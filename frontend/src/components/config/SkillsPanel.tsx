import { useState, useEffect } from 'react'
import { useSkills } from '../../hooks/useConfig'

export function SkillsPanel() {
  const { skills, selected, loading, error, load, select, create, update, remove } = useSkills()
  const [editContent, setEditContent] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (selected) setEditContent(selected.content)
    setDirty(false)
  }, [selected])

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await update(selected.dirName, editContent)
      setDirty(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const defaultContent = `---\nname: ${newName}\ndescription: \n---\n\n`
      await create(newName.trim(), defaultContent)
      setCreating(false)
      setNewName('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`Delete skill "${selected.name}"? This cannot be undone.`)) return
    try {
      await remove(selected.dirName)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (loading && skills.length === 0) {
    return <div className="p-6 text-text-tertiary text-sm">Loading skills...</div>
  }

  return (
    <div className="flex h-full">
      {/* Left list */}
      <div className="w-52 border-r border-subtle overflow-y-auto flex-shrink-0">
        <div className="p-2">
          <button
            onClick={() => setCreating(true)}
            className="w-full px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/5 rounded-lg text-left"
          >
            + New Skill
          </button>
        </div>
        {skills.map(s => (
          <button
            key={s.dirName}
            onClick={() => {
              if (dirty && !confirm('You have unsaved changes. Discard?')) return
              select(s.dirName)
            }}
            className={`w-full text-left px-3 py-2 text-sm border-b border-subtle/50 hover:bg-surface/60 ${
              selected?.dirName === s.dirName ? 'bg-accent/8 text-accent font-medium' : 'text-text-primary'
            }`}
          >
            <div className="truncate">{s.name}</div>
            {s.description && (
              <div className="text-[11px] text-text-tertiary truncate mt-0.5">{s.description}</div>
            )}
            {s.hasExtras && (
              <span className="text-[10px] text-text-tertiary bg-surface px-1.5 py-0.5 rounded mt-1 inline-block">has extras</span>
            )}
          </button>
        ))}
        {skills.length === 0 && !loading && (
          <div className="px-3 py-4 text-xs text-text-tertiary">No skills found</div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {creating ? (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-3">New Skill</h3>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Skill directory name (e.g. my-skill)"
              className="w-full max-w-md px-3 py-2 text-sm bg-surface border border-subtle rounded-lg outline-none focus:border-accent/40 mb-3"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                className="px-4 py-1.5 text-sm font-medium text-white bg-accent hover:bg-amber-600 rounded-lg disabled:opacity-40"
              >
                Create
              </button>
              <button
                onClick={() => { setCreating(false); setNewName('') }}
                className="px-4 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : selected ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-subtle bg-surface/40">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{selected.name}</h3>
                <span className="text-[11px] text-text-tertiary font-mono">{selected.dirName}/SKILL.md</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-amber-600 rounded-lg disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
            <textarea
              value={editContent}
              onChange={e => { setEditContent(e.target.value); setDirty(true) }}
              className="flex-1 p-4 text-sm font-mono bg-base text-text-primary outline-none resize-none"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
            Select a skill to view or edit
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
