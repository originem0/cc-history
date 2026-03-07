import type { SessionSummary } from '../../types'

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0">
    <path
      d="M8 1.5l1.85 3.75L14 5.9l-3 2.92.71 4.13L8 10.88l-3.71 2.07.71-4.13-3-2.92 4.15-.65L8 1.5z"
      fill={filled ? 'var(--accent)' : 'none'}
      stroke={filled ? 'var(--accent)' : 'currentColor'}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
)

interface SessionItemProps {
  session: SessionSummary
  isSelected: boolean
  isFocused: boolean
  showProject?: boolean
  onSelect: (session: SessionSummary) => void
  onToggleStar: (sessionId: string) => void
}

export function SessionItem({ session, isSelected, isFocused, showProject, onSelect, onToggleStar }: SessionItemProps) {
  return (
    <div
      data-session-id={session.id}
      className={`group/item flex items-center gap-1 rounded-lg ${
        isSelected
          ? 'bg-amber-50 shadow-glow'
          : isFocused
            ? 'ring-1 ring-amber-300 bg-black/[0.02]'
            : 'hover:bg-black/[0.04]'
      }`}
    >
      <button
        onClick={() => onSelect(session)}
        className={`flex-1 text-left px-3 py-[6px] text-[13px] truncate min-w-0 ${
          isSelected
            ? 'text-accent font-medium'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        title={session.title}
      >
        <div className="flex items-center gap-2">
          {isSelected && (
            <span className="inline-block w-1 h-1 rounded-full bg-accent shrink-0" />
          )}
          <span className="truncate">{session.title}</span>
        </div>
        {showProject && (
          <div className="text-[10px] text-text-tertiary mt-0.5 truncate font-mono">
            {session.cwd || session.project}
          </div>
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleStar(session.id) }}
        className={`p-1 mr-1 rounded shrink-0 ${
          session.starred
            ? 'opacity-100 text-accent'
            : 'opacity-0 group-hover/item:opacity-40 hover:!opacity-100 text-text-tertiary'
        }`}
        title={session.starred ? 'Unstar' : 'Star'}
      >
        <StarIcon filled={session.starred} />
      </button>
    </div>
  )
}
