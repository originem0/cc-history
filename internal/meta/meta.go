package meta

import (
	"encoding/json"
	"log"
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
// Writes are debounced: mutations mark the store dirty and schedule a
// save after 500ms. If another mutation arrives in that window the timer
// resets, batching rapid-fire changes into a single disk write.
type Store struct {
	mu       sync.RWMutex
	filePath string
	data     fileData

	// Debounced write coordination
	dirty    bool
	timer    *time.Timer
	saveMu   sync.Mutex // serializes actual disk writes
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

// scheduleSave marks the store dirty and schedules a debounced save.
// Must be called while s.mu is held (write-locked).
func (s *Store) scheduleSave() {
	s.dirty = true
	if s.timer != nil {
		s.timer.Stop()
	}
	s.timer = time.AfterFunc(500*time.Millisecond, func() {
		s.doSave()
	})
}

// doSave performs the actual disk write if dirty.
func (s *Store) doSave() {
	s.saveMu.Lock()
	defer s.saveMu.Unlock()

	s.mu.Lock()
	if !s.dirty {
		s.mu.Unlock()
		return
	}
	s.dirty = false
	raw, err := json.MarshalIndent(s.data, "", "  ")
	s.mu.Unlock()

	if err != nil {
		log.Printf("meta: marshal error: %v", err)
		return
	}

	dir := filepath.Dir(s.filePath)
	tmp, err := os.CreateTemp(dir, "cc-history-*.tmp")
	if err != nil {
		log.Printf("meta: create temp error: %v", err)
		return
	}
	tmpName := tmp.Name()

	if _, err := tmp.Write(raw); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		log.Printf("meta: write error: %v", err)
		return
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		log.Printf("meta: close error: %v", err)
		return
	}

	if err := os.Rename(tmpName, s.filePath); err != nil {
		os.Remove(tmpName)
		log.Printf("meta: rename error: %v", err)
	}
}

// Flush forces any pending debounced write to disk immediately.
// Call during graceful shutdown.
func (s *Store) Flush() {
	s.mu.Lock()
	if s.timer != nil {
		s.timer.Stop()
		s.timer = nil
	}
	s.mu.Unlock()

	s.doSave()
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

	s.scheduleSave()
	return nil
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
		s.scheduleSave()
		return nil
	}

	m := s.getOrCreate(id)
	m.Title = title
	s.scheduleSave()
	return nil
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
	s.scheduleSave()
	return nil
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

	s.scheduleSave()
	return nil
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
