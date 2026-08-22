# docs/rules/ — Правила как отдельный слой

_Канон архитектуры rules. Синхронизируется в остальные репо экосистемы._

## Зачем это

По систематизации Anthropic (блог «Steering Claude Code», 2026-08) rules — **отдельный механизм управления агентом**, ортогональный CLAUDE.md / skills / hooks / subagents. Rules — always-on constraints (или path-scoped), re-injected при компакции.

До этой архитектуры rules жили внутри `SYSTEM.md` / `CLAUDE.md` — правила смешивались с картой репо, файл разрастался, дубли между репо расходились. Вынос в атомы `docs/rules/core/*.md` решает три проблемы:

1. **SSOT** — правило меняется в одном месте (AI_OS), раскатывается по 9 репо.
2. **Модульность** — новое правило = новый файл, никакой переписи `SYSTEM.md`.
3. **Стоимость контекста** — path-scoped rules (в будущем `docs/rules/scoped/`) грузятся только при касании файлов.

## Структура

```
docs/rules/
├── core/            ← always-on правила для всей экосистемы
│   ├── task-classification.md   SMALL / BIG критерии
│   ├── communication-style.md   стиль ответов, без воды, факт/интерпретация/допущение
│   ├── code-principles.md       DRY, verification, без over-engineering
│   ├── git-flow.md              ветки, PR, запрет --force/--no-verify
│   ├── github-anti-abuse.md     rate limits, инцидент 2026-07-11
│   ├── session-lifecycle.md     начало/конец сессии, todo/lessons формат
│   ├── subagents.md             worktree-изоляция, JSON-schema контракты
│   └── audit-trigger.md         триггеры аудита, канон
└── scoped/          ← path-scoped (загружаются при касании файлов)
```

## Правила использования

- **`core/`** — SSOT в AI_OS. В остальных репо `core/` **никогда не редактируется вручную** — обновляется через синк из AI_OS (`sync-to-template.yml` + `init.sh`).
- **`scoped/`** — специфика конкретного репо (edge-functions, миграции, frontend-компоненты). Живёт локально в репо.
- **`SYSTEM.md` / `CLAUDE.md`** — тонкий адаптер, ссылается на `docs/rules/core/*.md`, не дублирует содержимое.

## Синхронизация в другие репо

- **AI_OS → TEMPLATE:** автоматически через `.github/workflows/sync-to-template.yml` (AI_OS pushes rules → TEMPLATE main).
- **TEMPLATE → новый проект:** при `bash init.sh /path` — `docs/rules/core/` копируется.
- **TEMPLATE → существующий проект:** `bash scripts/sync-rules.sh <target-repo>` — pull последних `core/`.

## Миграция к первоклассному `.claude/rules/`

Если Anthropic введёт первоклассный `.claude/rules/` в CLI, миграция тривиальна:
```
mv docs/rules/core/ .claude/rules/
```
и обновить ссылки в `SYSTEM.md`. Структура файлов и содержимое переносятся 1:1.

_Источник архитектуры: [llm_wiki/wiki/skills.md §Механизмы управления Claude Code](../../../LLM_Wiki/wiki/skills.md), [llm_wiki/wiki/lessons.md §Model/harness/context](../../../LLM_Wiki/wiki/lessons.md). Прецедент: SellerBase 2026-06-21 (параллельные агенты без worktree), GitHub anti-abuse 2026-07-11._
