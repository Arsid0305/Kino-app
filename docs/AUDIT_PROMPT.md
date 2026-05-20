# Repository Audit — Reference Prompt

Вставить этот файл целиком в начало аудита любому AI.  
Перед запуском — убедиться что блок «Контекст проекта» актуален.

---

## Перед началом — синхронизация

Аудит на устаревшем snapshot бесполезен. До чтения кода:
1. Прочитать последние 10 коммитов: `git log --oneline -10 main`
2. Зафиксировать HEAD: `git rev-parse main` — указать SHA в начале отчёта
3. Пробежать по `tasks/lessons.md` и `git log --grep=fix` за последний месяц — не повторять уже починенное

Если найден баг — убедиться что он **есть в текущем HEAD**, а не в кеше.

---

## Контекст проекта

```
Тип проекта: веб-приложение для рекомендации фильмов с AI-советником
Стек: React + Vite + TypeScript + Tailwind + shadcn/ui + Framer Motion
Бэкенд: Supabase Auth (email OTP + анонимный) + Edge Functions (Deno)
Edge Functions: ai-chat, movie-recommendation
Деплой: Vercel (фронтенд, main) + GitHub Actions (Edge Functions)
Тесты: Vitest (npm test)
Design System: git submodule kino-design-system/ (github.com/Arsid0305/design-system)

CI/CD:
  automerge.yml — claude/** и cursor/** → main автоматически, conflict guard
  promote.yml   — пост-мерж тесты (НЕ ТРОГАТЬ)
  deploy.yml    — Edge Functions при изменении supabase/functions/**

SSOT этого проекта:
  git workflow          → .github/workflows/automerge.yml (claude/**, cursor/** → main)
  логика рекомендаций  → src/lib/movieEngine.ts
  типы фильмов         → src/lib/movieTypes.ts
  Edge Functions       → supabase/functions/
  правила AI-работы    → CLAUDE.md

Вторичные источники (должны совпадать с SSOT):
  CLAUDE.md §Инфраструктура  → должен совпадать с automerge.yml (claude/** → main)
  CLAUDE.md §Рабочий процесс → должен отражать схему claude/... → main
  Edge Functions            → должны соответствовать типам из movieTypes.ts
```

**НЕ проверять** (нерелевантно для персонального проекта):
- multi-user RBAC и изоляция тенантов
- GDPR / compliance
- Docker / Kubernetes / horizontal scaling
- §10 ЗАВИСИМОСТИ — frontend-зависимости вынесены за скоп простого аудита

---

## Pipeline — 3 pass

| Pass | Секции | Фокус |
|------|--------|-------|
| 1 — Корректность | §1, §3, §8 | SSOT sync, чистота слоёв, обработка ошибок |
| 2 — Безопасность + документация | §6, §7, §5 | security, dead code, docs vs reality |
| 3 — CI + архитектура | §4, §9, §11, §12 | CI/CD, производительность, freshness |

---

## Чеклист аудита

### 1. СИНХРОНИЗАЦИЯ (SSOT → вторичные источники)

- [ ] `automerge.yml` мержит `claude/**` и `cursor/**` напрямую в `main` (нет dev-стейджа)
- [ ] `CLAUDE.md §Инфраструктура` совпадает с реальными workflow файлами
- [ ] `CLAUDE.md §Рабочий процесс` отражает схему `claude/... → main`
- [ ] Типы фильмов в Edge Functions соответствуют `src/lib/movieTypes.ts`
- [ ] Логика Edge Functions соответствует декларациям `movieEngine.ts`

### 2. ВНЕШНИЕ API И КЛИЕНТЫ

- [ ] AI-ключи (ANTHROPIC, OPENAI, GOOGLE, DEEPSEEK) — только в Supabase Secrets
- [ ] Rate limiting на AI Edge Functions — есть или нет (зафиксировать)
- [ ] CORS ограничен: `https://kino-app.vercel.app`, не `*`

### 3. ЧИСТОТА СЛОЁВ

- [ ] `movieEngine.ts` содержит только логику, не UI
- [ ] `movieTypes.ts` содержит только типы, не логику
- [ ] Компоненты React не содержат прямых обращений к Supabase — через хуки/сервисы

### 4. CI/CD

- [ ] `automerge.yml` триггер ограничен `claude/**` и `cursor/**`
- [ ] `automerge.yml` мержит в `main` (не в `dev`)
- [ ] `promote.yml` существует и не тронут (назначение см. CLAUDE.md)
- [ ] `deploy.yml` триггерится только на `supabase/functions/**`
- [ ] При конфликте мержа — abort + exit 1
- [ ] Нет `-X theirs`, нет force push в main

### 5. ДОКУМЕНТАЦИЯ vs РЕАЛЬНОСТЬ

- [ ] `CLAUDE.md §Инфраструктура` — описание совпадает с `automerge.yml`
- [ ] `CLAUDE.md §Рабочий процесс` — указан `claude/... → main`
- [ ] `CLAUDE.md §Среда Claude` — статусы актуальные
- [ ] Все пути в `.md` реально существуют

### 6. БЕЗОПАСНОСТЬ

- [ ] Нет `service_role` ключа в `VITE_` переменных
- [ ] `.env` не попал в историю git: `git log --all -- .env`
- [ ] Каждая Edge Function верифицирует JWT → 401
- [ ] RLS включён на каждой таблице, политики через `auth.uid()`
- [ ] Входные данные валидируются через `zod`

### 7. МЁРТВЫЙ КОД

- [ ] Нет неиспользуемых Edge Functions в `supabase/functions/`
- [ ] Нет устаревших workflow файлов

### 8. ОБРАБОТКА ОШИБОК

- [ ] Edge Functions — понятный HTTP-код при ошибке, не только 500
- [ ] Frontend отображает ошибки пользователю
- [ ] `automerge.yml` abort при конфликте

### 9–12. Остальные разделы

_См. темплейт AUDIT_PROMPT.md из `github.com/Arsid0305/TEMPLATE/docs/AUDIT_PROMPT.md` §§9–12._

---

## Формат отчёта

```
SEVERITY: BLOCKER / HIGH / MEDIUM / LOW
CONFIDENCE: HIGH / MEDIUM / LOW

[СЕВЕРИТЕТ] [УВЕРЕННОСТЬ]
Файл: path/to/file:line
Проблема: ...
Последствие: ...
Фикс: ...
```

Завершить: Блокеры / Что сделано хорошо / Следующие 3 приоритета.

---

## Вывод

Отчёт одним markdown файлом.
