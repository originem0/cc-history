import { useState, useEffect, useCallback, useMemo } from 'react'
import { Sidebar, type SidebarTab } from './components/layout/Sidebar'
import { Header } from './components/search/SearchHeader'
import { ConversationView } from './components/conversation/ConversationView'
import { useSessions } from './hooks/useSessions'
import { useConversation } from './hooks/useConversation'
import { useSearch } from './hooks/useSearch'
import { useSSE } from './hooks/useSSE'
import { useKeyboardNav } from './hooks/useKeyboardNav'
import { useResizable } from './hooks/useResizable'
import { api } from './lib/api'
import type { SessionSummary } from './types'

function App() {
  const { projects, sessions, setSessions, loading, reload, refresh, removeSession } = useSessions()
  const { conversation, loading: convLoading, error: convError, loadConversation } = useConversation()
  const { results: searchResults, loading: searchLoading, query, search, clearSearch } = useSearch()

  // SSE: auto-refresh when backend detects file changes
  useSSE(refresh)

  // Resizable sidebar
  const { width: sidebarWidth, handleMouseDown: handleSidebarResize } = useResizable({
    initialWidth: 280,
    minWidth: 200,
    maxWidth: 500,
    storageKey: 'cc-history-sidebar-width',
  })

  const [selectedSession, setSelectedSession] = useState<SessionSummary | null>(null)
  const [reloading, setReloading] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ type: 'resume' | 'delete'; session: SessionSummary } | null>(null)

  // Sidebar tab — persisted to localStorage
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(() => {
    return (localStorage.getItem('cc-history-sidebar-tab') as SidebarTab) || 'projects'
  })

  const handleTabChange = useCallback((tab: SidebarTab) => {
    setSidebarTab(tab)
    localStorage.setItem('cc-history-sidebar-tab', tab)
  }, [])

  // Compute visible sessions for keyboard nav based on current tab
  const visibleSessions = useMemo((): SessionSummary[] => {
    if (sidebarTab === 'timeline') return sessions
    if (sidebarTab === 'starred') return sessions.filter(s => s.starred)
    // Projects tab: all sessions (keyboard nav traverses them in display order)
    return sessions
  }, [sidebarTab, sessions])

  // Keyboard navigation
  const { focusedId, setFocusedId } = useKeyboardNav({
    sessions: visibleSessions,
    onSelect: (session) => {
      setSelectedSession(session)
      loadConversation(session.id)
      localStorage.setItem('cc-history-last-session', session.id)
    },
  })

  // Reset focus when tab changes
  useEffect(() => {
    setFocusedId(null)
  }, [sidebarTab, setFocusedId])

  // Restore last selected session from localStorage
  useEffect(() => {
    if (!loading && sessions.length > 0) {
      const lastId = localStorage.getItem('cc-history-last-session')
      if (lastId) {
        const found = sessions.find(s => s.id === lastId)
        if (found) {
          setSelectedSession(found)
          loadConversation(found.id)
        }
      }
    }
  }, [loading, sessions, loadConversation])

  const handleSelectSession = useCallback((session: SessionSummary) => {
    setSelectedSession(session)
    loadConversation(session.id)
    localStorage.setItem('cc-history-last-session', session.id)
  }, [loadConversation])

  const handleSearchSelect = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (session) {
      handleSelectSession(session)
    }
  }, [sessions, handleSelectSession])

  const handleReload = useCallback(async () => {
    setReloading(true)
    await reload()
    setReloading(false)
  }, [reload])

  const handleResume = useCallback(async () => {
    if (!selectedSession) return
    setConfirmAction({ type: 'resume', session: selectedSession })
  }, [selectedSession])

  const handleDelete = useCallback(async () => {
    if (!selectedSession) return
    setConfirmAction({ type: 'delete', session: selectedSession })
  }, [selectedSession])

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return
    const { type, session } = confirmAction
    setConfirmAction(null)

    try {
      if (type === 'resume') {
        await api.resumeSession(session.id)
      } else {
        await api.deleteSession(session.id)
        removeSession(session.id)
        if (selectedSession?.id === session.id) {
          setSelectedSession(null)
        }
      }
    } catch (e) {
      alert(`Failed to ${type}: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }, [confirmAction, removeSession, selectedSession])

  // Optimistic star toggle
  const handleToggleStar = useCallback(async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    const newStarred = !session.starred

    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, starred: newStarred } : s
    ))
    if (selectedSession?.id === sessionId) {
      setSelectedSession(prev => prev ? { ...prev, starred: newStarred } : prev)
    }

    try {
      await api.toggleStar(sessionId, newStarred)
    } catch {
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, starred: !newStarred } : s
      ))
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, starred: !newStarred } : prev)
      }
    }
  }, [sessions, selectedSession, setSessions])

  const handleAddTag = useCallback(async (sessionId: string, tag: string) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, tags: [...s.tags, tag] } : s
    ))
    if (selectedSession?.id === sessionId) {
      setSelectedSession(prev => prev ? { ...prev, tags: [...prev.tags, tag] } : prev)
    }

    try {
      await api.addTag(sessionId, tag)
    } catch {
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, tags: s.tags.filter(t => t !== tag) } : s
      ))
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, tags: prev.tags.filter(t => t !== tag) } : prev)
      }
    }
  }, [selectedSession, setSessions])

  const handleRemoveTag = useCallback(async (sessionId: string, tag: string) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, tags: s.tags.filter(t => t !== tag) } : s
    ))
    if (selectedSession?.id === sessionId) {
      setSelectedSession(prev => prev ? { ...prev, tags: prev.tags.filter(t => t !== tag) } : prev)
    }

    try {
      await api.removeTag(sessionId, tag)
    } catch {
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, tags: [...s.tags, tag] } : s
      ))
      if (selectedSession?.id === sessionId) {
        setSelectedSession(prev => prev ? { ...prev, tags: [...prev.tags, tag] } : prev)
      }
    }
  }, [selectedSession, setSessions])

  // Ctrl+K shortcut for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('input[type="text"]')
        input?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-base">
      {/* Top search bar */}
      <Header
        query={query}
        onSearch={search}
        searchResults={searchResults}
        searchLoading={searchLoading}
        onSelectResult={handleSearchSelect}
        onClearSearch={clearSearch}
        onReload={handleReload}
        reloading={reloading}
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          projects={projects}
          sessions={sessions}
          selectedId={selectedSession?.id || null}
          focusedId={focusedId}
          activeTab={sidebarTab}
          onTabChange={handleTabChange}
          onSelect={handleSelectSession}
          onToggleStar={handleToggleStar}
          loading={loading}
          width={sidebarWidth}
          onResizeStart={handleSidebarResize}
        />
        <ConversationView
          conversation={conversation}
          session={selectedSession}
          loading={convLoading}
          error={convError}
          onResume={handleResume}
          onDelete={handleDelete}
          onToggleStar={handleToggleStar}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
        />
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-overlay border border-subtle rounded-2xl shadow-elevated p-6 max-w-sm mx-4 animate-slide-down">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                confirmAction.type === 'delete' ? 'bg-red-500/15' : 'bg-accent/15'
              }`}>
                {confirmAction.type === 'delete' ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-red-500">
                    <path d="M5.5 2V1h5v1m-8 1h11M6 6v6m4-6v6M3.5 4l.75 9.5a1.5 1.5 0 0 0 1.5 1.5h4.5a1.5 1.5 0 0 0 1.5-1.5L12.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-accent">
                    <path d="M4 2.5v11l9-5.5L4 2.5Z" fill="currentColor"/>
                  </svg>
                )}
              </div>
              <h3 className="text-base font-semibold text-text-primary">
                {confirmAction.type === 'resume' ? 'Resume Session' : 'Delete Session'}
              </h3>
            </div>

            <p className="text-sm text-text-secondary mb-3 leading-relaxed">
              {confirmAction.type === 'resume'
                ? 'This will open a new terminal window with this session.'
                : 'This will move the session to trash. You can restore it later from ~/.claude/trash/.'}
            </p>

            <div className="px-3 py-2 bg-surface rounded-lg border border-subtle mb-5">
              <p className="text-xs text-text-tertiary font-mono truncate" title={confirmAction.session.title}>
                {confirmAction.session.title}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-black/[0.04] rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
                  confirmAction.type === 'delete'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-accent hover:bg-amber-600'
                }`}
              >
                {confirmAction.type === 'resume' ? 'Resume' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
