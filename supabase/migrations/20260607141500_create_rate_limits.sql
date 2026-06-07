-- Server-side rate limiting table
-- Tracks API usage per user (or IP for anonymous) to enforce daily search limits.

-- 1. Rate limits tracking table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,              -- user_id or "ip:1.2.3.4"
  endpoint TEXT NOT NULL DEFAULT 'search',  -- which endpoint was used
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups: "how many requests did key X make today?"
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_date
  ON public.rate_limits (key, created_at DESC);

-- Enable RLS — only service_role can read/write
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role manages rate limits"
    ON public.rate_limits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Cleanup function: delete records older than 48 hours
-- Run this periodically via pg_cron or a scheduled edge function
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits
  WHERE created_at < now() - interval '48 hours';
$$;

-- If pg_cron is available, schedule daily cleanup at 3 AM UTC:
-- SELECT cron.schedule('cleanup-rate-limits', '0 3 * * *', $$SELECT public.cleanup_old_rate_limits()$$);
