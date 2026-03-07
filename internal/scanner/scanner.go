package scanner

import (
	"os"
	"path/filepath"
	"strings"
)

// Result holds a discovered JSONL session file and its project directory name.
type Result struct {
	FilePath  string // absolute path to .jsonl file
	ProjectID string // encoded directory name (e.g. "D--Development-Apps")
}

// Scan walks ~/.claude/projects/ and finds all session JSONL files.
// It skips subagents directories and non-JSONL files.
func Scan(claudeDir string) ([]Result, error) {
	projectsDir := filepath.Join(claudeDir, "projects")

	entries, err := os.ReadDir(projectsDir)
	if err != nil {
		return nil, err
	}

	var results []Result

	for _, projectEntry := range entries {
		if !projectEntry.IsDir() {
			continue
		}

		projectName := projectEntry.Name()
		projectPath := filepath.Join(projectsDir, projectName)

		files, err := os.ReadDir(projectPath)
		if err != nil {
			continue // skip unreadable directories
		}

		for _, f := range files {
			if f.IsDir() {
				continue // skip session subdirectories (subagents, etc.)
			}
			if !strings.HasSuffix(f.Name(), ".jsonl") {
				continue
			}

			results = append(results, Result{
				FilePath:  filepath.Join(projectPath, f.Name()),
				ProjectID: projectName,
			})
		}
	}

	return results, nil
}

// DefaultClaudeDir returns the default ~/.claude directory path.
func DefaultClaudeDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".claude")
}
