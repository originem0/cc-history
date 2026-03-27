package store

import (
	"container/list"
	"fmt"
	"log"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"cc-history/internal/parser"
	"cc-history/internal/scanner"
)

// fileInfo tracks file metadata for incremental loading.
type fileInfo struct {
	modTime time.Time
	size    int64
}

// Store holds all session metadata in memory and provides an LRU cache
// for full conversation parsing.
type Store struct {
	mu       sync.RWMutex
	sessions map[string]*parser.SessionSummary // keyed by session ID
	projects map[string]*parser.ProjectInfo    // keyed by encoded dir name

	// fileInfos tracks file mtime+size for incremental loading.
	// Keyed by absolute file path.
	fileInfos map[string]fileInfo

	// fileToSession maps file path -> session ID for removal tracking.
	fileToSession map[string]string

	// cwdExists caches os.Stat results for session CWDs, populated during Load().
	cwdExists map[string]bool

	// version is incremented on every Load() for change detection.
	version atomic.Uint64

	// LRU conversation cache (capacity: 3)
	cacheMu   sync.Mutex
	cacheMap  map[string]*list.Element
	cacheList *list.List
	cacheCap  int

	claudeDir string
}

type cacheEntry struct {
	key  string
	conv *parser.Conversation
}

func New(claudeDir string) *Store {
	return &Store{
		sessions:      make(map[string]*parser.SessionSummary),
		projects:      make(map[string]*parser.ProjectInfo),
		fileInfos:     make(map[string]fileInfo),
		fileToSession: make(map[string]string),
		cwdExists:     make(map[string]bool),
		cacheMap:      make(map[string]*list.Element),
		cacheList:     list.New(),
		cacheCap:      3,
		claudeDir:     claudeDir,
	}
}

// Version returns the current data version, incremented on each Load().
func (s *Store) Version() uint64 {
	return s.version.Load()
}

// Load scans the claude projects directory and incrementally parses
// only changed or new session files. Removed files are cleaned up.
func (s *Store) Load() error {
	results, err := scanner.Scan(s.claudeDir)
	if err != nil {
		return fmt.Errorf("scanning projects: %w", err)
	}

	// Build a set of current file paths for detecting deletions
	currentFiles := make(map[string]scanner.Result, len(results))
	for _, r := range results {
		currentFiles[r.FilePath] = r
	}

	s.mu.Lock()

	// Remove sessions whose files no longer exist
	for filePath, sessID := range s.fileToSession {
		if _, exists := currentFiles[filePath]; !exists {
			if sess, ok := s.sessions[sessID]; ok {
				if proj, ok := s.projects[sess.ProjectID]; ok {
					proj.Sessions--
					if proj.Sessions <= 0 {
						delete(s.projects, sess.ProjectID)
					}
				}
				delete(s.sessions, sessID)
			}
			delete(s.fileInfos, filePath)
			delete(s.fileToSession, filePath)

			// Invalidate cache for removed session
			s.cacheMu.Lock()
			if elem, ok := s.cacheMap[sessID]; ok {
				s.cacheList.Remove(elem)
				delete(s.cacheMap, sessID)
			}
			s.cacheMu.Unlock()
		}
	}

	// Parse changed/new files
	for filePath, r := range currentFiles {
		fi, statErr := os.Stat(filePath)
		if statErr != nil {
			continue
		}

		// Check if file is unchanged
		prev, known := s.fileInfos[filePath]
		if known && prev.modTime.Equal(fi.ModTime()) && prev.size == fi.Size() {
			continue // unchanged — skip re-parse
		}

		// Parse the file
		s.mu.Unlock() // unlock during I/O-heavy parse
		summary, parseErr := parser.ParseSummary(filePath)
		s.mu.Lock()

		if parseErr != nil {
			log.Printf("skipping %s: %v", filePath, parseErr)
			continue
		}

		summary.ProjectID = r.ProjectID
		if summary.Project == "" {
			summary.Project = summary.CWD
		}

		// If this file previously mapped to a different session ID, clean up
		if oldID, ok := s.fileToSession[filePath]; ok && oldID != summary.ID {
			if oldSess, ok := s.sessions[oldID]; ok {
				if proj, ok := s.projects[oldSess.ProjectID]; ok {
					proj.Sessions--
					if proj.Sessions <= 0 {
						delete(s.projects, oldSess.ProjectID)
					}
				}
				delete(s.sessions, oldID)
			}
		}

		s.sessions[summary.ID] = summary
		s.fileInfos[filePath] = fileInfo{modTime: fi.ModTime(), size: fi.Size()}
		s.fileToSession[filePath] = summary.ID

		// Build project info
		if _, ok := s.projects[r.ProjectID]; !ok {
			s.projects[r.ProjectID] = &parser.ProjectInfo{
				Path:    summary.CWD,
				DirName: r.ProjectID,
			}
		}

		// Invalidate cache for changed session
		s.cacheMu.Lock()
		if elem, ok := s.cacheMap[summary.ID]; ok {
			s.cacheList.Remove(elem)
			delete(s.cacheMap, summary.ID)
		}
		s.cacheMu.Unlock()
	}

	// Rebuild project session counts
	projectCounts := make(map[string]int)
	for _, sess := range s.sessions {
		projectCounts[sess.ProjectID]++
	}
	for pid, proj := range s.projects {
		if count, ok := projectCounts[pid]; ok {
			proj.Sessions = count
		} else {
			delete(s.projects, pid)
		}
	}

	// Populate cwdExists cache
	cwdExists := make(map[string]bool, len(s.sessions))
	for _, sess := range s.sessions {
		if sess.CWD == "" {
			continue
		}
		// Avoid re-checking the same CWD path
		if _, checked := cwdExists[sess.CWD]; checked {
			continue
		}
		if info, err := os.Stat(sess.CWD); err == nil && info.IsDir() {
			cwdExists[sess.CWD] = true
		} else {
			cwdExists[sess.CWD] = false
		}
	}
	s.cwdExists = cwdExists

	s.mu.Unlock()

	s.version.Add(1)

	log.Printf("loaded %d sessions across %d projects", len(s.sessions), len(s.projects))
	return nil
}

// GetCWDExists returns whether a session's CWD directory exists,
// using the cache populated during Load().
func (s *Store) GetCWDExists(sessionID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[sessionID]
	if !ok || sess.CWD == "" {
		return false
	}
	return s.cwdExists[sess.CWD]
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

	result := make([]parser.SessionSummary, 0, len(s.sessions))
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

// GetSession returns a copy of a single session by ID.
func (s *Store) GetSession(id string) (*parser.SessionSummary, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[id]
	if !ok {
		return nil, false
	}
	cp := *sess
	return &cp, true
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

	// Clean up file tracking
	if sess.FilePath != "" {
		delete(s.fileInfos, sess.FilePath)
		delete(s.fileToSession, sess.FilePath)
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
