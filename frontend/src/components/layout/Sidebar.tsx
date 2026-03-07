import { useState, useEffect, useCallback } from 'react'
import type { ProjectInfo, SessionSummary } from '../../types'
import { SessionItem } from './SessionItem'
import { TimelineView } from './TimelineView'
import { StarredView } from './StarredView'

export type SidebarTab = 'projects' | 'timeline' | 'starred'

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="10" height="10" viewBox="0 0 10 10" fill="none"
    className={`transition-transform duration-150 ${expanded ? 'rotate-0' : '-rotate-90'}`}
  >
    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const FolderIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-40">
    <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6.17a1.5 1.5 0 0 1 1.06.44l.54.54a1.5 1.5 0 0 0 1.06.44H12.5c.83 0 1.5.67 1.5 1.5V11.5c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5V4.5Z" stroke="currentColor" strokeWidth="1.2"/>
  </svg>
)

interface ProjectGroupProps {
  project: ProjectInfo
  sessions: SessionSummary[]
  selectedId: string | null
  focusedId: string | null
  onSelect: (session: SessionSummary) => void
  onToggleStar: (sessionId: string) => void
  defaultExpanded?: boolean
}

function ProjectGroup({ project, sessions, selectedId, focusedId, onSelect, onToggleStar, defaultExpanded = false }: ProjectGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  useEffect(() => {
    const saved = localStorage.getItem(`sidebar-expanded-${project.dirName}`)
    if (saved !== null) {
      setExpanded(saved === 'true')
    }
  }, [project.dirName])

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    localStorage.setItem(`sidebar-expanded-${project.dirName}`, String(next))
  }

  const segments = project.path.replace(/\\/g, '/').split('/')
  const shortName = segments.slice(-2).join('/')

  return (
    <div className="mb-0.5">
      <button
        onClick={toggle}
        className="group w-full flex items-center gap-2 px-3 py-[7px] text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-black/[0.03] rounded-lg"
        title={project.path}
      >
        <ChevronIcon expanded={expanded} />
        <FolderIcon />
        <span className="truncate flex-1 text-left tracking-wide">{shortName}</span>
        <span className="text-text-tertiary tabular-nums text-[10px] opacity-0 group-hover:opacity-100">{sessions.length}</span>
      </button>

      {expanded && (
        <div className="ml-3 pl-3 border-l border-subtle">
          {sessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              isSelected={selectedId === session.id}
              isFocused={focusedId === session.id}
              onSelect={onSelect}
              onToggleStar={onToggleStar}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const tabs: { key: SidebarTab; label: string }[] = [
  { key: 'projects', label: 'Projects' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'starred', label: 'Starred' },
]

interface SidebarProps {
  projects: ProjectInfo[]
  sessions: SessionSummary[]
  selectedId: string | null
  focusedId: string | null
  activeTab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  onSelect: (session: SessionSummary) => void
  onToggleStar: (sessionId: string) => void
  loading: boolean
  width: number
  onResizeStart: (e: React.MouseEvent) => void
}

export function Sidebar({ projects, sessions, selectedId, focusedId, activeTab, onTabChange, onSelect, onToggleStar, loading, width, onResizeStart }: SidebarProps) {
  const grouped = useCallback(() => {
    const map = new Map<string, SessionSummary[]>()
    for (const s of sessions) {
      const key = s.projectId
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  }, [sessions])

  const sessionMap = grouped()
  const totalSessions = sessions.length

  return (
    <div className="relative bg-raised flex flex-col h-full overflow-hidden border-r border-subtle" style={{ width }}>
      {/* Header */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v4.5a1.5 1.5 0 0 0 1.5 1.5H14M8 1 3 6v8.5A1.5 1.5 0 0 0 4.5 16h7a1.5 1.5 0 0 0 1.5-1.5V7L8 1Z" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary font-mono tracking-tight">cc-history</div>
            <div className="text-[10px] text-text-tertiary mt-0.5 tracking-wide uppercase">{totalSessions} sessions</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mx-3 flex gap-0.5 p-0.5 bg-surface rounded-lg border border-subtle">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-black/[0.06] text-text-primary shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-3 mt-2 border-t border-subtle" />

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2 px-1.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
            <span className="text-[11px] text-text-tertiary">Loading sessions...</span>
          </div>
        ) : activeTab === 'projects' ? (
          projects.length === 0 ? (
            <div className="text-center text-text-tertiary text-sm py-12">No sessions found</div>
          ) : (
            projects.map(project => (
              <ProjectGroup
                key={project.dirName}
                project={project}
                sessions={sessionMap.get(project.dirName) || []}
                selectedId={selectedId}
                focusedId={focusedId}
                onSelect={onSelect}
                onToggleStar={onToggleStar}
                defaultExpanded={projects.length <= 5}
              />
            ))
          )
        ) : activeTab === 'timeline' ? (
          <TimelineView
            sessions={sessions}
            selectedId={selectedId}
            focusedId={focusedId}
            onSelect={onSelect}
            onToggleStar={onToggleStar}
          />
        ) : (
          <StarredView
            sessions={sessions}
            selectedId={selectedId}
            focusedId={focusedId}
            onSelect={onSelect}
            onToggleStar={onToggleStar}
          />
        )}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onResizeStart}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-black/[0.08] active:bg-black/[0.12] transition-colors z-10"
      />
    </div>
  )
}
