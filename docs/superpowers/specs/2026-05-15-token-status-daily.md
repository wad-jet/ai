# Token-Status Daily Breakdown

## Цель

Добавить в `opencode-monitor token-status` опцию `--daily`, которая выводит разбивку метрик токенов по дням с общим итогом.

## Подход

Группировка записей по дате из колонки `timestamp` (первые 10 символов: `YYYY-MM-DD`). Отдельная опция `--daily` добавляет таблицу "Day Breakdown" к существующему выводу.

## Интерфейс

```
opencode-monitor token-status                   # как сейчас (сводка + агенты)
opencode-monitor token-status --daily           # сводка + по дням + по агентам
opencode-monitor token-status --daily --trend-days=30 --agent-top-n=5
```

## Пример вывода

```
Token Usage Summary
══════════════════════════════════════════════════
  Total Input:     2,400
  Total Output:    1,200
  Reasoning:         150
  Cache Read:        500
  Cache Write:       100
  Total Cost:      $0.0480
  API Calls:          20

Day Breakdown
══════════════════════════════════════════════════════════════════════════
  Date         Calls    Input      Output     Reasoning  Cache R   Cache W   Cost
  ──────────────────────────────────────────────────────────────────────────────
  2026-05-14      12    1,500        750          100       300        60    $0.0300
  2026-05-15       8      900        450           50       200        40    $0.0180
  ──────────────────────────────────────────────────────────────────────────────
  Total:          20    2,400      1,200          150       500       100    $0.0480

Agent Breakdown
══════════════════════════════════════════════════════════════════════
  Agent         Calls    Input      Output     Cost
  ────────────────────────────────────────────────────────────
  agent-a          15    1,800        900    $0.0380
  agent-b           5      600        300    $0.0100
```

## Компоненты

### `src/queries/token-query.ts`
- Добавить `DailyRow` интерфейс
- Добавить `queryDailyBreakdown(base, days): DailyRow[]`
  - Читает CSV через `readCSV`
  - Группирует по `row[COL.TS].slice(0, 10)`
  - Суммирует input, output, reasoning, cacheRead, cacheWrite, cost, hits
  - Сортирует по дате

### `src/queries/token-query.test.ts`
- Тест `queryDailyBreakdown` с CSV за 2 дня
- Проверка сумм по дням
- Проверка пустого результата

### `src/cli/commands/token-status.ts`
- Добавить `formatDailyTable(rows: DailyRow[]): string`
- В `runTokenStatusCLI`: если `args.daily` — вызывать `queryDailyBreakdown` и добавлять таблицу

### `src/cli/commands/token-status.test.ts`
- Тест `formatDailyTable` с корректным форматированием
- Тест с пустым массивом

## Файловая структура

```
src/
  queries/
    token-query.ts                   # + DailyRow, queryDailyBreakdown
    token-query.test.ts              # + тесты daily breakdown
  cli/commands/
    token-status.ts                  # + formatDailyTable, --daily
    token-status.test.ts             # + тесты daily format
README.md                            # обновить документацию
docs/superpowers/specs/
  2026-05-15-token-status-daily.md   # данный spec
```
