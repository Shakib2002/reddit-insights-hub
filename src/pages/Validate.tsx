import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, X, Share2, Printer, AlertTriangle } from "lucide-react";
import type { ValidatePayload } from "@/lib/types";
import { decodeShare, encodeShare } from "@/lib/share";

const verdictColor = (score: number) => {
  if (score >= 80) return { bg: "bg-success", text: "text-success-foreground", label: "Strong Idea" };
  if (score >= 60) return { bg: "bg-primary", text: "text-primary-foreground", label: "Good Idea" };
  if (score >= 40) return { bg: "bg-yellow-500", text: "text-white", label: "Needs Work" };
  return { bg: "bg-destructive", text: "text-destructive-foreground", label: "Pivot Needed" };
};

const dimColor = (score: number) => {
  if (score >= 70) return "hsl(var(--success))";
  if (score >= 40) return "hsl(45 93% 47%)";
  return "hsl(var(--destructive))";
};

const Validate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ValidatePayload | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const shared = searchParams.get("data");
    if (shared) {
      const decoded = decodeShare<ValidatePayload>(shared);
      if (decoded && (decoded as any).validation) {
        setData(decoded);
        return;
      }
    }
    const stored = sessionStorage.getItem("redditlens_validate");
    if (!stored) {
      navigate("/");
      return;
    }
    setData(JSON.parse(stored));
  }, [navigate, searchParams]);

  // Animate score circle 0 → final
  useEffect(() => {
    if (!data) return;
    const target = data.validation.overallScore;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 800);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedScore(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data]);

  if (!data) return null;
  const { inputs, validation } = data;
  const v = verdictColor(validation.overallScore);

  const shareReport = async () => {
    try {
      const u = new URL(window.location.href);
      u.search = "";
      u.searchParams.set("mode", "validate");
      u.searchParams.set("data", encodeShare(data));
      await navigator.clipboard.writeText(u.toString());
      toast({ title: "Link copied!", description: "Anyone with this link can view your validation." });
    } catch {
      toast({ title: "Share failed", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-4xl py-8 md:py-12 space-y-8">
        {/* Page header */}
        <div className="fade-in">
          <div className="text-sm text-muted-foreground">Idea validation report</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
            Validating: {inputs.appIdea}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Topic researched: <span className="font-medium text-foreground">{inputs.keyword}</span>
          </p>
        </div>

        {/* Verdict card */}
        <Card className="p-8 fade-in bg-card border-border">
          <div className="flex flex-col items-center text-center gap-3">
            <div className={`relative h-36 w-36 rounded-full ${v.bg} ${v.text} flex flex-col items-center justify-center shadow-lg`}>
              <span className="text-5xl font-bold leading-none tabular-nums">{animatedScore}</span>
              <span className="text-xs mt-1 opacity-90">/ 100</span>
            </div>
            <h2 className="text-2xl font-bold mt-2">{validation.verdict || v.label}</h2>
            {validation.verdictReason && (
              <p className="text-muted-foreground max-w-xl">{validation.verdictReason}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Based on {validation.redditEvidenceCount} Reddit discussions
            </p>
          </div>
        </Card>

        {/* 6 dimension cards */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Validation across 6 dimensions</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {validation.dimensions.map((d, i) => (
              <Card
                key={d.name}
                className="p-5 fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold">{d.name}</h3>
                  <Badge variant="outline" className="shrink-0 text-xs">{d.verdict}</Badge>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${d.score}%`, backgroundColor: dimColor(d.score) }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums mb-3">
                  <span>Score</span>
                  <span className="font-medium">{d.score}/100</span>
                </div>
                {d.evidence && (
                  <p className="text-sm text-foreground mb-2">{d.evidence}</p>
                )}
                {d.redditQuote && (
                  <p className="text-sm text-muted-foreground italic bg-muted/50 rounded-md px-3 py-2">
                    “{d.redditQuote}”
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* Strengths & weaknesses */}
        <section className="grid gap-3 md:grid-cols-2 fade-in">
          <Card className="p-5">
            <h3 className="font-semibold mb-3 text-success">Strengths</h3>
            <ul className="space-y-2">
              {validation.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="font-semibold mb-3 text-destructive">Weaknesses</h3>
            <ul className="space-y-2">
              {validation.weaknesses.map((w, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Pivot suggestions (only if score < 60) */}
        {validation.overallScore < 60 && validation.pivotSuggestions.length > 0 && (
          <Card className="p-5 fade-in border-l-4" style={{ borderLeftColor: "hsl(var(--primary))" }}>
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Consider these pivots</h3>
                <ul className="space-y-2">
                  {validation.pivotSuggestions.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-primary mt-1">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}

        {/* Next steps */}
        {validation.nextSteps.length > 0 && (
          <section className="fade-in">
            <h2 className="text-xl font-semibold mb-4">Next steps</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {validation.nextSteps.slice(0, 3).map((step, i) => (
                <Card key={i} className="p-5">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mb-3">
                    {i + 1}
                  </div>
                  <p className="text-sm">{step}</p>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Evidence counter */}
        <div className="flex justify-center">
          <Badge variant="outline" className="text-xs">
            Validated against {validation.redditEvidenceCount} Reddit discussions
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 fade-in no-print">
          <Button onClick={() => navigate("/")} variant="outline" className="flex-1 min-w-[140px]">
            <ArrowLeft className="h-4 w-4" /> New validation
          </Button>
          <Button onClick={shareReport} variant="outline" className="flex-1 min-w-[120px]">
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="flex-1 min-w-[140px]">
            <Printer className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Validate;
