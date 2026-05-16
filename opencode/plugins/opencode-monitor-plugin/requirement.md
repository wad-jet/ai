# opencode-monitor-plugin

## Стек

* JavaScript, TS
* npm package

## Функци

Собираемая статистика, логи хранятся в файлах. Формат логов, строка в JSON формате.
Файлы разбиваются по датам.

В лог записи есть обязательные поля:
- timestamp - дата и время записи
- agent: (string): идентификатор агента
- session_id (string): идентификатор сессии

Корневой путь ~/.local/share/opencode/opencode-monitor-plugin, далее по папкам:
- token-status - CSV/JSON файлы статистики токенов
- session-logs - JSON-логи запросов/ответов (по датам)

### Статистика входящих/исходящих токенов (token-status)

Show detailed token usage for the current or specified session.

Parameters:

* session_id (string, optional): Session ID to inspect. Defaults to current.
* include_children (boolean, optional): Include child sessions in aggregation.
* agent_view (string, optional): "execution", "initiator", or "both" (default).
* agent_sort (string, optional): Sort tables by "cost" (default) or "tokens".
* agent_top_n (number, optional): Show top N agents (default: 10). Use 0 to show all.
* trend_days (number, optional): Number of days for trend analysis (default: 7).
* scope (string, optional): Filter historical trends to "project" or "all" (default).
* compact (boolean, optional): Skip heavy tables (auto-enabled for Antigravity models).
* debug (boolean, optional): Include debug information.

### Лог запросов и ответов от модели

На каждый пользовательский запрос (input) формируется запись

В логе фиксируется:
* skills (string[], optional): список примененных скилов
* input (string, required): текст запрос от пользователя
* output (string, required): текст ответа модели в формате MD
* thinking (string, optional): цепочка рассуждений