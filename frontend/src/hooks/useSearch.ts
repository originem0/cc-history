import { useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import type { SearchResult } from '../types'

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const search = useCallback((q: string) => {
    setQuery(q)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!q.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.search(q.trim())
        setResults(data || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
  }, [])

  return { results, loading, query, search, clearSearch }
}
