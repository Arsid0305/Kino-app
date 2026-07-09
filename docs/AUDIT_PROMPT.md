# Repository Audit — Kino-app

Универсальные проверки — см. **`llm_wiki/wiki/audit-universal.md`** (canon для всех репо).

Этот файл — тонкий overlay с проектной спецификой Kino-app.

---

## Контекст проекта

```
Тип: веб-приложение для рекомендации фильмов с AI-советником
Стек: React + Vite + TypeScript + Tailwind + shadcn/ui + Framer Motion
Бэкенд: Supabase Auth (email OTP + анонимный) + Edge Functions (Deno)
Edge Functions: ai-chat, movie-recommendation
Деплой: Vercel (frontend) + GitHub Actions (Edge Functions)
Design System: git submodule kino-design-system/ (github.com/Arsid0305/design-system)
```

## Проектные проверки (в дополнение к universal)

**Supabase Edge Functions:**
- [ ] Обе функции (`ai-chat`, `movie-recommendation`) имеют `verify_jwt: true`
- [ ] Каждая функция валидирует JWT через `supabase.auth.getUser(token)` → 401 при невалидном
- [ ] `user_id` берётся из верифицированного токена, НЕ из тела запроса
- [ ] CORS ограничен: `Access-Control-Allow-Origin: https://kino-app.vercel.app` (не `*`)
- [ ] Входные данные валидируются через `zod` до обращения к БД

**Auth / RLS:**
- [ ] RLS включён на **каждой** таблице `public` схемы
- [ ] Политики через `auth.uid() = user_id`, не открыты анонимам
- [ ] Rate limiting на OTP-endpoint (иначе спам)

**Frontend:**
- [ ] `service_role` ключ НЕ в `VITE_*` — только в Edge Functions / GitHub Secrets
- [ ] В `vite.config.ts` нет `build.sourcemap: true`
- [ ] `.env` в `.gitignore`, нет `.env` в истории git

**Design System:**
- [ ] `kino-design-system/` submodule на актуальном коммите main (`git submodule status`)
- [ ] UI-компоненты сверены с `kino-design-system/kino-app/preview/*.html` — не выдуманы

**API-ключи (в Supabase Secrets):**
- [ ] `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY` — все существуют
- [ ] `ALLOWED_ORIGINS` содержит `https://kino-app.vercel.app`

## Формат отчёта

Как в `llm_wiki/wiki/audit-universal.md`.
