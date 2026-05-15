# @opencode-dev/opencode-monitor-plugin

Плагин для мониторинга использования токенов и логирования сессий в OpenCode.

## Возможности

- **Статистика токенов** — сбор и агрегация входящих/исходящих токенов, reasoning tokens, cache read/write, стоимости
- **Лог сессий** — запись input/output модели, цепочек рассуждений (thinking), метаданных (finish_reason, duration_ms, mode, error, cwd), project_id, git_branch и применённых скилов
- **Slash-команда `/token-status`** — запрос статистики прямо из диалога с AI
- **CLI** — запрос статистики и очистка данных из терминала

## Установка

Плагин подключается через `opencode.json`:

```json
{
  "plugin": ["./opencode/plugins/opencode-monitor-plugin/dist/index.js"]
}
```

После подключения плагин автоматически:
- Собирает статистику токенов через hook `event` (`message.updated`)
- Логирует запросы/ответы через hook `chat.message`
- Регистрирует slash-команду `/token-status` (копирует command-файл в `~/.config/opencode/command/`)

### Зависимости

```bash
cd opencode/plugins/opencode-monitor-plugin
npm install
npm run build
```

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

Каждая директория разбивает данные по дням (UTC). Один файл — все записи за одну дату.

### token_status/ — статистика токенов

**Формат:** CSV без заголовка, одна строка — один `message.updated` event.

```
timestamp,agent,session_id,provider_id,model_id,input_tokens,output_tokens,reasoning_tokens,cache_read,cache_write,cost
```

| Поле | Тип | Описание |
|------|-----|----------|
| `timestamp` | ISO 8601 | Время события |
| `agent` | string | Имя агента (feature, explore, task и т.д.) |
| `session_id` | string | ID сессии |
| `provider_id` | string | Провайдер модели (opencode, anthropic, openai и т.д.) |
| `model_id` | string | Модель (big-pickle, claude-sonnet-4, gpt-4o и т.д.) |
| `input_tokens` | number | Входящие токены |
| `output_tokens` | number | Исходящие токены |
| `reasoning_tokens` | number | Токены цепочки рассуждений (thinking) |
| `cache_read` | number | Токены, прочитанные из кэша |
| `cache_write` | number | Токены, записанные в кэш |
| `cost` | number | Стоимость в долларах (0, если нет цены) |

### session-logs/ — логи сессий

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
  "thinking": "цепочка рассуждений (опционально)"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `timestamp` | ISO 8601 | Время сообщения |
| `agent` | string | Имя агента |
| `session_id` | string | ID сессии |
| `username` | string | Системное имя пользователя (из `os.userInfo()`) |
| `root_dir` | string | Путь к корню проекта |
| `project_id` | string | ID проекта (из `input.project.id`, опционально) |
| `git_branch` | string | Текущая ветка git (опционально) |
| `provider_id` | string | Провайдер модели (опционально) |
| `model_id` | string | Модель (опционально) |
| `opencode_version` | string | Версия OpenCode |
| `mode` | string | Режим: `agent`/`chat` (только assistant, опционально) |
| `finish_reason` | string | Причина завершения: `stop`/`length`/`error`/`tool_use` (только assistant, опционально) |
| `duration_ms` | number | Длительность ответа в мс (только assistant, опционально) |
| `cwd` | string | Рабочая директория на момент запроса (только assistant, опционально) |
| `error` | object | Объект ошибки (только assistant, опционально) |
| `skills` | string[] | Список вызванных скилов (только assistant, опционально) |
| `input` | string | Текст запроса пользователя (только user) |
| `output` | string | Текст ответа модели (только assistant) |
| `thinking` | string | Цепочка рассуждений модели (опционально) |

## Использование

### Slash-команда `/token-status` (в диалоге с AI)

После подключения плагина в OpenCode доступна команда `/token-status`. При вводе команды AI вызывает内置ный тул и показывает статистику.

```
/token-status
/token-status daily=true
/token-status trend_days=30
/token-status agent_view=execution agent_top_n=5
/token-status session_id=abc-123
/token-status daily=true trend_days=30 agent_view=initiator agent_top_n=0
```

Команда принимает key=value аргументы:

| Параметр | Тип | Описание | По умолчанию |
|----------|-----|----------|--------------|
| `session_id` | string | ID сессии для просмотра | текущая |
| `include_children` | boolean | Включить дочерние сессии | `false` |
| `agent_view` | string | Режим: `execution` (агенты-исполнители), `initiator` (агенты-инициаторы), `both` | `both` |
| `agent_sort` | string | Сортировка агентов: `cost` (по стоимости) или `tokens` (по токенам) | `cost` |
| `agent_top_n` | number | Показать топ N агентов. `0` = все | `10` |
| `trend_days` | number | Глубина анализа трендов в днях | `7` |
| `scope` | string | Фильтр: `project` (только текущий проект) или `all` (все проекты) | `all` |
| `compact` | boolean | Пропустить тяжёлые таблицы (агенты, тренды) | `false` |
| `debug` | boolean | Показать отладочную информацию | `false` |

**Пример вывода** (в диалоге — markdown-таблицы):

```
## Token Usage Summary
| Metric | Value |
|--------|-------|
| Total Input Tokens | 1,500 |
| Total Output Tokens | 750 |
| Reasoning Tokens | 200 |
| Cache Read Tokens | 100 |
| Cache Write Tokens | 50 |
| **Total Cost** | **$0.0350** |

## Agent Breakdown
| Agent | Calls | Input | Output | Cost |
|-------|-------|-------|--------|------|
| default | 3 | 1,000 | 500 | $0.0300 |
| feature | 1 | 500 | 250 | $0.0050 |
```

Режим `--daily` группирует статистику по календарным дням (дата извлекается из поля `timestamp`, а не из имени файла — это корректно работает, если за полный день накопилось несколько дневных файлов). Показывает количество вызовов модели, сумму входящих и исходящих токенов и общую стоимость за каждый день. Полезно для отслеживания дневных паттернов потребления, особенно в сочетании с `trend_days`.

```
## Daily Breakdown
| Date | Calls | Input | Output | Cost |
|------|-------|-------|--------|------|
| 2026-05-14 | 5 | 2,000 | 1,000 | $0.0400 |
| 2026-05-15 | 3 | 1,000 | 500 | $0.0200 |
```

### CLI

CLI-утилита `opencode-monitor` устанавливается вместе с плагином.

```bash
# Статистика токенов (сводка + разбивка по агентам)
opencode-monitor token-status

# Сводка с разбивкой по дням
opencode-monitor token-status --daily

# Глубина анализа 30 дней, топ-5 агентов
opencode-monitor token-status --trend-days=30 --agent-top-n=5

# Разбивка по дням за 30 дней, все агенты
opencode-monitor token-status --daily --trend-days=30 --agent-top-n=0

# Параметры CLI (соответствуют параметрам slash-команды)
opencode-monitor token-status --trend-days=30 --agent-view=initiator --agent-sort=tokens
```

**Параметры CLI `token-status`:**

| Параметр | Тип | Описание | По умолчанию |
|----------|-----|----------|--------------|
| `--session-id` | string | ID сессии | текущая |
| `--include-children` | boolean | Включить дочерние сессии | `false` |
| `--agent-view` | `execution`/`initiator`/`both` | Режим отображения агентов | `both` |
| `--agent-sort` | `cost`/`tokens` | Сортировка | `cost` |
| `--agent-top-n` | number | Топ N агентов (0 = все) | `10` |
| `--trend-days` | number | Глубина анализа трендов | `7` |
| `--scope` | `project`/`all` | Фильтр проекта | `all` |
| `--compact` | boolean | Без тяжёлых таблиц | `false` |
| `--debug` | boolean | Отладка | `false` |
| `--daily` | boolean | Разбивка по дням | `false` |

**Пример вывода CLI** (ASCII-таблицы):

```
 Token Usage Summary
┌─────────────────────────┬────────────┐
│ Metric                  │       Value │
├─────────────────────────┼────────────┤
│ Total Input Tokens      │      1,500 │
│ Total Output Tokens     │        750 │
│ Total Cost              │    $0.0350 │
└─────────────────────────┴────────────┘
 Agent Breakdown (top 10)
┌─────────┬───────┬────────┬────────┬─────────┐
│ Agent   │ Calls │  Input │ Output │    Cost │
├─────────┼───────┼────────┼────────┼─────────┤
│ default │     3 │  1,000 │    500 │ $0.0300 │
│ feature │     1 │    500 │    250 │ $0.0050 │
└─────────┴───────┴────────┴────────┴─────────┘
```

### session-log — просмотр логов сессий

Команда для чтения сохранённых JSONL-логов. Поддерживает три режима: просмотр по ID (с фильтрами), список сессий, поиск по тексту.

```bash
# Просмотр логов конкретной сессии
opencode-monitor session-log <session-id>

# Просмотр с фильтрами
opencode-monitor session-log <session-id> --date 2026-05-14
opencode-monitor session-log <session-id> --agent feature
opencode-monitor session-log <session-id> --field output
opencode-monitor session-log <session-id> --tail 5
opencode-monitor session-log <session-id> --error
opencode-monitor session-log <session-id> --since 2026-05-14 --until 2026-05-15

# Список всех доступных сессий (с датами)
opencode-monitor session-log list

# Поиск по содержимому логов
opencode-monitor session-log search "ошибка авторизации"
```

**Параметры просмотра (`--date`, `--since`, `--until`, `--agent`, `--field`, `--tail`, `--error`):**

| Параметр | Тип | Описание | По умолчанию |
|----------|-----|----------|--------------|
| `--date` | YYYY-MM-DD | Только записи за указанную дату (по `timestamp`) | — |
| `--since` | YYYY-MM-DD | Начиная с даты (включительно) | — |
| `--until` | YYYY-MM-DD | Заканчивая датой (включительно) | — |
| `--agent` | string | Фильтр по имени агента (`feature`, `explore` и т.д.) | — |
| `--field` | `input`/`output`/`thinking`/`all` | Какие поля показывать | `all` |
| `--tail` | number | Последние N запросов в сессии | все |
| `--error` | boolean | Только записи с ошибками (поле `error` не пусто) | `false` |

**Режимы:**

| Режим | Использование | Описание |
|-------|---------------|----------|
| `view` | `session-log <session-id>` | Показывает все записи сессии: timestamp, agent, input, output, thinking |
| `list` | `session-log list` | Список уникальных session_id с первой датой появления |
| `search` | `session-log search <text>` | Поиск по input/output, вывод совпадений с превью (первые 80 символов input) |

**Пример вывода `session-log list`:**

```
Available Sessions
════════════════════════════════════════════════════════════════════════════════
  2026-05-14T06:55:42.000Z  58a91aab-63d2-4e12-ab4e-ca3342260b0f
  2026-05-14T07:10:15.000Z  a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Пример вывода `session-log <id>`:**

```
────────────────────────────────────────────────────────────────────────────
Time:    2026-05-14T06:55:42.000Z
Agent:   feature

Input:
Напиши функцию для сортировки массива

Output:
Вот функция сортировки пузырьком...

Thinking:
Пользователь просит сортировку, предложу оптимальный вариант
```

### Cleanup — очистка старых данных

Команда для удаления старых дневных файлов. Файлы удаляются целиком (один файл = один день).

**Процесс:**
1. Сбор файлов из `token_status/` и/или `session-logs/` старше N дней
2. Вывод таблицы с датами, типом и размером
3. Запрос подтверждения: `Delete N files? (yes/no):`
4. Только после `yes` — безвозвратное удаление

```bash
# Удалить все данные старше 30 дней
opencode-monitor cleanup --days 30

# Только логи сессий старше 90 дней
opencode-monitor cleanup --days 90 --session-logs

# Только метрики токенов старше 7 дней
opencode-monitor cleanup --days 7 --token-status

# Предпросмотр (без удаления)
opencode-monitor cleanup --days 30 --dry-run
```

**Параметры `cleanup`:**

| Параметр | Тип | Описание | По умолчанию |
|----------|-----|----------|--------------|
| `--days` | number | **Обязательный.** Хранить файлы не старше N дней | — |
| `--session-logs` | boolean | Только логи сессий | `false` |
| `--token-status` | boolean | Только метрики токенов | `false` |
| `--dry-run` | boolean | Предпросмотр без удаления | `false` |

Если не указаны `--session-logs` и `--token-status`, очищаются оба типа данных.
