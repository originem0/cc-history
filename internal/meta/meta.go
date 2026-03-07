package meta

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

// SessionMeta holds user-defined metadata for a session (stars, tags, custom title).
type SessionMeta struct {
	Starred   bool     `json:"starred,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	StarredAt string   `json:"starredAt,omitempty"`
	Title     string   `json:"title,omitempty"`
}

type fileData struct {
	Version  int                     `json:"version"`
	Sessions map[string]*SessionMeta `json:"sessions"`
}

// Store persists session metadata to ~/.claude/cc-history.json.
type Store struct {
	mu       sync.RWMutex
	filePath string
	data     fileData
}

func NewStore(claudeDir string) *Store {
	return &Store{
		filePath: filepath.Join(claudeDir, "cc-history.json"),
		data: fileData{
			Version:  1,
			Sessions: make(map[string]*SessionMeta),
		},
	}
}

// Load reads the metadata file. Missing or corrupt file is not an error —
// we start with empty data.
func (s *Store) Load() {
	s.mu.Lock()
	defer s.mu.Unlock()

	raw, err := os.ReadFile(s.filePath)
	if err != nil {
		// File doesn't exist yet — fine
		return
	}

	var d fileData
	if err := json.Unmarshal(raw, &d); err != nil {
		// Corrupt — start fresh
		return
	}
	if d.Sessions == nil {
		d.Sessions = make(map[string]*SessionMeta)
	}
	s.data = d
}

// save writes data atomically via temp file + rename.
func (s *Store) save() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}

	dir := filepath.Dir(s.filePath)
	tmp, err := os.CreateTemp(dir, "cc-history-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()

	if _, err := tmp.Write(raw); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return err
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return err
	}

	return os.Rename(tmpName, s.filePath)
}

// GetMeta returns metadata for a session. Returns nil if none exists.
func (s *Store) GetMeta(id string) *SessionMeta {
	s.mu.RLock()
	defer s.mu.RUnlock()
	m := s.data.Sessions[id]
	if m == nil {
		return &SessionMeta{}
	}
	// Return a copy
	cp := *m
	tags := make([]string, len(m.Tags))
	copy(tags, m.Tags)
	cp.Tags = tags
	return &cp
}

// SetStarred sets the starred state for a session.
func (s *Store) SetStarred(id string, starred bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	m := s.getOrCreate(id)
	m.Starred = starred
	if starred {
		m.StarredAt = time.Now().UTC().Format(time.RFC3339)
	} else {
		m.StarredAt = ""
	}

	// Clean up empty entries
	if !m.Starred && len(m.Tags) == 0 && m.Title == "" {
		delete(s.data.Sessions, id)
	}

	return s.save()
}

// SetTitle sets a custom title override for a session.
// Empty title removes the override, restoring the auto-extracted title.
func (s *Store) SetTitle(id, title string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	title = strings.TrimSpace(title)

	if title == "" {
		// Remove override — clean up entry if nothing else is set
		m, ok := s.data.Sessions[id]
		if !ok {
			return nil
		}
		m.Title = ""
		if !m.Starred && len(m.Tags) == 0 {
			delete(s.data.Sessions, id)
		}
		return s.save()
	}

	m := s.getOrCreate(id)
	m.Title = title
	return s.save()
}

// AddTag adds a tag to a session. No-op if already present.
func (s *Store) AddTag(id, tag string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	m := s.getOrCreate(id)
	for _, t := range m.Tags {
		if t == tag {
			return nil
		}
	}
	m.Tags = append(m.Tags, tag)
	return s.save()
}

// RemoveTag removes a tag from a session.
func (s *Store) RemoveTag(id, tag string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	m, ok := s.data.Sessions[id]
	if !ok {
		return nil
	}

	filtered := m.Tags[:0]
	for _, t := range m.Tags {
		if t != tag {
			filtered = append(filtered, t)
		}
	}
	m.Tags = filtered

	// Clean up empty entries
	if !m.Starred && len(m.Tags) == 0 && m.Title == "" {
		delete(s.data.Sessions, id)
	}

	return s.save()
}

// GetAllTags returns a deduplicated, sorted list of all tags in use.
func (s *Store) GetAllTags() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	seen := make(map[string]bool)
	for _, m := range s.data.Sessions {
		for _, t := range m.Tags {
			seen[t] = true
		}
	}

	tags := make([]string, 0, len(seen))
	for t := range seen {
		tags = append(tags, t)
	}
	sort.Strings(tags)
	return tags
}

func (s *Store) getOrCreate(id string) *SessionMeta {
	m, ok := s.data.Sessions[id]
	if !ok {
		m = &SessionMeta{}
		s.data.Sessions[id] = m
	}
	return m
}
