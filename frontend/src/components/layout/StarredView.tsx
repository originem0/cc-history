import type { SessionSummary } from '../../types'
import { SessionItem } from './SessionItem'

interface StarredViewProps {
  sessions: SessionSummary[]
  selectedId: string | null
  focusedId: string | null
  onSelect: (session: SessionSummary) => void
  onToggleStar: (sessionId: string) => void
}

export function StarredView({ sessions, selectedId, focusedId, onSelect, onToggleStar }: StarredViewProps) {
  const starred = sessions.filter(s => s.starred)

  if (starred.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-tertiary">
        <svg width="24" height="24" viewBox="0 0 16 16" fill="none" className="opacity-30">
          <path
            d="M8 1.5l1.85 3.75L14 5.9l-3 2.92.71 4.13L8 10.88l-3.71 2.07.71-4.13-3-2.92 4.15-.65L8 1.5z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[11px]">No starred sessions</span>
      </div>
    )
  }

  return (
    <div className="py-1">
      {starred.map(session => (
        <SessionItem
          key={session.id}
          session={session}
          isSelected={selectedId === session.id}
          isFocused={focusedId === session.id}
          showProject
          onSelect={onSelect}
          onToggleStar={onToggleStar}
        />
      ))}
    </div>
  )
}
