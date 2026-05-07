# Agent Workflow: Feature Development

Этот агент автоматизирует полный цикл разработки фичи — от идеи до коммита в git-flow ветку.

## Быстрый старт

Просто напиши, что хочешь сделать:

```
Добавить эндпоинт для смены пароля
```

Агент сам запустит цикл: обсудит требования, создаст proposal/design/tasks, реализует через TDD, проверит тесты и закоммитит.

## Полный цикл работы

### 1. EXPLORE — обсуждение

Ты описываешь фичу → агент запускает `ralph-loop` и начинает обсуждение.

**Что делает агент:**
- Уточняет требования
- Предлагает 2-3 подхода с trade-offs
- Определяет тестовую стратегию
- Формирует DoD (Definition of Done)

**Пример диалога:**

```
User: Добавить rate limiting на auth endpoints
Agent: Давай обсудим. Какие эндпоинты нужно покрыть?
       Варианты:
       A. Только /auth/login — 5 попыток в минуту
       B. Все /auth/* — с разными лимитами
       C. Гибкая конфигурация через env
       Какой подход ближе?
```

### 2. PROPOSE — создание change

После обсуждения агент предлагает создать OpenSpec change.

**Что делает агент:**
- Проверяет текущую git-ветку
- Определяет тип ветки (feature / release / hotfix)
- Создаёт ветку и change
- Генерирует proposal.md, design.md, tasks.md

**Пример:**
```
Feature: добавить rate limiting
Branch type: feature
Branch: feature/rate-limiting (from develop)
```

Если дизайн-проблема найдётся на этапе разработки — агент сам вернётся сюда обновить артефакты.

### 3. APPLY — реализация через TDD

Агент последовательно выполняет задачи из `tasks.md`, каждая через полный TDD цикл.

**Как это выглядит:**
```
Task 1/3: добавить RateLimitGuard
  RED   → написал тест, проверяем что падает — OK
  GREEN → написал реализацию, тест проходит — OK
  REFACTOR → вынес конфигурацию лимитов

Task 2/3: применить guard к /auth/login
  ...
```

**Если в процессе вскрылась проблема:**
```
Агент: В процессе реализации обнаружил, что RateLimitGuard
       нужно хранить состояние в Redis, а не в памяти.
       Это меняет design. Обновить design.md и tasks.md?
User: Да
  → агент обновляет артефакты в PROPOSE
  → возвращается в APPLY и продолжает
```

### 4. VERIFY — проверка

Автоматическая проверка после реализации.

```
npm run test  ✓ все тесты проходят
npm run build ✓ сборка чистая
```

Если что-то упало → агент возвращается в APPLY и чинит.

### 5. ARCHIVE — завершение

Агент архивирует change, создаёт коммит и завершает цикл.

```
Openspec: change archived → openspec/changes/archive/YYYY-MM-DD-rate-limiting/
Git:     commit → feature/rate-limiting (ждёт подтверждения)
Ralph:   /cancel-ralph (автоматически)
```

После коммита ты можешь сделать push и PR вручную.

---

## Команды

| Команда | Когда использовать |
|---------|-------------------|
| Обычный текст | Опиши фичу — агент сам запустит цикл |
| `/ralph-loop <описание>` | Принудительно запустить цикл с описанием |
| `/cancel-ralph` | Прервать цикл вручную |
| `/opsx-propose` | Пересоздать change (если нужно) |
| `/opsx-apply` | Продолжить реализацию |
| `/opsx-archive` | Заархивировать change вручную |

## Git Flow

```
main
  └── develop
        ├── feature/rate-limiting    ← агент создаёт
        ├── feature/password-reset   ← агент создаёт
        └── release-1.2.0            ← агент создаёт
```

- `feature/*` — новая функциональность (от develop/main)
- `release-*` — подготовка релиза (от develop/main)
- `hotfix/*` — критический багфикс (от master)

Если `develop` не существует — агент использует `main` как base.

## Типы коммитов

Агент использует conventional commits:

| Type | Пример |
|------|--------|
| feat | `feat(auth): add rate limiting to login endpoint` |
| fix | `fix(auth): handle expired tokens gracefully` |
| refactor | `refactor(guard): extract rate limit config` |
| test | `test(auth): add rate limit integration tests` |

## Советы

- **Не дополняй фичу в процессе** — если появилась новая идея, лучше создать отдельный change
- **Прерывай, если нужно** — `/cancel-ralph` в любой момент остановит цикл
- **Смотри артефакты** — `openspec/changes/<name>/` содержит proposal, design и задачи
- **Проверяй тесты** — если агент пропустил TDD, напомни: процесс требует red → green → refactor для каждого изменения
