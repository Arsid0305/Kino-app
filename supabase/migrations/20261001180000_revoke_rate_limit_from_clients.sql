-- Функции rate limit — SECURITY DEFINER, поэтому вызов клиентом идёт в обход RLS.
-- Supabase по умолчанию выдаёт anon/authenticated EXECUTE на функции в public,
-- и REVOKE FROM PUBLIC (миграция 20260829141000) это право не снимает.
-- Звать их должны только edge functions с service_role.
--
-- public.check_rate_limit НЕ удаляем: её вызывают функции Technical-language
-- (lookup-word, generate-lesson) — проект Supabase общий.

REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION kino.check_and_increment_rate_limit(text, integer, bigint) FROM PUBLIC, anon, authenticated;
