package store

import (
	"container/list"
	"fmt"
	"log"
	"sort"
	"sync"

	"cc-history/internal/parser"
	"cc-history/internal/scanner"
)

// Store holds all session metadata in memory and provides an LRU cache
// for full conversation parsing.
type Store struct {
	mu       sync.RWMutex
	sessions map[string]*parser.SessionSummary // keyed by session ID
	projects map[string]*parser.ProjectInfo    // keyed by encoded dir name

	// LRU conversation cache (capacity: 3)
	cacheMu  sync.Mutex
	cacheMap map[string]*list.Element
	cacheList *list.List
	cacheCap int

	claudeDir string
}

type cacheEntry struct {
	key  string
	conv *parser.Conversation
}

func New(claudeDir string) *Store {
	return &Store{
		sessions:  make(map[string]*parser.SessionSummary),
		projects:  make(map[string]*parser.ProjectInfo),
		cacheMap:  make(map[string]*list.Element),
		cacheList: list.New(),
		cacheCap:  3,
		claudeDir: claudeDir,
	}
}

// Load scans the claude projects directory and parses all session summaries.
func (s *Store) Load() error {
	results, err := scanner.Scan(s.claudeDir)
	if err != nil {
		return fmt.Errorf("scanning projects: %w", err)
	}

	sessions := make(map[string]*parser.SessionSummary)
	projects := make(map[string]*parser.ProjectInfo)

	for _, r := range results {
		summary, err := parser.ParseSummary(r.FilePath)
		if err != nil {
			log.Printf("skipping %s: %v", r.FilePath, err)
			continue
		}

		summary.ProjectID = r.ProjectID
		if summary.Project == "" {
			summary.Project = summary.CWD
		}

		sessions[summary.ID] = summary

		// Build project info
		if _, ok := projects[r.ProjectID]; !ok {
			projects[r.ProjectID] = &parser.ProjectInfo{
				Path:    summary.CWD,
				DirName: r.ProjectID,
			}
		}
		projects[r.ProjectID].Sessions++
	}

	s.mu.Lock()
	s.sessions = sessions
	s.projects = projects
	// Invalidate LRU cache — old entries may reference stale file paths
	s.cacheMu.Lock()
	s.cacheMap = make(map[string]*list.Element)
	s.cacheList.Init()
	s.cacheMu.Unlock()
	s.mu.Unlock()

	log.Printf("loaded %d sessions across %d projects", len(sessions), len(projects))
	return nil
}

// GetProjects returns all projects sorted by path.
func (s *Store) GetProjects() []parser.ProjectInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]parser.ProjectInfo, 0, len(s.projects))
	for _, p := range s.projects {
		result = append(result, *p)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Path < result[j].Path
	})
	return result
}

// GetSessions returns sessions, optionally filtered by project directory name.
// Sorted by timestamp descending (most recent first).
func (s *Store) GetSessions(projectID string) []parser.SessionSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []parser.SessionSummary
	for _, sess := range s.sessions {
		if projectID != "" && sess.ProjectID != projectID {
			continue
		}
		result = append(result, *sess)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Timestamp.After(result[j].Timestamp)
	})
	return result
}

// GetSession returns a single session by ID.
func (s *Store) GetSession(id string) (*parser.SessionSummary, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[id]
	return sess, ok
}

// GetConversation returns the full parsed conversation for a session,
// using an LRU cache to avoid re-parsing recent sessions.
func (s *Store) GetConversation(sessionID string) (*parser.Conversation, error) {
	// Check cache
	s.cacheMu.Lock()
	if elem, ok := s.cacheMap[sessionID]; ok {
		s.cacheList.MoveToFront(elem)
		conv := elem.Value.(*cacheEntry).conv
		s.cacheMu.Unlock()
		return conv, nil
	}
	s.cacheMu.Unlock()

	// Find the session to get file path
	s.mu.RLock()
	sess, ok := s.sessions[sessionID]
	s.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}

	// Parse the conversation
	conv, err := parser.ParseConversation(sess.FilePath)
	if err != nil {
		return nil, err
	}

	// Put in cache
	s.cacheMu.Lock()
	if elem, ok := s.cacheMap[sessionID]; ok {
		s.cacheList.MoveToFront(elem)
		elem.Value.(*cacheEntry).conv = conv
	} else {
		entry := &cacheEntry{key: sessionID, conv: conv}
		elem := s.cacheList.PushFront(entry)
		s.cacheMap[sessionID] = elem

		// Evict if over capacity
		for s.cacheList.Len() > s.cacheCap {
			oldest := s.cacheList.Back()
			if oldest != nil {
				s.cacheList.Remove(oldest)
				delete(s.cacheMap, oldest.Value.(*cacheEntry).key)
			}
		}
	}
	s.cacheMu.Unlock()

	return conv, nil
}

// RemoveSession removes a session from the in-memory store.
func (s *Store) RemoveSession(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sess, ok := s.sessions[id]
	if !ok {
		return
	}

	// Decrement project count
	if proj, ok := s.projects[sess.ProjectID]; ok {
		proj.Sessions--
		if proj.Sessions <= 0 {
			delete(s.projects, sess.ProjectID)
		}
	}

	delete(s.sessions, id)

	// Also evict from conversation cache
	s.cacheMu.Lock()
	if elem, ok := s.cacheMap[id]; ok {
		s.cacheList.Remove(elem)
		delete(s.cacheMap, id)
	}
	s.cacheMu.Unlock()
}
