-- Явные права на объекты Kino-app в схеме public.
--
-- Supabase с 2026-10-30 больше не выдаёт anon/authenticated/service_role права
-- на новые таблицы и представления в public по умолчанию (в этом проекте новое
-- поведение уже включено). Живая база не затронута: старые объекты права сохранили.
-- Но при повторном прогоне миграций (supabase db reset, preview-ветка,
-- восстановление) объекты ниже создались бы без прав, и фронт получил бы 42501.
-- Миграция идемпотентна: на живой базе эти права уже есть, ничего не меняется.

-- Фронт ходит в представления под залогиненным пользователем; RLS базовых
-- таблиц kino.* действует через security_invoker. Edge functions представления
-- не читают, поэтому service_role здесь не нужен (у него нет прав на kino.*).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages, public.user_movies TO authenticated;

-- Лимиты пишет public.check_rate_limit (SECURITY DEFINER), клиентам прямой доступ не нужен.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO service_role;
