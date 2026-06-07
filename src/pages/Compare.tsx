import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Share2, Printer, Trophy } from "lucide-react";
import type { ComparePayload, ResultsPayload } from "@/lib/types";
import { decodeShare, encodeShare } from "@/lib/share";

const SentimentBars = ({ s }: { s: ResultsPayload["analysis"]["sentiment"] }) => (
  <div className="space-y-1.5">
    <Bar label="Positive" pct={s.positive} color="hsl(var(--success))" />
    <Bar label="Neutral" pct={s.neutral} color="hsl(var(--muted-foreground))" />
    <Bar label="Negative" pct={s.negative} color="hsl(var(--destructive))" />
  </div>
);

const Bar = ({ label, pct, color }: { label: string; pct: number; color: string }) => (
  <div>
    <div className="flex justify-between text-xs mb-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{pct}%</span>
    </div>
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  </div>
);

const SideReport = ({
  payload,
  isWinner,
  side,
}: {
  payload: ResultsPayload;
  isWinner: boolean;
  side: "left" | "right";
}) => {
  const { inputs, analysis } = payload;
  const score = Math.round(analysis.ideaMatchScore);
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            {side === "left" ? "Keyword A" : "Keyword B"}
          </div>
          <h2 className="text-xl font-bold truncate">{inputs.keyword}</h2>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl shadow">
            {score}
          </div>
          {isWinner && (
            <Badge className="mt-1 bg-primary text-primary-foreground gap-1">
              <Trophy className="h-3 w-3" /> Winner
            </Badge>
          )}
        </div>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-1.5">Summary</h3>
        <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Sentiment</h3>
        <SentimentBars s={analysis.sentiment} />
        {analysis.sentimentSummary && (
          <p className="text-xs text-muted-foreground mt-2 italic">{analysis.sentimentSummary}</p>
        )}
      </Card>

      <div>
        <h3 className="text-sm font-semibold mb-2">Top pain points</h3>
        <div className="space-y-2">
          {analysis.painPoints.slice(0, 3).map((p, i) => (
            <Card key={i} className="p-3 border-l-4" style={{ borderLeftColor: "hsl(var(--destructive))" }}>
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <h4 className="text-sm font-semibold">{p.title}</h4>
                <Badge variant="secondary" className="text-xs shrink-0">{p.signal}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {analysis.niches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Top niches</h3>
          <div className="space-y-2">
            {analysis.niches.slice(0, 3).map((n, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <h4 className="text-sm font-semibold">{n.niche}</h4>
                  <Badge variant="outline" className="text-xs">{n.size}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{n.description}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Compare = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ComparePayload | null>(null);

  useEffect(() => {
    const shared = searchParams.get("data");
    if (shared) {
      const decoded = decodeShare<ComparePayload>(shared);
      if (decoded && decoded.mode === "compare") {
        setData(decoded);
        return;
      }
    }
    const stored = sessionStorage.getItem("redditlens_compare");
    if (!stored) {
      navigate("/");
      return;
    }
    try {
      setData(JSON.parse(stored));
    } catch {
      console.error("Failed to parse stored comparison");
      navigate("/");
    }
  }, [navigate, searchParams]);

  const winnerSide = useMemo<"left" | "right" | null>(() => {
    if (!data) return null;
    const l = data.left.analysis.ideaMatchScore;
    const r = data.right.analysis.ideaMatchScore;
    if (l === r) return null;
    return l > r ? "left" : "right";
  }, [data]);

  if (!data) return null;

  const sharedUrl = () => {
    const u = new URL(window.location.href);
    u.searchParams.set("data", encodeShare(data));
    return u.toString();
  };

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(sharedUrl());
      toast({
        title: "Link copied!",
        description: "Anyone with this link can view your comparison.",
      });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-6xl py-8 md:py-12 space-y-6">
        <div className="fade-in flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">Comparison report</div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Comparing: {data.left.inputs.keyword} <span className="text-muted-foreground">vs</span> {data.right.inputs.keyword}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <Button onClick={() => navigate("/")} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" /> New search
            </Button>
            <Button onClick={onShare} variant="outline" size="sm">
              <Share2 className="h-4 w-4" /> Share
            </Button>
            <Button onClick={() => window.print()} variant="outline" size="sm">
              <Printer className="h-4 w-4" /> Export PDF
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 fade-in">
          <div className="md:pr-3 md:border-r border-border">
            <SideReport payload={data.left} isWinner={winnerSide === "left"} side="left" />
          </div>
          <div className="md:pl-3">
            <SideReport payload={data.right} isWinner={winnerSide === "right"} side="right" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Compare;
