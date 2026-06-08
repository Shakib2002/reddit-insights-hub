import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Map OAuth/network error codes & messages to friendly, non-technical text.
function friendlyOAuthError(code: string, description: string): string {
  const c = (code || "").toLowerCase();
  const d = (description || "").toLowerCase();

  if (c === "access_denied" || d.includes("denied") || d.includes("cancel"))
    return "You cancelled the sign-in. Tap Continue with Google to try again.";
  if (c === "server_error" || d.includes("server"))
    return "Google had a temporary issue. Please try again in a moment.";
  if (c === "temporarily_unavailable")
    return "The sign-in service is briefly unavailable. Please try again shortly.";
  if (c === "invalid_request" || c === "unauthorized_client" || c === "unsupported_response_type")
    return "Google sign-in is misconfigured. Try email sign-in or contact support.";
  if (d.includes("popup") && d.includes("closed"))
    return "The Google window was closed before sign-in finished. Please try again.";
  if (d.includes("network") || d.includes("failed to fetch") || d.includes("offline"))
    return "Network problem. Check your connection and try again.";
  if (d.includes("provider is not enabled"))
    return "Google sign-in is not enabled yet. Please use email sign-in for now.";

  return description || "Something went wrong. Please try again or use email sign-in.";
}

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = mode === "signin" ? "Sign in — RedditLens" : "Create account — RedditLens";
  }, [mode]);

  useEffect(() => {
    if (!authLoading && session) navigate("/");
  }, [session, authLoading, navigate]);

  // Handle OAuth errors returned in URL when Google redirects back after a failure/cancellation
  useEffect(() => {
    const parseParams = (str: string) =>
      new URLSearchParams(str.startsWith("#") || str.startsWith("?") ? str.slice(1) : str);
    const hashParams = parseParams(window.location.hash);
    const queryParams = parseParams(window.location.search);
    const errorCode = hashParams.get("error") || queryParams.get("error");
    const errorDesc =
      hashParams.get("error_description") || queryParams.get("error_description") || "";

    if (!errorCode) return;

    toast({
      title: "Google sign-in didn't complete",
      description: friendlyOAuthError(errorCode, errorDesc),
      variant: "destructive",
    });

    // Clean URL so the toast doesn't re-fire on re-render
    window.history.replaceState(null, "", window.location.pathname);
  }, [toast]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Email and password required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description: "Confirm your email to finish creating your account.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (err) {
      toast({
        title: mode === "signup" ? "Signup failed" : "Sign in failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) {
        toast({
          title: "Google sign-in failed",
          description: friendlyOAuthError("", error.message),
          variant: "destructive",
        });
        setBusy(false);
      }
      // Browser will redirect to Google — no further action needed
    } catch (err) {
      toast({
        title: "Google sign-in failed",
        description: friendlyOAuthError(
          "",
          err instanceof Error ? err.message : "Unexpected error",
        ),
        variant: "destructive",
      });
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-md py-12 md:py-20">
        <Card className="p-6 md:p-8 fade-in">
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin"
              ? "Sign in to save and revisit your Reddit research."
              : "Save your research history and share reports across devices."}
          </p>

          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 gap-2"
            onClick={onGoogle}
            disabled={busy}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </Button>
          <div className="relative my-4 text-center text-xs text-muted-foreground">
            <span className="bg-card px-2 relative z-10">or with email</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Optional"
                  maxLength={60}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-primary font-medium hover:underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-primary font-medium hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
