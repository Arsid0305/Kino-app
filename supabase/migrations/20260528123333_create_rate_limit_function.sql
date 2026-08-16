-- Rate limits table for Edge Function rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  CONSTRAINT rate_limits_pkey PRIMARY KEY (key, window_start)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- check_rate_limit: increments count and returns true if within limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_window text,
  p_limit integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, p_window::timestamptz, 1)
  ON CONFLICT (key, window_start) DO UPDATE
    SET count = rate_limits.count + 1
  RETURNING count INTO v_count;
  RETURN v_count <= p_limit;
END;
$$;

-- Allow Edge Function (service_role) to call the function
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer) TO service_role, anon, authenticated;
