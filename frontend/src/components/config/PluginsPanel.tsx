import { useEffect } from 'react'
import { usePlugins } from '../../hooks/useConfig'

export function PluginsPanel() {
  const { plugins, loading, error, load, toggle } = usePlugins()

  useEffect(() => { load() }, [load])

  if (loading && plugins.length === 0) {
    return <div className="p-6 text-text-tertiary text-sm">Loading plugins...</div>
  }

  if (plugins.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
        No plugins installed
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-2">
        {plugins.map(plugin => (
          <div
            key={plugin.key}
            className="flex items-center justify-between px-4 py-3 bg-surface/60 border border-subtle rounded-xl hover:bg-surface"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-text-primary truncate">{plugin.name}</div>
              <div className="text-[11px] text-text-tertiary mt-0.5 flex items-center gap-2">
                <span className="font-mono truncate">{plugin.key}</span>
                {plugin.version && (
                  <>
                    <span className="text-subtle">|</span>
                    <span>v{plugin.version}</span>
                  </>
                )}
                {plugin.marketplace && (
                  <>
                    <span className="text-subtle">|</span>
                    <span>{plugin.marketplace}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => toggle(plugin.key, !plugin.enabled)}
              className={`relative ml-3 w-10 h-[22px] rounded-full flex-shrink-0 ${
                plugin.enabled ? 'bg-accent' : 'bg-medium'
              }`}
              title={plugin.enabled ? 'Disable' : 'Enable'}
            >
              <div
                className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm ${
                  plugin.enabled ? 'left-[21px]' : 'left-[3px]'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
      {error && (
        <div className="px-4 py-2 text-xs text-red-500 bg-red-500/5 border-t border-red-500/10">
          {error}
        </div>
      )}
    </div>
  )
}
