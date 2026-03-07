import { useState, useEffect, useCallback } from 'react'
import type { SessionSummary } from '../types'

interface UseKeyboardNavOptions {
  sessions: SessionSummary[]
  onSelect: (session: SessionSummary) => void
}

export function useKeyboardNav({ sessions, onSelect }: UseKeyboardNavOptions) {
  const [focusedId, setFocusedId] = useState<string | null>(null)

  // Reset focus when the session list changes identity
  useEffect(() => {
    setFocusedId(null)
  }, [sessions])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't interfere with input/textarea
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (sessions.length === 0) return

      const currentIndex = focusedId
        ? sessions.findIndex(s => s.id === focusedId)
        : -1

      let nextIndex: number
      if (e.key === 'ArrowDown') {
        nextIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : 0
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : sessions.length - 1
      }

      const nextSession = sessions[nextIndex]
      setFocusedId(nextSession.id)

      // Auto-scroll into view
      const el = document.querySelector(`[data-session-id="${nextSession.id}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }

    if (e.key === 'Enter' && focusedId) {
      e.preventDefault()
      const session = sessions.find(s => s.id === focusedId)
      if (session) {
        onSelect(session)
      }
    }
  }, [sessions, focusedId, onSelect])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { focusedId, setFocusedId }
}
