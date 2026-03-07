import { useState, useRef, useEffect } from 'react'
import type { ConversationMessage, ContentBlock } from '../../types'
import { MarkdownRenderer } from './MarkdownRenderer'

interface MessageBubbleProps {
  message: ConversationMessage
}

// --- Inline single-line component for tool_use / tool_result / thinking ---

function ToolLine({ block }: { block: ContentBlock }) {
  const [expanded, setExpanded] = useState(false)

  let icon: string
  let label: string
  let summary: string
  let colorClass: string
  let content: string = ''

  switch (block.type) {
    case 'tool_use': {
      icon = '\u{1F527}'
      label = block.toolName || 'Tool'
      content = block.input || ''
      colorClass = 'text-[var(--tool)]'

      // Build summary from input
      if (content) {
        try {
          const parsed = JSON.parse(content)
          if (parsed.command) {
            summary = parsed.command
            content = parsed.command
          } else if (parsed.file_path) {
            const fname = parsed.file_path.split(/[/\\]/).pop()
            summary = `${block.toolName}: ${fname}`
            content = JSON.stringify(parsed, null, 2)
          } else {
            summary = label
            content = JSON.stringify(parsed, null, 2)
          }
        } catch {
          summary = content.slice(0, 120)
        }
      } else {
        summary = label
      }
      break
    }
    case 'tool_result': {
      content = block.text || ''
      if (block.isError) {
        icon = '\u2717'
        label = 'Error'
        colorClass = 'text-[var(--danger)]'
        const firstLine = content.split('\n')[0] || ''
        summary = firstLine.slice(0, 120) || '(empty)'
      } else {
        icon = '\u2713'
        label = 'Result'
        colorClass = 'text-[var(--success)]'
        if (!content.trim()) {
          summary = '(ok)'
        } else {
          const lineCount = content.split('\n').length
          if (lineCount > 1) {
            summary = `(${lineCount} lines)`
          } else {
            summary = content.slice(0, 120)
          }
        }
      }
      break
    }
    case 'thinking': {
      icon = '\u{1F4AD}'
      colorClass = 'text-[var(--thinking)]'
      content = block.text || ''
      if (content) {
        const lineCount = content.split('\n').length
        label = 'Thinking'
        summary = `(${lineCount} lines)`
      } else {
        label = 'Thinking...'
        summary = ''
      }
      break
    }
    default: {
      icon = '\u2022'
      label = block.type
      colorClass = 'text-text-tertiary'
      content = block.text || ''
      summary = content.slice(0, 120)
    }
  }

  return (
    <div className="my-0.5">
      <button
        onClick={() => content && setExpanded(!expanded)}
        className={`w-full flex items-center gap-1.5 px-2 py-0.5 text-left rounded hover:bg-black/[0.03] group ${
          content ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <span className="text-[11px] shrink-0">{icon}</span>
        <span className={`text-[11px] font-mono font-medium shrink-0 ${colorClass}`}>
          {label}
        </span>
        {summary && (
          <span className="text-[11px] text-text-tertiary truncate flex-1 font-mono">
            {summary}
          </span>
        )}
        {content && (
          <svg
            width="8" height="8" viewBox="0 0 8 8" fill="none"
            className={`shrink-0 opacity-40 group-hover:opacity-70 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          >
            <path d="M2 1.5L5.5 4L2 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      {expanded && content && (
        <pre className="text-[11px] text-text-secondary whitespace-pre-wrap break-words max-h-80 overflow-y-auto font-mono bg-black/[0.03] rounded-lg px-3 py-2 mx-2 mt-0.5 mb-1 leading-relaxed">
          {content}
        </pre>
      )}
    </div>
  )
}

// --- Collapsible wrapper for long text content ---

function CollapsibleContent({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      setOverflows(ref.current.scrollHeight > ref.current.clientHeight)
    }
  }, [children])

  return (
    <div className="relative">
      <div
        ref={ref}
        style={{ maxHeight: expanded ? 'none' : '400px', overflow: 'hidden' }}
      >
        {children}
      </div>
      {overflows && !expanded && (
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--surface)] to-transparent flex items-end justify-center pb-1">
          <button
            onClick={() => setExpanded(true)}
            className="text-[11px] font-medium text-accent bg-surface/90 border border-accent/20 rounded-full px-3 py-1 hover:bg-accent/10"
          >
            Expand all
          </button>
        </div>
      )}
    </div>
  )
}

// --- Helper: check if a block has visible content ---

function hasVisibleContent(block: ContentBlock): boolean {
  switch (block.type) {
    case 'text':
      return !!block.text?.trim()
    case 'tool_use':
      return true
    case 'tool_result':
      return true
    case 'thinking':
      return true
    default:
      return !!block.text
  }
}

// --- Main MessageBubble ---

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.type === 'user'

  // Skip rendering if no blocks have visible content
  const visibleBlocks = message.content.filter(hasVisibleContent)
  if (visibleBlocks.length === 0) return null

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Role label */}
        <div className={`flex items-center gap-2 mb-0.5 ${isUser ? 'justify-end' : ''}`}>
          <div className={`w-[6px] h-[6px] rounded-full ${
            isUser ? 'bg-user-bubble' : 'bg-accent'
          }`} />
          <span className={`text-[11px] font-mono font-medium tracking-wide ${
            isUser ? 'text-blue-600' : 'text-accent'
          }`}>
            {isUser ? 'YOU' : 'CLAUDE'}
          </span>
          {message.timestamp && (
            <span className="text-[10px] text-text-tertiary">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Message content */}
        <div className={`rounded-xl px-3 py-2 ${
          isUser
            ? 'bg-user-bubble/12 border border-blue-500/15 rounded-br-sm'
            : 'bg-surface border border-subtle rounded-bl-sm'
        }`}>
          {message.content.map((block, i) => {
            switch (block.type) {
              case 'text':
                // Skip empty text blocks
                if (!block.text?.trim()) return null
                if (isUser) {
                  return (
                    <CollapsibleContent key={i}>
                      <div className="text-[13px] text-text-primary whitespace-pre-wrap break-words leading-relaxed">
                        {block.text}
                      </div>
                    </CollapsibleContent>
                  )
                }
                return (
                  <CollapsibleContent key={i}>
                    <MarkdownRenderer content={block.text || ''} />
                  </CollapsibleContent>
                )

              case 'thinking':
              case 'tool_use':
              case 'tool_result':
                return <ToolLine key={i} block={block} />

              default:
                if (block.text) {
                  return (
                    <div key={i} className="text-[12px] text-text-tertiary italic font-mono">
                      [{block.type}] {block.text.slice(0, 200)}
                    </div>
                  )
                }
                return null
            }
          })}
        </div>
      </div>
    </div>
  )
}
