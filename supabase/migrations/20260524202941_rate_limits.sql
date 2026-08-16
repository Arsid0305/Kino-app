-- Persistent rate limiting table (survives edge function cold starts)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key      text        PRIMARY KEY,
  count    integer     NOT NULL DEFAULT 1,
  reset_at timestamptz NOT NULL
);

-- No RLS policies = inaccessible to anon/authenticated; only service role reaches it directly
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic upsert for a sliding window; runs as the function owner (service role via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key       text,
  p_max_count integer DEFAULT 10,
  p_window_ms bigint  DEFAULT 60000
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now   timestamptz := now();
  v_count integer;
BEGIN
  INSERT INTO public.rate_limits (key, count, reset_at)
  VALUES (p_key, 1, v_now + make_interval(secs => p_window_ms / 1000.0))
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN rate_limits.reset_at < v_now THEN 1
      ELSE rate_limits.count + 1
    END,
    reset_at = CASE
      WHEN rate_limits.reset_at < v_now
        THEN v_now + make_interval(secs => p_window_ms / 1000.0)
      ELSE rate_limits.reset_at
    END
  RETURNING rate_limits.count INTO v_count;

  RETURN v_count <= p_max_count;
END;
$$;

-- Grant execute to service role callers (edge functions use service role key)
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(text, integer, bigint)
  TO service_role;
