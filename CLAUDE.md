# Контекст проекта для Claude

## ⛔ ГЛАВНОЕ ПРАВИЛО

**Никаких изменений без явного согласования с пользователем.**
Claude меняет только то, что обсудили и что пользователь подтвердил. Никаких инициативных правок, «заодно», рефакторинга или отката чужих решений.
Заметил баг или улучшение — сообщи и жди разрешения. Не трогай.

**Исключение:** если баг напрямую мешает текущей задаче и очевиден — исправь и сообщи.

---

> **Правило для Claude**: Читай этот файл и `tasks/lessons.md` в начале каждого чата. В конце чата — обновляй раздел «Открытые баги»: убирай что пофикшено, добавляй новые. Костяк файла (инфраструктура, стек, среда) не трогай — только если реально что-то добавилось или изменилось.

---

## TEMPLATE репо

Всегда читать в начале чата:
```bash
git clone https://github.com/Arsid0305/TEMPLATE /tmp/arsid-template
```
Затем прочитать все `.md` файлы из `/tmp/arsid-template/`.

---

## Core Principles

1. **Понять перед кодом** — прочитай связанный код перед написанием
2. **Минимальное изменение** — меняй строго то, что нужно для задачи
3. **Верификация перед Done** — убедись что работает, потом сообщай о готовности
4. **Документируй расхождения** — если реальность не совпадает с CLAUDE.md, обнови нужный раздел

---

## BIG vs SMALL задачи

**SMALL** (делай сразу без согласования плана): опечатки, однострочные правки, переименования, текстовые изменения.

**BIG** (сначала план, потом «делай»): новые фичи, рефакторинг, изменение архитектуры, новые зависимости, изменение схемы БД.

Для BIG: коротко объясни что именно и где меняешь → жди подтверждения → только потом код.

---

## Task Management

- `tasks/todo.md` — текущие задачи. Читать и обновлять каждый чат.
- `tasks/lessons.md` — выученные уроки и паттерны. Читать в начале, дополнять в конце чата.

---

## Review перед кодом

Перед написанием любого кода — прочитай связанные файлы:
- Меняешь компонент → прочитай весь компонент целиком
- Меняешь Edge Function → прочитай её целиком
- Добавляешь новый файл → посмотри соседние файлы для консистентности стиля

---

## Верификация перед Done

Перед тем как сообщить о готовности:
1. Логика соответствует задаче
2. Нет очевидных TypeScript ошибок
3. Граничные случаи учтены
4. Нет новых секретов в коде

---

## Subagents

Используй subagents (Agent tool) для:
- Параллельного поиска по разным частям кода
- Изолированных исследований, не нужных в основном контексте

Не используй для простых однофайловых задач.

---

## Self-Improvement Loop

В конце каждого чата:
1. Добавь в `tasks/lessons.md` что нового узнал о проекте
2. Обнови «Открытые баги» — убери пофикшенные, добавь новые
3. Если CLAUDE.md устарел — обнови нужный раздел

---

## Безопасность — чеклист

Перед каждым PR проверить:
- [ ] Нет секретов в коде (ключи, пароли, токены)
- [ ] `ALLOWED_ORIGINS` установлен в Supabase Secrets (не полагаться на `*`)
- [ ] Входные данные валидируются перед использованием
- [ ] RLS включён на всех таблицах Supabase
- [ ] `npm audit --audit-level=high` не показывает критических уязвимостей

---

## Правило «Мержить в main?"

Никогда не пушить напрямую в `main`. Автоматика сама промоутит:
1. Пуш в `claude/...` → `automerge.yml` мержит в `dev`
2. `promote.yml` мержит `dev` → `main` после успешного билда + audit

---

## ⚠️ ОБЯЗАТЕЛЬНО ПРИ ЛЮБЫХ UI-ПРАВКАХ

**Перед изменением любого UI-компонента (карточки, кнопки, плашки, чипы, шапка, чат, формы)** — сначала прочитай соответствующий файл из папки `kino-design-system/kino-app/preview/`:

| Что меняешь | Файл в design system |
|-------------|---------------------|
| Карточка фильма (MovieCard, чат-карточки) | `kino-design-system/kino-app/preview/component-cards.html` |
| Кнопки (action buttons) | `kino-design-system/kino-app/preview/component-buttons.html` |
| Чипы (фильтры, теги жанров/настроений) | `kino-design-system/kino-app/preview/component-chips.html` |
| Шапка + табы + stat-карточки счётчиков | `kino-design-system/kino-app/preview/component-nav.html` |
| Чат-окно AI | `kino-design-system/kino-app/preview/component-chat.html` |
| Форма входа / OTP / профиль | `kino-design-system/kino-app/preview/component-auth.html` |
| Цвета, фоны, primary/secondary | `kino-design-system/kino-app/preview/colors-base.html`, `colors-semantic.html` |
| Шрифты (display/body) | `kino-design-system/kino-app/preview/type-display.html`, `type-body.html` |
| Тени, glow | `kino-design-system/kino-app/preview/shadows-glow.html` |
| Отступы | `kino-design-system/kino-app/preview/spacing-tokens.html` |

**Никогда не выдумывай UI с нуля.** Открой нужный файл, скопируй классы/токены, перевоплоти в Tailwind. Если пользователь говорит «как на телефоне» / «как было» / «не похоже» — точно нарушено это правило, иди в design system.

Design system — отдельный репо `github.com/Arsid0305/design-system`, подключён как git submodule в папку `kino-design-system/`.
Перед чтением файлов — инициализировать: `git submodule update --init`
Обновить до последней версии: `git submodule update --remote`

---

## Инфраструктура (настроена, не трогать)

### Хостинг
- **Фронтенд**: Vercel — подключён к GitHub, деплоит автоматически при пуше в `main`
- **Бэкенд**: Supabase Edge Functions — деплоит автоматически через GitHub Actions
- **БД и Auth**: Supabase, проект `ovhwxfdtkzwxfomdlgjv`
- **Репо**: github.com/arsid0305/kino-app, основная ветка `main`

### GitHub Actions (автоматический деплой)
- `.github/workflows/automerge.yml` — любая ветка → `dev` (авто, без проверок)
- `.github/workflows/promote.yml` — `dev` → `main` (только после `npm run build` + `npm audit`)
- `.github/workflows/deploy.yml` — деплоит Edge Functions при изменении `supabase/functions/**`
- Секрет: `SBP_ACCESS_TOKEN` (Supabase Access Token) — уже добавлен в GitHub Secrets
- Права Actions: Read and write permissions — включены

### API ключи (уже в Supabase Secrets)
- `ANTHROPIC_API_KEY` ✅
- `OPENAI_API_KEY` ✅
- `GOOGLE_API_KEY` ✅
- `DEEPSEEK_API_KEY` ✅
- `TAVILY_API_KEY` (опционально)
- `ALLOWED_ORIGINS` — установить значение `https://kino-app.vercel.app` (или актуальный домен)

---

## Стек приложения

- **Фронтенд**: React + Vite + TypeScript + Tailwind + shadcn/ui
- **Анимации**: Framer Motion
- **Excel-парсинг**: xlsx (runtime)
- **БД**: Supabase (таблицы: `user_movies`, `chat_messages`)
- **Auth**: Supabase Auth (email OTP + анонимный)
- **Edge Functions** (Deno):
  - `ai-chat` — мультипровайдерный AI чат (Claude / GPT / Gemini / DeepSeek)
  - `movie-recommendation` — подбор фильмов через DeepSeek

### devDependencies (не в рантайме)
- `@resvg/resvg-js` — конвертация SVG → PNG для генерации PWA-иконок (`public/icon-192.png`, `public/icon-512.png`). Запускать через `node scripts/...` при смене иконки.

---

## Среда Claude (что доступно в чате)

| Инструмент | Статус |
|-----------|--------|
| Node.js v22 | ✅ |
| npm v10 | ✅ |
| Git v2.43 | ✅ |
| Vite v8 | ✅ |
| Supabase CLI | ❌ Не работает |
| Deno | ❌ Не установлен |
| node_modules | ❌ Нет (есть package-lock.json, установить через `npm ci`) |
| .env реальный | ❌ Только .env.example |

Claude может писать и пушить код. Собрать фронтенд и задеплоить функции вручную — не может. Всё через GitHub Actions + Vercel автоматически.

---

## Рабочий процесс

1. Claude пишет код → пушит в ветку `claude/...`
2. `automerge.yml` мержит ветку в `dev` автоматически
3. `promote.yml` мержит `dev` → `main` после успешного билда + audit
4. Vercel деплоит фронтенд автоматически (1-2 мин)
5. GitHub Actions деплоит Edge Functions автоматически (1-2 мин)
6. Тестируем на проде

## Правила Git

- Разрабатывать на ветке `claude/...`, никогда не пушить напрямую в `main`
- Никогда не использовать `--no-verify`, `--force`, `--no-gpg-sign`
- Синхронизация с основной: `git pull origin main`

---

## Открытые баги

_(пусто — фикси по мере поступления)_

---

## Папка проекта на машине пользователя

```
C:\DATA\AI_OS\projects\Kino-app
```

Локальная синхронизация (`pull-all.bat` в `C:\DATA\AI_OS\`):
```bat
@echo off
echo Синхронизация всех проектов...

echo [1/5] Kino-app
cd /d C:\DATA\AI_OS\projects\Kino-app
git pull origin main

echo [2/5] WB_bot
cd /d C:\DATA\AI_OS\projects\WB_bot
git pull origin main

echo [3/5] Response_bot
cd /d C:\DATA\AI_OS\projects\Response_bot
git pull origin main

echo [4/5] Skincare_Guide
cd /d C:\DATA\AI_OS\projects\Skincare_Guide
git pull origin main

echo [5/5] Technical_language
cd /d C:\DATA\AI_OS\projects\Technical_language
git pull origin main

echo Готово!
pause
```
