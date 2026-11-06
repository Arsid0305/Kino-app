# Claude Adapter — Kino-app

> Тонкий адаптер для Claude. Общий вход для любого ИИ — [`AGENTS.md`](AGENTS.md) (его же читает Codex): сначала он, здесь только Claude-специфика.
> Правила, специфика проекта, инфраструктура и деплой — в `AGENTS.md` и `docs/rules/scoped/kino-app-specific.md`. Здесь не дублируются.

---

## Хуки Claude Code

`.claude/settings.json` подключает хуки из `.claude/hooks/`:

- `session-start.sh` — в облачной сессии ставит context-mode (MCP) и зависимости.
- `ctx-*.sh` — защита контекстного окна context-mode. Канон — `llm_wiki/wiki/context-mode.md`.

## Выбор модели

`haiku` / `sonnet` / `opus` для субагентов — `llm_wiki/wiki/workflow.md`.

## Ветки

Claude работает в ветках `claude/...` (Codex — `codex/...`, правило общее, см. `AGENTS.md`).
