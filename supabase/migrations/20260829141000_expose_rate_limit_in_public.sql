-- Edge-функции ai-chat и movie-recommendation зовут
--   supabaseAdmin.rpc('check_and_increment_rate_limit', ...)
-- через PostgREST, а он по умолчанию видит только схему public.
-- Функция живёт в kino, поэтому RPC отвечал «функция не найдена».
-- Раньше это было незаметно (fail-open), после 2026-08-16
-- checkRateLimit → fail-closed, и каждый вызов чата стал возвращать 429.
--
-- Тонкая обёртка в public делегирует в kino без дублирования логики.
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key text,
  p_max_count integer DEFAULT 10,
  p_window_ms bigint DEFAULT 60000
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT kino.check_and_increment_rate_limit(p_key, p_max_count, p_window_ms);
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(text, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, bigint) TO service_role;
