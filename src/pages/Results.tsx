import { useEffect, useMemo, useState } from "react";
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
  Loader2,
  Plus,
  Share2,
  Printer,
  Sparkles,
  AlertTriangle,
  MessageSquare,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ResultsPayload, Niche, RedditPost } from "@/lib/types";
import { decodeShare, encodeShare } from "@/lib/share";
import { saveToHistory } from "@/lib/history";
import { BlueprintDialog } from "@/components/BlueprintDialog";

const MAX_RESULTS = 30;
const RERUN_STEP = 10;

const signalVariant = (s: string) => {
  if (s === "High") return "bg-primary text-primary-foreground border-transparent";
  if (s === "Medium")
    return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";
  return "bg-muted text-muted-foreground border-border";
};

const intentVariant = (s: string) => {
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

const sizeChipVariant = (s: Niche["size"]) => {
  if (s === "Large") return "bg-primary/15 text-primary border-primary/30";
  if (s === "Medium")
    return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";
  return "bg-muted text-muted-foreground border-border";
};

const avgSignalLabel = (avg: number): "High" | "Medium" | "Low" => {
  if (avg >= 6) return "High";
  if (avg >= 3) return "Medium";
  return "Low";
};

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

const SentimentBars = ({ s }: { s: ResultsPayload["analysis"]["sentiment"] }) => (
  <div className="space-y-2">
    <Bar label="Positive" pct={s.positive} color="hsl(var(--success))" />
    <Bar label="Neutral" pct={s.neutral} color="hsl(var(--muted-foreground))" />
    <Bar label="Negative" pct={s.negative} color="hsl(var(--destructive))" />
  </div>
);

const EmptyPlaceholder = ({ text }: { text: string }) => (
  <Card className="p-4 md:p-5 border-dashed bg-muted/30">
    <p className="text-sm text-muted-foreground text-center">{text}</p>
  </Card>
);

const StatCard = ({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) => (
  <div className="flex flex-col justify-center p-4 md:p-5 bg-background/70 backdrop-blur rounded-lg border border-border">
    <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
      {label}
    </div>
    <div className="text-2xl md:text-3xl font-bold tabular-nums mt-1 truncate">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</div>}
  </div>
);

const PainPointCard = ({ p }: { p: ResultsPayload["analysis"]["painPoints"][number] }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card
      className="p-4 md:p-5 border-l-[3px] flex flex-col gap-2"
      style={{ borderLeftColor: "hsl(var(--destructive))" }}
    >
      <h3 className="font-semibold text-base leading-tight">{p.title}</h3>
      <div>
        <p className={`text-sm text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}>
          {p.description}
        </p>
        {p.description && p.description.length > 110 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-primary hover:underline mt-1 no-print"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
        {p.source && (
          <Badge variant="outline" className="text-xs font-normal">
            r/{p.source}
          </Badge>
        )}
        <Badge className={`text-xs ${signalVariant(p.signal)}`}>{p.signal}</Badge>
        {p.commercialIntent && (
          <Badge variant="outline" className={`text-xs ${intentVariant(p.commercialIntent)}`}>
            💰 {p.commercialIntent}
          </Badge>
        )}
        {p.link && (
          <a
            href={p.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View "${p.title}" on Reddit (opens in new tab)`}
            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors no-print"
          >
            View on Reddit
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </Card>
  );
};

const Results = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [numResults, setNumResults] = useState(10);
  const [rerunning, setRerunning] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [evidenceSignal, setEvidenceSignal] = useState<"all" | "High" | "Medium" | "Low">("all");
  const [evidenceSubreddit, setEvidenceSubreddit] = useState<string>("all");

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

  const redditPosts: RedditPost[] = useMemo(
    () => data?.inputs.redditPosts ?? [],
    [data],
  );

  const totalFound = data?.inputs.totalFound ?? redditPosts.length;
  const noPosts = totalFound === 0 || data?.inputs.serperOk === false;

  const [opportunities, gaps] = useMemo(() => {
    const all = data?.analysis.competitorGaps ?? [];
    if (all.length <= 3) return [all, []];
    return [all.slice(0, 3), all.slice(3)];
  }, [data]);

  // Evidence filters
  const evidenceSubreddits = useMemo(() => {
    const set = new Set<string>();
    for (const p of redditPosts) if (p.subreddit) set.add(p.subreddit);
    return [...set].sort();
  }, [redditPosts]);

  const filteredEvidence = useMemo(() => {
    const q = evidenceSearch.trim().toLowerCase();
    return redditPosts.filter((p) => {
      if (evidenceSubreddit !== "all" && p.subreddit !== evidenceSubreddit) return false;
      if (evidenceSignal !== "all") {
        const sig = p.score >= 6 ? "High" : p.score >= 3 ? "Medium" : "Low";
        if (sig !== evidenceSignal) return false;
      }
      if (q) {
        const hay = `${p.title} ${p.snippet} ${p.subreddit}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [redditPosts, evidenceSearch, evidenceSignal, evidenceSubreddit]);

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
          redditPosts: redditData?.results ?? inputs.redditPosts ?? [],
          totalFound: Number(redditData?.totalFound ?? redditData?.results?.length ?? 0),
          serperOk: redditData?.serperOk !== false,
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
Pain Score: ${analysis.ideaMatchScore}/100
Posts Found: ${totalFound}

SUMMARY
${analysis.summary}

SENTIMENT
Positive ${analysis.sentiment.positive}% | Neutral ${analysis.sentiment.neutral}% | Negative ${analysis.sentiment.negative}%
${analysis.sentimentSummary}

PAIN POINTS
${analysis.painPoints.map((p) => `• [${p.signal}] ${p.title} (r/${p.source})\n  ${p.description}${p.link ? `\n  ${p.link}` : ""}`).join("\n")}

APP OPPORTUNITIES
${opportunities.map((g) => `• ${g.gap}: ${g.description}${g.opportunity ? `\n  Unique angle: ${g.opportunity}` : ""}`).join("\n")}

COMPETITOR GAPS
${gaps.map((g) => `• ${g.gap}: ${g.description}`).join("\n")}

NICHES
${analysis.niches.map((n) => `• [${n.size}] ${n.niche} — ${n.description}`).join("\n")}

POTENTIAL FIRST USERS
${analysis.firstUserPersonas.map((p) => `• ${p.persona} — ${p.pain}${p.willingToPay ? ` (Pays: ${p.willingToPay})` : ""}`).join("\n")}

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
      u.search = "";
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
  const avgSig = inputs.rationale?.avgScore ?? 0;
  const topSubreddit = inputs.effectiveSubreddits?.[0] ?? "—";

  const filtersActive =
    evidenceSearch.trim() !== "" || evidenceSignal !== "all" || evidenceSubreddit !== "all";

  const visibleEvidence = evidenceExpanded ? filteredEvidence : filteredEvidence.slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-5xl py-8 md:py-12 space-y-6">
        {/* Page header */}
        <div className="fade-in flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-muted-foreground">Research report</div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
              {inputs.keyword}
            </h1>
            {inputs.appIdea && (
              <p className="text-muted-foreground text-sm mt-1">
                <span className="font-medium text-foreground">Idea:</span> {inputs.appIdea}
              </p>
            )}
          </div>
        </div>

        {/* 1. Hero stats bar */}
        <div
          className="rounded-xl border border-border p-3 md:p-4 grid grid-cols-2 md:grid-cols-4 gap-3 fade-in"
          style={{ background: "hsl(16 100% 97%)" }}
        >
          <StatCard label="Pain Score" value={`${score}/100`} />
          <StatCard label="Posts Found" value={totalFound} />
          <StatCard
            label="Avg Signal"
            value={avgSignalLabel(avgSig)}
            sub={`avg ${avgSig.toFixed(1)}`}
          />
          <StatCard
            label="Top Subreddit"
            value={topSubreddit !== "—" ? `r/${topSubreddit}` : "—"}
          />
        </div>

        {/* 2. Warning banner if no Reddit data */}
        {noPosts && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 fade-in"
          >
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>No Reddit posts found.</strong> Showing AI-generated insights based on general
              knowledge. For real Reddit data, try a more specific keyword
              {inputs.serperOk === false ? " (or check that the Serper API key is valid)" : ""}.
            </p>
          </div>
        )}

        {/* 3. Summary */}
        <Card className="p-4 md:p-5 fade-in">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Summary
          </h2>
          <p className="text-foreground leading-relaxed line-clamp-3">{analysis.summary}</p>
        </Card>

        {/* 4. Pain Points */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-4">Pain Points</h2>
          {analysis.painPoints.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {analysis.painPoints.map((p, i) => (
                <PainPointCard key={i} p={p} />
              ))}
            </div>
          )}
        </section>

        {/* 5. Reddit Evidence */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Reddit Evidence
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Real posts retrieved by the search — proof the analysis is grounded in actual
            discussions.
          </p>
          {visibleEvidence.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <>
              <div className="space-y-2">
                {visibleEvidence.map((post, i) => (
                  <Card key={i} className="p-3 md:p-4 hover:border-primary/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <a
                          href={post.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-sm hover:text-primary hover:underline line-clamp-1"
                        >
                          {post.title}
                        </a>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {post.snippet || "(no snippet)"}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-xs font-normal">
                            {post.subreddit}
                          </Badge>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            signal {post.score}
                          </span>
                        </div>
                      </div>
                      <a
                        href={post.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary shrink-0 no-print"
                        aria-label="Open on Reddit"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
              {redditPosts.length > 5 && (
                <button
                  type="button"
                  onClick={() => setEvidenceExpanded((v) => !v)}
                  className="mt-3 text-sm text-primary hover:underline no-print"
                >
                  {evidenceExpanded
                    ? "Show fewer posts"
                    : `Show all ${redditPosts.length} posts →`}
                </button>
              )}
            </>
          )}
        </section>

        {/* 6. Sentiment */}
        <Card className="p-4 md:p-5 fade-in">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Reddit Sentiment
          </h2>
          <SentimentBars s={analysis.sentiment} />
          {analysis.sentimentSummary && (
            <p className="text-sm text-muted-foreground mt-3 italic">{analysis.sentimentSummary}</p>
          )}
        </Card>

        {/* 7. App Opportunities */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-1">App Opportunities</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Gaps in existing solutions you could fill. Click <strong>Get Blueprint</strong> for an
            MVP plan.
          </p>
          {opportunities.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
              {opportunities.map((g, i) => (
                <Card
                  key={i}
                  className="p-4 md:p-5 border-t-[3px] flex flex-col"
                  style={{ borderTopColor: "hsl(var(--primary))" }}
                >
                  <h3 className="font-semibold text-base mb-2 leading-tight">{g.gap}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {g.description}
                  </p>
                  {g.opportunity && (
                    <p className="text-sm italic text-success font-medium mb-4 flex-1">
                      <span className="not-italic font-semibold opacity-80">Unique angle:</span>{" "}
                      {g.opportunity}
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
          )}
        </section>

        {/* 8. Competitor Gaps */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-4">Competitor Gaps</h2>
          {gaps.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {gaps.map((g, i) => (
                <Card key={i} className="p-4 md:p-5">
                  <h3 className="font-semibold text-sm mb-1.5">{g.gap}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{g.description}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* 9. Niche Opportunities — horizontal chips */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-1">Niche Opportunities</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Click any chip to research that niche.
          </p>
          {analysis.niches.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
              {analysis.niches.map((n, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => searchNiche(n)}
                  className="snap-start shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-primary/60 hover:shadow-sm transition-all"
                  title={n.description}
                >
                  <span>🎯</span>
                  <span className="font-medium">{n.niche}</span>
                  <Badge variant="outline" className={`text-xs ${sizeChipVariant(n.size)}`}>
                    {n.size}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 10. Potential First Users */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-4">Potential First Users</h2>
          {analysis.firstUserPersonas.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
              {analysis.firstUserPersonas.map((p, i) => (
                <Card key={i} className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-sm leading-tight">{p.persona}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3">{p.pain}</p>
                  {p.willingToPay && (
                    <Badge
                      variant="outline"
                      className={`text-xs mt-2 ${payVariant(p.willingToPay)}`}
                    >
                      Pays: {p.willingToPay}
                    </Badge>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* 11. Recommended Subreddits */}
        <section className="fade-in no-print">
          <h2 className="text-xl font-semibold mb-4">Recommended Subreddits</h2>
          {analysis.recommendedSubreddits.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
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
          )}
        </section>

        {/* 12. Action Bar */}
        <div className="flex flex-wrap gap-2 pt-4 fade-in no-print">
          <Button onClick={() => navigate("/")} variant="outline" className="flex-1 min-w-[140px]">
            <ArrowLeft className="h-4 w-4" /> Search Again
          </Button>
          <Button onClick={shareReport} variant="outline" className="flex-1 min-w-[120px]">
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="flex-1 min-w-[140px]"
          >
            <Printer className="h-4 w-4" /> Export PDF
          </Button>
          <Button
            onClick={copyReport}
            className="flex-1 min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Copy className="h-4 w-4" /> Copy Report
          </Button>
        </div>

        {/* Secondary action: rerun with more results */}
        {canRerun && (
          <div className="flex justify-center fade-in no-print">
            <Button
              onClick={rerunWithMore}
              variant="ghost"
              size="sm"
              disabled={rerunning}
              className="text-muted-foreground"
            >
              {rerunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Re-analyzing…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Use more results ({nextCount})
                </>
              )}
            </Button>
          </div>
        )}
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
