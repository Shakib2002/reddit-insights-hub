import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BuildOrSkip, TrendSignal } from "@/lib/types";

interface Props {
  verdict: BuildOrSkip;
  keyword: string;
  painScore: number;
  trend?: TrendSignal;
}

const verdictStyles: Record<BuildOrSkip["verdict"], { gradient: string; text: string; border: string; emoji: string; glow: string }> = {
  "BUILD IT": {
    gradient: "gradient-verdict-build",
    text: "text-green-400",
    border: "border-green-500/30",
    emoji: "✅",
    glow: "shadow-[0_0_60px_-10px_rgba(34,197,94,0.45)]",
  },
  "NEEDS WORK": {
    gradient: "gradient-verdict-needs",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    emoji: "⚠️",
    glow: "shadow-[0_0_60px_-10px_rgba(234,179,8,0.45)]",
  },
  "SKIP IT": {
    gradient: "gradient-verdict-skip",
    text: "text-red-400",
    border: "border-red-500/30",
    emoji: "❌",
    glow: "shadow-[0_0_60px_-10px_rgba(239,68,68,0.45)]",
  },
};

const factorLabels: Record<keyof BuildOrSkip["factors"], string> = {
  marketSize: "Market Size",
  painIntensity: "Pain Intensity",
  competitionGap: "Competition Gap",
  monetization: "Monetization",
  timing: "Timing",
};

const FactorBar = ({ label, score }: { label: string; score: number }) => {
  const pct = (score / 10) * 100;
  const color =
    score >= 7
      ? "hsl(var(--success))"
      : score >= 5
        ? "hsl(45 93% 47%)"
        : "hsl(var(--destructive))";
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium truncate">
        {label}
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs font-semibold tabular-nums">{score.toFixed(1)}/10</div>
    </div>
  );
};

export function BuildOrSkipVerdict({ verdict, keyword, painScore, trend }: Props) {
  const { toast } = useToast();
  const style = verdictStyles[verdict.verdict];

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(keyword)}`;
    const text = `🔍 I analyzed Reddit for "${keyword}"
Verdict: ${style.emoji} ${verdict.verdict} (Confidence: ${verdict.confidence}%)
📊 Pain Score: ${painScore}/100${trend ? `\n📈 Trend: ${trend.direction}` : ""}
🔗 ${url}

Analyzed with RedditLens — free Reddit research tool`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Verdict copied!", description: "Share it anywhere." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Card
      id="verdict"
      className={`p-5 md:p-7 fade-in scroll-mt-32 ${style.gradient} ${style.border} border ${style.glow}`}
    >
      <div className="flex flex-col items-center text-center gap-3">
        <div
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-lg md:text-xl font-bold ${style.text} bg-background/70 backdrop-blur-sm border ${style.border}`}
        >
          <span aria-hidden="true">{style.emoji}</span>
          {verdict.verdict}
        </div>
        <p className="text-base md:text-lg font-bold max-w-2xl text-foreground">
          {verdict.reason}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        {(Object.keys(factorLabels) as (keyof BuildOrSkip["factors"])[]).map((key) => (
          <FactorBar key={key} label={factorLabels[key]} score={verdict.factors[key]} />
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          Confidence: <span className="font-semibold">{verdict.confidence}%</span>
        </div>
        <Button onClick={handleShare} size="sm" variant="outline" className="no-print">
          <Share2 className="h-3.5 w-3.5" /> Share Verdict
        </Button>
      </div>
    </Card>
  );
}
