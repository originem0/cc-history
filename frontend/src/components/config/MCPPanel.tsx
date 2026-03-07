import { useState, useEffect } from 'react'
import { useMCPServers } from '../../hooks/useConfig'
import type { MCPServer } from '../../types'

const emptyServer: MCPServer = { type: 'stdio', command: '', args: [], env: {} }

export function MCPPanel() {
  const { servers, loading, error, load, set, remove } = useMCPServers()
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editServer, setEditServer] = useState<MCPServer>(emptyServer)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [argsText, setArgsText] = useState('')
  const [envText, setEnvText] = useState('')

  useEffect(() => { load() }, [load])

  const serverNames = Object.keys(servers)

  const selectServer = (name: string) => {
    setSelectedName(name)
    setCreating(false)
    const s = servers[name]
    setEditServer(s)
    setEditName(name)
    setArgsText((s.args || []).join('\n'))
    setEnvText(Object.entries(s.env || {}).map(([k, v]) => `${k}=${v}`).join('\n'))
  }

  const startCreate = () => {
    setCreating(true)
    setSelectedName(null)
    setEditName('')
    setEditServer({ ...emptyServer })
    setArgsText('')
    setEnvText('')
  }

  const parseArgs = (text: string): string[] => {
    return text.split('\n').map(l => l.trim()).filter(Boolean)
  }

  const parseEnv = (text: string): Record<string, string> => {
    const env: Record<string, string> = {}
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const idx = trimmed.indexOf('=')
      if (idx > 0) {
        env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
      }
    }
    return env
  }

  const handleSave = async () => {
    const name = creating ? editName.trim() : selectedName
    if (!name) return
    setSaving(true)
    try {
      const server: MCPServer = {
        ...editServer,
        args: parseArgs(argsText),
        env: parseEnv(envText),
      }
      await set(name, server)
      setCreating(false)
      setSelectedName(name)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedName) return
    if (!confirm(`Delete MCP server "${selectedName}"?`)) return
    try {
      await remove(selectedName)
      setSelectedName(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (loading && serverNames.length === 0) {
    return <div className="p-6 text-text-tertiary text-sm">Loading MCP servers...</div>
  }

  const showEditor = creating || selectedName

  return (
    <div className="flex h-full">
      {/* Left list */}
      <div className="w-52 border-r border-subtle overflow-y-auto flex-shrink-0">
        <div className="p-2">
          <button
            onClick={startCreate}
            className="w-full px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/5 rounded-lg text-left"
          >
            + New MCP Server
          </button>
        </div>
        {serverNames.map(name => (
          <button
            key={name}
            onClick={() => selectServer(name)}
            className={`w-full text-left px-3 py-2 text-sm border-b border-subtle/50 hover:bg-surface/60 ${
              selectedName === name ? 'bg-accent/8 text-accent font-medium' : 'text-text-primary'
            }`}
          >
            <div className="truncate">{name}</div>
            <div className="text-[11px] text-text-tertiary mt-0.5">{servers[name].type}</div>
          </button>
        ))}
        {serverNames.length === 0 && !loading && (
          <div className="px-3 py-4 text-xs text-text-tertiary">No MCP servers configured</div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showEditor ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-subtle bg-surface/40">
              <h3 className="text-sm font-semibold text-text-primary">
                {creating ? 'New MCP Server' : selectedName}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || (creating && !editName.trim())}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-amber-600 rounded-lg disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                {!creating && (
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {creating && (
                <label className="block">
                  <span className="text-xs font-medium text-text-secondary mb-1 block">Server Name</span>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full max-w-md px-3 py-2 text-sm bg-surface border border-subtle rounded-lg outline-none focus:border-accent/40"
                    autoFocus
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-medium text-text-secondary mb-1 block">Type</span>
                <select
                  value={editServer.type}
                  onChange={e => setEditServer(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full max-w-md px-3 py-2 text-sm bg-surface border border-subtle rounded-lg outline-none focus:border-accent/40"
                >
                  <option value="stdio">stdio</option>
                  <option value="sse">sse</option>
                  <option value="http">http</option>
                </select>
              </label>

              {(editServer.type === 'stdio') && (
                <label className="block">
                  <span className="text-xs font-medium text-text-secondary mb-1 block">Command</span>
                  <input
                    type="text"
                    value={editServer.command || ''}
                    onChange={e => setEditServer(prev => ({ ...prev, command: e.target.value }))}
                    placeholder="e.g. npx, node, python"
                    className="w-full max-w-md px-3 py-2 text-sm bg-surface border border-subtle rounded-lg outline-none focus:border-accent/40"
                  />
                </label>
              )}

              {(editServer.type === 'sse' || editServer.type === 'http') && (
                <label className="block">
                  <span className="text-xs font-medium text-text-secondary mb-1 block">URL</span>
                  <input
                    type="text"
                    value={editServer.url || ''}
                    onChange={e => setEditServer(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="e.g. http://localhost:3000/sse"
                    className="w-full max-w-md px-3 py-2 text-sm bg-surface border border-subtle rounded-lg outline-none focus:border-accent/40"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-medium text-text-secondary mb-1 block">Args (one per line)</span>
                <textarea
                  value={argsText}
                  onChange={e => setArgsText(e.target.value)}
                  rows={4}
                  placeholder="-y&#10;@anthropic-ai/mcp-server-example"
                  className="w-full max-w-md px-3 py-2 text-sm font-mono bg-surface border border-subtle rounded-lg outline-none focus:border-accent/40 resize-none"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-text-secondary mb-1 block">Environment (KEY=VALUE, one per line)</span>
                <textarea
                  value={envText}
                  onChange={e => setEnvText(e.target.value)}
                  rows={4}
                  placeholder="API_KEY=xxx&#10;DEBUG=true"
                  className="w-full max-w-md px-3 py-2 text-sm font-mono bg-surface border border-subtle rounded-lg outline-none focus:border-accent/40 resize-none"
                />
              </label>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
            Select a server to view or edit
          </div>
        )}
        {error && (
          <div className="px-4 py-2 text-xs text-red-500 bg-red-500/5 border-t border-red-500/10">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
