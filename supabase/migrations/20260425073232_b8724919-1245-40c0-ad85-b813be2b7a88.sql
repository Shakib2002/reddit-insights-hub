DROP POLICY "Anyone can subscribe" ON public.email_subscriptions;

CREATE POLICY "Anyone can subscribe with valid data"
ON public.email_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(email) > 3
  AND length(email) <= 255
  AND email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
  AND length(keyword) > 0
  AND length(keyword) <= 200
);