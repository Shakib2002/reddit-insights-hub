import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RedditPost } from "@/lib/types";

interface CompetitorResult {
  overallSentiment: "Positive" | "Mixed" | "Negative";
  sentimentScore: number;
  topComplaints: { complaint: string; frequency: "High" | "Medium" | "Low" }[];
  missingFeatures: string[];
  whatUsersLove: string[];
  switchingTrigger: string;
  opportunityScore: number;
}

const sentimentStyle = (s: CompetitorResult["overallSentiment"]) =>
  s === "Positive"
    ? "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30"
    : s === "Negative"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";

const freqStyle = (f: string) =>
  f === "High"
    ? "bg-destructive/15 text-destructive"
    : f === "Medium"
      ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
      : "bg-muted text-muted-foreground";

export function CompetitorIntelSection({
  keyword,
  existingResults,
}: {
  keyword: string;
  existingResults: RedditPost[];
}) {
  const { toast } = useToast();
  const [competitor, setCompetitor] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompetitorResult | null>(null);
  const [analyzedName, setAnalyzedName] = useState("");

  const analyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competitor.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("competitor", {
        body: { competitor: competitor.trim(), keyword, existingResults: existingResults.slice(0, 15) },
      });
      if (error) {
        const msg = (error as any).context?.body
          ? JSON.parse((error as any).context.body).error
          : error.message;
        throw new Error(msg);
      }
      setResult(data.result);
      setAnalyzedName(competitor.trim());
    } catch (err) {
      toast({
        title: "Competitor analysis failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="competitor" className="reveal-up scroll-mt-32">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold section-accent">
            🔍 Competitor Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze what Reddit says about any existing tool.
          </p>
        </div>
      </div>
      <Card className="p-5 md:p-6 bg-card border-border">
        <form onSubmit={analyze} className="flex flex-col sm:flex-row gap-2 no-print">
          <Input
            placeholder="Enter a competitor… e.g. Notion, Trello"
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            maxLength={80}
            disabled={loading}
            className="flex-1 h-11 text-[14px]"
          />
          <Button
            type="submit"
            disabled={loading || !competitor.trim()}
            className="h-11 px-6 btn-copy-orange"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze →"}
          </Button>
        </form>
        <p className="mt-2 text-xs text-[#555566]">
          Try: Notion · Trello · Slack · Headspace
        </p>

        {result && (
          <div className="mt-5 space-y-5 fade-in">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Overall sentiment for</span>
                <span className="font-semibold">{analyzedName}</span>
                <Badge variant="outline" className={sentimentStyle(result.overallSentiment)}>
                  {result.overallSentiment} ({result.sentimentScore}%)
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Opportunity Score</span>
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full border-4 font-bold tabular-nums text-sm"
                  style={{
                    borderColor:
                      result.opportunityScore >= 70
                        ? "hsl(var(--success))"
                        : result.opportunityScore >= 40
                          ? "hsl(45 93% 47%)"
                          : "hsl(var(--destructive))",
                  }}
                >
                  {result.opportunityScore}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <h4 className="text-sm font-semibold mb-2 text-destructive">Top Complaints</h4>
                <ul className="space-y-2 text-sm">
                  {result.topComplaints.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-destructive mt-1.5">●</span>
                      <span className="flex-1">
                        {c.complaint}{" "}
                        <Badge variant="outline" className={`text-[10px] ml-1 ${freqStyle(c.frequency)}`}>
                          {c.frequency}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-orange-600 dark:text-orange-400">
                  Missing Features
                </h4>
                <ul className="space-y-2 text-sm">
                  {result.missingFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-orange-500 mt-1.5">●</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 text-success">What Users Love</h4>
                <ul className="space-y-2 text-sm">
                  {result.whatUsersLove.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-success mt-1.5">●</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {result.switchingTrigger && (
              <Card className="p-4 bg-primary/5 border-primary/30 border-l-[3px]">
                <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">
                  Switching Trigger
                </div>
                <p className="text-sm">{result.switchingTrigger}</p>
              </Card>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
