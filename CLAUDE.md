# Контекст проекта для Claude

## ⛔ ГЛАВНОЕ ПРАВИЛО

**Никаких изменений без явного согласования с пользователем.**
Claude меняет только то, что обсудили и что пользователь подтвердил. Никаких инициативных правок, «заодно», рефакторинга или отката чужих решений.
Заметил баг или улучшение — сообщи и жди разрешения. Не трогай.

---

> **Правило для Claude**: Читай этот файл в начале чата. В конце чата — обновляй раздел «Открытые баги»: убирай то что пофикшено, добавляй новые. Костяк файла (инфраструктура, стек, среда) не трогай — только если реально что-то добавилось или изменилось.

---

## Стиль общения Claude
- Выдавать только результат, без рассуждений вслух
- Не заполнять контекстное окно внутренними рассуждениями
- Коротко и по делу
- Без лишних объяснений если не просят
- Отвечать на языке пользователя

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
- `.github/workflows/promote.yml` — `dev` → `main` (только после `npm run build`)
- `.github/workflows/deploy.yml` — деплоит Edge Functions при изменении `supabase/functions/**`
- Секрет: `SBP_ACCESS_TOKEN` (Supabase Access Token) — уже добавлен в GitHub Secrets
- Права Actions: Read and write permissions — включены

### API ключи (уже в Supabase Secrets)
- `ANTHROPIC_API_KEY` ✅
- `OPENAI_API_KEY` ✅
- `GOOGLE_API_KEY` ✅
- `DEEPSEEK_API_KEY` ✅
- `TAVILY_API_KEY` (опционально)

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
3. `promote.yml` мержит `dev` → `main` после успешного билда
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
