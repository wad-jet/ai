# Cleanup CLI Command for opencode-monitor

## Цель

Добавить в CLI opencode-monitor команду для удаления старых файлов логов и метрик с указанием срока в днях, старше которых данные нужно удалить. Удаление — с обязательным подтверждением.

## Архитектура

### Approach: Удаление на уровне файлов

Данные на диске уже разбиты по дням (`YYYY-MM-DD.csv` / `YYYY-MM-DD.jsonl`) в двух поддиректориях `token_status/` и `session-logs/`. Удаляем целиком дневные файлы, дата которых старше N дней от сегодня. Это безопасно, т.к. файлы — append-only и изолированы друг от друга.

### Команда CLI

```
opencode-monitor cleanup --days <N> [--session-logs] [--token-status] [--dry-run]
```

**Обязательные параметры:**
- `--days <N>` — количество дней. Удалить данные, созданные раньше чем N дней назад.

**Опциональные фильтры (хотя бы один):**
- `--session-logs` — удалять только логи сессий
- `--token-status` — удалять только метрики токенов
- Если ни один не указан — удаляются оба типа

**Опции:**
- `--dry-run` — показать, какие файлы будут удалены и их суммарный размер, без фактического удаления

### Процесс удаления (без `--dry-run`)

1. Сбор файлов, подлежащих удалению (по тем же правилам, что в `--dry-run`)
2. Если файлов нет → сообщение "No files to delete." и выход
3. Вывод preview (таблица с датами, типами, размером файлов, суммарным размером + количеством файлов)
4. Запрос подтверждения: `"Delete N files? (yes/no): "` — читаем одну строку из stdin
5. На `yes` (регистронезависимо) — удаляем все файлы через `fs.unlinkSync`
6. На любой другой ответ — "Cancelled."

### Preview (таблица)

```
Files to delete:
  Date         Type          Size
  2025-12-01   session-logs  1.2 MB
  2025-12-01   token-status  0.3 MB
  2025-11-15   session-logs  0.8 MB
  ...
  Total: 14 files, ~2.3 MB
```

### Компоненты

**Новый файл:** `src/cli/commands/cleanup.ts`

```
runCleanupCLI(args: {
  days: number;
  sessionLogs: boolean;
  tokenStatus: boolean;
  dryRun: boolean;
}): string
```

Логика:
1. Вычислить `cutoffDate = new Date(Date.now() - days * 86400000)`
2. Получить список файлов из нужных поддиректорий (`getDataDir() + "/session-logs"`, `getDataDir() + "/token_status"`)
3. Для каждого файла: проверить, что имя соответствует `YYYY-MM-DD.ext`, спарсить дату, проверить `fileDate < cutoffDate`
4. Собрать массив `{ date, type, size, path }`
5. Если пусто и не `dryRun` → "No files to delete."
6. Если `dryRun` → отформатировать preview без запроса подтверждения
7. Если не `dryRun` → preview + запрос подтверждения → удаление

**Модификация:** `src/cli/index.ts`
- Добавить case `cleanup`
- Парсить `--days`, `--session-logs`, `--token-status`, `--dry-run`

**Модификация:** `README.md`
- Добавить секцию с cleanup в Usage > CLI

### Тесты

**Новый файл:** `src/cli/commands/cleanup.test.ts`

- Тест с пустой директорией
- Тест `--dry-run` с файлами разного возраста
- Тест фильтрации `--session-logs` / `--token-status`
- Тест с `--days 0` (ничего не удалять, т.к. файлы датированы сегодняшним днём не могут быть "старше 0 дней")
- Тест с подтверждением (симулировать stdin)
- Тест с `--days=30` — только файлы старше 30 дней попадают в список

### Обработка ошибок

- Невалидный `--days` (не число, отрицательное) — `throw / return error message`
- Директория не существует — пустой результат, не ошибка
- Внутри директории есть не-файлы (поддиректории) — игнорировать
- Права доступа при `readdirSync` / `unlinkSync` — пробрасывать ошибку

### Файловая структура (что меняется)

```
src/
  cli/
    index.ts                        # + case cleanup
    commands/
      cleanup.ts                    # NEW: основная логика
      cleanup.test.ts               # NEW: тесты
README.md                           # + cleanup секция в CLI
docs/superpowers/specs/
  2026-05-15-cleanup-command.md     # данный spec (NEW)
```
