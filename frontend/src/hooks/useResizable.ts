import { useState, useCallback, useEffect, useRef } from 'react'

interface UseResizableOptions {
  initialWidth: number
  minWidth: number
  maxWidth: number
  storageKey: string
}

export function useResizable({ initialWidth, minWidth, maxWidth, storageKey }: UseResizableOptions) {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) return parsed
    }
    return initialWidth
  })

  const dragging = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      const clamped = Math.min(maxWidth, Math.max(minWidth, ev.clientX))
      setWidth(clamped)
    }

    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [minWidth, maxWidth])

  // Persist width to localStorage on change (debounced via ref to avoid thrashing)
  useEffect(() => {
    localStorage.setItem(storageKey, String(width))
  }, [width, storageKey])

  return { width, handleMouseDown }
}
