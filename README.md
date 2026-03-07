# cc-history

本地 Web 工具，用于搜索、浏览、恢复和删除 Claude Code 会话历史。

单一二进制文件，双击即用。

## 功能

- **会话浏览** — 按项目分组展示所有 Claude Code 会话，侧边栏树形导航
- **对话预览** — 完整渲染对话内容，支持 Markdown、代码高亮、折叠的 Thinking/Tool 块
- **全文搜索** — 中英文混合搜索，Ctrl+K 快捷键，实时结果下拉
- **恢复会话** — 一键打开终端执行 `claude --resume`（Windows Terminal 优先）
- **删除会话** — 软删除到 `~/.claude/trash/`，可手动恢复
- **自动刷新** — 文件变动 SSE 推送自动刷新，也可手动触发重新扫描
- **可拖拽侧栏** — 拖动侧边栏右侧边缘调整宽度（200–500px），宽度自动保存
- **浅色主题** — 护眼浅色配色，代码高亮使用 One Light 主题
- **收藏与标签** — 会话可标星、添加自定义标签，支持按收藏过滤
- **键盘导航** — 上下方向键快速切换会话

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
│   └── config/config.go           # 配置
└── frontend/src/
    ├── App.tsx                    # 主界面
    ├── lib/api.ts                 # API 客户端
    ├── types/index.ts             # TypeScript 类型
    ├── hooks/                     # useSessions, useConversation, useSearch, useResizable
    └── components/
        ├── layout/Sidebar.tsx     # 侧边栏（项目分组 + 会话树）
        ├── search/SearchHeader.tsx # 搜索栏 + 下拉结果
        └── conversation/          # 对话视图、消息气泡、Markdown 渲染
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| GET | `/api/sessions?project={dir}` | 会话列表（可按项目过滤） |
| GET | `/api/sessions/{id}/conversation` | 完整对话 |
| GET | `/api/search?q={keyword}&limit=50` | 全文搜索 |
| POST | `/api/sessions/{id}/resume` | 恢复会话 |
| DELETE | `/api/sessions/{id}` | 软删除 |
| POST | `/api/reload` | 重新扫描 |
| GET | `/api/meta/{id}` | 获取会话元数据 |
| PUT | `/api/meta/{id}/star` | 设置收藏状态 |
| POST | `/api/meta/{id}/tags` | 添加标签 |
| DELETE | `/api/meta/{id}/tags/{tag}` | 删除标签 |
| GET | `/api/tags` | 获取所有标签 |
| GET | `/api/events` | SSE 事件流（文件变动推送） |

## 设计决策

- **内存存储** — 百量级会话，索引 < 20MB，无需数据库
- **LRU 缓存 3 条对话** — 避免反复解析大 JSONL 文件
- **JSONL 逐行容错** — 跳过损坏行，不崩溃（Claude Code 可能正在写入）
- **绑定 127.0.0.1** — 禁止局域网访问
- **端口冲突自动重试** — 3456 被占用则尝试 3457-3466
- **SPA fallback** — 有扩展名的路径 404，无扩展名的路径返回 index.html
- **软删除** — 文件移到 `~/.claude/trash/{timestamp}_{id}/`
