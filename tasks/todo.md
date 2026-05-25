# TODO

## Сессия 2026-05-25 — Security audit ✅

### Выполнено
- [x] Rate limiting перенесён в Supabase DB (`rate_limits` + `check_and_increment_rate_limit`)
- [x] `signInAnonymously()` убран из `AiAdvisor.tsx`
- [x] Anonymous auth выключен в Supabase Dashboard
- [x] Prompt injection: `sanitizeTasteProfile()` + маркеры `[ВКУСОВОЙ ПРОФИЛЬ]` в обоих Edge Functions
- [x] CORS wildcard → хардкожные домены Vercel в `DEFAULT_ORIGINS`
- [x] `loadCloudLibrary` — добавлен `.limit(500)`

---

## Следующая сессия — разобрать

- [ ] Выяснить что именно не работает в приложении и зафиксировать

---

## Заметки для Claude

- GitHub MCP не создаёт ветки с `/` в названии → использовать `fix-...` вместо `claude/...`, мержить вручную
- `ALLOWED_ORIGINS` как Supabase Secret больше не нужен — домены захардкожены в коде
- Supabase project ID: `ovhwxfdtkzwxfomdlgjv`
- Vercel domains: `kino-app-arsid.vercel.app`, `kino-app-eight.vercel.app`, `kino-app-git-main-arsid.vercel.app`
