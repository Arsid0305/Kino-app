# Claude Adapter — Kino-app

> Тонкий адаптер. Универсальные правила экосистемы — в `AI_OS/docs/rules/core/*.md` (SSOT, копий в этом репо нет).
> Специфика Kino-app — в `docs/rules/scoped/kino-app-specific.md`.

---

## Каноны (rules как атомы)

Универсальные правила — в `AI_OS/docs/rules/core/*.md` (SSOT, копий в этом репо нет). Если AI_OS не подключён к сессии — попросить подключить, по памяти не работать:

- Начало / конец сессии — [`AI_OS/docs/rules/core/session-lifecycle.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/session-lifecycle.md)
- Стиль общения / краткость — [`AI_OS/docs/rules/core/communication-style.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/communication-style.md)
- Git flow, запрет флагов, редактирование — [`AI_OS/docs/rules/core/git-flow.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/git-flow.md)
- GitHub anti-abuse — [`AI_OS/docs/rules/core/github-anti-abuse.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/github-anti-abuse.md)
- BIG / SMALL классификация — [`AI_OS/docs/rules/core/task-classification.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/task-classification.md)
- Принципы работы с кодом — [`AI_OS/docs/rules/core/code-principles.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/code-principles.md)
- Subagents (worktree, JSON-schema контракты) — [`AI_OS/docs/rules/core/subagents.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/subagents.md)
- Audit-триггер — [`AI_OS/docs/rules/core/audit-trigger.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/audit-trigger.md)
- Выбор модели `haiku`/`sonnet`/`opus` — `llm_wiki/wiki/workflow.md`
- Context Mode — `llm_wiki/wiki/context-mode.md`
- Универсальный audit-canon — `llm_wiki/wiki/audit-universal.md`
- Проектный audit-overlay — `docs/AUDIT_PROMPT.md`

**Специфика Kino-app** (scoped): [`docs/rules/scoped/kino-app-specific.md`](docs/rules/scoped/kino-app-specific.md) — design-system маппинг, безопасность (verify_jwt/CORS/RLS/zod), стек, среда.

Архитектура rules — [`AI_OS/docs/rules/README.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/README.md).

---

## Task Management

- `tasks/todo.md` — план BIG задач, чекбоксы, отмечать выполненное
- `tasks/lessons.md` — паттерны ошибок (формат — в [`AI_OS/docs/rules/core/session-lifecycle.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/session-lifecycle.md) §«Формат lessons.md»)
- `docs/AUDIT_PROMPT.md` — тонкий overlay + ссылка на `llm_wiki/wiki/audit-universal.md`

---

## Инфраструктура и деплой

_Проверено: 2026-10-01. Мерж — канон `llm_wiki/wiki/workflow.md` (только владелица, кнопкой)._

- **Фронт** — Vercel, автодеплой из `main`. Прод: `https://kino-arsid.vercel.app`. `scripts/deploy.ps1` — запасной ручной путь.
- **Edge functions** (`ai-chat`, `movie-recommendation`) — `.github/workflows/deploy.yml` при изменении `supabase/functions/**`. Упал — деплой через Supabase MCP (`deploy_edge_function`), сообщить номер версии.
- **БД** — Supabase `ovhwxfdtkzwxfomdlgjv`, схема `kino`, представления в `public`. Миграции вручную: Supabase MCP (`apply_migration`) или SQL Editor + файл в `supabase/migrations/`. `DROP` через MCP зависал — такое владелице в SQL Editor. После миграций / RLS — `get_advisors type=security`.
- **Проект Supabase общий с Technical-language** (схема `technical_language`, функции `lookup-word`, `generate-lesson`) — перед изменением общих объектов (`public.check_rate_limit`) проверять, кто их вызывает.
- **Secrets:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, `TAVILY_API_KEY`, `ALLOWED_ORIGINS`.

Перед мержем владелица прогоняет `npm ci && npm test -- --run && npx tsc --noEmit`. После деплоя напомнить: service worker отдаёт старую версию до **второго** захода. Откат: Vercel → Deployments → Promote предыдущий; Supabase → Edge Functions → предыдущая версия.

---

## Пути на машине пользователя (проверено 2026-08-16)
- рабочая копия — `C:\DATA\PROJECTS\Kino-app`
- клон под деплой — `C:\Users\arols\kino-deploy` (отдельный, потому что `vercel --prod` отправляет папку как есть, вместе с незакоммиченными правками)
