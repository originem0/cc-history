import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import type { ProjectInfo, SessionSummary } from '../types'

export function useSessions() {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, s] = await Promise.all([
        api.getProjects(),
        api.getSessions(),
      ])
      setProjects(p)
      setSessions(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const reload = useCallback(async () => {
    await api.reload()
    await load()
  }, [load])

  // Re-fetch sessions without triggering backend reload
  // (used by SSE — the watcher already reloaded the store)
  const refresh = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        api.getProjects(),
        api.getSessions(),
      ])
      setProjects(p)
      setSessions(s)
    } catch {
      // silent — SSE refresh is best-effort
    }
  }, [])

  const removeSession = useCallback((id: string) => {
    // Use functional updates to avoid stale closure over `sessions`
    setSessions(prev => prev.filter(s => s.id !== id))
    setProjects(prev => {
      // Recount using the filtered sessions
      return prev.map(p => {
        // We need current sessions minus the removed one
        const count = sessions.filter(s => s.projectId === p.dirName && s.id !== id).length
        return { ...p, sessions: count }
      }).filter(p => p.sessions > 0)
    })
  }, [sessions])

  return { projects, sessions, setSessions, loading, error, reload, refresh, removeSession }
}
