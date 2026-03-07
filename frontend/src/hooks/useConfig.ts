import { useState, useCallback } from 'react'
import { api } from '../lib/api'
import type { SkillInfo, SkillDetail, CommandInfo, CommandDetail, MCPServer, PluginInfo } from '../types'

export function useSkills() {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [selected, setSelected] = useState<SkillDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSkills(await api.listSkills())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skills')
    } finally {
      setLoading(false)
    }
  }, [])

  const select = useCallback(async (dirName: string) => {
    setError(null)
    try {
      setSelected(await api.getSkill(dirName))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skill')
    }
  }, [])

  const create = useCallback(async (name: string, content: string) => {
    await api.createSkill(name, content)
    await load()
  }, [load])

  const update = useCallback(async (name: string, content: string) => {
    await api.updateSkill(name, content)
    setSelected(prev => prev ? { ...prev, content } : prev)
    await load() // Refresh list to reflect frontmatter changes
  }, [load])

  const remove = useCallback(async (name: string) => {
    await api.deleteSkill(name)
    setSelected(null)
    await load()
  }, [load])

  return { skills, selected, loading, error, load, select, create, update, remove, setSelected }
}

export function useCommands() {
  const [commands, setCommands] = useState<CommandInfo[]>([])
  const [selected, setSelected] = useState<CommandDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCommands(await api.listCommands())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load commands')
    } finally {
      setLoading(false)
    }
  }, [])

  const select = useCallback(async (name: string) => {
    setError(null)
    try {
      setSelected(await api.getCommand(name))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load command')
    }
  }, [])

  const create = useCallback(async (name: string, content: string) => {
    await api.createCommand(name, content)
    await load()
  }, [load])

  const update = useCallback(async (name: string, content: string) => {
    await api.updateCommand(name, content)
    setSelected(prev => prev ? { ...prev, content } : prev)
    await load() // Refresh list to reflect frontmatter changes
  }, [load])

  const remove = useCallback(async (name: string) => {
    await api.deleteCommand(name)
    setSelected(null)
    await load()
  }, [load])

  return { commands, selected, loading, error, load, select, create, update, remove, setSelected }
}

export function useMCPServers() {
  const [servers, setServers] = useState<Record<string, MCPServer>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setServers(await api.listMCPServers())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load MCP servers')
    } finally {
      setLoading(false)
    }
  }, [])

  const set = useCallback(async (name: string, server: MCPServer) => {
    await api.setMCPServer(name, server)
    await load()
  }, [load])

  const remove = useCallback(async (name: string) => {
    await api.deleteMCPServer(name)
    await load()
  }, [load])

  return { servers, loading, error, load, set, remove }
}

export function usePlugins() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlugins(await api.listPlugins())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plugins')
    } finally {
      setLoading(false)
    }
  }, [])

  const toggle = useCallback(async (key: string, enabled: boolean) => {
    // Optimistic update
    setPlugins(prev => prev.map(p => p.key === key ? { ...p, enabled } : p))
    try {
      await api.togglePlugin(key, enabled)
    } catch (e) {
      setPlugins(prev => prev.map(p => p.key === key ? { ...p, enabled: !enabled } : p))
      setError(e instanceof Error ? e.message : 'Toggle failed')
    }
  }, [])

  return { plugins, loading, error, load, toggle }
}
