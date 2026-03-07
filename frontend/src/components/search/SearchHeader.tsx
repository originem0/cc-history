import type { SearchResult } from '../../types'

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5M13.5 2.5V6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const ConfigIcon = ({ active }: { active: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path d="M6.9 1.7a1 1 0 0 1 2.2 0l.15.9a.6.6 0 0 0 .46.46l.36.13a.6.6 0 0 0 .63-.1l.7-.6a1 1 0 0 1 1.55 1.56l-.6.7a.6.6 0 0 0-.1.62l.14.37a.6.6 0 0 0 .46.46l.9.15a1 1 0 0 1 0 2.2l-.9.15a.6.6 0 0 0-.46.46l-.13.36a.6.6 0 0 0 .1.63l.6.7a1 1 0 0 1-1.56 1.55l-.7-.6a.6.6 0 0 0-.62-.1l-.37.14a.6.6 0 0 0-.46.46l-.15.9a1 1 0 0 1-2.2 0l-.15-.9a.6.6 0 0 0-.46-.46l-.36-.13a.6.6 0 0 0-.63.1l-.7.6a1 1 0 0 1-1.55-1.56l.6-.7a.6.6 0 0 0 .1-.62l-.14-.37a.6.6 0 0 0-.46-.46l-.9-.15a1 1 0 0 1 0-2.2l.9-.15a.6.6 0 0 0 .46-.46l.13-.36a.6.6 0 0 0-.1-.63l-.6-.7A1 1 0 0 1 4.04 2.5l.7.6a.6.6 0 0 0 .62.1l.37-.14a.6.6 0 0 0 .46-.46l.15-.9Z"
      stroke="currentColor" strokeWidth="1.2" fill={active ? 'currentColor' : 'none'}/>
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" fill={active ? 'var(--bg-base)' : 'none'}/>
  </svg>
)

interface HeaderProps {
  query: string
  onSearch: (q: string) => void
  searchResults: SearchResult[]
  searchLoading: boolean
  onSelectResult: (sessionId: string) => void
  onClearSearch: () => void
  onReload: () => void
  reloading: boolean
  appView: 'sessions' | 'config'
  onToggleConfig: () => void
}

export function Header({
  query,
  onSearch,
  searchResults,
  searchLoading,
  onSelectResult,
  onClearSearch,
  onReload,
  reloading,
  appView,
  onToggleConfig,
}: HeaderProps) {
  const showDropdown = query.trim().length > 0

  return (
    <div className="relative flex items-center gap-3 px-4 py-2 bg-base border-b border-subtle">
      {/* Search bar */}
      <div className="relative flex-1 max-w-2xl">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
          <SearchIcon />
        </div>
        <input
          type="text"
          value={query}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search sessions..."
          className="w-full pl-9 pr-20 py-2 bg-surface rounded-lg text-sm text-text-primary placeholder-text-tertiary outline-none border border-subtle focus:border-accent/40 focus:bg-overlay"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query ? (
            <button
              onClick={onClearSearch}
              className="p-1 text-text-tertiary hover:text-text-secondary rounded"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary bg-raised border border-subtle rounded">
              Ctrl K
            </kbd>
          )}
        </div>

        {/* Search results dropdown */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-overlay rounded-xl shadow-dropdown max-h-80 overflow-y-auto z-50 animate-slide-down">
            {searchLoading ? (
              <div className="px-4 py-4 text-sm text-text-tertiary flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-4 text-sm text-text-tertiary">No results found</div>
            ) : (
              searchResults.map((r, i) => (
                <button
                  key={r.sessionId}
                  onClick={() => {
                    onSelectResult(r.sessionId)
                    onClearSearch()
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-black/[0.04] border-b border-subtle last:border-0 animate-fade-in"
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="text-sm font-medium text-text-primary truncate">{r.title}</div>
                  <div className="text-[11px] text-text-tertiary mt-1 flex items-center gap-2">
                    <span className="truncate font-mono">{r.project}</span>
                    <span className="text-subtle">/</span>
                    <span className="whitespace-nowrap">{r.timestamp}</span>
                  </div>
                  {r.snippet && (
                    <div className="text-[11px] text-text-secondary mt-1.5 truncate bg-surface/60 px-2 py-1 rounded font-mono">
                      {r.snippet}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Reload button */}
      <button
        onClick={onReload}
        disabled={reloading}
        className="p-2 text-text-tertiary hover:text-accent hover:bg-accent/5 rounded-lg disabled:opacity-30"
        title="Reload sessions"
      >
        <span className={reloading ? 'animate-spin inline-block' : ''}>
          <RefreshIcon />
        </span>
      </button>

      {/* Config button */}
      <button
        onClick={onToggleConfig}
        className={`p-2 rounded-lg ${
          appView === 'config'
            ? 'text-accent bg-accent/10'
            : 'text-text-tertiary hover:text-accent hover:bg-accent/5'
        }`}
        title="Configuration"
      >
        <ConfigIcon active={appView === 'config'} />
      </button>
    </div>
  )
}
