# Claude Adapter — Kino-app

> Тонкий адаптер. Универсальные правила — в `arsid0305/ai_os/SYSTEM.md` и `llm_wiki/wiki/*`.

## Каноны (не дублировать)

- Стиль общения / краткость — `AI_OS/SYSTEM.md §4`
- Git flow, запрет флагов, редактирование — `AI_OS/SYSTEM.md §10`
- Начало / конец сессии — `AI_OS/SYSTEM.md §8`
- BIG / SMALL классификация — `AI_OS/SYSTEM.md §3`
- Subagents — `AI_OS/CLAUDE.md`
- Выбор модели `haiku`/`sonnet`/`opus` — `llm_wiki/wiki/workflow.md`
- Context Mode — `llm_wiki/wiki/context-mode.md`
- Универсальный audit-canon — `llm_wiki/wiki/audit-universal.md`
- Проектный audit-overlay — `docs/AUDIT_PROMPT.md`

---

## LLM_Wiki

В начале сессии читать: `wiki/lessons.md`, `wiki/decisions.md`, `wiki/projects.md`.

---

## ⚠️ Design System (обязательно перед UI-правкой)

Submodule `kino-design-system/` → `github.com/Arsid0305/design-system`. Инициализировать: `git submodule update --init`; обновить: `git submodule update --remote`.

Перед изменением любого UI-компонента открыть соответствующий превью из `kino-design-system/kino-app/preview/`:

| Что меняешь | Файл |
|-------------|------|
| Карточка фильма / чат-карточка | `component-cards.html` |
| Кнопки | `component-buttons.html` |
| Чипы (фильтры, теги) | `component-chips.html` |
| Шапка + табы + stat-карточки | `component-nav.html` |
| Чат-окно AI | `component-chat.html` |
| Форма входа / OTP / профиль | `component-auth.html` |
| Цвета, фоны | `colors-base.html`, `colors-semantic.html` |
| Шрифты | `type-display.html`, `type-body.html` |
| Тени, glow | `shadows-glow.html` |
| Отступы | `spacing-tokens.html` |

Не выдумывать UI с нуля — брать классы/токены из превью в Tailwind.

---

## Task Management

- `tasks/todo.md` — план BIG задач, чекбоксы, отмечать выполненное
- `tasks/lessons.md` — паттерны ошибок, формат:
  ```
  ## [дата] [краткое название]
  **Что произошло:** ...
  **Правило:** ...
  ```
- `docs/AUDIT_PROMPT.md` — тонкий overlay + ссылка на `llm_wiki/wiki/audit-universal.md`

---

## Безопасность (перед первым/следующим деплоем)

Полный чеклист — `docs/AUDIT_PROMPT.md` + `llm_wiki/wiki/audit-universal.md §2`. Специфично для Kino-app:

- `service_role` только в Supabase / GitHub Secrets, никогда во `VITE_*`
- `verify_jwt: true` в `supabase/config.toml` для обеих функций (закоммичено)
- CORS whitelist — hardcoded fallback (`https://kino-app.vercel.app`) + `ALLOWED_ORIGINS` secret (валидация в `deploy.yml`)
- RLS через `auth.uid() = user_id` на всех `public.*` таблицах
- `zod`-валидация всех входных данных в Edge Functions (TODO)

---

## Инфраструктура

- Vercel — фронтенд, автодеплой при пуше в `main`
- Supabase — БД, Auth, Edge Functions (`ai-chat`, `movie-recommendation`), проект `ovhwxfdtkzwxfomdlgjv`
- GitHub Actions:
  - `automerge.yml` — PR `claude/**` / `cursor/**` → main через API (squash + deleteRef)
  - `deploy.yml` — деплой Edge Functions при изменении `supabase/functions/**`

API-ключи в Supabase Secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, `ALLOWED_ORIGINS`.

---

## Стек / среда

- React + Vite + TypeScript + Tailwind + shadcn/ui + Framer Motion
- Supabase Auth (email OTP + анонимный) + Edge Functions (Deno)
- Тесты: Vitest (`npm test`)
- Design System: `kino-design-system/` (submodule)
- Среда Claude: Node.js v22, npm v10, Vitest ✅ · Python / Supabase CLI / Deno ❌ · `.env` реальный ❌

Стандартные пакеты: `lucide-react`, `sonner`, `next-themes`, `zod`, `date-fns`, `xlsx`, `@resvg/resvg-js`.

Путь проекта локально: `C:\DATA\AI_OS\projects\Kino-app`.
