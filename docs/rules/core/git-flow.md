# Git Flow — универсальные правила git

_Rule: always-on. Источник: AI_OS/SYSTEM.md §10 (без GitHub Anti-Abuse — см. `github-anti-abuse.md`)._

## Ветки и поток

- Разработка — на ветке `claude/<description>` (или `cursor/<description>` для Cursor).
- Главная — `main`. **Никогда** не пушить туда напрямую.
- В начале каждой сессии **первая команда** — `git pull origin main` (main уходит вперёд пока ветка живёт).

## Запрещённые флаги

Категорически **НЕ использовать**:
- `--no-verify` — не обходить pre-commit хуки.
- `--force` / `--force-with-lease` — не переписывать историю на shared ветках.
- `--no-gpg-sign` — не отключать подпись коммитов.

**Если коммит не проходит** — разбираться с причиной, не обходить. Сообщить пользователю и остановиться.

## PR flow

- PR в `main` — **не draft** (draft пропускается `automerge.yml`, guard `draft == false`).
- `automerge.yml` сам включает native auto-merge через GraphQL и сольёт, когда required checks пройдут.
- Если CI красный — PR висит до следующего push с фиксом.

## Правила редактирования файлов

- Локально: `Read` → `Edit` → `git commit` → `git push`.
- `Edit` меняет только нужные строки — файл не трогается целиком.
- **Запрещено** использовать GitHub MCP `push_files` для кода — требует весь файл целиком, риск обрезки.
- Через GitHub MCP `create_or_update_file` для одиночных — только после `get_file_contents` для актуального `sha`.

## Коммиты — авторство

- **Основной автор коммита — пользователь**, не Claude. `user.email` = email пользователя.
- `Co-Authored-By: Claude <noreply@anthropic.com>` в теле коммита.
- Ссылку на сессию — в футер (`Claude-Session: https://claude.ai/code/session_...`).
