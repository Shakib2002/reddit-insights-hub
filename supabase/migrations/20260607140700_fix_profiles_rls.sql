-- SEC: Fix profiles table RLS — remove the overly permissive "viewable by everyone" policy
-- that was created in the initial migration. Users should only read their OWN profile.

-- Drop the permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- The restrictive "Users can view own profile" policy from the later migration
-- already exists and will now be the only SELECT policy.
-- Re-create it idempotently just in case:
DO $$ BEGIN
  CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Also ensure service_role can read all profiles (for webhook tier lookups)
DO $$ BEGIN
  CREATE POLICY "Service role can manage profiles"
    ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
