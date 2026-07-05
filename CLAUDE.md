# Контекст проекта для Claude

## ⛔ ГЛАВНОЕ ПРАВИЛО

**Никаких изменений без явного согласования с пользователем.**
Claude меняет только то, что обсудили и что пользователь подтвердил. Никаких инициативных правок, «заодно», рефакторинга или отката чужих решений.
Заметил баг или улучшение — сообщи и жди разрешения. Не трогай.

**Исключение:** баг внутри уже согласованного скоупа задачи — чини сам, сообщи после.

> Правило: Читай этот файл и `tasks/lessons.md` в начале каждого чата. В конце чата — обновляй «Открытые баги» и `tasks/lessons.md`.

---

## LLM_Wiki — Общий контекст экосистемы

В начале каждой сессии прочитать из репо `arsid0305/llm_wiki` (ветка `main`):
- `wiki/lessons.md` — кросс-проектные уроки
- `wiki/decisions.md` — ключевые архитектурные решения

Даёт контекст по всем проектам без объяснений от пользователя.

---

## Глобальный стандарт

Этот файл создан на основе `github.com/Arsid0305/TEMPLATE`. При появлении нового паттерна — предложить для обсуждения, после одобрения внести в глобальный стандарт.

---

## Стиль общения Claude

Канон — `AI_OS/SYSTEM.md §4` + `AI_OS/CLAUDE.md` («Правила краткости»).

---

## TEMPLATE репо — автодоступ

`github.com/Arsid0305/TEMPLATE` содержит шаблоны для всех проектов.

Claude читает его через git:
```bash
git clone https://github.com/Arsid0305/TEMPLATE /tmp/arsid-template
```

Репо публичное — работает без токена.

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

## BIG vs SMALL — определить до начала

Спросить пользователя: это большая или маленькая задача?

**BIG** (новая фича, архитектура, рефакторинг):
- Написать план в `tasks/todo.md` с чекбоксами
- Провести полный review по разделам ниже
- Пауза после каждого раздела — ждать фидбек
- Не писать код до финального «делай»

**SMALL** (баг, мелкое изменение, стиль):
- Один фокусный вопрос на раздел если нужно
- Краткий план (2-3 строки), подождать «делай»

---

## Перед написанием кода — Review

**Не начинать реализацию до завершения review и подтверждения пользователя.**

Для каждой найденной проблемы:
1. Описание проблемы
2. Почему важно
3. 2-3 варианта решения (включая «не трогать» если разумно)
4. Для каждого варианта: усилие / риск / импакт / стоимость поддержки
5. Рекомендация + причина

### Архитектура
- Границы компонентов, граф зависимостей
- Точки отказа, масштабируемость
- Безопасность (auth, доступ к данным, API limits)

### Качество кода
- DRY-нарушения — помечать агрессивно
- Обработка ошибок и edge cases
- Технический долг, over/under engineering

### Тесты
- Покрытие (unit, integration, e2e)
- Непокрытые сценарии отказа
- Качество assertions

### Производительность
- N+1 запросы, неэффективный I/O
- Узкие места, caching opportunities

---

## Task Management

- `tasks/todo.md` — план с чекбоксами до начала любой BIG задачи. Отмечать выполненное по ходу.
- `tasks/lessons.md` — паттерны ошибок. Фиксировать после каждой правки от пользователя.

Формат записи в `tasks/lessons.md`:
```
## [дата] [краткое название ситуации]
**Что произошло:** ...
**Правило:** ...
```

---

## Верификация перед Done

Никогда не говорить «готово» без:
- Проверки что код работает (тесты, логи, поведение)
- Сравнения до/после если релевантно
- Вопроса себе: «Одобрил бы это Senior Engineer в проде?»

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

## Self-Improvement Loop

После каждой правки от пользователя:
1. Понять паттерн ошибки
2. Записать правило в `tasks/lessons.md`
3. Читать `tasks/lessons.md` в начале следующего чата

---

## Предложение улучшений в стандарт

Если в проекте появился новый паттерн, инструмент, или решение лучше существующего:
1. Не применять молча — сначала предложить пользователю
2. Описать: что это, почему лучше, какой трейдофф
3. Ждать решения: принять в стандарт / использовать только в этом проекте / отклонить
4. После одобрения — внести в `~/.claude/CLAUDE.md`

---

## Core Principles

- **Простота:** минимальный импакт, трогать только необходимое
- **Корень проблемы:** не хакать, искать причину, не временные фиксы
- **Явность над хитростью:** явные решения лучше умных
- **Тесты:** лучше лишний тест, чем непокрытый edge case
- **Элегантность:** для нетривиальных изменений — спросить себя «есть ли более элегантный способ?»

---

## Context Mode

Канон — `llm_wiki/wiki/context-mode.md`. Routing rules, инструменты `ctx_*`, команды `ctx stats/doctor/upgrade/purge` — там.

---

## Безопасность — чеклист перед первым деплоем

Claude инициирует проверку сам перед первым деплоем в `main`. Молча не пропускать.

### Secrets & ключи
- [ ] `service_role` ключ нигде в `VITE_` переменных — только в Edge Functions или GitHub Secrets
- [ ] `.env` файлы в `.gitignore`, не попали в историю git (`git log --all -- .env`)
- [ ] В `vite.config.ts` нет `build.sourcemap: true` (исходники не отдаются в браузер)

### Supabase RLS
- [ ] RLS включён на **каждой** таблице в `public` схеме
- [ ] Политики используют `auth.uid() = user_id`, не открыты анонимам

### Edge Functions
- [ ] Каждая функция верифицирует JWT: `supabase.auth.getUser(token)` → 401 если невалидный
- [ ] Никаких user_id из тела запроса — только из верифицированного токена
- [ ] Входные данные валидируются через `zod` до любого обращения к БД
- [ ] CORS ограничен: `Access-Control-Allow-Origin: https://kino-app.vercel.app` (не `*`)

### CI/CD
- [ ] В каждом workflow файле: `permissions: contents: write` (для push)
- [ ] Actions закреплены по commit SHA, не по тегу
- [ ] `npm audit --audit-level=high` добавлен как шаг перед билдом
- [ ] Секреты не выводятся в `run:` шагах через `echo`

### OWASP Top 10 — быстрая проверка
- [ ] A01 Broken Access Control — RLS на всех таблицах, JWT в каждой Edge Function
- [ ] A02 Cryptographic Failures — нет service_role во фронтенде, нет секретов в git
- [ ] A03 Injection — zod валидация на всех входных данных Edge Functions
- [ ] A05 Misconfiguration — CSP, CORS, заголовки настроены
- [ ] A06 Vulnerable Components — `npm audit` в CI
- [ ] A07 Auth Failures — rate limiting на OTP, токен верифицируется на бэкенде

---

## Инфраструктура (настроена, не трогать)

- **Фронтенд**: Vercel — деплоит автоматически при пуше в `main`
- **Бэкенд**: Supabase Edge Functions — деплоит автоматически через GitHub Actions
- **БД и Auth**: Supabase, проект `ovhwxfdtkzwxfomdlgjv`
- **Репо**: github.com/arsid0305/kino-app
- `.github/workflows/automerge.yml` — PR из `claude/**` или `cursor/**` → автомерж в `main` через GitHub API
- `.github/workflows/promote.yml` — тесты перед деплоем в `main` (не трогать)
- `.github/workflows/deploy.yml` — Edge Functions при изменении `supabase/functions/**`
- `SBP_ACCESS_TOKEN` — в GitHub Secrets ✅

> **Требует:** Settings → General → «Allow auto-merge» включён в репо

### API ключи (в Supabase Secrets)
- `ANTHROPIC_API_KEY` ✅
- `OPENAI_API_KEY` ✅
- `GOOGLE_API_KEY` ✅
- `DEEPSEEK_API_KEY` ✅
- `ALLOWED_ORIGINS` — добавить значение `https://kino-app.vercel.app`

---

## Структура проекта

```
.github/
  workflows/
    automerge.yml
    promote.yml
    deploy.yml
.gitignore
.env.example
.cursorrules
CLAUDE.md
README.md
tasks/
  todo.md
  lessons.md
scripts/
  check_consistency.py
docs/
  AUDIT_PROMPT.md
src/
public/
supabase/
kino-design-system/   — git submodule (github.com/Arsid0305/design-system)
package.json
```

---

## Стек

- React + Vite + TypeScript + Tailwind + shadcn/ui + Framer Motion
- Supabase Auth (email OTP + анонимный), Edge Functions (Deno)
- `ai-chat`, `movie-recommendation`
- Тесты: Vitest (`npm test`)
- Design System: git submodule (`kino-design-system/`)
- Python: нет

---

## Среда Claude

| Инструмент | Статус |
|-----------|--------|
| Node.js v22 | ✅ |
| npm v10 | ✅ |
| Python | ❌ |
| Vitest | ✅ (`npm test`) |
| Supabase CLI | ❌ не установлен — деплой только через GitHub Actions |
| Deno | ❌ не установлен — Edge Functions только через CI/CD |
| node_modules | ❌ (есть package-lock.json, `npm ci`) |
| .env реальный | ❌ (только .env.example) |

---

## Стандартные пакеты

> Правило: при использовании нового пакета в любом проекте — добавлять его сюда.

- `lucide-react` — иконки
- `sonner` — toast-уведомления
- `next-themes` — смена темы (светлая/тёмная)
- `zod` — валидация данных
- `date-fns` — форматирование дат
- `xlsx` — парсинг Excel-файлов
- `@resvg/resvg-js` — SVG → PNG (devDependency, для иконок PWA)

---

## Рабочий процесс

Схема: `claude/...` или `cursor/...` → PR → автомерж в `main`

1. Claude пишет код → пушит в ветку `claude/...`
2. Создать PR в `main` (если не существует)
3. `automerge.yml` запускается на PR-событии и мержит через GitHub API (`squash`)
4. Никакого shell-мержа — только GitHub API
5. Никогда не пушить напрямую в `main`

> **Требует:** Settings → General → «Allow auto-merge» включён в репо

---

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
