package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"path"
	"strings"
)

//go:embed frontend/dist/*
//go:embed frontend/dist/assets/*
var frontendFS embed.FS

// distFS and fileServer are computed once at init to avoid re-creating the
// handler on every request.
var distFS fs.FS
var fileServer http.Handler

func init() {
	var err error
	distFS, err = fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		log.Fatalf("failed to create dist sub-filesystem: %v", err)
	}
	fileServer = http.FileServerFS(distFS)
}

func handleSPA(w http.ResponseWriter, r *http.Request) {
	// Strip leading slash
	urlPath := strings.TrimPrefix(r.URL.Path, "/")

	// Don't serve API routes here
	if strings.HasPrefix(urlPath, "api/") {
		http.NotFound(w, r)
		return
	}

	// Try to serve the exact file
	if urlPath == "" {
		urlPath = "index.html"
	}

	f, err := distFS.Open(urlPath)
	if err == nil {
		f.Close()
		fileServer.ServeHTTP(w, r)
		return
	}

	// SPA fallback: only for paths without a file extension
	ext := path.Ext(urlPath)
	if ext != "" {
		// Has extension but file not found → real 404
		http.NotFound(w, r)
		return
	}

	// No extension → serve index.html for client-side routing
	r.URL.Path = "/"
	fileServer.ServeHTTP(w, r)
}
