-- Create email_subscriptions table for weekly digest feature
CREATE TABLE IF NOT EXISTS public.email_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  keyword text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate subscriptions for same email+keyword
  CONSTRAINT email_subscriptions_email_keyword_unique UNIQUE (email, keyword)
);

-- Enable RLS
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can insert subscriptions (even anon for email-only signups)
CREATE POLICY "Anyone can subscribe"
  ON public.email_subscriptions
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Authenticated users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.email_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can update their own subscriptions (unsubscribe)
CREATE POLICY "Users can update own subscriptions"
  ON public.email_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for cron job: find active subscriptions efficiently
CREATE INDEX idx_email_subscriptions_active
  ON public.email_subscriptions (is_active, keyword)
  WHERE is_active = true;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_email_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_email_subscriptions_updated_at
  BEFORE UPDATE ON public.email_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_email_subscriptions_updated_at();
