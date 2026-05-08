# Спецификация Feature Agent

## Назначение

Спецификация описывает полный цикл работы агента над новой фичей — от идеи до коммита в git-flow ветку. Процесс работает внутри ralph-loop, который активен от EXPLORE до ARCHIVE. Поддерживается feedback loop между разработкой и дизайном.

<HARD-GATE>
Используется **только** скиллы из https://github.com/obra/superpowers
</HARD-GATE>

---

## Архитектура потока

**Ralph Loop:** активен от EXPLORE до ARCHIVE

```flow
[START]
  │
  ▼
+─────────+
| EXPLORE | ← brainstorming
+─────────+
  │
  ▼
+─────────+     feedback if issues found
| PROPOSE | ← writing-plans + git-worktrees
+─────────+
  │
  ▼
+─────────+
| APPLY   | ← subagent-driven-development + test-driven-development
+─────────+
  │  if fails
  │ feedback from plan/requirements
  ▼
+─────────+
| VERIFY  | ← verification-before-completion
+─────────+
  │  if passes
  ▼
+─────────+     cancel-ralph
| ARCHIVE | ← finishing-a-development-branch
+─────────+
  │
  ▼
[READY FOR PR]
```

**Ручной feedback loop (через /cancel-ralph):**

```
APPLY
  ├── /cancel-ralph
  ├── Обновить plan в writing-plans
  └── /ralph-loop "продолжить задачу N из плана"
      └── agent вернётся в APPLY с обновлённым планом
```

---

## Фазы процесса

### EXPLORE — Обсуждение

**Вход:** пользователь описывает фичу. 
<HARD-GATE>
Агент запускает `/ralph-loop`.
</HARD-GATE>

**Чек-лист задачи (todowrite):**
- [ ] Запросить/создать todo для задач EXPLORE
- [ ] Каждая подзадача — отдельный item в checklist

**Шаги:**
1. **Загрузить скилл:** `brainstorming`
2. **Explore project context:** проверить файлы, docs, недавние коммиты, существующие паттерны
3. **Clarify requirements** (по одному вопросу):
   - Цели: зачем нужна фича?
   - Scope: что входит/не входит
   - Users: кто будет использовать
   - Success criteria: как измерить успех
4. **Propose approaches:** 2-3 варианта с trade-offs, дать рекомендацию
5. **Define test strategy:** unit/integration/E2E, критические пути, failure cases
6. **Define DoD:** все задачи, которые будут в implementation plan
7. **Get approval:** одобрение требований, тест-стратегии, DoD
8. **Iteration:** при новых деталях — REVISE, оставаясь в EXPLORE

**Результат:** требования (✔), тест-стратегия (✔), DoD (✔), переход к PROPOSE.

---

### PROPOSE — План реализации

**Вход:** после EXPLORE. Информация: требования, тест-стратегия, DoD.

**Чек-лист задачи (todowrite):**
- [ ] Проверка ветки и создание git-ветки
- [ ] Создание implementation plan
- [ ] Self-review плана
- [ ] Handoff пользователю

**Шаги:**
1. **Проверка текущей ветки (`git branch`):**
   - На `feature/*`, `release/*`, `hotfix/*` → уточнить: использовать эту ветку или создать новую
   - На `develop` или `main` → продолжить
2. **Определение типа ветки:**
   - `feature/<kebab-name>` — новая функциональность (default)
   - `release-*` — подготовка релиза
   - `hotfix/<kebab-name>` — критический багфикс
   - Агент предлагает тип → пользователь подтверждает
3. **Создание git ветки:**
   ```bash
   # Проверка develop
   git fetch
   if git branch -a | grep -q 'remotes/origin/develop'; then
     base="develop"
   else
     base="main"
   fi
   
   # Создание ветки
   git checkout -b feature/<kebab-name> "$base"
   ```
4. **Загрузить скилл:** `writing-plans`
5. **Использовать контекст из EXPLORE** (требования, test strategy, DoD tasks)
6. **Создать план:**
   - Сохранить в: `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
   - Шаги: 2-5 минут каждый (2-5 steps per task)
   - Полные команды с expected output
   - Без placeholder (TBD, TODO, fill in details)
   - Map: какие файлы create/modify
   - TDD: test → verify fail → implement → verify pass → commit
7. **Self-review:**
   - Spec coverage: все требования в DoD покрыты
   - Placeholder scan: нет TBD, TODO, "implement later"
   - Type consistency: типы и signatures согласованы
8. **Execution handoff** — предложить выбор:
   - **Subagent-Driven** (рекомендуется) — dispatch subagent per task
   - **Inline Execution** — выполнить в этом session

**Результат:** план готов (`docs/superpowers/plans/...`), ветка создана, выбран способ выполнения.

---

### APPLY — Разработка

**Вход:** после PROPOSE. Пользователь выбрал execution option.

**Чек-лист задачи (todowrite):**
- [ ] Каждая задача из плана — отдельный item в checklist
- [ ] По завершении каждой задачи: verify, review, commit

#### Option A: Subagent-Driven (recommended)

1. **Загрузить скилл:** `subagent-driven-development`
2. **Для каждого task из плана:**
   - Dispatch fresh subagent per task
   - **RED-GREEN-REFACTOR cycle** с verification (скилл `test-driven-development`)
   - Review между задачами
   - Частые коммиты: `git add -p` → `git commit -m`
3. **Git workflow:**
   ```bash
   # В конце каждой задачи
   git add -p
   git commit -m "feat(api): [task N] implement <feature>"
   ```

**TDD правила (test-driven-development):**
- NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
- Watch test fail before implementing
- Minimal code to pass
- Refactor only after green
- Delete any code written before test

#### Option B: Inline Execution

1. **Загрузить скилл:** `executing-plans` + `test-driven-development`
2. **Для каждого task из плана:**
   - **RED:** написать тест
   - **Verify RED:** запустить тест, убедиться что FAIL (expected)
   - **GREEN:** реализовать минимальный код, тест PASS
   - **REFACTOR:** улучшить код, тесты остаются зелёными
   - **Commit:** закоммитить изменения
3. **Verification checkpoint** — перед каждой следующей задачей

**Ручной feedback loop через Ralph Loop:**
```
В APPLY обнаружена проблема в plan/requirements
  ├── Поставить задачу на паузу (обновить todo: [ ] → [.paused])
  ├── /cancel-ralph
  ├── Загрузить writing-plans, обновить план
  │   - Обновить tasks.md
  │   - Или добавить новые задачи
  └── /ralph-loop "продолжить задачу N из плана: <task title>"
      └── agent вернётся в APPLY с обновлённым планом
```

**Результат:** все задачи выполнены (todos marked [x]), тесты проходят.

---

### VERIFY — Проверка

**Вход:** после APPLY (все задачи отмечены `[x]` в todo).

**Чек-лист задачи (todowrite):**
- [ ] Тесты
- [ ] Линтинг
- [ ] Билд
- [ ] Проверка требований против плана

**Шаги:**
1. **Загрузить скилл:** `verification-before-completion`
2. **Тесты:**
   ```bash
   npm run test 2>&1
   ```
   - Прочитать полный output
   - Проверить exit code: 0
   - Подсчитать pass/fail
   - **Если failures:** вернуться в APPLY (отметить failing tasks в todo)
3. **Линтинг:**
   ```bash
   npm run lint
   ```
   - Проверить 0 errors
4. **Билд:**
   ```bash
   npm run build 2>&1
   ```
   - Проверить exit code: 0
5. **Requirements checklist:**
   - Re-read план из `docs/superpowers/plans/...`
   - Создать checklist из plan
   - Verify каждое requirement line-by-line
   - Report gaps или completion
6. **Evidence gathering:** зафиксировать все результаты перед claim о завершении

**Если что-то упало:**
- Backtrack в APPLY
- Отметить проблемные задачи в todo
- После исправления — повторить VERIFY

**Результат:** код готов (всё evidence собрано), переход к ARCHIVE.

---

### ARCHIVE — Архивация

**Вход:** после VERIFY. Все проверки пройдены.

**Чек-лист задачи (todowrite):**
- [ ] Commit changes
- [ ] Проверка git-flow
- [ ] Cancel ralph
- [ ] Report user

**Шаги:**
1. **Загрузить скилл:** `finishing-a-development-branch`
2. **Commit changes:**
   ```bash
   # Статус изменений
   git status
   
   # Добавить только файлы фичи
   git add -A
   
   # Conventional commit
   # Format: type(scope): description
   git commit -m "feat(auth): add rate limiting to login endpoint"
   
   # Типы: feat | fix | refactor | test | docs | style | chore
   ```
3. **Проверка git-flow:**
   - Текущая ветка: `git branch --show-current`
   - Ветка должна быть: `feature/<name>` или `hotfix/<name>`
   - **НЕ merge** в develop/main без pull request
   - Команда для PR: `gh pr create` (если используется GitHub CLI) или вручную через UI
4. **Автоматически завершить Ralph Loop:**
   ```
   /cancel-ralph
   ```
5. **Отчёт пользователю:**
   ```bash
   # Показать ветку
   git branch --show-current
   
   # Показать статус
   git status
   
   # Показать изменения
   git diff HEAD~1
   ```
   - Сообщить: "Фича готова к PR"
   - Предоставить ссылку на план: `docs/superpowers/plans/...`

**Результат:** все изменения закоммичены, git-flow соблюдён, ralph-loop завершён, готов к PR.

---

## Триггеры feedback loop

**Ручной feedback loop через Ralph Loop:**
1. В процессе работы обнаружена проблема
2. Поставить task на паузу (отметить [.paused] в todo)
3. `/cancel-ralph`
4. Обновить артефакты (план/требования)
5. `/ralph-loop "продолжить задачу N: <title>"`
6. Agent восстановит контекст из плана и продолжит

**Автоматический переход в рамках Ralph Loop:**
| Ситуация | Действие |
|----------|----------|
| В APPLY проблема в plan | пауза → /cancel-ralph → обновить plan → /ralph-loop |
| В EXPLORE новые требования | итерация в EXPLORE → PROPOSE |
| VERIFY упал (тесты/линтинг/билд) | Backtrack в APPLY → исправить → VERIFY снова |
| Найдены gaps в requirements | Обновить plan в PROPOSE → продолжить APPLY |

---

## Используемые скиллы

**Основные скиллы (один на фазу):**

| Фаза    | Скилл                              | Описание                           |
|---------|------------------------------------|------------------------------------|
| EXPLORE | `brainstorming`                   | Требования, test strategy, DoD     |
| PROPOSE | `writing-plans`                   | Implementation plan                |
| APPLY   | `subagent-driven-development`     | Dispatch tasks to subagents        |
| VERIFY  | `verification-before-completion`  | Evidence перед claims              |
| ARCHIVE | `finishing-a-development-branch`  | Commit и PR                        |

**Дополнительные скиллы:**

| Скилл                              | Когда использовать                          |
|------------------------------------|---------------------------------------------|
| `test-driven-development`          | В APPLY: TDD для каждой задачи              |
| `executing-plans`                  | В APPLY: inline execution вместо subagents  |
| `using-git-worktrees`              | В PROPOSE: работа с git и ветками           |
| `cancel-ralph`                     | В ARCHIVE: завершение ralph-loop            |

**Workflow:**
```
EXPLORE: brainstorming
  │
  ▼
PROPOSE: writing-plans + using-git-worktrees
  │
  ▼
APPLY: subagent-driven-development + test-driven-development
  │     (или executing-plans для inline)
  ▼
VERIFY: verification-before-completion
  │
  ▼
ARCHIVE: finishing-a-development-branch + cancel-ralph
```

---

## Примеры workflow

### Subagent-Driven (рекомендуемый)

```bash
# 1. ralph-loop активирован

# 2. EXPLORE
skill brainstorming
  → requirements: ясные
  → test strategy: unit + integration
  → DoD: 5 задач

# 3. PROPOSE
skill writing-plans
  → docs/superpowers/plans/2026-05-08-rate-limiting.md
  → 5 задач, 2-5 шагов каждая
  → Полные команды без TBD

# 4. APPLY
skill subagent-driven-development
  Task 1: dispatch subagent → test (RED) → verify fail → implement (GREEN) → verify pass → refactor → commit
  Task 2: dispatch subagent → ...
  ...
  # Каждую задачу: отдельный commit
  git commit -m "feat(api): rate limit guard implementation"

# 5. VERIFY
skill verification-before-completion
  npm run test 2>&1 → 100 pass, 0 fail
  npm run lint      → 0 errors
  npm run build     → success
  Requirements check → все покрытия

# 6. ARCHIVE
skill finishing-a-development-branch
  git add -A
  git commit -m "feat(api): add rate limiting"
  git status → feature/rate-limiting
  /cancel-ralph
  → Готов к PR
```

### Inline Execution (полный контроль)

```bash
# 1. ralph-loop активирован

# 2. EXPLORE
skill brainstorming
  → требования, тест-стратегия, DoD

# 3. PROPOSE
skill writing-plans
  → docs/superpowers/plans/2026-05-08-rate-limiting.md

# 4. APPLY
skill executing-plans
  Task 1:
    - task 1a: write test (RED)
    - verify: npm test → FAIL (expected)
    - task 1b: implement guard (GREEN)
    - verify: npm test → PASS
    - refactor: extract config
    - git add -p && git commit -m "feat: rate limit guard"
  Task 2:
    ...
  # Verification checkpoint перед каждой задачей

# 5. VERIFY
skill verification-before-completion
  npm test, npm lint, npm build
  Requirements checklist

# 6. ARCHIVE
skill finishing-a-development-branch
  commit + cancel-ralph
  → Готов к PR
```

### Feedback loop через Ralph Loop

```bash
# 1. APPLY в процессе, проблема в plan
Subagent: "RateLimitGuard нужно хранить состояние в Redis, не в памяти"
User: "Это меняет design. Обновить?"
Agent: "Да"

# 2. /cancel-ralph
/cancel-ralph

# 3. Обновить plan
skill writing-plans
  → docs/superpowers/plans/2026-05-08-rate-limiting.md
  → Обновить: guard state storage → Redis
  → Добавить задачу: integrate Redis cache

# 4. Продолжить
/ralph-loop "продолжить задачу 3: update plan и implement Redis integration"

# 5. Agent: вернётся в APPLY с обновлённым планом
    → Продолжит с Task 3
```

---

## Best Practices

### Чек-листы (todowrite)
- **Каждая фаза** — создай todo с подзадачами
- **APPLY** — каждая задача из плана отдельный item
- **VERIFY** — чек-лист: test, lint, build, requirements
- **ARCHIVE** — чек-лист: commit, git-flow, cancel-ralph, report

### Git commits
```
feat(api): add rate limiting to login endpoint
^    ^      ^
|    |      └─ краткое описание
|    └──────── scope (module/component)
└───────────── type (feat|fix|refactor|test|docs|style|chore)
```

### TDD discipline
```
❌ ПЛОХО:
  - Написать код без теста
  - "Should work now" без evidence
  - TBD/TODO в плане

✅ ХОРОШО:  
  - Test → Verify FAIL → Implement → Verify PASS → Refactor → Commit
  - Evidence перед claim
  - Полные команды в плане
```

### Feedback loop etiquette
```
❌ ПЛОХО:
  - Молча исправить plan
  - Игнорировать feedback пользователя

✅ ХОРОШО:
  - Пауза задачи, /cancel-ralph
  - Спросить: "Обновить plan?"
  - /ralph-loop "продолжить задачу N"
```

---

## Common Pitfalls

### 1. Отсутствие чек-листов
**Проблема:** Agent теряет трек задач
**Решение:** Создавать todo в начале каждой фазы

### 2. Пустые placeholders в плане
**Проблема:** Task с "TODO implement later"
**Решение:** Self-review: placeholder scan перед handoff

### 3. Пропуск TDD
**Проблема:** "Сначала напишем код, потом тесты"
**Решение:** strict TDD: red → green → refactor

### 4. Merge в develop без PR
**Проблема:** Agent merges ветку
**Решение:** finishing-a-development-branch подчёркивает: НЕ merge без PR

### 5. Ignoring build/lint failures
**Проблема:** "Тесты прошли, сборка ошибка не критична"
**Решение:** VERIFY fails → back to APPLY

---

## Расширения workflow

### Использование `using-git-worktrees`

Вместо `git checkout -b`, можно создать worktree:

```bash
skill using-git-worktrees
  → Создать worktree для feature ветки
  → Изоляция от основного проекта
  → Удобно для параллельной разработки
```

### Использование `brainstorming` вместо других подходов

Для **сложных фич** с архитектурными решениями:

```
EXPLORE:
  skill brainstorming
    → Design document
    → Architecture decision records
    → Browser companion для UI вопросов
    
  ▼
  
PROPOSE: writing-plans (с контекстом из brainstorming)
```

### Авто-PR с GitHub CLI

В ARCHIVE добавить:

```bash
# После finishing-a-development-branch
gh auth status
gh pr create --title "feat: rate limiting" --body "See docs/superpowers/plans/..."
# → PR создан, агент может предложить: "PR готов к review"
```

---

## Сравнение с оригинальным процессом

### Что изменилось:

1. **Только суперpowers скиллы**
   - Никаких OpenSpec команд
   - Все артефакты в `docs/superpowers/`
   - План в `docs/superpowers/plans/YYYY-MM-DD-<name>.md`

2. **writing-plans вместо OpenSpec propose**
   - Создаёт implementation plan вместо OpenSpec change
   - Полностью структурированный план с steps
   - Две опции выполнения: subagent или inline

3. **verification-before-completion**
   - Evidence перед claims
   - Никаких "should work now"
   - Полная проверка перед commit

4. **finishing-a-development-branch вместо archive**
   - Подготовка к PR, не merge
   - Сохранение git workflow
   - Автоматический cancel-ralph

5. **Гибкость APPLY**
   - Subagent-driven (рекомендуется) — быстро
   - Inline execution — полный контроль
   - Выбор пользователем

6. **Чек-листы (todowrite) на каждой фазе**
   - Трекинг задач
   - Прозрачность прогресса
   - Поддержка feedback loop
