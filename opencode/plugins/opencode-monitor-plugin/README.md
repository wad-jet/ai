# @opencode-ai/opencode-monitor-plugin

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
├── token_status/
│   ├── 2026-05-14.csv
│   └── ...
└── session-logs/
    ├── 2026-05-14.jsonl
    └── ...
```

### token_status CSV

```
timestamp,agent,session_id,provider_id,model_id,input_tokens,output_tokens,reasoning_tokens,cache_read,cache_write,cost
```

Файлы разбиваются по датам. Одна строка — один `message.updated` event (один ответ модели).

### session-logs JSONL

Каждая строка — JSON:

```json
{
  "timestamp": "2026-05-14T06:55:42.000Z",
  "agent": "default",
  "session_id": "58a91aab-...",
  "input": "текст запроса пользователя",
  "output": "ответ модели в markdown",
  "thinking": "цепочка рассуждений"
}
```

## Сборка

```bash
cd opencode/plugins/opencode-monitor-plugin
npm install
npm run build
```

## Подключение в OpenCode

```bash
cd opencode/plugins/opencode-monitor-plugin
npm pack   # создаст .tgz
npm install -g ./opencode-ai-opencode-monitor-plugin-0.1.0.tgz
```

Добавить в `opencode.json`:

```json
{
  "plugin": [
    "@opencode-ai/opencode-monitor-plugin"
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
