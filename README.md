# cc-history

本地 Web 工具，用于搜索、浏览、恢复和删除 Claude Code 会话历史，以及管理 Claude Code 配置。

单一二进制文件，双击即用。

## 功能

- **会话浏览** — 按项目分组展示所有 Claude Code 会话，侧边栏树形导航
- **对话预览** — 完整渲染对话内容，支持 Markdown、代码高亮；Thinking/Tool 块单行内联摘要（点击展开）；长文本自动截断（展开全部按钮）
- **会话标题编辑** — 双击标题即可修改，空标题恢复自动提取
- **全文搜索** — 中英文混合搜索，Ctrl+K 快捷键，实时结果下拉
- **恢复会话** — 一键打开终端执行 `claude --resume`（Windows Terminal 优先）
- **删除会话** — 软删除到 `~/.claude/trash/`，可手动恢复
- **自动刷新** — 文件变动 SSE 推送自动刷新（智能 diff，数据不变不触发 re-render）
- **可拖拽侧栏** — 拖动侧边栏右侧边缘调整宽度（200–500px），宽度自动保存
- **浅色主题** — 护眼浅色配色，代码高亮使用 One Light 主题
- **收藏与标签** — 会话可标星、添加自定义标签，支持按收藏过滤
- **导出会话** — 一键导出对话为 Markdown 文件（仅保留 User/Claude 文本，过滤 tool_use/thinking 等中间过程）
- **键盘导航** — 上下方向键快速切换会话
- **配置管理** — 在 Web 界面中管理 Claude Code 的 Skills、Commands、MCP Servers、Plugins

### 配置管理

点击顶部搜索栏旁的齿轮按钮进入配置面板，支持四类配置的增删改查：

| 类型 | 说明 | 存储位置 |
|------|------|----------|
| **Skills** | 用户自定义技能（含 symlink skill） | `~/.claude/skills/*/SKILL.md` |
| **Commands** | Slash 命令（`.md` 文件或子目录） | `~/.claude/commands/` |
| **MCP Servers** | MCP 服务器配置（stdio/sse/http） | `~/.claude/settings.json` → `mcpServers` |
| **Plugins** | 已安装插件的启用/禁用切换 | `installed_plugins.json` + `settings.json` → `enabledPlugins` |

## 快速开始

```
cc-history.exe
```

浏览器自动打开 `http://127.0.0.1:3456`。

## 构建

依赖：Go 1.22+、Node.js 18+

```
build.cmd
```

输出 `cc-history.exe`（约 10MB），内嵌前端静态文件，无外部依赖。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Go 标准库 `net/http`（Go 1.22+ 路由模式） |
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS |
| 字体 | DM Sans + JetBrains Mono（Google Fonts CDN） |
| 打包 | Go `embed.FS` 内嵌 `frontend/dist/` |

## 项目结构

```
cc-history/
├── main.go                        # HTTP 服务 + API 路由
├── embed.go                       # 静态文件嵌入 + SPA fallback
├── build.cmd                      # 构建脚本
├── internal/
│   ├── scanner/scanner.go         # 扫描 ~/.claude/projects/
│   ├── parser/
│   │   ├── types.go               # 数据模型
│   │   └── parser.go              # JSONL 解析（容错）
│   ├── store/
│   │   ├── store.go               # 内存存储 + LRU 缓存
│   │   └── search.go              # 全文搜索
│   ├── launcher/launcher.go       # 终端启动器
│   ├── config/config.go           # 应用配置
│   ├── ccconfig/ccconfig.go       # Claude Code 配置读写（Skills/Commands/MCP/Plugins）
│   ├── meta/meta.go               # 会话元数据（标星、标签、自定义标题）
│   └── watcher/watcher.go         # 文件变动监控（fsnotify）
└── frontend/src/
    ├── App.tsx                    # 主界面（sessions/config 视图切换）
    ├── lib/api.ts                 # API 客户端
    ├── types/index.ts             # TypeScript 类型
    ├── hooks/                     # useSessions, useConversation, useSearch, useConfig, ...
    └── components/
        ├── layout/Sidebar.tsx     # 侧边栏（项目分组 + 会话树）
        ├── search/SearchHeader.tsx # 搜索栏 + 配置入口按钮
        ├── conversation/          # 对话视图、消息气泡、Markdown 渲染
        └── config/                # 配置管理面板
            ├── ConfigView.tsx     # 配置主面板（4 个 Tab）
            ├── SkillsPanel.tsx    # Skills 增删改查
            ├── CommandsPanel.tsx  # Commands 增删改查
            ├── MCPPanel.tsx       # MCP Servers 管理
            └── PluginsPanel.tsx   # Plugins 启用/禁用
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| GET | `/api/sessions?project={dir}` | 会话列表（可按项目过滤） |
| GET | `/api/sessions/{id}/conversation` | 完整对话 |
| GET | `/api/sessions/{id}/export` | 导出对话为 Markdown 文件 |
| GET | `/api/search?q={keyword}&limit=50` | 全文搜索 |
| POST | `/api/sessions/{id}/resume` | 恢复会话 |
| DELETE | `/api/sessions/{id}` | 软删除 |
| POST | `/api/reload` | 重新扫描 |
| GET | `/api/meta/{id}` | 获取会话元数据 |
| PUT | `/api/meta/{id}/star` | 设置收藏状态 |
| PUT | `/api/meta/{id}/title` | 设置自定义标题（空标题恢复默认） |
| POST | `/api/meta/{id}/tags` | 添加标签 |
| DELETE | `/api/meta/{id}/tags/{tag}` | 删除标签 |
| GET | `/api/tags` | 获取所有标签 |
| GET | `/api/events` | SSE 事件流（文件变动推送） |
| GET | `/api/config/skills` | Skills 列表 |
| GET | `/api/config/skills/{name}` | Skill 详情（含 SKILL.md 内容） |
| POST | `/api/config/skills` | 创建 Skill |
| PUT | `/api/config/skills/{name}` | 更新 Skill |
| DELETE | `/api/config/skills/{name}` | 删除 Skill |
| GET | `/api/config/commands` | Commands 列表 |
| GET | `/api/config/commands/{name}` | Command 详情 |
| POST | `/api/config/commands` | 创建 Command |
| PUT | `/api/config/commands/{name}` | 更新 Command |
| DELETE | `/api/config/commands/{name}` | 删除 Command |
| GET | `/api/config/mcp` | MCP Servers 列表 |
| PUT | `/api/config/mcp/{name}` | 创建/更新 MCP Server |
| DELETE | `/api/config/mcp/{name}` | 删除 MCP Server |
| GET | `/api/config/plugins` | Plugins 列表（含 enabled 状态） |
| PUT | `/api/config/plugins/{key}/toggle` | 切换 Plugin 启用/禁用 |

## 设计决策

- **内存存储** — 百量级会话，索引 < 20MB，无需数据库
- **LRU 缓存 3 条对话** — 避免反复解析大 JSONL 文件
- **JSONL 逐行容错** — 跳过损坏行，不崩溃（Claude Code 可能正在写入）
- **绑定 127.0.0.1** — 禁止局域网访问
- **端口冲突自动重试** — 3456 被占用则尝试 3457-3466
- **SPA fallback** — 有扩展名的路径 404，无扩展名的路径返回 index.html
- **软删除** — 文件移到 `~/.claude/trash/{timestamp}_{id}/`
- **Symlink 支持** — Skills/Commands 目录中的符号链接自动解析（插件安装的 skill 通常是 symlink）
- **SSE 智能刷新** — 文件变动推送后前端做 diff 比较，数据不变不触发 re-render，避免 UI 闪跳
- **配置原子写入** — `settings.json` 写入时先写 `.tmp` 再 rename，防止半写状态
- **路径穿越防护** — 配置 API 的 name 参数禁止 `..`、`/`、`\`
