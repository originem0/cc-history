import { useState } from 'react'
import { SkillsPanel } from './SkillsPanel'
import { CommandsPanel } from './CommandsPanel'
import { MCPPanel } from './MCPPanel'
import { PluginsPanel } from './PluginsPanel'

type ConfigTab = 'skills' | 'commands' | 'mcp' | 'plugins'

const tabs: { key: ConfigTab; label: string }[] = [
  { key: 'skills', label: 'Skills' },
  { key: 'commands', label: 'Commands' },
  { key: 'mcp', label: 'MCP' },
  { key: 'plugins', label: 'Plugins' },
]

export function ConfigView() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('skills')

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-base">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-subtle bg-raised">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg ${
              activeTab === tab.key
                ? 'bg-accent/10 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'skills' && <SkillsPanel />}
        {activeTab === 'commands' && <CommandsPanel />}
        {activeTab === 'mcp' && <MCPPanel />}
        {activeTab === 'plugins' && <PluginsPanel />}
      </div>
    </div>
  )
}
