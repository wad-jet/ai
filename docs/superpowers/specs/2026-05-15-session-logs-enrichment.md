# Session Logs Enrichment — Design Spec

## Overview

Add metadata fields to `session-logs` JSONL records: finish reason, duration, mode, errors, project info, git branch, and skills.

## New Fields

### Из `message.updated` event → flushAssistantOutput

| Поле в JSONL | Исходные данные | Тип | Пример |
|-------------|----------------|-----|--------|
| `finish_reason` | `info.finish` | string | `"stop"`, `"length"`, `"tool_use"` |
| `mode` | `info.mode` | string | `"chat"`, `"agent"` |
| `duration_ms` | `info.time.completed - info.time.created` | number | `4523` |
| `error` | `info.error` | object | `{ "type": "api_error", "message": "..." }` |
| `cwd` | `info.path.cwd` | string | `"/Users/user/project"` |

### Из PluginInput (при инициализации) → оба collector'а

| Поле в JSONL | Исходные данные | Тип | Пример |
|-------------|----------------|-----|--------|
| `project_id` | `input.project.id` | string | `"proj_abc123"` |
| `git_branch` | `git rev-parse --abbrev-ref HEAD` | string | `"feature/rate-limiting"` |

### skills (из ToolPart)

В `output.parts` хендлера `chat.message` приходят `ToolPart` с полем `tool: string` — это имя вызванного скила. Собираем уникальные `tool` из всех `ToolPart` за одно сообщение.

Формат — массив строк:

```json
"skills": ["test-driven-development", "writing-plans"]
```

Если скилы не обнаружены — поле отсутствует.

Для записей из `event`-хендлера (flushAssistantOutput) скилы не собираются — они доступны только в `chat.message`.

## Обновляемые функции

### `handleChatMessage` — новые параметры

- `projectId?: string`
- `gitBranch?: string`
- `skills?: string[]` (собирается в `index.ts` из `ToolPart`)

Пишутся во все записи (input и output). `skills` — только для assistant-записей.

### `flushAssistantOutput` — новые параметры

- `finishReason?: string`
- `mode?: string`
- `durationMs?: number`
- `error?: object`
- `cwd?: string`
- `projectId?: string`
- `gitBranch?: string`
- `skills?: string[]`

Пишутся только в assistant-записи.

### `index.ts` — изменения в plugin entry

- `const projectId = input.project.id`
- `const gitBranch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim()`
- В `event`-хендлере: извлечение `info.finish`, `info.mode`, `info.time`, `info.error`, `info.path.cwd`
- В `chat.message`: сбор `ToolPart.tool` из `output.parts` → массив уникальных скилов

## Формат JSONL после изменений

```json
{
  "timestamp": "2026-05-15T06:55:42.000Z",
  "agent": "feature",
  "session_id": "58a91aab-...",
  "username": "odemidov",
  "root_dir": "/Users/user/projects/my-app",
  "project_id": "proj_abc123",
  "git_branch": "feature/monitor",
  "provider_id": "opencode",
  "model_id": "big-pickle",
  "opencode_version": "1.15.0",
  "mode": "agent",
  "finish_reason": "stop",
  "duration_ms": 4523,
  "cwd": "/Users/user/projects/my-app/src",
  "skills": ["test-driven-development"],
  "input": "текст запроса",
  "output": "ответ модели",
  "thinking": "цепочка рассуждений"
}
```

## Тестирование

- Unit-тесты на каждое новое поле в отдельном тесте
- Интеграционный тест проверяет все поля end-to-end
- Тест на отсутствие полей, если данные не переданы (undefined)

## Error Handling

- `git_branch`: если git недоступен — пустая строка, не ошибка
- `duration_ms`: если `time.completed` отсутствует — не пишется
- `error`/`skills`: пишутся только если есть данные
