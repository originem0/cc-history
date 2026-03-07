import { useState } from 'react'
import type { ContentBlock } from '../../types'

interface CollapsibleBlockProps {
  type: 'thinking' | 'tool_use' | 'tool_result'
  block: ContentBlock
}

export function CollapsibleBlock({ type, block }: CollapsibleBlockProps) {
  const [expanded, setExpanded] = useState(false)

  let label: string
  let content: string
  let accentColor: string
  let bgClass: string
  let iconPath: string

  switch (type) {
    case 'thinking':
      label = 'Thinking'
      content = block.text || ''
      accentColor = 'var(--thinking)'
      bgClass = 'bg-[var(--thinking-soft)] border-[var(--thinking)]/20'
      iconPath = 'M8 2a6 6 0 0 0-6 6c0 2.2 1.2 4.1 3 5.1V14a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-.9c1.8-1 3-2.9 3-5.1a6 6 0 0 0-6-6Z'
      break
    case 'tool_use':
      label = block.toolName || 'Tool'
      content = block.input || ''
      accentColor = 'var(--tool)'
      bgClass = 'bg-[var(--tool-soft)] border-[var(--tool)]/20'
      iconPath = 'M14.7 6.3a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0L10 5l3 3 1.7-1.7ZM2 11l7.3-7.3 3 3L5 14H2v-3Z'
      if (content) {
        try {
          const parsed = JSON.parse(content)
          if (parsed.command) {
            content = parsed.command
          } else if (parsed.file_path) {
            label = `${block.toolName}: ${parsed.file_path.split(/[/\\]/).pop()}`
            content = JSON.stringify(parsed, null, 2)
          } else {
            content = JSON.stringify(parsed, null, 2)
          }
        } catch {
          // keep as-is
        }
      }
      break
    case 'tool_result':
      label = block.isError ? 'Error' : 'Result'
      content = block.text || ''
      accentColor = block.isError ? 'var(--danger)' : 'var(--success)'
      bgClass = block.isError ? 'bg-[var(--danger-soft)] border-red-500/20' : 'bg-emerald-500/[0.06] border-emerald-500/20'
      iconPath = block.isError
        ? 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 4v4m0 2.5h.01'
        : 'M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-1 10l-3-3 1.4-1.4L7 8.2l3.6-3.6L12 6l-5 5Z'
      break
  }

  const preview = content.length > 100 ? content.slice(0, 100) + '...' : content

  return (
    <div className={`rounded-lg border ${bgClass} my-2 overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/[0.02]"
      >
        {/* Icon */}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0" style={{ color: accentColor }}>
          <path d={iconPath} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        {/* Label */}
        <span className="text-[11px] font-mono font-medium shrink-0" style={{ color: accentColor }}>
          {label}
        </span>

        {/* Preview */}
        <span className="text-[11px] text-text-tertiary truncate flex-1 font-mono">
          {!expanded && preview}
        </span>

        {/* Expand indicator */}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`shrink-0 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          style={{ color: accentColor }}
        >
          <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {expanded && content && (
        <div className="px-3 pb-3">
          <pre className="text-[11px] text-text-secondary whitespace-pre-wrap break-words max-h-80 overflow-y-auto font-mono bg-black/[0.04] rounded-lg p-3 leading-relaxed">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}
