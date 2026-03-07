package parser

import "time"

// SessionSummary is the lightweight metadata extracted from a JSONL file
// without parsing the full conversation.
type SessionSummary struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Project   string    `json:"project"`   // decoded cwd path
	ProjectID string    `json:"projectId"` // encoded directory name
	FilePath  string    `json:"-"`         // absolute path to .jsonl file
	CWD       string    `json:"cwd"`
	Timestamp time.Time `json:"timestamp"`
	Messages  int       `json:"messages"` // count of user+assistant messages
	// SearchText is a pre-extracted plaintext blob for full-text search.
	SearchText string `json:"-"`
}

// ProjectInfo groups sessions by project directory.
type ProjectInfo struct {
	Path     string `json:"path"`     // decoded cwd path (e.g. D:\Development\Apps)
	DirName  string `json:"dirName"`  // encoded directory name
	Sessions int    `json:"sessions"` // count of sessions in this project
}

// Conversation is the full parsed dialog for a session.
type Conversation struct {
	SessionID string    `json:"sessionId"`
	Messages  []Message `json:"messages"`
}

// Message represents a single turn in the conversation.
type Message struct {
	Type      string         `json:"type"` // user, assistant, system
	Timestamp time.Time      `json:"timestamp"`
	Content   []ContentBlock `json:"content"`
}

// ContentBlock is a unified representation of message content.
// Claude Code messages can have string content or an array of typed blocks.
type ContentBlock struct {
	Type string `json:"type"` // text, tool_use, tool_result, thinking
	Text string `json:"text,omitempty"`
	// For tool_use blocks
	ToolName string `json:"toolName,omitempty"`
	ToolID   string `json:"toolId,omitempty"`
	Input    string `json:"input,omitempty"` // JSON string of tool input
	// For tool_result blocks
	IsError bool `json:"isError,omitempty"`
}
