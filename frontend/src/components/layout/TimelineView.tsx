import type { SessionSummary } from '../../types'
import { SessionItem } from './SessionItem'

interface TimelineViewProps {
  sessions: SessionSummary[]
  selectedId: string | null
  focusedId: string | null
  onSelect: (session: SessionSummary) => void
  onToggleStar: (sessionId: string) => void
}

function getDateGroup(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return 'This Week'
  if (diffDays < 30) return 'This Month'
  return 'Older'
}

export function TimelineView({ sessions, selectedId, focusedId, onSelect, onToggleStar }: TimelineViewProps) {
  // Sessions are already sorted by timestamp desc from API
  const groups = new Map<string, SessionSummary[]>()
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older']

  for (const s of sessions) {
    const group = getDateGroup(s.timestamp)
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(s)
  }

  let isFirst = true

  return (
    <div className="py-1">
      {groupOrder.map(group => {
        const items = groups.get(group)
        if (!items || items.length === 0) return null
        const showDivider = !isFirst
        isFirst = false
        return (
          <div key={group} className="mb-1">
            {showDivider && <div className="mx-3 my-1 border-t border-subtle" />}
            <div className="px-3 py-1.5 text-[10px] font-semibold text-text-tertiary tracking-wider uppercase">
              {group}
              <span className="ml-1.5 text-[9px] font-normal opacity-60">{items.length}</span>
            </div>
            {items.map(session => (
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
      })}
    </div>
  )
}
