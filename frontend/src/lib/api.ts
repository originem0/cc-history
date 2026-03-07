import type { ProjectInfo, SessionSummary, Conversation, SearchResult } from '../types'

const BASE = '/api'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  getProjects(): Promise<ProjectInfo[]> {
    return fetchJSON(`${BASE}/projects`)
  },

  getSessions(projectId?: string): Promise<SessionSummary[]> {
    const params = projectId ? `?project=${encodeURIComponent(projectId)}` : ''
    return fetchJSON(`${BASE}/sessions${params}`)
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

  getTags(): Promise<string[]> {
    return fetchJSON(`${BASE}/tags`)
  },
}
