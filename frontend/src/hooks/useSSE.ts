import { useEffect } from 'react'

export function useSSE(onRefresh: () => void) {
  useEffect(() => {
    const es = new EventSource('/api/events')

    es.addEventListener('sessions_updated', () => {
      onRefresh()
    })

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here
    }

    return () => {
      es.close()
    }
  }, [onRefresh])
}
