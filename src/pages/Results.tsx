import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  TrendingUp,
  Loader2,
  Plus,
  Share2,
  Printer,
  Sparkles,
  Search as SearchIcon,
} from "lucide-react";
import type { ResultsPayload, Niche } from "@/lib/types";
import { decodeShare, encodeShare } from "@/lib/share";
import { saveToHistory } from "@/lib/history";
import { BlueprintDialog } from "@/components/BlueprintDialog";

const MAX_RESULTS = 30;
const RERUN_STEP = 10;

const signalVariant = (s: string) => {
  if (s === "High") return "bg-primary text-primary-foreground";
  if (s === "Medium") return "bg-accent text-accent-foreground";
  return "bg-muted text-muted-foreground";
};

const sizeVariant = (s: Niche["size"]) => {
  if (s === "Large") return "bg-primary/15 text-primary border-primary/30";
  if (s === "Medium") return "bg-accent text-accent-foreground border-accent";
  return "bg-muted text-muted-foreground border-border";
};

const intentVariant = (s: string) => {
  // Dark orange for High, yellow for Medium, gray for Low
  if (s === "High") return "bg-primary text-primary-foreground border-transparent";
  if (s === "Medium")
    return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";
  return "bg-muted text-muted-foreground border-border";
};

const payVariant = (s: string) => {
  if (s === "Yes")
    return "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30";
  if (s === "Maybe")
    return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";
  return "bg-muted text-muted-foreground border-border";
};

const SentimentBars = ({ s }: { s: ResultsPayload["analysis"]["sentiment"] }) => (
  <div className="space-y-2">
    <Bar label="Positive" pct={s.positive} color="hsl(var(--success))" />
    <Bar label="Neutral" pct={s.neutral} color="hsl(var(--muted-foreground))" />
    <Bar label="Negative" pct={s.negative} color="hsl(var(--destructive))" />
  </div>
);

const Bar = ({ label, pct, color }: { label: string; pct: number; color: string }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{pct}%</span>
    </div>
    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

const Results = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [numResults, setNumResults] = useState(10);
  const [rerunning, setRerunning] = useState(false);

  // Blueprint dialog state
  const [blueprintFor, setBlueprintFor] = useState<{ name: string; description: string } | null>(null);

  useEffect(() => {
    const shared = searchParams.get("data");
    if (shared) {
      const decoded = decodeShare<ResultsPayload>(shared);
      if (decoded && (decoded as any).analysis) {
        setData(decoded);
        if (decoded.inputs?.numResults) setNumResults(decoded.inputs.numResults);
        return;
      }
    }
    const stored = sessionStorage.getItem("redditlens_results");
    if (!stored) {
      navigate("/");
      return;
    }
    const parsed: ResultsPayload = JSON.parse(stored);
    setData(parsed);
    if (parsed.inputs.numResults) setNumResults(parsed.inputs.numResults);
  }, [navigate, searchParams]);

  if (!data) return null;
  const { inputs, analysis } = data;

  const nextCount = Math.min(MAX_RESULTS, numResults + RERUN_STEP);
  const canRerun = nextCount > numResults;

  const rerunWithMore = async () => {
    setRerunning(true);
    try {
      const { data: redditData, error: redditErr } = await supabase.functions.invoke(
        "reddit-fetch",
        {
          body: {
            keyword: inputs.keyword,
            subreddit: inputs.subreddit,
            numResults: nextCount,
            includeAllContext: true,
          },
        },
      );
      if (redditErr) throw redditErr;

      const { data: analyzeData, error: analyzeErr } = await supabase.functions.invoke(
        "analyze",
        {
          body: {
            results: redditData?.results ?? [],
            keyword: inputs.keyword,
            appIdea: inputs.appIdea,
            language: inputs.language ?? "en",
          },
        },
      );
      if (analyzeErr) {
        const msg = (analyzeErr as any).context?.body
          ? JSON.parse((analyzeErr as any).context.body).error
          : analyzeErr.message;
        throw new Error(msg);
      }

      const updated: ResultsPayload = {
        inputs: {
          ...inputs,
          numResults: nextCount,
          effectiveSubreddits:
            redditData?.effectiveSubreddits ?? inputs.effectiveSubreddits ?? [],
          rationale: redditData?.rationale ?? inputs.rationale,
        },
        analysis: analyzeData.analysis,
      };
      sessionStorage.setItem("redditlens_results", JSON.stringify(updated));
      saveToHistory(updated);
      setData(updated);
      setNumResults(nextCount);
      toast({
        title: "Report updated",
        description: `Re-analyzed with ${nextCount} Reddit results.`,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      toast({
        title: "Re-analysis failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRerunning(false);
    }
  };

  const copyReport = async () => {
    const text = `RedditLens Report
================
Keyword: ${inputs.keyword}
App idea: ${inputs.appIdea || "(none)"}
Subreddit: ${inputs.subreddit ? "r/" + inputs.subreddit : "across Reddit"}
Idea Match Score: ${analysis.ideaMatchScore}/100

SUMMARY
${analysis.summary}

SENTIMENT
Positive ${analysis.sentiment.positive}% | Neutral ${analysis.sentiment.neutral}% | Negative ${analysis.sentiment.negative}%
${analysis.sentimentSummary}

PAIN POINTS
${analysis.painPoints.map((p) => `• [${p.signal}] ${p.title} (r/${p.source})\n  ${p.description}${p.link ? `\n  ${p.link}` : ""}`).join("\n")}

IDEA VALIDATION (${analysis.ideaValidation.matchPercentage}%)
${analysis.ideaValidation.reasons.map((r) => `• ${r}`).join("\n")}

APP OPPORTUNITIES (Competitor gaps)
${analysis.competitorGaps.map((g) => `• ${g.gap}: ${g.description}`).join("\n")}

NICHES
${analysis.niches.map((n) => `• [${n.size}] ${n.niche} — ${n.description}`).join("\n")}

POTENTIAL FIRST USERS
${analysis.firstUserPersonas.map((p) => `• ${p.persona} — ${p.pain}`).join("\n")}

RECOMMENDED SUBREDDITS
${analysis.recommendedSubreddits.map((s) => `r/${s}`).join(", ")}
`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Report copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const shareReport = async () => {
    try {
      const u = new URL(window.location.href);
      u.search = ""; // clean
      u.searchParams.set("data", encodeShare(data));
      await navigator.clipboard.writeText(u.toString());
      toast({
        title: "Link copied!",
        description: "Anyone with this link can view your report.",
      });
    } catch {
      toast({ title: "Share failed", variant: "destructive" });
    }
  };

  const searchNiche = (niche: Niche) => {
    sessionStorage.setItem("redditlens_prefill", niche.niche);
    navigate("/");
  };

  const score = Math.round(analysis.ideaMatchScore);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-4xl py-8 md:py-12 space-y-8">
        {/* Header section */}
        <div className="fade-in flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 space-y-2">
            <div className="text-sm text-muted-foreground">Research report</div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {inputs.keyword}
            </h1>
            {inputs.appIdea && (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Idea:</span> {inputs.appIdea}
              </p>
            )}
            {(() => {
              const sources =
                inputs.subreddit
                  ? [inputs.subreddit]
                  : (inputs.effectiveSubreddits ?? []);
              if (sources.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">
                    Searched <span className="font-medium">across Reddit</span>
                  </p>
                );
              }
              return (
                <div className="text-sm text-muted-foreground">
                  <span>{inputs.subreddit ? "Searched in " : "Top sources: "}</span>
                  <span className="inline-flex flex-wrap gap-1.5 align-middle">
                    {sources.map((s) => (
                      <a
                        key={s}
                        href={`https://reddit.com/r/${s}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        r/{s}
                      </a>
                    ))}
                  </span>
                </div>
              );
            })()}
          </div>
          <div className="flex flex-col items-center shrink-0">
            <div className="relative h-32 w-32 rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center shadow-lg">
              <span className="text-4xl font-bold leading-none">{score}</span>
              <span className="text-xs mt-1 opacity-90">/ 100</span>
            </div>
            <span className="text-xs text-muted-foreground mt-2 font-medium">
              Idea Match Score
            </span>
          </div>
        </div>

        {/* Why these results — search rationale */}
        {inputs.rationale && (
          <Card className="p-5 fade-in border-dashed bg-muted/30">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <SearchIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold mb-1">Why these results</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {inputs.rationale.summary}
                </p>
                {inputs.rationale.topSignals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {inputs.rationale.topSignals.map((t) => (
                      <Badge
                        key={t.signal}
                        variant="outline"
                        className="text-xs bg-background"
                      >
                        “{t.signal}” ×{t.count}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground tabular-nums">
                  <span>{inputs.rationale.totalQueries} parallel queries</span>
                  <span>·</span>
                  <span>avg signal score {inputs.rationale.avgScore}</span>
                  {inputs.rationale.multiQueryHits > 0 && (
                    <>
                      <span>·</span>
                      <span>{inputs.rationale.multiQueryHits} cross-query match{inputs.rationale.multiQueryHits === 1 ? "" : "es"}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Summary */}
        <Card className="p-6 fade-in">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Summary
          </h2>
          <p className="text-foreground leading-relaxed">{analysis.summary}</p>
        </Card>

        {/* Sentiment */}
        <Card className="p-6 fade-in">
          <h2 className="text-lg font-semibold mb-3">Reddit Sentiment</h2>
          <SentimentBars s={analysis.sentiment} />
          {analysis.sentimentSummary && (
            <p className="text-sm text-muted-foreground mt-3 italic">
              {analysis.sentimentSummary}
            </p>
          )}
        </Card>

        {/* Pain points */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-4">Pain Points</h2>
          <div className="grid gap-3">
            {analysis.painPoints.map((p, i) => (
              <Card
                key={i}
                className="p-5 border-l-4"
                style={{ borderLeftColor: "hsl(var(--destructive))" }}
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="font-semibold">{p.title}</h3>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <Badge className={signalVariant(p.signal)}>{p.signal}</Badge>
                    {p.commercialIntent && (
                      <Badge variant="outline" className={`text-xs ${intentVariant(p.commercialIntent)}`}>
                        💰 {p.commercialIntent}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-muted-foreground">from r/{p.source}</p>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View "${p.title}" on Reddit (opens in new tab)`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 -mr-1 rounded-md text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors no-print"
                    >
                      View on Reddit
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Idea validation */}
        <Card className="p-6 fade-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Idea Validation</h2>
            <Badge className="bg-primary text-primary-foreground text-base px-3 py-1">
              {Math.round(analysis.ideaValidation.matchPercentage)}% match
            </Badge>
          </div>
          <ul className="space-y-2">
            {analysis.ideaValidation.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-foreground">
                <span className="text-primary mt-1">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* App opportunities (formerly competitor gaps) + Build This App */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-1">App Opportunities</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Gaps in existing solutions you could fill. Click <strong>Get Blueprint</strong> for an MVP plan.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {analysis.competitorGaps.map((g, i) => (
              <Card
                key={i}
                className="p-5 border-l-4 flex flex-col"
                style={{ borderLeftColor: "hsl(var(--success))" }}
              >
                <h3 className="font-semibold mb-2">{g.gap}</h3>
                <p className="text-sm text-muted-foreground mb-3">{g.description}</p>
                {g.opportunity && (
                  <p className="text-sm mb-4 flex-1 text-success font-medium">
                    <span className="opacity-80">Opportunity:</span> {g.opportunity}
                  </p>
                )}
                {!g.opportunity && <div className="flex-1" />}
                <Button
                  variant="outline"
                  size="sm"
                  className="no-print"
                  onClick={() => setBlueprintFor({ name: g.gap, description: g.description })}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Get Blueprint →
                </Button>
              </Card>
            ))}
          </div>
        </section>

        {/* Niche finder */}
        {analysis.niches.length > 0 && (
          <section className="fade-in">
            <h2 className="text-xl font-semibold mb-1">Niche Opportunities</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Specific sub-niches to explore. Click any card to research that niche.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {analysis.niches.map((n, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => searchNiche(n)}
                  className="text-left rounded-xl p-5 border border-border bg-card hover:border-primary/60 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {n.niche}
                    </h3>
                    <Badge variant="outline" className={`text-xs ${sizeVariant(n.size)}`}>
                      {n.size}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{n.description}</p>
                  <span className="text-xs text-primary font-medium inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                    <SearchIcon className="h-3 w-3" /> Research this niche
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* First users */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-4">Potential First Users</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.firstUserPersonas.map((p, i) => (
              <Card key={i} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="font-semibold">{p.persona}</h3>
                  {p.willingToPay && (
                    <Badge variant="outline" className={`text-xs shrink-0 ${payVariant(p.willingToPay)}`}>
                      Willing to pay: {p.willingToPay}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{p.pain}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Recommended subreddits */}
        <section className="fade-in no-print">
          <h2 className="text-xl font-semibold mb-4">Recommended Subreddits</h2>
          <div className="flex flex-wrap gap-2">
            {analysis.recommendedSubreddits.map((s) => {
              const clean = s.replace(/^r\//, "");
              return (
                <a
                  key={clean}
                  href={`https://reddit.com/r/${clean}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors border border-border"
                >
                  r/{clean}
                  <ExternalLink className="h-3 w-3" />
                </a>
              );
            })}
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 fade-in no-print">
          <Button onClick={() => navigate("/")} variant="outline" className="flex-1 min-w-[140px]">
            <ArrowLeft className="h-4 w-4" /> Search Again
          </Button>
          <Button
            onClick={rerunWithMore}
            variant="outline"
            disabled={rerunning || !canRerun}
            className="flex-1 min-w-[160px]"
            title={canRerun ? `Re-analyze with ${nextCount} results` : "Already at max results"}
          >
            {rerunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Re-analyzing…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {canRerun ? `Use more results (${nextCount})` : `Max (${numResults})`}
              </>
            )}
          </Button>
          <Button onClick={shareReport} variant="outline" className="flex-1 min-w-[120px]">
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button onClick={() => window.print()} variant="outline" className="flex-1 min-w-[140px]">
            <Printer className="h-4 w-4" /> Export PDF
          </Button>
          <Button onClick={copyReport} className="flex-1 min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground">
            <Copy className="h-4 w-4" /> Copy Report
          </Button>
        </div>
      </main>

      {blueprintFor && (
        <BlueprintDialog
          open={!!blueprintFor}
          onOpenChange={(v) => !v && setBlueprintFor(null)}
          appName={blueprintFor.name}
          appDescription={blueprintFor.description}
          painPoints={analysis.painPoints}
          language={inputs.language ?? "en"}
        />
      )}
    </div>
  );
};

export default Results;
