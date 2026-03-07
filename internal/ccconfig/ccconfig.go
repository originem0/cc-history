package ccconfig

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// --- Data Types ---

type SkillInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	DirName     string `json:"dirName"`
	HasExtras   bool   `json:"hasExtras"`
}

type SkillDetail struct {
	SkillInfo
	Content string `json:"content"`
}

type CommandInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	FileName    string `json:"fileName"`
	IsDir       bool   `json:"isDir"`
}

type CommandDetail struct {
	CommandInfo
	Content string `json:"content"`
}

type MCPServer struct {
	Type    string            `json:"type"`
	Command string           `json:"command,omitempty"`
	Args    []string          `json:"args,omitempty"`
	URL     string            `json:"url,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
}

type PluginInfo struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Marketplace string `json:"marketplace"`
	Version     string `json:"version"`
	Enabled     bool   `json:"enabled"`
	InstalledAt string `json:"installedAt"`
}

// --- Validation ---

// validateName rejects path traversal attempts.
func validateName(name string) error {
	if name == "" {
		return fmt.Errorf("name cannot be empty")
	}
	if strings.Contains(name, "..") || strings.Contains(name, "/") || strings.Contains(name, "\\") {
		return fmt.Errorf("invalid name: must not contain '..', '/' or '\\'")
	}
	return nil
}

// --- Frontmatter parsing ---

// parseFrontmatter extracts YAML frontmatter fields from markdown content.
// Returns a map of key-value pairs and the body after the frontmatter.
func parseFrontmatter(content string) (map[string]string, string) {
	fields := make(map[string]string)
	lines := strings.Split(content, "\n")

	if len(lines) == 0 || strings.TrimSpace(lines[0]) != "---" {
		return fields, content
	}

	endIdx := -1
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			endIdx = i
			break
		}
	}
	if endIdx < 0 {
		return fields, content
	}

	// Parse key-value pairs, handling YAML folded (>) and literal (|) scalars
	fmLines := lines[1:endIdx]
	for i := 0; i < len(fmLines); i++ {
		line := fmLines[i]
		idx := strings.Index(line, ":")
		if idx < 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])

		// Handle multi-line YAML scalars (> or |)
		if val == ">" || val == "|" {
			var parts []string
			for i+1 < len(fmLines) {
				next := fmLines[i+1]
				// Continuation lines are indented (start with spaces)
				if len(next) > 0 && (next[0] == ' ' || next[0] == '\t') {
					parts = append(parts, strings.TrimSpace(next))
					i++
				} else {
					break
				}
			}
			val = strings.Join(parts, " ")
		} else {
			// Strip surrounding quotes
			val = strings.Trim(val, "\"'")
		}

		fields[key] = val
	}

	body := strings.Join(lines[endIdx+1:], "\n")
	return fields, body
}

// --- Skills ---

func ListSkills(claudeDir string) ([]SkillInfo, error) {
	skillsDir := filepath.Join(claudeDir, "skills")
	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []SkillInfo{}, nil
		}
		return nil, err
	}

	var skills []SkillInfo
	for _, e := range entries {
		// Follow symlinks: DirEntry.IsDir() returns false for symlinks,
		// so we os.Stat the resolved path instead.
		entryPath := filepath.Join(skillsDir, e.Name())
		fi, err := os.Stat(entryPath)
		if err != nil || !fi.IsDir() {
			continue
		}
		dirName := e.Name()
		si := SkillInfo{
			Name:    dirName,
			DirName: dirName,
		}

		// Try reading SKILL.md (case-insensitive)
		mdPath := findSkillMD(filepath.Join(skillsDir, dirName))
		if mdPath != "" {
			data, err := os.ReadFile(mdPath)
			if err == nil {
				fm, _ := parseFrontmatter(string(data))
				if v, ok := fm["name"]; ok && v != "" {
					si.Name = v
				}
				if v, ok := fm["description"]; ok {
					si.Description = v
				}
			}
		}

		// Check for extras (directories other than the skill md)
		subEntries, _ := os.ReadDir(entryPath)
		for _, se := range subEntries {
			if se.IsDir() {
				si.HasExtras = true
				break
			}
		}

		skills = append(skills, si)
	}

	if skills == nil {
		skills = []SkillInfo{}
	}
	return skills, nil
}

// findSkillMD finds the skill markdown file regardless of case.
func findSkillMD(dir string) string {
	candidates := []string{"SKILL.md", "skill.md", "Skill.md"}
	for _, c := range candidates {
		p := filepath.Join(dir, c)
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

func GetSkill(claudeDir, name string) (*SkillDetail, error) {
	if err := validateName(name); err != nil {
		return nil, err
	}

	dir := filepath.Join(claudeDir, "skills", name)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil, fmt.Errorf("skill not found: %s", name)
	}

	detail := &SkillDetail{
		SkillInfo: SkillInfo{
			Name:    name,
			DirName: name,
		},
	}

	mdPath := findSkillMD(dir)
	if mdPath != "" {
		data, err := os.ReadFile(mdPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read skill file: %w", err)
		}
		detail.Content = string(data)
		fm, _ := parseFrontmatter(detail.Content)
		if v, ok := fm["name"]; ok && v != "" {
			detail.Name = v
		}
		if v, ok := fm["description"]; ok {
			detail.Description = v
		}
	}

	subEntries, _ := os.ReadDir(dir)
	for _, se := range subEntries {
		if se.IsDir() {
			detail.HasExtras = true
			break
		}
	}

	return detail, nil
}

func CreateSkill(claudeDir, name, content string) error {
	if err := validateName(name); err != nil {
		return err
	}

	dir := filepath.Join(claudeDir, "skills", name)
	if _, err := os.Stat(dir); err == nil {
		return fmt.Errorf("skill already exists: %s", name)
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create skill directory: %w", err)
	}

	mdPath := filepath.Join(dir, "SKILL.md")
	if err := os.WriteFile(mdPath, []byte(content), 0644); err != nil {
		os.RemoveAll(dir) // cleanup on failure
		return fmt.Errorf("failed to write SKILL.md: %w", err)
	}

	return nil
}

func UpdateSkill(claudeDir, name, content string) error {
	if err := validateName(name); err != nil {
		return err
	}

	dir := filepath.Join(claudeDir, "skills", name)
	mdPath := findSkillMD(dir)
	if mdPath == "" {
		// If the directory exists but no md file, create SKILL.md
		if _, err := os.Stat(dir); os.IsNotExist(err) {
			return fmt.Errorf("skill not found: %s", name)
		}
		mdPath = filepath.Join(dir, "SKILL.md")
	}

	return os.WriteFile(mdPath, []byte(content), 0644)
}

func DeleteSkill(claudeDir, name string) error {
	if err := validateName(name); err != nil {
		return err
	}

	dir := filepath.Join(claudeDir, "skills", name)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return fmt.Errorf("skill not found: %s", name)
	}

	return os.RemoveAll(dir)
}

// --- Commands ---

func ListCommands(claudeDir string) ([]CommandInfo, error) {
	cmdsDir := filepath.Join(claudeDir, "commands")
	entries, err := os.ReadDir(cmdsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []CommandInfo{}, nil
		}
		return nil, err
	}

	var commands []CommandInfo
	for _, e := range entries {
		entryPath := filepath.Join(cmdsDir, e.Name())
		fi, err := os.Stat(entryPath) // follow symlinks
		if err != nil {
			continue
		}

		if fi.IsDir() {
			// Sub-directory command — skip if empty
			sub, _ := os.ReadDir(entryPath)
			hasMD := false
			for _, se := range sub {
				if strings.HasSuffix(se.Name(), ".md") {
					hasMD = true
					break
				}
			}
			if !hasMD {
				continue
			}
			info := CommandInfo{
				Name:     e.Name(),
				FileName: e.Name(),
				IsDir:    true,
			}
			commands = append(commands, info)
			continue
		}

		if !strings.HasSuffix(e.Name(), ".md") {
			continue
		}

		name := strings.TrimSuffix(e.Name(), ".md")
		info := CommandInfo{
			Name:     name,
			FileName: e.Name(),
		}

		// Read frontmatter for description
		data, err := os.ReadFile(filepath.Join(cmdsDir, e.Name()))
		if err == nil {
			fm, _ := parseFrontmatter(string(data))
			if v, ok := fm["description"]; ok {
				info.Description = v
			}
			if v, ok := fm["name"]; ok && v != "" {
				info.Name = v
			}
		}

		commands = append(commands, info)
	}

	if commands == nil {
		commands = []CommandInfo{}
	}
	return commands, nil
}

func GetCommand(claudeDir, name string) (*CommandDetail, error) {
	if err := validateName(name); err != nil {
		return nil, err
	}

	cmdsDir := filepath.Join(claudeDir, "commands")

	// Try as .md file first
	mdPath := filepath.Join(cmdsDir, name+".md")
	if info, err := os.Stat(mdPath); err == nil && !info.IsDir() {
		data, err := os.ReadFile(mdPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read command: %w", err)
		}
		detail := &CommandDetail{
			CommandInfo: CommandInfo{
				Name:     name,
				FileName: name + ".md",
			},
			Content: string(data),
		}
		fm, _ := parseFrontmatter(detail.Content)
		if v, ok := fm["description"]; ok {
			detail.Description = v
		}
		if v, ok := fm["name"]; ok && v != "" {
			detail.Name = v
		}
		return detail, nil
	}

	// Try as directory
	dirPath := filepath.Join(cmdsDir, name)
	if info, err := os.Stat(dirPath); err == nil && info.IsDir() {
		detail := &CommandDetail{
			CommandInfo: CommandInfo{
				Name:     name,
				FileName: name,
				IsDir:    true,
			},
		}
		// Read all .md files in the directory
		var parts []string
		entries, _ := os.ReadDir(dirPath)
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
				continue
			}
			data, err := os.ReadFile(filepath.Join(dirPath, e.Name()))
			if err == nil {
				parts = append(parts, fmt.Sprintf("# %s\n\n%s", e.Name(), string(data)))
			}
		}
		detail.Content = strings.Join(parts, "\n\n---\n\n")
		return detail, nil
	}

	return nil, fmt.Errorf("command not found: %s", name)
}

func CreateCommand(claudeDir, name, content string) error {
	if err := validateName(name); err != nil {
		return err
	}

	cmdsDir := filepath.Join(claudeDir, "commands")
	if err := os.MkdirAll(cmdsDir, 0755); err != nil {
		return fmt.Errorf("failed to create commands directory: %w", err)
	}

	mdPath := filepath.Join(cmdsDir, name+".md")
	if _, err := os.Stat(mdPath); err == nil {
		return fmt.Errorf("command already exists: %s", name)
	}

	return os.WriteFile(mdPath, []byte(content), 0644)
}

func UpdateCommand(claudeDir, name, content string) error {
	if err := validateName(name); err != nil {
		return err
	}

	mdPath := filepath.Join(claudeDir, "commands", name+".md")
	if _, err := os.Stat(mdPath); os.IsNotExist(err) {
		return fmt.Errorf("command not found: %s", name)
	}

	return os.WriteFile(mdPath, []byte(content), 0644)
}

func DeleteCommand(claudeDir, name string) error {
	if err := validateName(name); err != nil {
		return err
	}

	cmdsDir := filepath.Join(claudeDir, "commands")

	// Try .md file
	mdPath := filepath.Join(cmdsDir, name+".md")
	if _, err := os.Stat(mdPath); err == nil {
		return os.Remove(mdPath)
	}

	// Try directory
	dirPath := filepath.Join(cmdsDir, name)
	if info, err := os.Stat(dirPath); err == nil && info.IsDir() {
		return os.RemoveAll(dirPath)
	}

	return fmt.Errorf("command not found: %s", name)
}

// --- MCP Servers ---

// readSettings reads and parses settings.json, returning the raw map.
func readSettings(claudeDir string) (map[string]interface{}, error) {
	path := filepath.Join(claudeDir, "settings.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return make(map[string]interface{}), nil
		}
		return nil, err
	}

	var settings map[string]interface{}
	if err := json.Unmarshal(data, &settings); err != nil {
		return nil, fmt.Errorf("failed to parse settings.json: %w", err)
	}
	return settings, nil
}

// writeSettings writes settings map back to settings.json atomically.
func writeSettings(claudeDir string, settings map[string]interface{}) error {
	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	path := filepath.Join(claudeDir, "settings.json")
	tmpPath := path + ".tmp"

	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}

	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("failed to rename temp file: %w", err)
	}

	return nil
}

func ListMCPServers(claudeDir string) (map[string]MCPServer, error) {
	settings, err := readSettings(claudeDir)
	if err != nil {
		return nil, err
	}

	result := make(map[string]MCPServer)

	mcpRaw, ok := settings["mcpServers"]
	if !ok {
		return result, nil
	}

	mcpMap, ok := mcpRaw.(map[string]interface{})
	if !ok {
		return result, nil
	}

	for name, val := range mcpMap {
		serverMap, ok := val.(map[string]interface{})
		if !ok {
			continue
		}

		server := MCPServer{}
		if v, ok := serverMap["type"].(string); ok {
			server.Type = v
		}
		if v, ok := serverMap["command"].(string); ok {
			server.Command = v
		}
		if v, ok := serverMap["url"].(string); ok {
			server.URL = v
		}
		if args, ok := serverMap["args"].([]interface{}); ok {
			for _, a := range args {
				if s, ok := a.(string); ok {
					server.Args = append(server.Args, s)
				}
			}
		}
		if envRaw, ok := serverMap["env"].(map[string]interface{}); ok {
			server.Env = make(map[string]string)
			for k, v := range envRaw {
				if s, ok := v.(string); ok {
					server.Env[k] = s
				}
			}
		}

		result[name] = server
	}

	return result, nil
}

func SetMCPServer(claudeDir, name string, server MCPServer) error {
	if err := validateName(name); err != nil {
		return err
	}

	settings, err := readSettings(claudeDir)
	if err != nil {
		return err
	}

	mcpMap, ok := settings["mcpServers"].(map[string]interface{})
	if !ok {
		mcpMap = make(map[string]interface{})
	}

	// Convert server struct to map for JSON
	serverMap := map[string]interface{}{
		"type": server.Type,
	}
	if server.Command != "" {
		serverMap["command"] = server.Command
	}
	if len(server.Args) > 0 {
		serverMap["args"] = server.Args
	}
	if server.URL != "" {
		serverMap["url"] = server.URL
	}
	if len(server.Env) > 0 {
		serverMap["env"] = server.Env
	}

	mcpMap[name] = serverMap
	settings["mcpServers"] = mcpMap

	return writeSettings(claudeDir, settings)
}

func DeleteMCPServer(claudeDir, name string) error {
	if err := validateName(name); err != nil {
		return err
	}

	settings, err := readSettings(claudeDir)
	if err != nil {
		return err
	}

	mcpMap, ok := settings["mcpServers"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("no MCP servers configured")
	}

	if _, exists := mcpMap[name]; !exists {
		return fmt.Errorf("MCP server not found: %s", name)
	}

	delete(mcpMap, name)
	settings["mcpServers"] = mcpMap

	return writeSettings(claudeDir, settings)
}

// --- Plugins ---

// installedPluginsFile matches the actual format of installed_plugins.json:
//
//	{ "version": 2, "plugins": { "key@marketplace": [{ scope, installPath, version, installedAt, ... }] } }
type installedPluginsFile struct {
	Version int                                     `json:"version"`
	Plugins map[string][]installedPluginEntry        `json:"plugins"`
}

type installedPluginEntry struct {
	Scope       string `json:"scope"`
	InstallPath string `json:"installPath"`
	Version     string `json:"version"`
	InstalledAt string `json:"installedAt"`
}

func ListPlugins(claudeDir string) ([]PluginInfo, error) {
	pluginsPath := filepath.Join(claudeDir, "plugins", "installed_plugins.json")
	data, err := os.ReadFile(pluginsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []PluginInfo{}, nil
		}
		return nil, err
	}

	var file installedPluginsFile
	if err := json.Unmarshal(data, &file); err != nil {
		return nil, fmt.Errorf("failed to parse installed_plugins.json: %w", err)
	}

	// enabledPlugins in settings.json is { "key": bool }
	enabledMap := make(map[string]bool)
	settings, err := readSettings(claudeDir)
	if err == nil {
		if ep, ok := settings["enabledPlugins"].(map[string]interface{}); ok {
			for k, v := range ep {
				if b, ok := v.(bool); ok {
					enabledMap[k] = b
				}
			}
		}
	}

	var plugins []PluginInfo
	for key, entries := range file.Plugins {
		if len(entries) == 0 {
			continue
		}
		// Use the first (usually only) entry
		entry := entries[0]

		// Parse "name@marketplace" from key
		parts := strings.SplitN(key, "@", 2)
		name := parts[0]
		marketplace := ""
		if len(parts) == 2 {
			marketplace = parts[1]
		}

		// Check enabled status: if key exists in enabledMap use that value,
		// otherwise default to false
		enabled := enabledMap[key]

		plugins = append(plugins, PluginInfo{
			Key:         key,
			Name:        name,
			Marketplace: marketplace,
			Version:     entry.Version,
			Enabled:     enabled,
			InstalledAt: entry.InstalledAt,
		})
	}

	if plugins == nil {
		plugins = []PluginInfo{}
	}
	return plugins, nil
}

func TogglePlugin(claudeDir, pluginKey string, enabled bool) error {
	settings, err := readSettings(claudeDir)
	if err != nil {
		return err
	}

	// enabledPlugins is { "key": bool }
	epMap, ok := settings["enabledPlugins"].(map[string]interface{})
	if !ok {
		epMap = make(map[string]interface{})
	}

	epMap[pluginKey] = enabled
	settings["enabledPlugins"] = epMap

	return writeSettings(claudeDir, settings)
}
