package config

// Config holds application configuration.
type Config struct {
	Port      int    `json:"port"`
	ClaudeDir string `json:"claudeDir"`
}

// Default returns a Config with sensible defaults.
func Default() Config {
	return Config{
		Port:      3456,
		ClaudeDir: "", // will be resolved at runtime
	}
}
