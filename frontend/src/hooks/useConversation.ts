import { useState, useCallback } from 'react'
import { api } from '../lib/api'
import type { Conversation } from '../types'

export function useConversation() {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadConversation = useCallback(async (sessionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const conv = await api.getConversation(sessionId)
      setConversation(conv)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversation')
      setConversation(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setConversation(null)
    setError(null)
  }, [])

  return { conversation, loading, error, loadConversation, clear }
}
