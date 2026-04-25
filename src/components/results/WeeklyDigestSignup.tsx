import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";

const STORAGE_KEY = "redditlens_subscriptions";

export function WeeklyDigestSignup({ keyword }: { keyword: string }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({ email: trimmed, keyword, date: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // ignore storage errors
    }
    setDone(true);
    toast({
      title: "✓ You're subscribed!",
      description: "We'll email you every Monday.",
    });
  };

  return (
    <Card className="p-4 md:p-5 border-l-[4px] border-l-primary fade-in no-print">
      <div className="flex items-start gap-3">
        <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base">
            📧 Get weekly Reddit insights for "{keyword}"
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            New pain points and opportunities delivered every Monday.
          </p>
          {done ? (
            <p className="mt-3 text-sm text-success font-medium">
              ✓ You're subscribed! We'll email you every Monday.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-3 flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
                className="flex-1"
                required
              />
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Subscribe →
              </Button>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}
