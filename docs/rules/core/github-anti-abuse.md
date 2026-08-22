# GitHub Anti-Abuse — обязательно после инцидента 2026-07-11

_Rule: always-on. Источник: AI_OS/SYSTEM.md §10 подраздел, wiki/lessons.md §GitHub anti-abuse, wiki/workflow.md §GitHub Anti-Abuse._

## Что случилось (прецедент)

2026-07-11: аудит-сессия сделала 30+ PR через `mcp__github__*` за 2 часа в 9 репо. Все commits с `author: Claude <noreply@anthropic.com>`, все ветки `claude/audit-*`, все merge через API. GitHub abuse-detection автоматически флагнул аккаунт `arsid0305`:
- Все публичные репо → 404 для неавторизованных.
- OAuth-приложения отключены (нельзя логиниться в Vercel/Supabase через GitHub).
- GitHub Actions отключены.
- Support ticket #4535795 (Reinstatement) — ответ >7 дней.

## Лимиты (обязательно)

- **≥30 сек между PR-операциями** (`create_pull_request`, `merge_pull_request`).
- **≥60 сек между репо** — не мигрировать быстро между разными репо.
- **≤5 PR за 10 минут** через API-токен.
- **Массовые аудиты — по 1-2 репо/день**, не за одну сессию.

## Что не делать

- **Не открывать однотипные `claude/audit-*` во всех репо в одной сессии** — паттерн бота.
  - Разные названия веток + разные дни.
- **Не мержить >2 PR за минуту** через API.
- **403 / secondary rate limit → немедленно стоп на 1 час.** Не повторять операцию.

## Что делать

- Основной автор коммита — **пользователь**, не Claude (`user.email` = email пользователя).
- Claude — через `Co-Authored-By` в теле коммита.
- Массовые операции — spread по дням.

Полные правила и прецедент: [llm_wiki/wiki/workflow.md §GitHub Anti-Abuse](../../../../LLM_Wiki/wiki/workflow.md), [llm_wiki/wiki/lessons.md §GitHub anti-abuse](../../../../LLM_Wiki/wiki/lessons.md).
