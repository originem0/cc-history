package launcher

import (
	"fmt"
	"os/exec"
	"runtime"
)

// Resume opens a terminal window and runs `claude --resume <sessionID>`.
// On Windows: tries wt.exe first, falls back to cmd.exe.
func Resume(sessionID, cwd string) error {
	if runtime.GOOS != "windows" {
		return fmt.Errorf("resume is only supported on Windows")
	}

	// Try Windows Terminal first
	wtPath, err := exec.LookPath("wt.exe")
	if err == nil && wtPath != "" {
		cmd := exec.Command("wt.exe", "-d", cwd, "cmd", "/k", "claude", "--resume", sessionID)
		return cmd.Start()
	}

	// Fallback to cmd.exe
	cmd := exec.Command("cmd.exe", "/c", "start", "cmd", "/k",
		fmt.Sprintf("cd /d %q && claude --resume %s", cwd, sessionID))
	return cmd.Start()
}
