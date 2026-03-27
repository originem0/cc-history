export interface ProjectInfo {
  path: string
  dirName: string
  sessions: number
}

export interface SessionSummary {
  id: string
  title: string
  project: string
  projectId: string
  cwd: string
  timestamp: string
  messages: number
  starred: boolean
  tags: string[]
  cwdExists: boolean
}

export interface Conversation {
  sessionId: string
  messages: ConversationMessage[]
}

export interface ConversationMessage {
  type: 'user' | 'assistant'
  timestamp: string
  content: ContentBlock[]
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking'
  text?: string
  toolName?: string
  toolId?: string
  input?: string
  isError?: boolean
}

export interface SearchResult {
  sessionId: string
  title: string
  project: string
  snippet: string
  timestamp: string
}

// --- Config types ---

export interface SkillInfo {
  name: string
  description: string
  dirName: string
  hasExtras: boolean
}

export interface SkillDetail extends SkillInfo {
  content: string
}

export interface CommandInfo {
  name: string
  description: string
  fileName: string
  isDir: boolean
}

export interface CommandDetail extends CommandInfo {
  content: string
}

export interface MCPServer {
  type: string
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
}

export interface PluginInfo {
  key: string
  name: string
  marketplace: string
  version: string
  enabled: boolean
  installedAt: string
}
