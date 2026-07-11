# Lessons

## [2026-07-11] OTP-код — ровно 8 цифр (не 6)

**Что произошло:** серия из ≥5 подряд коммитов чинила «OTP не проходит» / «длина не совпадает».
**Правило:** в Supabase Auth конфиге OTP-код настроен на **8 цифр** (не дефолтные 6). Валидация во фронте / регексы / плейсхолдеры инпутов — под 8. При изменении длины — искать все `.{6}` / `length === 6` / `maxLength={6}` в `src/pages/Index.tsx` и компонентах auth.

## [2026-07-11] iOS status bar — учитывать safe-area-inset-top

**Что произошло:** серия коммитов правила overlap контента с системным статус-баром на iOS в модальных диалогах.
**Правило:** любая полноэкранная модалка / drawer / fullscreen-overlay в мобильном режиме — оборачивать в контейнер с `padding-top: env(safe-area-inset-top)` или Tailwind `pt-[env(safe-area-inset-top)]`. Проверять на реальном iOS Safari, а не в Chrome DevTools iPhone-эмуляции.

## [2026-07-11] Watchlist highlight — derived state, не ручной setState

**Что произошло:** пункт watchlist подсвечивался неверно после смены фильтра.
**Правило:** если UI-состояние (highlight, selected, active) зависит от нескольких источников (list + activeFilter + currentTab) — держать derived state через `useMemo` из явных источников, не в `useState` с ручными `setState`. Проверять с пустым списком и при переключении фильтра туда-обратно.

## [2026-07-11] CORS fallback на `*` — регресс безопасности

**Что произошло:** edge-функции содержали `if (allowed.length === 0) return "*"` — если secret `ALLOWED_ORIGINS` снесён, любой Origin проходит.
**Правило:** никогда fallback на wildcard в CORS. Hardcoded whitelist в коде + secret как override. Валидация непустоты secret — шаг в CI.
