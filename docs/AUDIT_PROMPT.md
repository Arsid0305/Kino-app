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

CI/CD: ДВУХСТУПЕНЧАТЫЙ WORKFLOW (намеренно):
  automerge.yml — claude/** и cursor/** → dev автоматически, conflict guard
  promote.yml   — dev → main после npm test + build (НЕ ТРОГАТЬ)
  deploy.yml    — Edge Functions при изменении supabase/functions/**

SSOT этого проекта:
  git workflow          → .github/workflows/automerge.yml (→ dev), promote.yml (dev → main)
  логика рекомендаций  → src/lib/movieEngine.ts
  типы фильмов         → src/lib/movieTypes.ts
  Edge Functions       → supabase/functions/
  правила AI-работы    → CLAUDE.md

Вторичные источники (должны совпадать с SSOT):
  CLAUDE.md §Инфраструктура  → должен совпадать с automerge.yml и promote.yml
  CLAUDE.md §Рабочий процесс → должен отражать схему claude/... → dev → main
  Edge Functions            → должны соответствовать типам из movieTypes.ts
```

**НЕ проверять** (нерелевантно для персонального проекта):
- multi-user RBAC и изоляция тенантов
- GDPR / compliance
- Docker / Kubernetes / horizontal scaling
- §10 ЗАВИСИМОСТИ — frontend-зависимости вынесены за скоп простого аудита

---

## Pipeline — 3 pass

Один pass не справляется с объёмом. Запускать как отдельные сессии:

| Pass | Секции | Фокус |
|------|--------|-------|
| 1 — Корректность | §1, §3, §8 | SSOT sync, чистота слоёв, обработка ошибок |
| 2 — Безопасность + документация | §6, §7, §5, §5.1 | security, dead code, docs vs reality |
| 3 — CI + архитектура | §4, §9, §11, §12 | CI/CD, производительность, freshness |

Каждый pass — свой мини-отчёт в формате §«Формат отчёта».

---

## Чеклист аудита

### 1. СИНХРОНИЗАЦИЯ (SSOT → вторичные источники)

- [ ] `automerge.yml` мержит в `dev` (не в `main`) — двухступенчатый workflow
- [ ] `promote.yml` существует и мержит `dev → main` после тестов
- [ ] `CLAUDE.md §Инфраструктура` совпадает с реальными workflow файлами
- [ ] `CLAUDE.md §Рабочий процесс` отражает схему `claude/... → dev → main`
- [ ] Типы фильмов в Edge Functions соответствуют `src/lib/movieTypes.ts`
- [ ] Логика `ai-chat` и `movie-recommendation` соответствует декларациям `movieEngine.ts`

### 2. ВНЕШНИЕ API И КЛИЕНТЫ

- [ ] `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` — единственные публичные ключи во фронтенде
- [ ] AI-ключи (ANTHROPIC, OPENAI, GOOGLE, DEEPSEEK) — только в Supabase Secrets, не в фронтенде
- [ ] Rate limiting на AI Edge Functions — есть или нет (зафиксировать статус)
- [ ] CORS ограничен: `https://kino-app.vercel.app`, не `*`

### 3. ЧИСТОТА СЛОЁВ

- [ ] `movieEngine.ts` содержит только логику, не UI
- [ ] `movieTypes.ts` содержит только типы, не логику
- [ ] Edge Functions не содержат бизнес-логику фронтенда
- [ ] Компоненты React не содержат прямых обращений к Supabase — через хуки/сервисы

### 4. CI/CD

- [ ] `automerge.yml` триггер ограничен `claude/**` и `cursor/**`
- [ ] `automerge.yml` мержит в `dev`, не в `main`
- [ ] `promote.yml` запускает `npm ci && npm test && npm run build` перед мержем dev → main
- [ ] `deploy.yml` триггерится только на `supabase/functions/**`
- [ ] При конфликте мержа в automerge — abort + exit 1, не зависает
- [ ] Нет `-X theirs` в automerge.yml
- [ ] Нет `--no-verify`, нет force push в main

### 5. ДОКУМЕНТАЦИЯ vs РЕАЛЬНОСТЬ

**Сканировать ВСЕ `.md` файлы:**
```
find . -name '*.md' -not -path './.git/*' -not -path '*/kino-design-system/*'
```

- [ ] `CLAUDE.md §Инфраструктура` — описание workflow совпадает с реальными workflow файлами
- [ ] `CLAUDE.md §Среда Claude` — статусы инструментов актуальны
- [ ] Все пути в `.md` реально существуют в репо
- [ ] `README.md` — есть, не пустой

#### 5.1 ПЕРЕКРЁСТНАЯ СВЕРКА

| Что сверять | Источник (SSOT) | Вторичные |
|---|---|---|
| Git workflow | `automerge.yml` + `promote.yml` | `CLAUDE.md §Инфраструктура`, `CLAUDE.md §Рабочий процесс` |
| Типы данных | `movieTypes.ts` | Edge Functions, `movieEngine.ts` |
| UI-компоненты | `kino-design-system/` | `src/components/` |

- [ ] Git workflow одинаков во всех источниках: automerge → dev, promote.yml → main
- [ ] Типы в Edge Functions не дублируются из `movieTypes.ts`
- [ ] UI использует токены из design system, не хардкод

### 6. БЕЗОПАСНОСТЬ

- [ ] Нет `service_role` ключа в `VITE_` переменных
- [ ] `.env` не попал в историю git: `git log --all -- .env`
- [ ] Каждая Edge Function верифицирует JWT: `supabase.auth.getUser(token)` → 401
- [ ] `user_id` берётся только из верифицированного токена, не из тела запроса
- [ ] Входные данные валидируются через `zod` до обращения к БД
- [ ] RLS включён на каждой таблице в `public` схеме, политики через `auth.uid()`
- [ ] `vite.config.ts` — нет `build.sourcemap: true`
- [ ] Секреты не выводятся в `run:` шагах CI через `echo`

### 7. МЁРТВЫЙ КОД

- [ ] Нет неиспользуемых Edge Functions в `supabase/functions/`
- [ ] Нет типов в `movieTypes.ts` которые не используются нигде
- [ ] Нет устаревших workflow файлов в `.github/workflows/`

### 8. ОБРАБОТКА ОШИБОК

- [ ] Edge Functions возвращают понятный HTTP-код при ошибке, не только 500
- [ ] Ошибки в `movieEngine.ts` обрабатываются, не падают скрытно
- [ ] Frontend отображает ошибки AI/сети пользователю (toast/fallback)
- [ ] `automerge.yml` abort при конфликте, не зависает

### 9. НАБЛЮДАЕМОСТЬ

- [ ] Ошибки Edge Functions логируются в Supabase Logs
- [ ] Frontend-ошибки не содержат секретов в `console.log`

### 10. ЗАВИСИМОСТИ

_Не входит в скоп простого аудита._

### 11. АРХИТЕКТУРНЫЙ СМЫСЛ

- [ ] Что можно удалить без потери функциональности
- [ ] Добавление новой Edge Function: сколько мест трогать?
- [ ] `movieEngine.ts` — есть ли признаки God Object?

### 12. AUDIT FRESHNESS

- [ ] Указать HEAD main SHA в начале отчёта
- [ ] Если пункт чеклиста «уже починено» — отметить, не выписывать как новую проблему

---

## Формат отчёта

**Калибровка severity до написания:**

```
SEVERITY:
  BLOCKER  = потеря данных / runtime не работает / дыра в безопасности
  HIGH     = silent degradation / неверный результат / неверный биллинг
  MEDIUM   = риск maintainability / drift который выстрелит через месяц
  LOW      = косметика / расхождение в docs / стиль

CONFIDENCE:
  HIGH    = нашёл в коде, строку указал, воспроизводимо
  MEDIUM  = паттерн виден, точная строка не проверена
  LOW     = подозрение — помечать явно, не выписывать как факт
```

Каждая проблема строго в формате:

```
[SEVERITY] [CONFIDENCE]
Файл: path/to/file:line
Проблема: что конкретно не так
Последствие: что сломается в реальном использовании
Фикс: конкретное исправление
```

Завершить отчёт тремя блоками:
1. **Блокеры** — что мешает работе прямо сейчас
2. **Что сделано хорошо** — не пропускать
3. **Следующие 3 приоритета** — конкретные задачи в порядке важности

**Не писать:**
- общие советы без привязки к файлу
- «рассмотреть использование паттерна X»
- enterprise-рекомендации

---

## Вывод

Отчёт одним markdown файлом.
