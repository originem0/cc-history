import type { ConversationMessage } from '../../types'
import { CollapsibleBlock } from './CollapsibleBlock'
import { MarkdownRenderer } from './MarkdownRenderer'

interface MessageBubbleProps {
  message: ConversationMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.type === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-5`}>
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Role label */}
        <div className={`flex items-center gap-2 mb-1.5 ${isUser ? 'justify-end' : ''}`}>
          {/* Avatar dot */}
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
        <div className={`rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-user-bubble/12 border border-blue-500/15 rounded-br-sm'
            : 'bg-surface border border-subtle rounded-bl-sm'
        }`}>
          {message.content.map((block, i) => {
            switch (block.type) {
              case 'text':
                if (isUser) {
                  return (
                    <div key={i} className="text-[13px] text-text-primary whitespace-pre-wrap break-words leading-relaxed">
                      {block.text}
                    </div>
                  )
                }
                return <MarkdownRenderer key={i} content={block.text || ''} />

              case 'thinking':
                return <CollapsibleBlock key={i} type="thinking" block={block} />

              case 'tool_use':
                return <CollapsibleBlock key={i} type="tool_use" block={block} />

              case 'tool_result':
                return <CollapsibleBlock key={i} type="tool_result" block={block} />

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
