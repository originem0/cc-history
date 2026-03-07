package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"cc-history/internal/ccconfig"
	"cc-history/internal/launcher"
	"cc-history/internal/meta"
	"cc-history/internal/scanner"
	"cc-history/internal/store"
	"cc-history/internal/watcher"
)

var appStore *store.Store
var metaStore *meta.Store
var hub *sseHub
var claudeDir string

const maxBodySize = 2 * 1024 * 1024 // 2MB

// --- SSE Hub ---

type sseHub struct {
	mu      sync.Mutex
	clients map[chan string]struct{}
}

func newSSEHub() *sseHub {
	return &sseHub{clients: make(map[chan string]struct{})}
}

func (h *sseHub) subscribe() chan string {
	ch := make(chan string, 8)
	h.mu.Lock()
	h.clients[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *sseHub) unsubscribe(ch chan string) {
	h.mu.Lock()
	delete(h.clients, ch)
	h.mu.Unlock()
	close(ch)
}

func (h *sseHub) broadcast(event string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.clients {
		select {
		case ch <- event:
		default:
			// Drop if client is slow
		}
	}
}

func main() {
	claudeDir = scanner.DefaultClaudeDir()
	if claudeDir == "" {
		log.Fatal("cannot determine home directory")
	}

	appStore = store.New(claudeDir)
	if err := appStore.Load(); err != nil {
		log.Fatalf("failed to load sessions: %v", err)
	}

	metaStore = meta.NewStore(claudeDir)
	metaStore.Load()

	mux := http.NewServeMux()

	// API routes (Go 1.22+ pattern syntax)
	mux.HandleFunc("GET /api/projects", handleProjects)
	mux.HandleFunc("GET /api/sessions/{id}/conversation", handleConversation)
	mux.HandleFunc("GET /api/sessions/{id}/export", handleExport)
	mux.HandleFunc("GET /api/sessions", handleSessions)
	mux.HandleFunc("GET /api/search", handleSearch)
	mux.HandleFunc("POST /api/sessions/{id}/resume", handleResume)
	mux.HandleFunc("DELETE /api/sessions/{id}", handleDelete)
	mux.HandleFunc("POST /api/reload", handleReload)

	// Meta API (tags & starred)
	mux.HandleFunc("GET /api/meta/{id}", handleGetMeta)
	mux.HandleFunc("PUT /api/meta/{id}/star", handleSetStar)
	mux.HandleFunc("PUT /api/meta/{id}/title", handleSetTitle)
	mux.HandleFunc("POST /api/meta/{id}/tags", handleAddTag)
	mux.HandleFunc("DELETE /api/meta/{id}/tags/{tag}", handleRemoveTag)
	mux.HandleFunc("GET /api/tags", handleGetAllTags)

	// Config API (skills, commands, MCP, plugins)
	mux.HandleFunc("GET /api/config/skills", handleListSkills)
	mux.HandleFunc("GET /api/config/skills/{name}", handleGetSkill)
	mux.HandleFunc("POST /api/config/skills", handleCreateSkill)
	mux.HandleFunc("PUT /api/config/skills/{name}", handleUpdateSkill)
	mux.HandleFunc("DELETE /api/config/skills/{name}", handleDeleteSkill)

	mux.HandleFunc("GET /api/config/commands", handleListCommands)
	mux.HandleFunc("GET /api/config/commands/{name}", handleGetCommand)
	mux.HandleFunc("POST /api/config/commands", handleCreateCommand)
	mux.HandleFunc("PUT /api/config/commands/{name}", handleUpdateCommand)
	mux.HandleFunc("DELETE /api/config/commands/{name}", handleDeleteCommand)

	mux.HandleFunc("GET /api/config/mcp", handleListMCP)
	mux.HandleFunc("PUT /api/config/mcp/{name}", handleSetMCP)
	mux.HandleFunc("DELETE /api/config/mcp/{name}", handleDeleteMCP)

	mux.HandleFunc("GET /api/config/plugins", handleListPlugins)
	mux.HandleFunc("PUT /api/config/plugins/{key}/toggle", handleTogglePlugin)

	// SSE endpoint
	hub = newSSEHub()
	mux.HandleFunc("GET /api/events", handleSSE)

	// File watcher — reload store on .jsonl changes, then push SSE
	w := watcher.New(claudeDir, func() {
		log.Println("watcher: detected changes, reloading store")
		if err := appStore.Load(); err != nil {
			log.Printf("watcher: reload error: %v", err)
			return
		}
		hub.broadcast("sessions_updated")
	})
	if w != nil {
		w.Start()
	}

	// Static files / SPA fallback
	mux.HandleFunc("/", handleSPA)

	// Find available port and keep the listener open (avoids TOCTOU race)
	ln := findAvailableListener(3456)
	addr := ln.Addr().String()

	server := &http.Server{Handler: mux}

	log.Printf("starting server at http://%s", addr)

	// Auto-open browser
	go func() {
		time.Sleep(300 * time.Millisecond)
		openBrowser(fmt.Sprintf("http://%s", addr))
	}()

	// Graceful shutdown on SIGINT/SIGTERM
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	go func() {
		if err := server.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down...")

	shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.Shutdown(shutCtx)

	if w != nil {
		w.Stop()
	}
	metaStore.Flush()
	log.Println("shutdown complete")
}

func handleProjects(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, appStore.GetProjects())
}

// SessionResponse wraps SessionSummary with user metadata.
// Keeps parser.SessionSummary clean — meta is overlaid at the API layer.
type SessionResponse struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Project   string   `json:"project"`
	ProjectID string   `json:"projectId"`
	CWD       string   `json:"cwd"`
	Timestamp string   `json:"timestamp"`
	Messages  int      `json:"messages"`
	Starred   bool     `json:"starred"`
	Tags      []string `json:"tags"`
	CWDExists bool     `json:"cwdExists"`
}

func handleSessions(w http.ResponseWriter, r *http.Request) {
	project := r.URL.Query().Get("project")
	sessions := appStore.GetSessions(project)

	resp := make([]SessionResponse, len(sessions))
	for i, s := range sessions {
		m := metaStore.GetMeta(s.ID)
		tags := m.Tags
		if tags == nil {
			tags = []string{}
		}
		title := s.Title
		if m.Title != "" {
			title = m.Title
		}
		resp[i] = SessionResponse{
			ID:        s.ID,
			Title:     title,
			Project:   s.Project,
			ProjectID: s.ProjectID,
			CWD:       s.CWD,
			Timestamp: s.Timestamp.Format(time.RFC3339),
			Messages:  s.Messages,
			Starred:   m.Starred,
			Tags:      tags,
			CWDExists: appStore.GetCWDExists(s.ID),
		}
	}

	// Include data version header for efficient frontend change detection
	w.Header().Set("X-Data-Version", strconv.FormatUint(appStore.Version(), 10))
	writeJSON(w, resp)
}

func handleConversation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	conv, err := appStore.GetConversation(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, conv)
}

var unsafeFilenameRe = regexp.MustCompile(`[/\\:*?"<>|]`)

func handleExport(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	conv, err := appStore.GetConversation(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Determine title: prefer user meta title, then session auto-title
	title := "Untitled Session"
	if m := metaStore.GetMeta(id); m.Title != "" {
		title = m.Title
	} else if sess, ok := appStore.GetSession(id); ok && sess.Title != "" {
		title = sess.Title
	}

	// Build Markdown
	var sb strings.Builder
	sb.WriteString("# ")
	sb.WriteString(title)
	sb.WriteString("\n")

	// Scan all text content to find the longest backtick run,
	// then use N+1 backticks as the fence to avoid conflicts.
	maxBackticks := 3
	for _, msg := range conv.Messages {
		for _, block := range msg.Content {
			if block.Type == "text" {
				n := longestBacktickRun(block.Text)
				if n >= maxBackticks {
					maxBackticks = n + 1
				}
			}
		}
	}
	fence := strings.Repeat("`", maxBackticks)

	for _, msg := range conv.Messages {
		// Collect only text blocks
		var texts []string
		for _, block := range msg.Content {
			if block.Type == "text" && strings.TrimSpace(block.Text) != "" {
				texts = append(texts, block.Text)
			}
		}
		if len(texts) == 0 {
			continue
		}

		role := "User"
		if msg.Type == "assistant" {
			role = "Claude"
		}

		sb.WriteString("\n")
		sb.WriteString(fence)
		sb.WriteString("\n")
		sb.WriteString(role)
		sb.WriteString(":\n\n")
		sb.WriteString(strings.Join(texts, "\n\n"))
		sb.WriteString("\n")
		sb.WriteString(fence)
		sb.WriteString("\n")
	}

	// Sanitize filename
	safeName := unsafeFilenameRe.ReplaceAllString(title, "_")
	safeName = strings.TrimSpace(safeName)
	if len(safeName) > 80 {
		safeName = safeName[:80]
	}
	if safeName == "" {
		safeName = "export"
	}

	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf(`attachment; filename="export.md"; filename*=UTF-8''%s.md`,
			url.PathEscape(safeName)))
	w.Write([]byte(sb.String()))
}

// longestBacktickRun returns the length of the longest consecutive
// backtick sequence in s.
func longestBacktickRun(s string) int {
	max, cur := 0, 0
	for _, c := range s {
		if c == '`' {
			cur++
			if cur > max {
				max = cur
			}
		} else {
			cur = 0
		}
	}
	return max
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if n, err := strconv.Atoi(limitStr); err == nil && n > 0 {
			limit = n
		}
	}
	writeJSON(w, appStore.Search(query, limit))
}

func handleResume(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sess, ok := appStore.GetSession(id)
	if !ok {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	cwd := sess.CWD
	if cwd == "" {
		cwd = "."
	}

	// Check CWD exists before launching terminal
	if info, err := os.Stat(cwd); err != nil || !info.IsDir() {
		http.Error(w, fmt.Sprintf("working directory no longer exists: %s", cwd), http.StatusBadRequest)
		return
	}

	if err := launcher.Resume(id, cwd); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]string{"status": "ok"})
}

func handleDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sess, ok := appStore.GetSession(id)
	if !ok {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	// Soft delete: move JSONL file to trash directory
	trashDir := filepath.Join(claudeDir, "trash",
		fmt.Sprintf("%s_%s", time.Now().Format("20060102T150405"), id))

	if err := os.MkdirAll(trashDir, 0755); err != nil {
		http.Error(w, "failed to create trash directory", http.StatusInternalServerError)
		return
	}

	srcPath := sess.FilePath
	dstPath := filepath.Join(trashDir, filepath.Base(srcPath))

	if err := os.Rename(srcPath, dstPath); err != nil {
		log.Printf("delete: failed to move %s to %s: %v", srcPath, dstPath, err)
		http.Error(w, "failed to move file to trash", http.StatusInternalServerError)
		return
	}

	// Also move the session subdirectory if it exists
	sessionDir := strings.TrimSuffix(srcPath, ".jsonl")
	if info, err := os.Stat(sessionDir); err == nil && info.IsDir() {
		dstDir := filepath.Join(trashDir, filepath.Base(sessionDir))
		os.Rename(sessionDir, dstDir) // best effort
	}

	appStore.RemoveSession(id)
	writeJSON(w, map[string]string{"status": "deleted"})
}

func handleReload(w http.ResponseWriter, r *http.Request) {
	if err := appStore.Load(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "reloaded"})
}

// --- Meta API handlers ---

func handleGetMeta(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	writeJSON(w, metaStore.GetMeta(id))
}

func handleSetStar(w http.ResponseWriter, r *http.Request) {
	limitBody(w, r)
	id := r.PathValue("id")
	var body struct {
		Starred bool `json:"starred"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := metaStore.SetStarred(id, body.Starred); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]bool{"starred": body.Starred})
}

func handleSetTitle(w http.ResponseWriter, r *http.Request) {
	limitBody(w, r)
	id := r.PathValue("id")
	var body struct {
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := metaStore.SetTitle(id, body.Title); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "ok"})
}

func handleAddTag(w http.ResponseWriter, r *http.Request) {
	limitBody(w, r)
	id := r.PathValue("id")
	var body struct {
		Tag string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Tag == "" {
		http.Error(w, "invalid JSON or empty tag", http.StatusBadRequest)
		return
	}
	if err := metaStore.AddTag(id, body.Tag); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "ok"})
}

func handleRemoveTag(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tag := r.PathValue("tag")
	if err := metaStore.RemoveTag(id, tag); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "ok"})
}

func handleGetAllTags(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, metaStore.GetAllTags())
}

// --- Config API handlers ---

func handleListSkills(w http.ResponseWriter, r *http.Request) {
	skills, err := ccconfig.ListSkills(claudeDir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, skills)
}

func handleGetSkill(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	skill, err := ccconfig.GetSkill(claudeDir, name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, skill)
}

func handleCreateSkill(w http.ResponseWriter, r *http.Request) {
	limitBody(w, r)
	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		http.Error(w, "invalid JSON or empty name", http.StatusBadRequest)
		return
	}
	if err := ccconfig.CreateSkill(claudeDir, body.Name, body.Content); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "created"})
}

func handleUpdateSkill(w http.ResponseWriter, r *http.Request) {
	limitBody(w, r)
	name := r.PathValue("name")
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := ccconfig.UpdateSkill(claudeDir, name, body.Content); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]string{"status": "updated"})
}

func handleDeleteSkill(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if err := ccconfig.DeleteSkill(claudeDir, name); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func handleListCommands(w http.ResponseWriter, r *http.Request) {
	commands, err := ccconfig.ListCommands(claudeDir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, commands)
}

func handleGetCommand(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	cmd, err := ccconfig.GetCommand(claudeDir, name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, cmd)
}

func handleCreateCommand(w http.ResponseWriter, r *http.Request) {
	limitBody(w, r)
	var body struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		http.Error(w, "invalid JSON or empty name", http.StatusBadRequest)
		return
	}
	if err := ccconfig.CreateCommand(claudeDir, body.Name, body.Content); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "created"})
}

func handleUpdateCommand(w http.ResponseWriter, r *http.Request) {
	limitBody(w, r)
	name := r.PathValue("name")
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := ccconfig.UpdateCommand(claudeDir, name, body.Content); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]string{"status": "updated"})
}

func handleDeleteCommand(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if err := ccconfig.DeleteCommand(claudeDir, name); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func handleListMCP(w http.ResponseWriter, r *http.Request) {
	servers, err := ccconfig.ListMCPServers(claudeDir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, servers)
}

func handleSetMCP(w http.ResponseWriter, r *http.Request) {
	limitBody(w, r)
	name := r.PathValue("name")
	var server ccconfig.MCPServer
	if err := json.NewDecoder(r.Body).Decode(&server); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := ccconfig.SetMCPServer(claudeDir, name, server); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]string{"status": "ok"})
}

func handleDeleteMCP(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if err := ccconfig.DeleteMCPServer(claudeDir, name); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]string{"status": "deleted"})
}

func handleListPlugins(w http.ResponseWriter, r *http.Request) {
	plugins, err := ccconfig.ListPlugins(claudeDir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, plugins)
}

func handleTogglePlugin(w http.ResponseWriter, r *http.Request) {
	limitBody(w, r)
	key := r.PathValue("key")
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := ccconfig.TogglePlugin(claudeDir, key, body.Enabled); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]bool{"enabled": body.Enabled})
}

func handleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := hub.subscribe()
	defer hub.unsubscribe(ch)

	// Send initial connection confirmation
	fmt.Fprintf(w, "event: connected\ndata: ok\n\n")
	flusher.Flush()

	// Heartbeat keeps the connection alive through proxies/load balancers
	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case event, ok := <-ch:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: %s\ndata: {}\n\n", event)
			flusher.Flush()
		case <-heartbeat.C:
			fmt.Fprintf(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

// limitBody caps the request body size to prevent abuse.
func limitBody(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodySize)
}

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("json encode error: %v", err)
	}
}

// findAvailableListener tries ports starting from base, up to base+10.
// Returns the open listener directly, avoiding a TOCTOU race where another
// process could grab the port between Listen and Serve.
func findAvailableListener(base int) net.Listener {
	for port := base; port <= base+10; port++ {
		addr := fmt.Sprintf("127.0.0.1:%d", port)
		ln, err := net.Listen("tcp", addr)
		if err == nil {
			return ln
		}
	}
	// Fallback: let it fail with a clear error
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", base))
	if err != nil {
		log.Fatalf("could not find available port: %v", err)
	}
	return ln
}

// openBrowser opens the default browser on Windows.
func openBrowser(url string) {
	cmd := exec.Command("cmd", "/c", "start", url)
	if err := cmd.Start(); err != nil {
		log.Printf("failed to open browser: %v", err)
		return
	}
	// Reap the child process to avoid zombie/leaked handles
	go cmd.Wait()
}
