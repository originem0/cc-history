package main

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed frontend/dist/*
var frontendFS embed.FS

func handleSPA(w http.ResponseWriter, r *http.Request) {
	// Strip leading slash
	urlPath := strings.TrimPrefix(r.URL.Path, "/")

	// Don't serve API routes here
	if strings.HasPrefix(urlPath, "api/") {
		http.NotFound(w, r)
		return
	}

	// Get the embedded filesystem rooted at frontend/dist
	distFS, err := fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Try to serve the exact file
	if urlPath == "" {
		urlPath = "index.html"
	}

	f, err := distFS.Open(urlPath)
	if err == nil {
		f.Close()
		http.FileServerFS(distFS).ServeHTTP(w, r)
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
	http.FileServerFS(distFS).ServeHTTP(w, r)
}
