package store

import (
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"cc-history/internal/parser"
)

// SearchResult represents a single search hit.
type SearchResult struct {
	SessionID string `json:"sessionId"`
	Title     string `json:"title"`
	Project   string `json:"project"`
	Snippet   string `json:"snippet"` // context around the match
	Timestamp string `json:"timestamp"`
	timestamp time.Time // unexported, for sorting
}

// Search performs full-text search across all sessions.
// Uses strings.Contains for both Chinese and English text.
// Returns up to `limit` results.
func (s *Store) Search(query string, limit int) []SearchResult {
	if query == "" {
		return []SearchResult{}
	}
	if limit <= 0 {
		limit = 50
	}

	// Also search case-insensitively for English text
	queryLower := strings.ToLower(query)

	s.mu.RLock()
	defer s.mu.RUnlock()

	results := make([]SearchResult, 0)

	for _, sess := range s.sessions {
		if len(results) >= limit {
			break
		}

		matched, snippet := matchSession(sess, query, queryLower)
		if matched {
			results = append(results, SearchResult{
				SessionID: sess.ID,
				Title:     sess.Title,
				Project:   sess.Project,
				Snippet:   snippet,
				Timestamp: sess.Timestamp.Format("2006-01-02 15:04"),
				timestamp: sess.Timestamp,
			})
		}
	}

	// Sort by timestamp descending (most recent first)
	sort.Slice(results, func(i, j int) bool {
		return results[i].timestamp.After(results[j].timestamp)
	})

	return results
}

// matchSession checks if a session matches the search query.
// Returns whether it matches and a context snippet.
func matchSession(sess *parser.SessionSummary, query, queryLower string) (bool, string) {
	// Check title first (exact match for Chinese, case-insensitive for English)
	if strings.Contains(sess.Title, query) || strings.Contains(strings.ToLower(sess.Title), queryLower) {
		return true, sess.Title
	}

	// Check search text
	searchText := sess.SearchText
	idx := strings.Index(searchText, query)
	if idx == -1 {
		idx = strings.Index(strings.ToLower(searchText), queryLower)
		if idx == -1 {
			return false, ""
		}
	}

	// Extract snippet with rune-safe boundaries.
	// Instead of converting the whole text to runes, we step backwards/forwards
	// by runes around the match position.
	snippetStart := idx
	for i := 0; i < 40 && snippetStart > 0; i++ {
		_, size := utf8.DecodeLastRuneInString(searchText[:snippetStart])
		snippetStart -= size
	}

	snippetEnd := idx + len(query)
	for i := 0; i < 40 && snippetEnd < len(searchText); i++ {
		_, size := utf8.DecodeRuneInString(searchText[snippetEnd:])
		snippetEnd += size
	}

	snippet := searchText[snippetStart:snippetEnd]
	// Clean up: replace newlines with spaces
	snippet = strings.ReplaceAll(snippet, "\n", " ")
	snippet = strings.ReplaceAll(snippet, "\r", "")

	if snippetStart > 0 {
		snippet = "..." + snippet
	}
	if snippetEnd < len(searchText) {
		snippet = snippet + "..."
	}

	return true, snippet
}
