import type { ProjectInfo, SessionSummary, Conversation, SearchResult, SkillInfo, SkillDetail, CommandInfo, CommandDetail, MCPServer, PluginInfo } from '../types'

const BASE = '/api'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

// fetchJSONWithVersion returns both parsed data and the X-Data-Version header.
async function fetchJSONWithVersion<T>(url: string, init?: RequestInit): Promise<{ data: T; version: string | null }> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  const data: T = await res.json()
  const version = res.headers.get('X-Data-Version')
  return { data, version }
}

export const api = {
  getProjects(): Promise<{ data: ProjectInfo[]; version: string | null }> {
    return fetchJSONWithVersion(`${BASE}/projects`)
  },

  getSessions(projectId?: string): Promise<{ data: SessionSummary[]; version: string | null }> {
    const params = projectId ? `?project=${encodeURIComponent(projectId)}` : ''
    return fetchJSONWithVersion(`${BASE}/sessions${params}`)
  },

  getConversation(sessionId: string): Promise<Conversation> {
    return fetchJSON(`${BASE}/sessions/${sessionId}/conversation`)
  },

  search(query: string, limit = 50): Promise<SearchResult[]> {
    return fetchJSON(`${BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  },

  resumeSession(sessionId: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/sessions/${sessionId}/resume`, { method: 'POST' })
  },

  deleteSession(sessionId: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/sessions/${sessionId}`, { method: 'DELETE' })
  },

  async exportSession(sessionId: string): Promise<void> {
    const res = await fetch(`${BASE}/sessions/${sessionId}/export`)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || `Export failed: ${res.status}`)
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') || ''
    const starMatch = disposition.match(/filename\*=UTF-8''(.+)/)
    const plainMatch = disposition.match(/filename="(.+?)"/)
    let filename = 'export.md'
    if (starMatch) {
      filename = decodeURIComponent(starMatch[1])
    } else if (plainMatch) {
      filename = plainMatch[1]
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  reload(): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/reload`, { method: 'POST' })
  },

  toggleStar(sessionId: string, starred: boolean): Promise<{ starred: boolean }> {
    return fetchJSON(`${BASE}/meta/${sessionId}/star`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred }),
    })
  },

  addTag(sessionId: string, tag: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/meta/${sessionId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag }),
    })
  },

  removeTag(sessionId: string, tag: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/meta/${sessionId}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
    })
  },

  setTitle(sessionId: string, title: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/meta/${sessionId}/title`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
  },

  getTags(): Promise<string[]> {
    return fetchJSON(`${BASE}/tags`)
  },

  // --- Config: Skills ---

  listSkills(): Promise<SkillInfo[]> {
    return fetchJSON(`${BASE}/config/skills`)
  },

  getSkill(name: string): Promise<SkillDetail> {
    return fetchJSON(`${BASE}/config/skills/${encodeURIComponent(name)}`)
  },

  createSkill(name: string, content: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/config/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content }),
    })
  },

  updateSkill(name: string, content: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/config/skills/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  },

  deleteSkill(name: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/config/skills/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  },

  // --- Config: Commands ---

  listCommands(): Promise<CommandInfo[]> {
    return fetchJSON(`${BASE}/config/commands`)
  },

  getCommand(name: string): Promise<CommandDetail> {
    return fetchJSON(`${BASE}/config/commands/${encodeURIComponent(name)}`)
  },

  createCommand(name: string, content: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/config/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content }),
    })
  },

  updateCommand(name: string, content: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/config/commands/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  },

  deleteCommand(name: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/config/commands/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  },

  // --- Config: MCP Servers ---

  listMCPServers(): Promise<Record<string, MCPServer>> {
    return fetchJSON(`${BASE}/config/mcp`)
  },

  setMCPServer(name: string, server: MCPServer): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/config/mcp/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(server),
    })
  },

  deleteMCPServer(name: string): Promise<{ status: string }> {
    return fetchJSON(`${BASE}/config/mcp/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  },

  // --- Config: Plugins ---

  listPlugins(): Promise<PluginInfo[]> {
    return fetchJSON(`${BASE}/config/plugins`)
  },

  togglePlugin(key: string, enabled: boolean): Promise<{ enabled: boolean }> {
    return fetchJSON(`${BASE}/config/plugins/${encodeURIComponent(key)}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
  },
}
