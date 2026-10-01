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

-- Право anon у public.check_rate_limit шло через PUBLIC, а не через явный грант:
-- без REVOKE FROM PUBLIC оно оставалось (проверено has_function_privilege).
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, bigint) TO service_role;
