-- Baseline схемы kino — снято с прода 2026-10-01 (pg_catalog через Supabase MCP).
-- Раньше схема kino, её таблицы и функция лимита создавались вне git, и
-- `supabase db reset` падал на 20260829141000 (нет kino.check_and_increment_rate_limit).
-- Файл идемпотентен (IF NOT EXISTS / OR REPLACE): на проде ничего не меняет.
-- Не включены: backup-таблицы *_backup_2026*, legacy-таблицы времён device_id
-- (users, films_history, user_settings — закрыты 20261001190000, кодом не используются).

CREATE SCHEMA IF NOT EXISTS kino;
GRANT USAGE ON SCHEMA kino TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS kino.chat_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  movie_suggestions jsonb DEFAULT '[]'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

CREATE TABLE IF NOT EXISTS kino.user_movies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  movie_key text NOT NULL,
  list_type text NOT NULL,
  movie_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  rating smallint,
  notes text,
  watched_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT user_movies_user_id_movie_key_list_type_key UNIQUE (user_id, movie_key, list_type),
  CONSTRAINT user_movies_pkey PRIMARY KEY (id),
  CONSTRAINT user_movies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_movies_list_type_check CHECK ((list_type = ANY (ARRAY['watched'::text, 'watchlist'::text, 'dismissed'::text]))),
  CONSTRAINT user_movies_rating_check CHECK (((rating >= 1) AND (rating <= 10)))
);

CREATE TABLE IF NOT EXISTS kino.rate_limits (
  key text NOT NULL,
  count integer DEFAULT 1 NOT NULL,
  reset_at timestamp with time zone NOT NULL,
  CONSTRAINT rate_limits_pkey PRIMARY KEY (key)
);

CREATE INDEX IF NOT EXISTS chat_messages_user_id_created_at_idx ON kino.chat_messages USING btree (user_id, created_at);
CREATE INDEX IF NOT EXISTS user_movies_user_id_idx ON kino.user_movies USING btree (user_id, list_type);
CREATE INDEX IF NOT EXISTS user_movies_movie_key_idx ON kino.user_movies USING btree (movie_key);

ALTER TABLE kino.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kino.user_movies ENABLE ROW LEVEL SECURITY;
-- rate_limits: RLS без политик — доступ только через SECURITY DEFINER функцию.
ALTER TABLE kino.rate_limits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'kino' AND tablename = 'user_movies' AND policyname = 'Users can read their own movies') THEN
    CREATE POLICY "Users can read their own movies" ON kino.user_movies FOR SELECT TO authenticated USING ((auth.uid() = user_id));
    CREATE POLICY "Users can insert their own movies" ON kino.user_movies FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
    CREATE POLICY "Users can update their own movies" ON kino.user_movies FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
    CREATE POLICY "Users can delete their own movies" ON kino.user_movies FOR DELETE TO authenticated USING ((auth.uid() = user_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'kino' AND tablename = 'chat_messages' AND policyname = 'Users can read their own chat messages') THEN
    CREATE POLICY "Users can read their own chat messages" ON kino.chat_messages FOR SELECT TO authenticated USING ((auth.uid() = user_id));
    CREATE POLICY "Users can insert their own chat messages" ON kino.chat_messages FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
    CREATE POLICY "Users can delete their own chat messages" ON kino.chat_messages FOR DELETE TO authenticated USING ((auth.uid() = user_id));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON kino.chat_messages, kino.user_movies TO authenticated;

CREATE OR REPLACE FUNCTION kino.check_and_increment_rate_limit(p_key text, p_max_count integer DEFAULT 10, p_window_ms bigint DEFAULT 60000)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'kino'
AS $function$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into kino.rate_limits (key, count, reset_at)
  values (p_key, 1, v_now + make_interval(secs => p_window_ms / 1000.0))
  on conflict (key) do update
  set
    count = case when rate_limits.reset_at < v_now then 1 else rate_limits.count + 1 end,
    reset_at = case when rate_limits.reset_at < v_now then v_now + make_interval(secs => p_window_ms / 1000.0) else rate_limits.reset_at end
  returning rate_limits.count into v_count;

  return v_count <= p_max_count;
end;
$function$;

REVOKE EXECUTE ON FUNCTION kino.check_and_increment_rate_limit(text, integer, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION kino.check_and_increment_rate_limit(text, integer, bigint) TO service_role;

-- Представления public.chat_messages / public.user_movies (через них ходит фронт).
CREATE OR REPLACE VIEW public.chat_messages WITH (security_invoker = on) AS
  SELECT id, user_id, role, content, movie_suggestions, created_at FROM kino.chat_messages;
CREATE OR REPLACE VIEW public.user_movies WITH (security_invoker = on) AS
  SELECT id, user_id, movie_key, list_type, movie_data, rating, notes, watched_at, created_at, updated_at FROM kino.user_movies;
