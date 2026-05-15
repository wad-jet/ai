# @opencode-dev/opencode-monitor-plugin

Плагин для мониторинга использования токенов и логирования сессий в OpenCode.

## Возможности

- **Статистика токенов** — сбор и агрегация входящих/исходящих токенов, reasoning tokens, cache read/write, стоимости
- **Лог сессий** — запись input/output модели, цепочек рассуждений (thinking) и применённых скилов
- **Tool** — запрос статистики через `/` команду в OpenCode
- **CLI** — запрос статистики и просмотр логов из терминала

## Структура данных

Корневой путь: `~/.local/share/opencode/opencode-monitor-plugin`

```
~/.local/share/opencode/opencode-monitor-plugin/
├── token_status/          # статистика использования токенов по дням
│   ├── 2026-05-14.csv
│   ├── 2026-05-15.csv
│   └── ...
└── session-logs/          # логи запросов и ответов модели по дням
    ├── 2026-05-14.jsonl
    ├── 2026-05-15.jsonl
    └── ...
```

Каждая директория внутри разбивает данные по дням (UTC). Один файл — все записи за одну дату.

---

### token_status/ — статистика токенов

**Назначение:** сбор данных о потреблении токенов для последующей агрегации и расчёта стоимости.

**Формат:** CSV без заголовка, одна строка — один `message.updated` event (один ответ модели).

```
timestamp,agent,session_id,provider_id,model_id,input_tokens,output_tokens,reasoning_tokens,cache_read,cache_write,cost
```

| Поле | Тип | Описание |
|------|-----|----------|
| `timestamp` | ISO 8601 | Время события |
| `agent` | string | Имя агента (build, explore, feature и т.д.) |
| `session_id` | string | ID сессии |
| `provider_id` | string | Провайдер модели (opencode, anthropic, openai и т.д.) |
| `model_id` | string | Модель (big-pickle, claude-sonnet-4, gpt-4o и т.д.) |
| `input_tokens` | number | Входящие токены |
| `output_tokens` | number | Исходящие токены |
| `reasoning_tokens` | number | Токены цепочки рассуждений (thinking/reasoning) |
| `cache_read` | number | Токены, прочитанные из кэша |
| `cache_write` | number | Токены, записанные в кэш |
| `cost` | number | Стоимость в долларах (0, если модель не имеет цены) |

**Коллектор:** hook `event` (событие `message.updated`). Записывается каждый чанк ответа модели, содержащий токены.

---

### session-logs/ — логи сессий

**Назначение:** запись полного текста запросов пользователя и ответов модели для просмотра и поиска.

**Формат:** JSONL (одна JSON-строка на запись).

```json
{
  "timestamp": "2026-05-14T06:55:42.000Z",
  "agent": "feature",
  "session_id": "58a91aab-63d2-4e12-ab4e-ca3342260b0f",
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
  "error": { "type": "api_error", "message": "timeout" },
  "skills": ["test-driven-development", "writing-plans"],
  "input": "текст запроса пользователя",
  "output": "ответ модели в markdown",
  "thinking": "цепочка рассуждений модели (опционально)"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `timestamp` | ISO 8601 | Время сообщения |
| `agent` | string | Имя агента, отправившего сообщение |
| `session_id` | string | ID сессии |
| `username` | string | Системное имя пользователя (из `os.userInfo()`) |
| `root_dir` | string | Путь к корневой папке проекта (опционально) |
| `project_id` | string | ID проекта (из `input.project.id`, опционально) |
| `git_branch` | string | Текущая ветка git (из `git rev-parse --abbrev-ref HEAD`, опционально) |
| `provider_id` | string | Провайдер модели (опционально) |
| `model_id` | string | Модель (опционально) |
| `opencode_version` | string | Версия OpenCode (из `opencode --version`) |
| `mode` | string | Режим: agent/chat (только для assistant, опционально) |
| `finish_reason` | string | Причина завершения: stop/length/error/tool_use (только для assistant, опционально) |
| `duration_ms` | number | Длительность ответа в мс (только для assistant, опционально) |
| `cwd` | string | Рабочая директория на момент запроса (только для assistant, опционально) |
| `error` | object | Объект ошибки, если ответ завершился с ошибкой (опционально) |
| `skills` | string[] | Список вызванных скилов (только для assistant, опционально) |
| `input` | string | Текст запроса пользователя (только для user-сообщений) |
| `output` | string | Текст ответа модели (только для assistant-сообщений) |
| `thinking` | string | Цепочка рассуждений модели (только если есть) |

**Коллектор:** hook `chat.message` для прямых сообщений и hook `event` (части `part`) для потокового сбора ответов. Для каждого обмена user → assistant создаётся две записи: одна с `input`, другая с `output`.

## Сборка

```bash
cd opencode/plugins/opencode-monitor-plugin
npm install
npm run build
```

## Подключение в OpenCode

Добавить в `opencode.json`:

```json
{
  "plugin": [
    "@opencode-dev/opencode-monitor-plugin"
  ]
}
```

Плагин должен быть установлен как npm-пакет в окружении OpenCode (либо добавлен в зависимости `.opencode/package.json`, либо установлен глобально).

После подключения плагин автоматически:
- Собирает статистику токенов через hook `event` (`message.updated`)
- Логирует запросы/ответы через hook `chat.message`

## Использование

### Tool (внутри OpenCode)

```
/token_status
/token_status session_id=abc-123
/token_status trend_days=30 agent_top_n=5
```

Параметры:

| Параметр | Тип | Описание | По умолчанию |
|----------|-----|----------|--------------|
| `session_id` | string | ID сессии для просмотра | текущая |
| `include_children` | boolean | Включить дочерние сессии | false |
| `agent_view` | string | `execution`, `initiator`, `both` | `both` |
| `agent_sort` | string | Сортировка по `cost` или `tokens` | `cost` |
| `agent_top_n` | number | Показать топ N агентов (0 = все) | 10 |
| `trend_days` | number | Дней для анализа трендов | 7 |
| `scope` | string | `project` или `all` | `all` |
| `compact` | boolean | Пропустить тяжёлые таблицы | false |
| `debug` | boolean | Показать отладочную информацию | false |

### CLI

```bash
# Статистика токенов
opencode-monitor token-status
opencode-monitor token-status --trend-days=30 --agent-top-n=5

# Просмотр логов сессии
opencode-monitor session-log <session-id>

# Список доступных сессий
opencode-monitor session-log list

# Поиск по содержимому логов
opencode-monitor session-log search "ошибка"
```

### Формат вывода

**Tool** — markdown-таблицы, встраиваемые в диалог с AI:

```
## Token Usage Summary
| Metric | Value |
|--------|-------|
| Total Input Tokens | 1,500 |
| Total Output Tokens | 750 |
| **Total Cost** | **$0.0350** |

## Agent Breakdown
| Agent | Calls | Input | Output | Cost |
|-------|-------|-------|--------|------|
| default | 3 | 1,000 | 500 | $0.0300 |
```

**CLI** — ASCII-таблицы для терминала.
