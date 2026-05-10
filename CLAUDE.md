# Контекст проекта для Claude

## ⛔ ГЛАВНОЕ ПРАВИЛО

**Никаких изменений без явного согласования с пользователем.**
Claude меняет только то, что обсудили и что пользователь подтвердил. Никаких инициативных правок, «заодно», рефакторинга или отката чужих решений.
Заметил баг или улучшение — сообщи и жди разрешения. Не трогай.

---

> **Правило для Claude**: Читай этот файл в начале чата. В конце чата — обновляй раздел «Открытые баги»: убирай то что пофикшено, добавляй новые. Костяк файла (инфраструктура, стек, среда) не трогай — только если реально что-то добавилось или изменилось.

---

## Стиль общения Claude
- Отвечать только результатом — без вступлений («сейчас сделаю», «давай разберёмся», «хороший вопрос»)
- Не рассуждать вслух, не объяснять что собираешься сделать до того как сделал
- Не заполнять контекстное окно внутренними рассуждениями
- Коротко и по делу — одно предложение вместо абзаца
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

**Никогда не выдумывай UI с нуля.** Открой нужный файл, скопируй классы/токены, перевоплоти в Tailwind.

Design system — отдельный репо `github.com/Arsid0305/design-system`, подключён как git submodule в папку `kino-design-system/`.
Инициализировать: `git submodule update --init`
Обновить: `git submodule update --remote`

---

## Инфраструктура (настроена, не трогать)

- **Фронтенд**: Vercel — деплоит автоматически при пуше в `main`
- **Бэкенд**: Supabase Edge Functions — деплоит автоматически через GitHub Actions
- **БД и Auth**: Supabase, проект `ovhwxfdtkzwxfomdlgjv`
- **Репо**: github.com/arsid0305/kino-app
- `.github/workflows/automerge.yml` — любая ветка → `dev`
- `.github/workflows/promote.yml` — `dev` → `main` после `npm run build`
- `.github/workflows/deploy.yml` — Edge Functions при изменении `supabase/functions/**`

---

## Стек

- React + Vite + TypeScript + Tailwind + shadcn/ui + Framer Motion
- Supabase Auth (email OTP + анонимный), Edge Functions (Deno)
- `ai-chat`, `movie-recommendation`

---

## Среда Claude

| Инструмент | Статус |
|-----------|--------|
| Node.js v22 | ✅ |
| npm v10 | ✅ |
| Supabase CLI | ❌ |
| Deno | ❌ |
| node_modules | ❌ (есть package-lock.json, `npm ci`) |
| .env реальный | ❌ (только .env.example) |

---

## Subagents

Использовать для:
- Исследования и анализа кода (не засорять основной контекст)
- Параллельных независимых задач

Один subagent — одна фокусная задача.

---

## Выбор модели для subagents

При запуске subagent всегда явно указывать `model`:

| Модель | Когда использовать |
|---------|-------------------|
| `haiku` | Поиск файлов, чтение кода, grep, простые запросы — быстро и дёшево |
| `sonnet` | Написание кода, отладка, стандартные задачи — баланс качества и цены |
| `opus` | Архитектура, сложный анализ, планирование BIG-задач — максимальное качество |

По умолчанию — `sonnet`. Переключаться на `haiku` если задача простая, на `opus` только если требуется глубокое архитектурное решение.

---

## Рабочий процесс

1. Claude пишет код → пушит в ветку `claude/...`
2. `automerge.yml` мержит ветку в `dev` автоматически
3. `promote.yml` мержит `dev` → `main` после успешного билда
4. Vercel + Actions деплоят автоматически (1-2 мин)
5. Тестируем на проде

## Правила Git

- Разрабатывать на ветке `claude/...`, никогда не пушить напрямую в `main`
- Никогда не использовать `--no-verify`, `--force`, `--no-gpg-sign`
- Синхронизация с основной: `git pull origin main`

---

## Открытые баги

_(пусто)_

---

## Папка проекта

```
C:\DATA\AI_OS\projects\Kino-app
```
