# Subagents — worktree-изоляция и оркестрация

_Rule: always-on. Источники: AI_OS/SYSTEM.md §9, wiki/lessons.md §Оркестрация субагентов, wiki/skills.md §Механизмы управления Claude Code._

## Приоритет использования

Если задача подходит субагенту — **использовать субагента**. Возвращает только итог, экономит токены и шум основного контекста.

Использовать для:
- Исследования кода (`@Explore`, `@general-purpose`).
- Параллельных независимых задач.
- Аудитов (`@repo-auditor`), ревью (`@reviewer`), поиска.
- Deep search, log analysis, dep audit — задач с промежуточными результатами, к которым не вернёшься.

Один subagent = одна фокусная задача.

## Параллельный запуск — ВСЕГДА с `isolation: "worktree"`

**Правило:** при запуске параллельных subagent'ов из основного чата — ВСЕГДА передавать `isolation: "worktree"`.

Если механизм возвращает ошибку «Cannot create agent worktree: not in a git repository and no WorktreeCreate hooks are configured» — это блокер, агенты **НЕЛЬЗЯ** запускать параллельно до настройки хуков.

**Почему:** без worktree все subagent'ы работают в одной физической рабочей копии репо. Каждый делает `git checkout -B своя-ветка` под рукой у других. Симптомы:
- Коммит уходит на чужую ветку (vitest-агент коммитит на orders-paginate).
- Агент B обнаруживает, что его файлы внезапно «откатились» (агент A сделал checkout другой ветки).
- Два агента закрывают коммиты с одинаковым misleading title.
- Основной чат видит непредсказуемые файлы в working tree.

**Что делать когда хуков нет:**
1. **Запретить параллельный запуск.** Один агент за раз, дождаться → следующий.
2. Сообщить пользователю, что параллелизация заблокирована.
3. Добавить в `MEMORY/tasks/cross-repo-todo.md` пункт о настройке `WorktreeCreate`/`WorktreeRemove` хуков.

**Настройка хуков:** выполняют `git worktree add .claude/worktrees/agent-<id> -b worktree-agent-<id>` перед агентом и `git worktree remove` после. В AI_OS настраиваются через `bash scripts/setup_context_mode.sh`.

_Прецедент: SellerBase 2026-06-21 — параллельные агенты (Vitest, paginate, orders, stocks) перемешали ветки и коммиты в одной рабочей копии._

## JSON-schema контракты между субагентами

Когда orchestrator собирает результаты нескольких subagents — **не парсить свободный текст**. Передавать `agent()` вызов с JSON-schema — subagent forced return validated structured data, валидация на уровне tool-call, retry на mismatch. Orchestrator берёт готовую структуру без «parse and pray».

Применимо к любой связке `@reviewer` + `@repo-auditor` или dynamic workflows: если один subagent пишет free text, следующий должен парсить — теряется определённость. Schema на выходе первого = определённый вход второго.

_Источник: @0xCodez про dynamic workflows, [llm_wiki/wiki/lessons.md §Оркестрация субагентов](../../../../LLM_Wiki/wiki/lessons.md)._

## Dynamic workflows (когда применимо)

Для нетипичных задач: скажи в промпте «workflow», Claude декомпозирует задачу, спавнит координированный флот субагентов, синтезирует. Bundled: `/deep-research` — production-граф (scope → parallel search → fetch → adversarial verify → synthesize).

Прикладные паттерны:
- **Security sweep** — один subagent на route file, потом verifier pass.
- **Port a module** — fan-out перевода по файлам, тест-сьют как гейт на каждом.
- **Cited report** (`/deep-research`) — параллельный поиск, дедуп источников, adversarial verify тройкой skeptics.
