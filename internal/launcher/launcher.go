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

	// Fallback to cmd.exe. Pass cwd via cmd.Dir (never interpolated into the
	// command line) and sessionID as a discrete arg. cmd's quoting rules differ
	// from Go's %q and don't escape & | ^ %, so the old fmt.Sprintf("cd /d %q ...")
	// was an injection vector for any cwd containing those characters.
	// The empty "" is start's mandatory window-title argument.
	cmd := exec.Command("cmd.exe", "/c", "start", "", "cmd", "/k", "claude", "--resume", sessionID)
	cmd.Dir = cwd
	return cmd.Start()
}
