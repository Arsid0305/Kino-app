# Kino-app — специфичные правила

_Rule: path-scoped. Применяется при работе с Kino-app: React/Tailwind фронт, Supabase Edge Functions, дизайн-система как submodule._

## Design System (обязательно перед UI-правкой)

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

**Не выдумывать UI с нуля** — брать классы/токены из превью в Tailwind.

## Безопасность (перед первым/следующим деплоем)

Полный чеклист — `docs/AUDIT_PROMPT.md` + `llm_wiki/wiki/audit-universal.md §2`. Специфично для Kino-app:

- `service_role` только в Supabase / GitHub Secrets, **никогда во `VITE_*`**
- `verify_jwt: true` в `supabase/config.toml` для обеих функций (закоммичено)
- CORS whitelist — hardcoded fallback в `supabase/functions/_shared/cors.ts` (`kino-arsid`, `kino-app-arsid`, `kino-app-git-main-arsid` на `vercel.app`) + `ALLOWED_ORIGINS` secret (валидация в `deploy.yml`)
- RLS через `auth.uid() = user_id` на всех `public.*` таблицах
- `zod`-валидация входных данных в Edge Functions — `supabase/functions/_shared/input.ts`

## Стек

- React + Vite + TypeScript + Tailwind + shadcn/ui + Framer Motion
- Supabase Auth (email OTP + анонимный) + Edge Functions (Deno)
- Тесты: Vitest (`npm test`)
- Design System: `kino-design-system/` (submodule)

Стандартные пакеты: `lucide-react`, `sonner`, `next-themes`, `zod`, `date-fns`, `xlsx`, `@resvg/resvg-js`.

## Где что лежит (SSOT в коде)

- `src/lib/movieEngine.ts` — логика рекомендаций; `src/lib/movieTypes.ts` — типы фильмов
- `supabase/functions/` — edge functions; `_shared/` — CORS, вызов LLM, проверка входных данных
- `supabase/migrations/` — схема БД (baseline `kino` + изменения)

## Auth (Supabase OTP)

`signInWithOtp({ email })` → `verifyOtp({ email, token, type: 'email' })`. Код — **8 цифр** (не 6).

## Среда Claude
- Node.js v22, npm v10, Vitest ✅
- Python / Supabase CLI / Deno ❌
- `.env` реальный ❌
