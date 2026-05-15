# session-log CLI: Параметры фильтрации

## Мотивация

Привести `session-log` к единому `--flag=value` стилю с `token-status` и `cleanup`.
Добавить гибкие фильтры по всем полям лога для точечного просмотра сессий.

## Текущее состояние

Сейчас `session-log` использует только позиционные аргументы:

```
opencode-monitor session-log <session-id>   # просмотр
opencode-monitor session-log list           # список сессий
opencode-monitor session-log search <text>  # поиск по тексту
```

Нет фильтров по дате, агенту, типу полей, tail, ошибкам.

## Дизайн

### Просмотр сессии (`session-log <session-id>`)

Базовый просмотр остаётся без изменений. Добавляются опциональные флаги:

```
opencode-monitor session-log <session-id> [options]
```

### Параметры

| Параметр | Тип | Описание | По умолчанию |
|----------|-----|----------|--------------|
| `--date YYYY-MM-DD` | string | Только записи за указанную дату (по `timestamp`) | — |
| `--since YYYY-MM-DD` | string | Начиная с даты (включительно) | — |
| `--until YYYY-MM-DD` | string | Заканчивая датой (включительно) | — |
| `--agent <name>` | string | Фильтр по имени агента (`feature`, `explore` и т.д.) | — |
| `--field <field>` | `input`/`output`/`thinking`/`all` | Какие поля показывать | `all` |
| `--tail <N>` | number | Последние N запросов в сессии | все |
| `--error` | boolean | Только записи с ошибками (поле `error` не пусто) | `false` |

### Примеры

```bash
# Только за конкретную дату
opencode-monitor session-log sess-123 --date 2026-05-14

# Только ответы модели (без input)
opencode-monitor session-log sess-123 --field output

# Только цепочки рассуждений
opencode-monitor session-log sess-123 --field thinking

# Последние 5 запросов
opencode-monitor session-log sess-123 --tail 5

# Диапазон дат
opencode-monitor session-log sess-123 --since 2026-05-14 --until 2026-05-15

# Фильтр по агенту
opencode-monitor session-log sess-123 --agent feature

# Только ошибки
opencode-monitor session-log sess-123 --error

# Комбинированный
opencode-monitor session-log sess-123 --agent explore --field output --tail 3 --since 2026-05-14
```

### Комбинирование фильтров

Все фильтры работают через **AND**:
- `--date` — фильтр по `timestamp.slice(0,10) === date`
- `--since` — фильтр по `timestamp >= since`
- `--until` — фильтр по `timestamp <= until + 1 day`
- `--agent` — точное совпадение по `agent`
- `--error` — запись содержит непустое поле `error`
- `--field` — выбор колонок для вывода (не фильтр записей)
- `--tail` — ограничение количества выводимых записей (берутся последние N после всех фильтров)

### Вывод

При наличии `--field`:
- `input` — показывать только Input-секцию (без Output/Thinking)
- `output` — показывать только Output-секцию (без Input/Thinking)
- `thinking` — показывать только Thinking-секцию
- `all` — показывать всё (как сейчас)

## План реализации

1. Обновить `runSessionLogCLI()`: принимать опциональные параметры через `LogFilters`
2. Обновить `cli/index.ts`: передавать `parseArgs()` в `session-log`
3. Обновить help/text в `default`-ветке
4. Обновить README
5. Написать/обновить тесты
