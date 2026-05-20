# Project Context

> Kino-app — приложение для рекомендаций фильмов с AI-чатом. React + Supabase + Vercel.

---

## 1. Tech Stack
- Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui
- Animations: Framer Motion
- Backend: Supabase Edge Functions (Deno) — `ai-chat`, `movie-recommendation`
- DB & Auth: Supabase Auth + Supabase PostgreSQL
- Design System: shadcn/ui

---

## 2. Infrastructure & CI/CD
- Frontend deploy: Vercel (из `main`)
- Repo: github.com/Arsid0305/Kino-app

Workflows:
- `automerge.yml` — `claude/** | cursor/**` → `main` авто ✅
- `promote.yml` — существует, не трогать ✅
- `deploy.yml` — Supabase Edge Functions deploy (GitHub Actions)

---

## 3. AI Environment

| Tool | Status | Note |
|------|--------|------|
| Node.js / npm | ✅ | `npm ci` |
| Python | ❌ | не используется |
| Supabase CLI | ❌ | Edge Functions деплоятся через GitHub Actions |
| .env (real keys) | ✅ | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

---

## 4. Design System

shadcn/ui — компоненты в `src/components/ui/`. Перед UI изменениями смотреть существующие компоненты там.

---

## 5. Project Structure

```
.github/workflows/
  automerge.yml        — авто-мерж ветки в main
  promote.yml          — существует, не трогать
docs/
  AUDIT_PROMPT.md      — контекст для аудита
scripts/
  check_consistency.py — CI-проверки консистентности
src/
  lib/
    movieEngine.ts     — SSOT: логика рекомендаций
    movieTypes.ts      — SSOT: типы фильмов
  components/          — React компоненты
    ui/                — shadcn/ui компоненты
supabase/
  functions/           — SSOT: Edge Functions (Deno)
    ai-chat/
    movie-recommendation/
tasks/
  todo.md
  lessons.md
```

---

## 6. Standard Packages

- `lucide-react` — иконки
- `framer-motion` — анимации
- `@supabase/supabase-js` — Supabase клиент
- `sonner` — toast уведомления
- `zod` — валидация
- `vitest` — тесты (`npm test`)

---

## 7. Auth (Supabase OTP)

- Step 1: `supabase.auth.signInWithOtp({ email })` — отправляет код
- Step 2: `supabase.auth.verifyOtp({ email, token, type: 'email' })` — проверяет
- Код — **8 цифр** (не 6)

---

## 8. Open Bugs

_(empty)_
