# Claude Adapter — Kino-app

> Тонкий адаптер. Универсальные правила — в `arsid0305/ai_os/SYSTEM.md` и `llm_wiki/wiki/*`.

---

## 🚨 TEMPORARY — GitHub Actions заблокированы (пока T&S не снимет флаг)

Аккаунт `Arsid0305` помечен suspicious, GitHub Actions отключены на уровне account. Тикет #4535795 в работе с июля 2026.

**Что НЕ работает пока флаг активен:**
- `automerge.yml` — не срабатывает
- `promote.yml` — тесты перед мержем не запускаются
- `deploy.yml` — **edge functions больше не деплоятся автоматически**
- OAuth третьих сторон через GitHub (Supabase login и т.п.)

**Что тоже НЕ работает (проверено 2026-08-16):**
- **Vercel-автодеплой мёртв с 26 июня** — GitHub-интеграция отвалилась вместе с флагом. Ни production при пуше в main, ни preview на PR. Раньше здесь было написано, что Vercel работает — это неверно, полдня ушло на поиск несуществующих preview-ссылок.
- **Supabase GitHub Integration не подключить** — GitHub отказывает: «This account is flagged, and therefore cannot authorize a third party application».

**Что работает:**
- Прямые REST-мержи через MCP (`merge_pull_request`) — это не workflow
- Деплой edge functions через Supabase MCP (`deploy_edge_function`) — мимо GitHub
- Миграции и SQL через Supabase MCP
- **Фронт-деплой — только вручную** с машины пользователя: `scripts/deploy.ps1` (см. ниже). Через MCP не выходит: бандл 1.3 МБ в вызов не помещается.

### Деплой фронта (единственный ручной шаг)

```powershell
cd <клон репозитория>
.\scripts\deploy.ps1              # фронт
.\scripts\deploy.ps1 -Functions   # фронт + edge functions
```

Скрипт сам проверит чистоту рабочей копии, подтянет main, прогонит `tsc` и тесты, соберёт и задеплоит. Останавливается на первой ошибке.

Требуется один раз: `npm i -g vercel` и `vercel login` — **входить по email, не через GitHub** (упрётся в тот же флаг).

Деплоить надо **из отдельного чистого клона**: `vercel --prod` отправляет файлы как есть, вместе с незакоммиченными правками.

### Merge protocol (обязательный чеклист перед мержем)

Локально до пуша:
```bash
npm ci                    # если давно не ставила
npm test -- --run
npx eslint src/
npx tsc --noEmit
```
Если хоть что-то красное — **не мержить**.

Плюс:
- Открыть **Vercel preview** из коммента PR, глазами кликнуть по тронутой фиче.
- Один PR = одна тема. Легче откатить.
- PR **не старше 1-2 дней** — иначе конфликты.
- **`supabase/functions/**` — после мержа деплоить ВРУЧНУЮ** через Supabase Dashboard → Edge Functions → Deploy (или `supabase functions deploy <name> --project-ref ovhwxfdtkzwxfomdlgjv` через CLI). Иначе прод не обновится.

### Частота

| ситуация | сколько раз в день |
|---|---|
| мелкие UI-правки | 3-5 |
| логика фронта | 1-3 |
| edge functions | 0-1 (плюс ручной деплой сразу) |
| миграции / RLS / схема БД | 0-1 (с проверкой `get_advisors` после) |

### Экстренный откат
- **фронт:** Vercel Dashboard → Deployments → предыдущий → Promote to Production
- **edge function:** Supabase Dashboard → Edge Functions → Deploy previous version

### Merge через MCP (пока automerge не работает)
PR создавай **сразу не-draft**, мержи через `mcp__github__merge_pull_request` с `merge_method: "squash"`. Draft-шаг бесполезен — automerge всё равно не сработает.

### Обязательные напоминания пользователю (проактивно)

Claude **сам** проговаривает эти пункты — не ждёт запроса:

1. **Перед каждым мержем** — короткая строка: «Прогнала локально `npm test && eslint && tsc --noEmit`? Vercel preview открыла?» Если пользователь не подтвердила — не мержить.
2. **После мержа PR, где менялись `supabase/functions/**`** — Claude деплоит их сам через Supabase MCP (`deploy_edge_function`), не перекладывая на пользователя, и сообщает новый номер версии.
2a. **После мержа PR, где менялся фронт (`src/**`)** — сразу: «Фронт в main, но Vercel не деплоит. Запусти `.\scripts\deploy.ps1` — иначе в браузере останется старая версия». Это единственное, что нельзя сделать за пользователя.
3. **После мержа миграций / изменений RLS / схемы БД** — «Запусти `get_advisors type=security` — проверь, не появилось ли новых ERROR».
4. **Если пользователь просит подключить новый OAuth к любому сервису через GitHub** — «Флаг suspicious ещё активен, OAuth через GitHub не сработает. Используй другой login-провайдер (Google/email/OpenAI)».
5. **В начале каждой сессии** — если `list_workflow_runs` для Kino-app возвращает `total_count: 0`, напомнить: «Actions ещё заблокированы. Merge-protocol в силе».

**Убрать этот блок**, когда T&S снимет флаг и `list_workflow_runs` начнёт возвращать нормальные runs.

---

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
