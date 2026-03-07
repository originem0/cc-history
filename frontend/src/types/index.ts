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
