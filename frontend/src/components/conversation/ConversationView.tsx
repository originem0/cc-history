import { useRef, useEffect, useState, useCallback } from 'react'
import type { Conversation, SessionSummary } from '../../types'
import { MessageBubble } from './MessageBubble'
import { api } from '../../lib/api'

interface ConversationViewProps {
  conversation: Conversation | null
  session: SessionSummary | null
  loading: boolean
  error: string | null
  onResume: () => void
  onDelete: () => void
  onToggleStar: (sessionId: string) => void
  onAddTag: (sessionId: string, tag: string) => void
  onRemoveTag: (sessionId: string, tag: string) => void
  onRenameSession: (sessionId: string, title: string) => void
}

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M4 2.5v11l9-5.5L4 2.5Z" fill="currentColor"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M5.5 2V1h5v1m-8 1h11M6 6v6m4-6v6M3.5 4l.75 9.5a1.5 1.5 0 0 0 1.5 1.5h4.5a1.5 1.5 0 0 0 1.5-1.5L12.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const StarIcon = ({ filled, size = 14 }: { filled: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path
      d="M8 1.5l1.85 3.75L14 5.9l-3 2.92.71 4.13L8 10.88l-3.71 2.07.71-4.13-3-2.92 4.15-.65L8 1.5z"
      fill={filled ? 'var(--accent)' : 'none'}
      stroke={filled ? 'var(--accent)' : 'currentColor'}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
)

const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export function ConversationView({ conversation, session, loading, error, onResume, onDelete, onToggleStar, onAddTag, onRemoveTag, onRenameSession }: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagValue, setTagValue] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [conversation?.sessionId])

  useEffect(() => {
    if (showTagInput && tagInputRef.current) {
      tagInputRef.current.focus()
    }
  }, [showTagInput])

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitle])

  const handleTitleDoubleClick = useCallback(() => {
    if (session) {
      setTitleValue(session.title)
      setEditingTitle(true)
    }
  }, [session])

  const handleTitleSave = useCallback(() => {
    const trimmed = titleValue.trim()
    if (session && trimmed && trimmed !== session.title) {
      onRenameSession(session.id, trimmed)
    }
    setEditingTitle(false)
  }, [session, titleValue, onRenameSession])

  const handleTitleCancel = useCallback(() => {
    setEditingTitle(false)
  }, [])

  const handleTagSubmit = () => {
    const tag = tagValue.trim()
    if (tag && session) {
      onAddTag(session.id, tag)
      setTagValue('')
      setShowTagInput(false)
    }
  }

  // Empty state
  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center bg-base">
        <div className="text-center">
          {/* Decorative element */}
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-2xl bg-accent/5 border border-accent/10 rotate-6" />
            <div className="absolute inset-0 rounded-2xl bg-accent/5 border border-accent/10 -rotate-3" />
            <div className="absolute inset-0 rounded-2xl bg-surface border border-subtle flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-text-tertiary">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <div className="text-sm font-medium text-text-secondary">Select a session</div>
          <div className="text-[11px] text-text-tertiary mt-1">Browse your Claude Code history</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-base overflow-hidden">
      {/* Conversation header */}
      <div className="px-5 py-3 bg-raised/50 border-b border-subtle backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <button
              onClick={() => onToggleStar(session.id)}
              className={`shrink-0 p-1 rounded hover:bg-black/[0.06] ${
                session.starred ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'
              }`}
              title={session.starred ? 'Unstar' : 'Star'}
            >
              <StarIcon filled={session.starred} />
            </button>
            <div className="min-w-0">
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={titleValue}
                  onChange={e => setTitleValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleTitleSave()
                    if (e.key === 'Escape') handleTitleCancel()
                  }}
                  onBlur={handleTitleSave}
                  className="text-sm font-semibold text-text-primary bg-surface border border-accent/30 rounded px-1.5 py-0.5 outline-none w-full"
                />
              ) : (
                <h2
                  className="text-sm font-semibold text-text-primary truncate cursor-pointer hover:text-accent"
                  onDoubleClick={handleTitleDoubleClick}
                  title="Double-click to edit title"
                >
                  {session.title}
                </h2>
              )}
              <div className="text-[11px] text-text-tertiary mt-0.5 flex items-center gap-1.5 font-mono">
                <span className="truncate">{session.cwd || session.project}</span>
                <span className="text-subtle">/</span>
                <span className="whitespace-nowrap">{new Date(session.timestamp).toLocaleDateString()}</span>
                <span className="text-subtle">/</span>
                <span className="whitespace-nowrap">{session.messages} msg</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => api.exportSession(session.id).catch(console.error)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-text-secondary bg-black/[0.04] rounded-lg hover:bg-black/[0.08] border border-subtle hover:border-black/10"
            >
              <DownloadIcon />
              Export
            </button>
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20 border border-accent/20 hover:border-accent/30"
            >
              <PlayIcon />
              Resume
            </button>
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-red-500 bg-red-500/10 rounded-lg hover:bg-red-500/15 border border-red-500/15 hover:border-red-500/25"
            >
              <TrashIcon />
              Delete
            </button>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {session.tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-black/[0.04] text-text-secondary rounded-md border border-subtle"
            >
              {tag}
              <button
                onClick={() => onRemoveTag(session.id, tag)}
                className="text-text-tertiary hover:text-text-primary ml-0.5"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 1.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
            </span>
          ))}
          {showTagInput ? (
            <input
              ref={tagInputRef}
              value={tagValue}
              onChange={e => setTagValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleTagSubmit()
                if (e.key === 'Escape') { setShowTagInput(false); setTagValue('') }
              }}
              onBlur={() => { handleTagSubmit(); setShowTagInput(false) }}
              className="px-2 py-0.5 text-[11px] bg-surface text-text-primary rounded-md border border-accent/30 outline-none w-24"
              placeholder="tag name"
            />
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] text-text-tertiary hover:text-text-secondary hover:bg-black/[0.04] rounded-md border border-dashed border-subtle"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              tag
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
            <span className="text-[11px] text-text-tertiary font-mono">Loading conversation...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-500 text-sm">{error}</div>
          </div>
        ) : conversation?.messages?.length ? (
          <>
            {conversation.messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            <div ref={bottomRef} />
          </>
        ) : (
          <div className="text-center text-text-tertiary py-12 text-sm">No messages in this session</div>
        )}
      </div>
    </div>
  )
}
