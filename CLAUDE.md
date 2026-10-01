# Claude Adapter — Kino-app

> Тонкий адаптер. Универсальные правила экосистемы — в `AI_OS/docs/rules/core/*.md` (SSOT, копий в этом репо нет).
> Специфика Kino-app — в `docs/rules/scoped/kino-app-specific.md`.

---

## Деплой и мерж

_Проверено: 2026-10-01. Флаг T&S на аккаунте снят 2026-09-12 (`llm_wiki/wiki/workflow.md`)._

- **Мерж** — только владелица, кнопкой; PR сразу не-draft. Мерж через API запрещён — [`AI_OS/docs/rules/core/github-anti-abuse.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/github-anti-abuse.md). Перед каждым «мержи» — проверить, не смержен ли PR уже.
- **Фронт** — Vercel деплоит сам при пуше в `main`. `scripts/deploy.ps1` — запасной ручной путь.
- **Edge functions** — `.github/workflows/deploy.yml` при изменении `supabase/functions/**` в `main`. Если workflow упал — деплой через Supabase MCP (`deploy_edge_function`) и сообщить номер версии.
- **Миграции** — автоматики нет: применять через Supabase MCP (`apply_migration`) или SQL Editor и класть файл в `supabase/migrations/`. `DROP` через MCP зависал (2026-10-01) — такое давать владелице в SQL Editor.

Перед мержем владелица прогоняет локально:
```bash
npm ci && npm test -- --run && npx tsc --noEmit
```

После мержа напомнить: service worker отдаёт старую версию до **второго** захода — обновить страницу дважды, на телефоне закрыть и открыть приложение. После миграций / RLS — `get_advisors type=security`.

**Откат:** фронт — Vercel Dashboard → Deployments → предыдущий → Promote to Production; edge function — Supabase Dashboard → Edge Functions → предыдущая версия.

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

## LLM_Wiki

В начале сессии читать: `wiki/lessons.md`, `wiki/decisions.md`, `wiki/projects.md`.

---

## Task Management

- `tasks/todo.md` — план BIG задач, чекбоксы, отмечать выполненное
- `tasks/lessons.md` — паттерны ошибок (формат — в [`AI_OS/docs/rules/core/session-lifecycle.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/session-lifecycle.md) §«Формат lessons.md»)
- `docs/AUDIT_PROMPT.md` — тонкий overlay + ссылка на `llm_wiki/wiki/audit-universal.md`

---

## Инфраструктура

_Проверено: 2026-10-01._

- Vercel — фронтенд, автодеплой из `main`. Прод: `https://kino-arsid.vercel.app`.
- Supabase — БД (схема `kino`, представления в `public`), Auth, Edge Functions (`ai-chat`, `movie-recommendation`), проект `ovhwxfdtkzwxfomdlgjv`. **Проект общий с Technical-language** (схема `technical_language`, функции `lookup-word`, `generate-lesson`) — перед удалением/изменением общих объектов (`public.check_rate_limit`) проверять, кто их вызывает.
- GitHub Actions — `deploy.yml` (edge functions).

API-ключи в Supabase Secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, `TAVILY_API_KEY`, `ALLOWED_ORIGINS`.

---

## Пути на машине пользователя (проверено 2026-08-16)
- рабочая копия — `C:\DATA\PROJECTS\Kino-app`
- клон под деплой — `C:\Users\arols\kino-deploy` (отдельный, потому что `vercel --prod` отправляет папку как есть, вместе с незакоммиченными правками)
