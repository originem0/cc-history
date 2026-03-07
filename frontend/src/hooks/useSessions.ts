import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import type { ProjectInfo, SessionSummary } from '../types'

export function useSessions() {
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  // initialLoading is true only during the first fetch, not SSE refreshes
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track data version from backend to skip redundant state updates
  const lastVersionRef = useRef<string | null>(null)

  // Refs for diffing in refresh() without needing them as deps
  const projectsRef = useRef(projects)
  projectsRef.current = projects
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  const load = useCallback(async () => {
    setInitialLoading(true)
    setError(null)
    try {
      const [p, s] = await Promise.all([
        api.getProjects(),
        api.getSessions(),
      ])
      setProjects(p.data)
      setSessions(s.data)
      if (s.version) lastVersionRef.current = s.version
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const reload = useCallback(async () => {
    await api.reload()
    await load()
  }, [load])

  // Re-fetch sessions without triggering backend reload.
  // Used by SSE — the watcher already reloaded the store.
  // Uses X-Data-Version header for efficient change detection.
  const refresh = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        api.getProjects(),
        api.getSessions(),
      ])

      // If backend provides a version header, use it for comparison
      if (s.version && s.version === lastVersionRef.current) {
        return // data unchanged, skip state updates entirely
      }
      if (s.version) lastVersionRef.current = s.version

      setProjects(p.data)
      setSessions(s.data)
    } catch {
      // silent — SSE refresh is best-effort
    }
  }, [])

  const removeSession = useCallback((id: string) => {
    // Use functional updates to avoid stale closure over `sessions`
    setSessions(prev => prev.filter(s => s.id !== id))
    setProjects(prev => {
      // Use ref to get current sessions, then exclude the removed one
      const currentSessions = sessionsRef.current
      return prev.map(p => {
        const count = currentSessions.filter(
          s => s.projectId === p.dirName && s.id !== id
        ).length
        return { ...p, sessions: count }
      }).filter(p => p.sessions > 0)
    })
  }, [])

  return { projects, sessions, setSessions, loading: initialLoading, error, reload, refresh, removeSession }
}
