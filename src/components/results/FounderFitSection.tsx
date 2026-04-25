import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Loader2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PainPoint, CompetitorGap } from "@/lib/types";

interface FitResult {
  fitScore: number;
  fitVerdict: "Great Fit" | "Good Fit" | "Challenging" | "Poor Fit";
  reasons: string[];
  advantages: string[];
  challenges: string[];
  recommendation: string;
}

const verdictColor = (v: FitResult["fitVerdict"]) =>
  v === "Great Fit"
    ? "bg-success text-white"
    : v === "Good Fit"
      ? "bg-blue-500 text-white"
      : v === "Challenging"
        ? "bg-yellow-500 text-white"
        : "bg-destructive text-destructive-foreground";

const scoreColor = (s: number) =>
  s >= 75 ? "hsl(var(--success))" : s >= 50 ? "hsl(217 91% 60%)" : s >= 30 ? "hsl(45 93% 47%)" : "hsl(var(--destructive))";

export function FounderFitSection({
  keyword,
  painPoints,
  opportunities,
}: {
  keyword: string;
  painPoints: PainPoint[];
  opportunities: CompetitorGap[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [background, setBackground] = useState("Developer");
  const [location, setLocation] = useState("");
  const [time, setTime] = useState("Part-time");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FitResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fit", {
        body: {
          background, location, time, keyword,
          painPoints: painPoints.slice(0, 5).map((p) => ({ title: p.title })),
          opportunities: opportunities.slice(0, 5).map((o) => ({ gap: o.gap })),
        },
      });
      if (error) {
        const msg = (error as any).context?.body
          ? JSON.parse((error as any).context.body).error
          : error.message;
        throw new Error(msg);
      }
      setResult(data.result);
    } catch (err) {
      toast({
        title: "Fit check failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="fit" className="fade-in scroll-mt-32">
      <Card className="p-4 md:p-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 text-left"
          aria-expanded={open}
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Founder-Market Fit
          </h2>
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {!open && (
          <p className="text-sm text-muted-foreground mt-1">
            Check how well your background fits this opportunity.
          </p>
        )}

        {open && (
          <div className="mt-4 space-y-4 fade-in">
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3 no-print">
              <div className="space-y-1.5">
                <Label className="text-xs">Your background</Label>
                <Select value={background} onValueChange={setBackground}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Developer", "Designer", "Marketer", "Business", "Student", "Other"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Your location/market</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bangladesh" maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Your available time</Label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Full-time", "Part-time", "Weekends only"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check My Fit →"}
                </Button>
              </div>
            </form>

            {result && (
              <div className="fade-in space-y-4 pt-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <div
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full border-4 font-bold tabular-nums"
                    style={{ borderColor: scoreColor(result.fitScore) }}
                  >
                    {result.fitScore}
                  </div>
                  <Badge className={verdictColor(result.fitVerdict)}>{result.fitVerdict}</Badge>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {result.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-1.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-success">Advantages</h4>
                    <ul className="space-y-1.5 text-sm">
                      {result.advantages.map((a, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-success mt-1.5">●</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-destructive">Challenges</h4>
                    <ul className="space-y-1.5 text-sm">
                      {result.challenges.map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-destructive mt-1.5">●</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {result.recommendation && (
                  <Card className="p-4 bg-primary/5 border-l-[3px] border-primary/40">
                    <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                      Recommendation
                    </div>
                    <p className="text-sm">{result.recommendation}</p>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
