package watcher

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// Watcher monitors ~/.claude/projects/ for .jsonl file changes
// and calls a handler after a debounce period.
type Watcher struct {
	fw       *fsnotify.Watcher
	rootDir  string
	handler  func()
	debounce time.Duration
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

// New creates a Watcher for the given claude directory.
// handler is called (debounced) when .jsonl files change.
// Returns nil if fsnotify initialization fails (graceful degradation).
func New(claudeDir string, handler func()) *Watcher {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("watcher: failed to create fsnotify watcher: %v (falling back to manual refresh)", err)
		return nil
	}

	return &Watcher{
		fw:       fw,
		rootDir:  filepath.Join(claudeDir, "projects"),
		handler:  handler,
		debounce: 1500 * time.Millisecond,
		stopCh:   make(chan struct{}),
	}
}

// Start begins watching. Call Stop() to clean up.
func (w *Watcher) Start() {
	// Add the root projects directory and all immediate subdirectories.
	// Windows fsnotify doesn't support recursive watching, so we add each project dir.
	w.addDir(w.rootDir)

	entries, err := os.ReadDir(w.rootDir)
	if err != nil {
		log.Printf("watcher: cannot read %s: %v", w.rootDir, err)
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			w.addDir(filepath.Join(w.rootDir, e.Name()))
		}
	}

	w.wg.Add(1)
	go w.loop()
}

// Stop shuts down the watcher.
func (w *Watcher) Stop() {
	close(w.stopCh)
	w.fw.Close()
	w.wg.Wait()
}

func (w *Watcher) addDir(dir string) {
	if err := w.fw.Add(dir); err != nil {
		log.Printf("watcher: cannot watch %s: %v", dir, err)
	}
}

func (w *Watcher) loop() {
	defer w.wg.Done()

	var timer *time.Timer
	var timerC <-chan time.Time

	for {
		select {
		case <-w.stopCh:
			if timer != nil {
				timer.Stop()
			}
			return

		case event, ok := <-w.fw.Events:
			if !ok {
				return
			}

			// Dynamically watch new project directories
			if event.Has(fsnotify.Create) {
				if info, err := os.Stat(event.Name); err == nil && info.IsDir() {
					w.addDir(event.Name)
				}
			}

			// Only care about .jsonl file changes
			if !strings.HasSuffix(event.Name, ".jsonl") {
				continue
			}

			// Reset debounce timer
			if timer == nil {
				timer = time.NewTimer(w.debounce)
				timerC = timer.C
			} else {
				timer.Reset(w.debounce)
			}

		case err, ok := <-w.fw.Errors:
			if !ok {
				return
			}
			log.Printf("watcher: error: %v", err)

		case <-timerC:
			// Debounce period elapsed — trigger handler
			timer = nil
			timerC = nil
			w.handler()
		}
	}
}
