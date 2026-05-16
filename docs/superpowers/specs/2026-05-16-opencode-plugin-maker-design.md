# opencode-plugin-maker Design

## Overview

Skill-справочник для создания плагинов opencode. Комбинированный approach: reference API всех хуков + process-гайд по разработке от идеи до публикации.

## Структура

Один SKILL.md без дополнительных файлов (всё в одном документе для экономии контекста).

Тип скилла: **Reference + Process** (справочник с workflow).

## Секции SKILL.md

### 1. Overview
- Что такое плагины и зачем их писать
- Концепция: плагин = функция, возвращающая hooks

### 2. Architecture
- Load order: global config → project config → global plugins dir → project plugins dir
- Lifecycle: загрузка при старте, hooks запускаются последовательно
- Plugin function signature

### 3. Quick Reference Table
- Таблица всех хуков с сигнатурами (tool, shell, chat, session, permission, command, auth, provider, compaction, config, event)
- Категоризация по группам

### 4. Plugin API Reference
Детальное описание всех типов и интерфейсов:

- **Plugin type**: `(input: PluginInput, options?: PluginOptions) => Promise<Hooks>`
- **PluginInput**: `{ client, project, $, directory, worktree, experimental_workspace, serverUrl }`
- **Hooks interface**: все хуки с полными TypeScript сигнатурами
- **Tool helper**: `tool({ description, args, execute })`
- **ToolContext**: `{ sessionID, messageID, agent, directory, worktree, abort, metadata(), ask() }`
- **Auth hooks**: `AuthHook`, `AuthOAuthResult`
- **Provider hooks**: `ProviderHook`, `ProviderHookContext`
- **Workspace adapters**: `WorkspaceAdapter`, `WorkspaceInfo`, `WorkspaceTarget`
- **Config types**: `Config`, `PluginOptions`

### 5. Setup & Installation
- Local plugins: `.opencode/plugins/` vs `~/.config/opencode/plugins/`
- npm plugins: `opencode.json` → `plugin` array
- Dependencies: `package.json` в config directory
- Bun автоматический `bun install` при старте
- TypeScript support

### 6. Development Workflow (Process)
Пошаговый процесс создания плагина:

1. **Scaffold**: создать директорию и package.json
2. **Implement**: написать plugin функцию с нужными hooks
3. **Test locally**: подключить в `.opencode/plugins/`, перезапустить opencode
4. **Debug**: использовать `client.app.log()` для структурированного логирования
5. **Publish to npm**: опубликовать пакет
6. **Add to ecosystem**: PR в opencode docs

### 7. Examples (из официальной документации)
- Notification plugin (event hook + osascript)
- .env protection (tool.execute.before with throw)
- Inject environment variables (shell.env)
- Custom tools (tool helper)
- Logging (client.app.log)
- Compaction hooks (experimental.session.compacting)
- Auth plugin (auth hook)
- Provider plugin (provider hook)

### 8. Common Patterns & Pitfalls
- **Pattern**: Intercept + Modify (tool.execute.before/after)
- **Pattern**: Context injection (chat.message with noReply)
- **Pattern**: Environment injection (shell.env)
- **Pitfall**: Plugin name collision (local vs npm)
- **Pitfall**: Async hooks without proper error handling
- **Pitfall**: Forgetting `noReply: true` when injecting context

### 9. SDK Integration Reference
Краткая шпаргалка по `client` API:
- `client.app.log()` — логирование
- `client.session.prompt()` — отправка промптов
- `client.tui.*` — управление TUI
- `client.file.*` / `client.find.*` — работа с файлами
- `client.event.subscribe()` — real-time events

## Description Field

```yaml
name: opencode-plugin-maker
description: Use when creating opencode plugins, custom tools, or workspace adapters; when you need to hook into opencode events (tool execution, chat, shell, permissions, session lifecycle, auth, providers, or compaction)
```

## Dependencies

Скилл не требует внешних зависимостей — это документация. Однако сам плагин использует `@opencode-ai/plugin` — это будет указано в примерах.

## Установка скилла

```bash
# Скопировать в проект
cp -r opencode-plugin-maker/ .opencode/skills/opencode-plugin-maker/

# Или установить через git submodule
```
