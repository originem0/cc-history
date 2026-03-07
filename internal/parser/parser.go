package parser

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"
)

// rawLine is the intermediate structure for each JSONL line.
type rawLine struct {
	Type      string          `json:"type"`
	SessionID string          `json:"sessionId"`
	CWD       string          `json:"cwd"`
	Timestamp string          `json:"timestamp"`
	UUID      string          `json:"uuid"`
	Message   json.RawMessage `json:"message"`
}

// rawMessage extracts the role and content from a message field.
type rawMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

// ParseSummary reads a JSONL file and extracts session summary metadata.
// It only scans enough lines to get the title, cwd, timestamp, and message count.
// Tolerant: skips lines that fail to parse.
func ParseSummary(filePath string) (*SessionSummary, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	s := &SessionSummary{
		FilePath: filePath,
	}

	var (
		firstTimestamp time.Time
		lastTimestamp  time.Time
		msgCount       int
		searchParts    []string
		searchLen      int // track total search text length
	)
	const maxSearchLen = 50000 // cap search text at 50KB per session

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 10*1024*1024) // up to 10MB per line

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var raw rawLine
		if err := json.Unmarshal(line, &raw); err != nil {
			continue // skip corrupted lines
		}

		// Extract session ID and cwd from any line that has them
		if s.ID == "" && raw.SessionID != "" {
			s.ID = raw.SessionID
		}
		if s.CWD == "" && raw.CWD != "" {
			s.CWD = raw.CWD
		}

		// Parse timestamp
		if raw.Timestamp != "" {
			if t, err := time.Parse(time.RFC3339Nano, raw.Timestamp); err == nil {
				if firstTimestamp.IsZero() {
					firstTimestamp = t
				}
				lastTimestamp = t
			}
		}

		// Only process user and assistant messages for title/count/search
		if raw.Type != "user" && raw.Type != "assistant" {
			continue
		}

		msgCount++

		// Extract text content for search and title
		text := extractText(raw.Message)
		if text != "" && searchLen < maxSearchLen {
			searchParts = append(searchParts, text)
			searchLen += len(text)
		}

		// Title: first user message that's not a meta command
		if s.Title == "" && raw.Type == "user" && text != "" {
			title := extractTitle(text)
			if title != "" {
				s.Title = title
			}
		}
	}

	if s.ID == "" {
		return nil, fmt.Errorf("no session ID found in %s", filePath)
	}

	s.Messages = msgCount
	s.Timestamp = lastTimestamp
	if s.Timestamp.IsZero() {
		s.Timestamp = firstTimestamp
	}
	s.SearchText = strings.Join(searchParts, " ")

	if s.Title == "" {
		s.Title = "Untitled Session"
	}

	return s, nil
}

// ParseConversation reads a JSONL file and returns the full conversation.
func ParseConversation(filePath string) (*Conversation, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	conv := &Conversation{}
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), 10*1024*1024)

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var raw rawLine
		if err := json.Unmarshal(line, &raw); err != nil {
			continue
		}

		if conv.SessionID == "" && raw.SessionID != "" {
			conv.SessionID = raw.SessionID
		}

		// Only include user and assistant messages in conversation view
		if raw.Type != "user" && raw.Type != "assistant" {
			continue
		}

		var ts time.Time
		if raw.Timestamp != "" {
			ts, _ = time.Parse(time.RFC3339Nano, raw.Timestamp)
		}

		blocks := parseContentBlocks(raw.Message)

		conv.Messages = append(conv.Messages, Message{
			Type:      raw.Type,
			Timestamp: ts,
			Content:   blocks,
		})
	}

	return conv, nil
}

// parseContentBlocks extracts ContentBlock array from a raw message JSON.
func parseContentBlocks(msgRaw json.RawMessage) []ContentBlock {
	if len(msgRaw) == 0 {
		return nil
	}

	var msg rawMessage
	if err := json.Unmarshal(msgRaw, &msg); err != nil {
		return nil
	}

	if len(msg.Content) == 0 {
		return nil
	}

	// Content can be a string or an array of blocks
	// Try string first
	var strContent string
	if err := json.Unmarshal(msg.Content, &strContent); err == nil {
		if strContent != "" {
			return []ContentBlock{{Type: "text", Text: strContent}}
		}
		return nil
	}

	// Try array of blocks
	var rawBlocks []json.RawMessage
	if err := json.Unmarshal(msg.Content, &rawBlocks); err != nil {
		return nil
	}

	var blocks []ContentBlock
	for _, rb := range rawBlocks {
		var block struct {
			Type    string          `json:"type"`
			Text    string          `json:"text"`
			Name    string          `json:"name"`
			ID      string          `json:"id"`
			Input   json.RawMessage `json:"input"`
			Content json.RawMessage `json:"content"`
			IsError bool            `json:"is_error"`
		}
		if err := json.Unmarshal(rb, &block); err != nil {
			continue
		}

		cb := ContentBlock{Type: block.Type}

		switch block.Type {
		case "text":
			cb.Text = block.Text
		case "thinking":
			cb.Text = block.Text
		case "tool_use":
			cb.ToolName = block.Name
			cb.ToolID = block.ID
			if len(block.Input) > 0 {
				cb.Input = string(block.Input)
			}
		case "tool_result":
			cb.ToolID = block.ID
			cb.IsError = block.IsError
			// tool_result content can be string or array
			if len(block.Content) > 0 {
				var s string
				if err := json.Unmarshal(block.Content, &s); err == nil {
					cb.Text = s
				} else {
					// Array of content blocks in tool result
					var parts []struct {
						Type string `json:"type"`
						Text string `json:"text"`
					}
					if err := json.Unmarshal(block.Content, &parts); err == nil {
						var texts []string
						for _, p := range parts {
							if p.Text != "" {
								texts = append(texts, p.Text)
							}
						}
						cb.Text = strings.Join(texts, "\n")
					}
				}
			}
		default:
			cb.Text = block.Text
		}

		blocks = append(blocks, cb)
	}

	return blocks
}

// extractText pulls plaintext from a message's raw JSON for search indexing.
func extractText(msgRaw json.RawMessage) string {
	if len(msgRaw) == 0 {
		return ""
	}

	var msg rawMessage
	if err := json.Unmarshal(msgRaw, &msg); err != nil {
		return ""
	}

	if len(msg.Content) == 0 {
		return ""
	}

	// Try string
	var s string
	if err := json.Unmarshal(msg.Content, &s); err == nil {
		return s
	}

	// Try array
	var blocks []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(msg.Content, &blocks); err != nil {
		return ""
	}

	var parts []string
	for _, b := range blocks {
		if b.Text != "" {
			parts = append(parts, b.Text)
		}
	}
	return strings.Join(parts, " ")
}

// extractTitle gets a clean title from the first user message.
// Skips /clear commands, XML-heavy messages, and truncates to reasonable length.
func extractTitle(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}

	// Skip meta commands
	if strings.HasPrefix(text, "/clear") || strings.HasPrefix(text, "/") {
		return ""
	}

	// Skip if mostly XML tags (system prompts, etc.)
	if strings.Count(text, "<") > 5 && strings.Count(text, "<") > len(text)/20 {
		return ""
	}

	// Skip command wrapper messages
	if strings.HasPrefix(text, "<command-message>") ||
		strings.HasPrefix(text, "<local-command-caveat>") ||
		strings.HasPrefix(text, "<command-name>") {
		return ""
	}

	// For "Implement the following plan:" messages, extract the plan title
	// (typically the first # heading in the plan content)
	if strings.HasPrefix(text, "Implement the following plan:") {
		if idx := strings.Index(text, "# "); idx != -1 {
			lineEnd := strings.IndexAny(text[idx:], "\n\r")
			if lineEnd > 0 {
				title := strings.TrimPrefix(text[idx:idx+lineEnd], "# ")
				title = strings.TrimSpace(title)
				if title != "" {
					return title
				}
			}
		}
	}

	// Take first line only
	if idx := strings.IndexAny(text, "\n\r"); idx > 0 {
		text = text[:idx]
	}

	// Truncate to 100 chars
	text = strings.TrimSpace(text)
	if len(text) > 100 {
		text = text[:100] + "..."
	}

	return text
}
