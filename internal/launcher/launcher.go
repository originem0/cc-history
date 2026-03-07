package launcher

import (
	"fmt"
	"os/exec"
	"regexp"
	"runtime"
)

// sessionIDRe validates session IDs as UUID hex patterns (with hyphens).
var sessionIDRe = regexp.MustCompile(`^[a-f0-9][a-f0-9-]+[a-f0-9]$`)

// Resume opens a terminal window and runs `claude --resume <sessionID>`.
// On Windows: tries wt.exe first, falls back to cmd.exe.
func Resume(sessionID, cwd string) error {
	if !sessionIDRe.MatchString(sessionID) {
		return fmt.Errorf("invalid session ID: %q", sessionID)
	}

	if runtime.GOOS != "windows" {
		return fmt.Errorf("resume is only supported on Windows")
	}

	// Try Windows Terminal first
	wtPath, err := exec.LookPath("wt.exe")
	if err == nil && wtPath != "" {
		cmd := exec.Command("wt.exe", "-d", cwd, "cmd", "/k", "claude", "--resume", sessionID)
		return cmd.Start()
	}

	// Fallback to cmd.exe — quote sessionID to prevent injection
	cmd := exec.Command("cmd.exe", "/c", "start", "cmd", "/k",
		fmt.Sprintf("cd /d %q && claude --resume %q", cwd, sessionID))
	return cmd.Start()
}
