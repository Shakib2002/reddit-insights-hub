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

const verdictStyles: Record<
  BuildOrSkip["verdict"],
  { gradient: string; text: string; border: string; emoji: string; glow: string; rgb: string }
> = {
  "BUILD IT": {
    gradient: "gradient-verdict-build",
    text: "text-green-400",
    border: "border-[#22C55E]",
    emoji: "✅",
    glow: "shadow-[0_0_60px_-10px_rgba(34,197,94,0.45)]",
    rgb: "34,197,94",
  },
  "NEEDS WORK": {
    gradient: "gradient-verdict-needs",
    text: "text-yellow-400",
    border: "border-[#EAB308]",
    emoji: "⚠️",
    glow: "shadow-[0_0_60px_-10px_rgba(234,179,8,0.45)]",
    rgb: "234,179,8",
  },
  "SKIP IT": {
    gradient: "gradient-verdict-skip",
    text: "text-red-400",
    border: "border-[#EF4444]",
    emoji: "❌",
    glow: "shadow-[0_0_60px_-10px_rgba(239,68,68,0.45)]",
    rgb: "239,68,68",
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
      ? "linear-gradient(90deg, #22c55e, #4ade80)"
      : score >= 5
        ? "linear-gradient(90deg, #eab308, #facc15)"
        : "linear-gradient(90deg, #ef4444, #f87171)";
  return (
    <div className="grid grid-cols-[minmax(110px,140px)_1fr_44px] items-center gap-3 py-1">
      <div className="text-[12px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
        {label}
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="text-xs font-bold tabular-nums text-right text-foreground">
        {score.toFixed(1)}/10
      </div>
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
      className={`relative p-6 md:p-8 reveal-up scroll-mt-32 ${style.gradient} ${style.border} border ${style.glow} verdict-border-glow`}
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div
          className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl text-3xl md:text-[48px] font-extrabold leading-none ${style.text} bg-background/60 backdrop-blur-sm border ${style.border}`}
          style={{ textShadow: `0 0 40px rgba(${style.rgb},0.35)` }}
        >
          <span aria-hidden="true" className="text-[0.8em]">
            {style.emoji}
          </span>
          {verdict.verdict}
        </div>
        <p className="text-base md:text-lg font-semibold max-w-2xl text-foreground leading-relaxed">
          {verdict.reason}
        </p>
      </div>

      <div className="mt-7 max-w-2xl mx-auto space-y-1">
        {(Object.keys(factorLabels) as (keyof BuildOrSkip["factors"])[]).map((key) => (
          <FactorBar key={key} label={factorLabels[key]} score={verdict.factors[key]} />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          Confidence:{" "}
          <span className="font-semibold text-foreground">{verdict.confidence}%</span>
        </div>
        <Button
          onClick={handleShare}
          size="sm"
          variant="outline"
          className="no-print border-white/10 text-muted-foreground hover:border-primary hover:text-primary hover:bg-transparent"
        >
          <Share2 className="h-3.5 w-3.5" /> Share Verdict
        </Button>
      </div>
    </Card>
  );
}
