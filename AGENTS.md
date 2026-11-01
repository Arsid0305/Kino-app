# AGENTS.md — Kino-app, вход для любого ИИ

> Общая точка входа для любого ИИ-ассистента (OpenAI Codex, Claude Code и других).
> Универсальные правила здесь не копируются — они в `AI_OS/docs/rules/core/*.md` (SSOT). Если AI_OS не подключён к сессии — попросить подключить, по памяти не работать.
> Если правило здесь расходится с AI_OS (ветка `main`), верен AI_OS.
> Claude Code дополнительно читает `CLAUDE.md` (только Claude-специфика).

## В начале каждой сессии прочитать

1. Этот файл.
2. `docs/rules/scoped/kino-app-specific.md` — специфика Kino-app: дизайн-система, безопасность (verify_jwt / CORS / RLS / zod), стек.
3. `tasks/lessons.md` — уроки, `tasks/todo.md` — открытые задачи.
4. Из `arsid0305/llm_wiki` (main): `wiki/lessons.md`, `wiki/decisions.md`, `wiki/workflow.md`.

## Правила (читать нужное по имени, `AI_OS/docs/rules/core/`)

| Тема | Файл |
|---|---|
| Начало и конец сессии | [`session-lifecycle.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/session-lifecycle.md) |
| Стиль общения | [`communication-style.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/communication-style.md) |
| Git: ветки, PR, запрещённые флаги | [`git-flow.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/git-flow.md) |
| GitHub anti-abuse, мерж только кнопкой | [`github-anti-abuse.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/github-anti-abuse.md) |
| SMALL / BIG | [`task-classification.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/task-classification.md) |
| Работа с кодом | [`code-principles.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/code-principles.md) |
| Субагенты | [`subagents.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/subagents.md) |
| Аудит | [`audit-trigger.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/audit-trigger.md) |
| Независимость от поставщика ИИ | [`vendor-independence.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/core/vendor-independence.md) |

Аудит: универсальный канон — `llm_wiki/wiki/audit-universal.md`, проектный overlay — `docs/AUDIT_PROMPT.md`.
Архитектура rules — [`AI_OS/docs/rules/README.md`](https://github.com/Arsid0305/AI_OS/blob/main/docs/rules/README.md).

## Самое важное (подробно — в правилах выше)

- Отвечать по-русски, коротко, простым языком. Начинать с результата.
- Ветка `claude/...` или `codex/...` (по инструменту), потом обычный PR в `main` (не черновик).
- Мержит только владелица, кнопкой. Мерж через API и автомерж запрещены.
- Без `--force`, `--force-with-lease`, `--no-verify`.
- После мержа, если менялся сайт, — напомнить про деплой и service worker (см. ниже).

## Task Management

- `tasks/todo.md` — план BIG задач, чекбоксы, отмечать выполненное.
- `tasks/lessons.md` — паттерны ошибок (формат — `AI_OS/docs/rules/core/session-lifecycle.md` §«Формат lessons.md»).

## Инфраструктура и деплой

_Проверено: 2026-10-01. Мерж — канон `llm_wiki/wiki/workflow.md` (только владелица, кнопкой)._

- **Фронт** — Vercel, автодеплой из `main`. Прод: `https://kino-arsid.vercel.app`. `scripts/deploy.ps1` — запасной ручной путь.
- **Edge functions** (`ai-chat`, `movie-recommendation`) — `.github/workflows/deploy.yml` при изменении `supabase/functions/**`. Упал — деплой через Supabase MCP (`deploy_edge_function`), сообщить номер версии.
- **БД** — Supabase `ovhwxfdtkzwxfomdlgjv`, схема `kino`, представления в `public`. Миграции вручную: Supabase MCP (`apply_migration`) или SQL Editor + файл в `supabase/migrations/`. `DROP` через MCP зависал — такое владелице в SQL Editor. После миграций / RLS — `get_advisors type=security`.
- **Проект Supabase общий с Technical-language** (схема `technical_language`, функции `lookup-word`, `generate-lesson`) — перед изменением общих объектов (`public.check_rate_limit`) проверять, кто их вызывает.
- **Secrets:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, `TAVILY_API_KEY`, `ALLOWED_ORIGINS`.

Перед мержем владелица прогоняет `npm ci && npm test -- --run && npx tsc --noEmit`. После деплоя напомнить: service worker отдаёт старую версию до **второго** захода. Откат: Vercel → Deployments → Promote предыдущий; Supabase → Edge Functions → предыдущая версия.

## Пути на машине владелицы (проверено 2026-08-16)

- рабочая копия — `C:\DATA\PROJECTS\Kino-app`
- клон под деплой — `C:\Users\arols\kino-deploy` (отдельный, потому что `vercel --prod` отправляет папку как есть, вместе с незакоммиченными правками)

## Что есть только у Claude Code

Хуки (`.claude/settings.json`, `.claude/hooks/`), context-mode. Другим ИИ они не нужны: правила выше читаются как обычные файлы. Подробности — `CLAUDE.md`.
