import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "redditlens_subscriptions";

export function WeeklyDigestSignup({ keyword }: { keyword: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from("email_subscriptions").insert({
      email: trimmed,
      keyword,
      user_id: user?.id ?? null,
    });

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({ email: trimmed, keyword, date: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // ignore
    }

    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        setDone(true);
        toast({
          title: "✓ Already subscribed",
          description: "You're already on the list for this keyword.",
        });
        return;
      }
      toast({
        title: "Subscription failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setDone(true);
    toast({
      title: "✓ You're subscribed!",
      description: "We'll email you every Monday.",
    });
  };

  if (done) {
    return (
      <Card
        className="p-5 md:p-6 reveal-up no-print border-l-[3px] border-l-primary"
        style={{ background: "rgba(255,69,0,0.05)" }}
      >
        <p className="text-base font-semibold text-success flex items-center gap-2">
          ✅ You're subscribed!{" "}
          <span className="font-normal text-muted-foreground">
            New insights every Monday.
          </span>
        </p>
      </Card>
    );
  }

  return (
    <Card
      className="p-5 md:p-6 reveal-up no-print border-l-[3px] border-l-primary"
      style={{ background: "rgba(255,69,0,0.05)" }}
    >
      <div className="flex items-start gap-3">
        <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base text-foreground">
            📧 Get weekly Reddit insights for "{keyword}"
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            New pain points and opportunities delivered every Monday.
          </p>
          <form onSubmit={submit} className="mt-3 flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={120}
              className="flex-1 h-11"
              required
              disabled={submitting}
            />
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 px-6 btn-copy-orange"
            >
              {submitting ? "Saving..." : "Subscribe →"}
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}
