-- Create email_subscriptions table for weekly digest signups
CREATE TABLE public.email_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  keyword TEXT NOT NULL,
  user_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (email, keyword)
);

-- Enable RLS
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous or authenticated) can subscribe
CREATE POLICY "Anyone can subscribe"
ON public.email_subscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Users can view their own subscriptions (matched by user_id when logged in)
CREATE POLICY "Users can view their own subscriptions"
ON public.email_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.email_subscriptions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage all subscriptions"
ON public.email_subscriptions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can unsubscribe (delete) their own
CREATE POLICY "Users can delete their own subscriptions"
ON public.email_subscriptions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_email_subscriptions_updated_at
BEFORE UPDATE ON public.email_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for efficient lookup
CREATE INDEX idx_email_subscriptions_keyword ON public.email_subscriptions(keyword);
CREATE INDEX idx_email_subscriptions_email ON public.email_subscriptions(email);