-- Add subscription_tier column to profiles table for payment integration
-- If profiles table doesn't exist, create it first

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    subscription_tier text NOT NULL DEFAULT 'free',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
EXCEPTION WHEN duplicate_table THEN
  -- Table exists, just add the column
  NULL;
END $$;

-- Add subscription_tier column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN subscription_tier text NOT NULL DEFAULT 'free';
EXCEPTION WHEN duplicate_column THEN
  NULL;
END $$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DO $$ BEGIN
  CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role (webhook) can upsert any profile
DO $$ BEGIN
  CREATE POLICY "Service role can manage profiles"
    ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, subscription_tier)
  VALUES (NEW.id, NEW.email, 'free')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Index for quick tier lookups
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles (subscription_tier);
