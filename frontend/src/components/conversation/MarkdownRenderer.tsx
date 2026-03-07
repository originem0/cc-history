import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface MarkdownRendererProps {
  content: string
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm max-w-none
      prose-headings:text-gray-900 prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold
      prose-p:my-2 prose-p:leading-relaxed prose-p:text-text-primary
      prose-pre:my-3 prose-pre:p-0 prose-pre:bg-transparent
      prose-code:text-[12px] prose-code:before:content-none prose-code:after:content-none
      prose-code:text-accent prose-code:bg-accent/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono
      prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-li:text-text-primary
      prose-a:text-accent prose-a:no-underline hover:prose-a:underline
      prose-blockquote:border-l-accent/40 prose-blockquote:text-text-secondary prose-blockquote:not-italic
      prose-strong:text-gray-900 prose-strong:font-semibold
      prose-em:text-text-secondary
      prose-hr:border-subtle
      prose-th:text-text-secondary prose-td:text-text-primary
      prose-table:text-sm
    ">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const codeStr = String(children).replace(/\n$/, '')

            if (match) {
              return (
                <SyntaxHighlighter
                  style={oneLight}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: '10px',
                    fontSize: '12px',
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'rgba(0,0,0,0.02)',
                  }}
                >
                  {codeStr}
                </SyntaxHighlighter>
              )
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
