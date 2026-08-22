# Claude Adapter — Kino-app

> Тонкий адаптер. Универсальные правила экосистемы — в `docs/rules/core/*.md` (синкается из AI_OS SSOT).
> Специфика Kino-app — в `docs/rules/scoped/kino-app-specific.md`.

---

## 🚨 TEMPORARY — GitHub Actions заблокированы (пока T&S не снимет флаг)

_Активен с: июль 2026. Последняя проверка: 2026-08-19._

Аккаунт `Arsid0305` помечен suspicious, GitHub Actions отключены на уровне account. Тикет #4535795 в работе с июля 2026.

**Как убедиться что блок ещё актуален** (быстрая проверка в начале сессии): `mcp__github__actions_list` для `Arsid0305/Kino-app` → если `total_count: 0` за последние 24 часа, блок ещё актуален. Если пошли runs — снимать блок и восстановить обычный автоматизированный workflow.

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
2a. **После КАЖДОГО мержа в `main` — сразу дать готовый блок команд.** Не «не забудь задеплоить», а именно копируемые строки:

```powershell
cd C:\Users\arols\kino-deploy
git pull origin main
.\scripts\deploy.ps1
```

Ждать вопроса не надо, пользователь просила писать это самой. Правило действует, пока Vercel не деплоит из GitHub.

Если мерж не влияет на бандл (правки только в `docs/`, `tasks/`, `CLAUDE.md`, `scripts/`, `supabase/**`) — вместо блока сказать прямо: «деплой не нужен, менялись только <что>». Молчать нельзя в обоих случаях: пользователь не должна гадать, доехало до браузера или нет.

После деплоя напомнить, что service worker отдаёт старую версию до **второго** захода: обновить страницу дважды, на телефоне — закрыть и открыть приложение. Если не помогло — Настройки → Safari → Дополнения → Данные сайтов → `vercel.app` → удалить.
3. **После мержа миграций / изменений RLS / схемы БД** — «Запусти `get_advisors type=security` — проверь, не появилось ли новых ERROR».
4. **Если пользователь просит подключить новый OAuth к любому сервису через GitHub** — «Флаг suspicious ещё активен, OAuth через GitHub не сработает. Используй другой login-провайдер (Google/email/OpenAI)».
5. **В начале каждой сессии** — если `list_workflow_runs` для Kino-app возвращает `total_count: 0`, напомнить: «Actions ещё заблокированы. Merge-protocol в силе».

**Убрать этот блок**, когда T&S снимет флаг и `list_workflow_runs` начнёт возвращать нормальные runs.

---

## Каноны (rules как атомы)

Универсальные правила — в `docs/rules/core/*.md` (SSOT в AI_OS, синкается автоматически):

- Начало / конец сессии — [`docs/rules/core/session-lifecycle.md`](docs/rules/core/session-lifecycle.md)
- Стиль общения / краткость — [`docs/rules/core/communication-style.md`](docs/rules/core/communication-style.md)
- Git flow, запрет флагов, редактирование — [`docs/rules/core/git-flow.md`](docs/rules/core/git-flow.md)
- GitHub anti-abuse — [`docs/rules/core/github-anti-abuse.md`](docs/rules/core/github-anti-abuse.md)
- BIG / SMALL классификация — [`docs/rules/core/task-classification.md`](docs/rules/core/task-classification.md)
- Принципы работы с кодом — [`docs/rules/core/code-principles.md`](docs/rules/core/code-principles.md)
- Subagents (worktree, JSON-schema контракты) — [`docs/rules/core/subagents.md`](docs/rules/core/subagents.md)
- Audit-триггер — [`docs/rules/core/audit-trigger.md`](docs/rules/core/audit-trigger.md)
- Выбор модели `haiku`/`sonnet`/`opus` — `llm_wiki/wiki/workflow.md`
- Context Mode — `llm_wiki/wiki/context-mode.md`
- Универсальный audit-canon — `llm_wiki/wiki/audit-universal.md`
- Проектный audit-overlay — `docs/AUDIT_PROMPT.md`

**Специфика Kino-app** (scoped): [`docs/rules/scoped/kino-app-specific.md`](docs/rules/scoped/kino-app-specific.md) — design-system маппинг, безопасность (verify_jwt/CORS/RLS/zod), стек, среда.

Архитектура rules и правила синка — [`docs/rules/README.md`](docs/rules/README.md).

---

## LLM_Wiki

В начале сессии читать: `wiki/lessons.md`, `wiki/decisions.md`, `wiki/projects.md`.

---

## Task Management

- `tasks/todo.md` — план BIG задач, чекбоксы, отмечать выполненное
- `tasks/lessons.md` — паттерны ошибок (формат — в [`docs/rules/core/session-lifecycle.md`](docs/rules/core/session-lifecycle.md) §«Формат lessons.md»)
- `docs/AUDIT_PROMPT.md` — тонкий overlay + ссылка на `llm_wiki/wiki/audit-universal.md`

---

## Инфраструктура

_Проверено: 2026-08-19._

- Vercel — фронтенд. **Автодеплой мёртв с 26.06.2026** (GitHub-интеграция отвалилась вместе с T&S-флагом). Деплой только ручной: `scripts/deploy.ps1` из отдельного клона (см. TEMPORARY-блок в начале файла).
- Supabase — БД, Auth, Edge Functions (`ai-chat`, `movie-recommendation`), проект `ovhwxfdtkzwxfomdlgjv`. Деплой edge functions — вручную через Supabase MCP (`deploy_edge_function`) после мержа.
- GitHub Actions — **фактически не работают** пока активен T&S-флаг. Файлы workflow сохранены, автоматически включатся когда флаг снимут:
  - `automerge.yml` — PR `claude/**` / `cursor/**` → main через API (squash + deleteRef). Сейчас мерж через `mcp__github__merge_pull_request`.
  - `deploy.yml` — деплой Edge Functions при изменении `supabase/functions/**`. Сейчас через Supabase MCP.

API-ключи в Supabase Secrets: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `DEEPSEEK_API_KEY`, `ALLOWED_ORIGINS`.

---

## Пути на машине пользователя (проверено 2026-08-16)
- рабочая копия — `C:\DATA\PROJECTS\Kino-app`
- клон под деплой — `C:\Users\arols\kino-deploy` (отдельный, потому что `vercel --prod` отправляет папку как есть, вместе с незакоммиченными правками)
