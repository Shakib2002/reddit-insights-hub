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
  FileText,
  FileSpreadsheet,
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
import { downloadFile, reportToCsv, reportToMarkdown, safeFilename } from "@/lib/exporters";
import { BlueprintDialog } from "@/components/BlueprintDialog";
import { LoadingSteps, type LoadingStep } from "@/components/LoadingSteps";
import { SectionNav } from "@/components/SectionNav";
import { BuildOrSkipVerdict } from "@/components/results/BuildOrSkipVerdict";
import { TrendStatCard } from "@/components/results/TrendStatCard";
import { RevenueModelsSection } from "@/components/results/RevenueModelsSection";
import { CompetitorIntelSection } from "@/components/results/CompetitorIntelSection";
import { FounderFitSection } from "@/components/results/FounderFitSection";
import { WeeklyDigestSignup } from "@/components/results/WeeklyDigestSignup";

type RerunStepKey = "fetch" | "score" | "ai" | "render";
const RERUN_STEPS: { key: RerunStepKey; label: string }[] = [
  { key: "fetch", label: "Fetching 20 more Reddit posts" },
  { key: "score", label: "Scoring & merging with existing posts" },
  { key: "ai", label: "Re-analyzing with AI" },
  { key: "render", label: "Rendering updated report" },
];

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
  if (avg >= 4) return "Medium";
  return "Low";
};

const sizePillClass = (s: Niche["size"]) => {
  if (s === "Large") return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  if (s === "Medium") return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-muted text-muted-foreground";
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
  <div
    className="space-y-2"
    role="img"
    aria-label={`Reddit sentiment: ${s.positive}% positive, ${s.neutral}% neutral, ${s.negative}% negative`}
  >
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
  badge,
  successBadge,
  valueClassName,
  valueTitle,
}: {
  label: string;
  value: string | number;
  sub?: string;
  badge?: string;
  successBadge?: string;
  valueClassName?: string;
  valueTitle?: string;
}) => (
  <div className="flex flex-col justify-center p-4 md:p-5 bg-background/70 backdrop-blur rounded-lg border border-border">
    <div className="flex items-center justify-between gap-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      {badge && (
        <span
          className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground"
          title={sub}
        >
          {badge}
        </span>
      )}
      {!badge && successBadge && (
        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-600 text-white">
          {successBadge}
        </span>
      )}
    </div>
    <div
      className={`mt-1 truncate font-bold tabular-nums ${valueClassName ?? "text-2xl md:text-3xl"}`}
      title={valueTitle ?? (typeof value === "string" ? value : undefined)}
    >
      {value}
    </div>
    {sub && (
      <div
        className={`text-xs mt-0.5 ${badge ? "text-destructive line-clamp-2" : "text-muted-foreground truncate"}`}
      >
        {sub}
      </div>
    )}
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
        {p.source &&
          p.source
            .split(/[,\/|]/)
            .map((s) => s.trim().replace(/^r\//i, ""))
            .filter(Boolean)
            .map((sub, idx) => {
              const href =
                idx === 0 && p.link ? p.link : `https://reddit.com/r/${sub}`;
              return (
                <a
                  key={`${sub}-${idx}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open r/${sub} on Reddit (opens in new tab)`}
                  className="no-print"
                >
                  <Badge
                    variant="outline"
                    className="text-xs font-normal hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    r/{sub}
                  </Badge>
                </a>
              );
            })}
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
  const [rerunStep, setRerunStep] = useState<RerunStepKey | "done" | null>(null);
  const [rerunDetails, setRerunDetails] = useState<Partial<Record<RerunStepKey, string>>>({});
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

  // Dynamic document title for SEO + tab clarity
  useEffect(() => {
    if (data?.inputs.keyword) {
      document.title = `${data.inputs.keyword} — Reddit pain analysis | RedditLens`;
    }
    return () => {
      document.title = "RedditLens";
    };
  }, [data]);

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
  const canRerun = !inputs.loadedMore;

  const setStep = (key: RerunStepKey | "done", detail?: string) => {
    setRerunStep(key);
    if (detail !== undefined && key !== "done") {
      setRerunDetails((prev) => ({ ...prev, [key]: detail }));
    }
  };

  const rerunWithMore = async () => {
    setRerunning(true);
    setRerunStep(null);
    setRerunDetails({});
    try {
      setStep("fetch", "Running 6 parallel searches");
      const { data: redditData, error: redditErr } = await supabase.functions.invoke(
        "reddit-fetch",
        {
          body: {
            keyword: inputs.keyword,
            subreddit: inputs.subreddit,
            numResults: 20,
            extraQueries: true,
            includeAllContext: true,
          },
        },
      );
      if (redditErr) throw redditErr;

      const fresh: RedditPost[] = redditData?.results ?? [];
      const existing: RedditPost[] = inputs.redditPosts ?? [];
      setStep(
        "score",
        `Merging ${fresh.length} new + ${existing.length} existing posts`,
      );

      // Merge with existing results, dedupe by link, keep highest score
      const byLink = new Map<string, RedditPost>();
      for (const p of [...existing, ...fresh]) {
        if (!p?.link) continue;
        const prev = byLink.get(p.link);
        if (!prev || (p.score ?? 0) > (prev.score ?? 0)) {
          byLink.set(p.link, p);
        }
      }
      const merged = [...byLink.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      setStep("ai", `Analyzing ${merged.length} merged posts with Gemini`);
      const { data: analyzeData, error: analyzeErr } = await supabase.functions.invoke(
        "analyze",
        {
          body: {
            results: merged,
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

      // Recompute effective subreddits + avg score from merged set
      const subCounts = new Map<string, number>();
      for (const r of merged) {
        const clean = (r.subreddit || "").replace(/^r\//, "");
        if (!clean || clean === "reddit") continue;
        subCounts.set(clean, (subCounts.get(clean) ?? 0) + 1);
      }
      const effectiveSubreddits = [...subCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([s]) => s);
      const avgScore =
        merged.length > 0
          ? Math.round((merged.reduce((s, r) => s + (r.score ?? 0), 0) / merged.length) * 10) / 10
          : 0;

      const updated: ResultsPayload = {
        inputs: {
          ...inputs,
          numResults: merged.length,
          loadedMore: true,
          effectiveSubreddits,
          rationale: {
            ...(inputs.rationale ?? {
              summary: "",
              topSignals: [],
              multiQueryHits: 0,
              avgScore: 0,
              totalQueries: 0,
            }),
            avgScore,
            summary: `Analyzed ${merged.length} merged Reddit posts after loading more.`,
          },
          redditPosts: merged,
          totalFound: merged.length,
          serperOk: redditData?.serperOk !== false,
          debug: redditData?.debug,
        },
        analysis: analyzeData.analysis,
      };
      setStep("render", `Building report from ${merged.length} posts`);
      sessionStorage.setItem("redditlens_results", JSON.stringify(updated));
      saveToHistory(updated);
      setData(updated);
      setNumResults(merged.length);
      setStep("done");
      toast({
        title: "Report updated",
        description: `Re-analyzed with ${merged.length} merged Reddit posts.`,
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

        {/* 0. Build or Skip Verdict (NEW) */}
        {analysis.buildOrSkip && (
          <BuildOrSkipVerdict
            verdict={analysis.buildOrSkip}
            keyword={inputs.keyword}
            painScore={score}
            trend={analysis.trend}
          />
        )}

        {/* 1. Hero stats bar */}
        <div
          className="rounded-xl border border-border p-3 md:p-4 grid grid-cols-2 md:grid-cols-5 gap-3 fade-in"
          style={{ background: "hsl(16 100% 97%)" }}
        >
          <StatCard label="Pain Score" value={`${score}/100`} />
          <StatCard
            label="Posts Found"
            value={totalFound}
            sub={
              totalFound === 0 && inputs.debug?.apiKeySet === false
                ? "⚠ API Key Issue? Check SERPER_API_KEY env var"
                : totalFound === 0 && inputs.serperOk === false
                ? "⚠ API Key Issue? Serper rejected the request"
                : undefined
            }
            badge={
              totalFound === 0 && (inputs.debug?.apiKeySet === false || inputs.serperOk === false)
                ? "API Key Issue?"
                : undefined
            }
            successBadge={inputs.loadedMore ? "Updated" : undefined}
          />
          <StatCard
            label="Avg Signal"
            value={avgSignalLabel(avgSig)}
            sub={`avg ${avgSig.toFixed(1)}`}
          />
          <StatCard
            label="Top Subreddit"
            value={topSubreddit !== "—" ? topSubreddit : "—"}
            valueClassName="text-[12px] md:text-sm font-semibold leading-tight"
            valueTitle={topSubreddit !== "—" ? `r/${topSubreddit}` : undefined}
          />
          <TrendStatCard trend={analysis.trend} />
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

        <SectionNav
          items={[
            ...(analysis.buildOrSkip ? [{ id: "verdict", label: "Verdict" }] : []),
            { id: "summary", label: "Summary" },
            { id: "pain-points", label: "Pain Points" },
            { id: "evidence", label: "Evidence" },
            { id: "sentiment", label: "Sentiment" },
            { id: "opportunities", label: "Opportunities" },
            { id: "gaps", label: "Gaps" },
            ...(analysis.revenueModels && analysis.revenueModels.length > 0 ? [{ id: "revenue", label: "Revenue" }] : []),
            { id: "competitor", label: "Competitor" },
            { id: "niches", label: "Niches" },
            { id: "first-users", label: "First Users" },
            { id: "fit", label: "Fit" },
          ]}
        />

        {/* 3. Summary */}
        <Card id="summary" className="p-4 md:p-5 fade-in scroll-mt-32">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Summary
          </h2>
          <p className="text-foreground leading-relaxed line-clamp-3">{analysis.summary}</p>
        </Card>

        {/* 4. Pain Points */}
        <section id="pain-points" className="fade-in scroll-mt-32">
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
        <section id="evidence" className="fade-in scroll-mt-32">
          <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Reddit Evidence
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Real posts retrieved by the search — proof the analysis is grounded in actual
            discussions.
          </p>

          {redditPosts.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <>
              {/* Search & filters */}
              <div className="flex flex-col md:flex-row gap-2 mb-3 no-print">
                <div className="relative flex-1 min-w-0">
                  <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="search"
                    placeholder="Search posts by keyword…"
                    value={evidenceSearch}
                    onChange={(e) => setEvidenceSearch(e.target.value)}
                    className="pl-9 pr-9 h-9"
                    aria-label="Search Reddit evidence"
                  />
                  {evidenceSearch && (
                    <button
                      type="button"
                      onClick={() => setEvidenceSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Select
                  value={evidenceSignal}
                  onValueChange={(v) => setEvidenceSignal(v as typeof evidenceSignal)}
                >
                  <SelectTrigger className="md:w-[150px] h-9" aria-label="Filter by signal">
                    <SelectValue placeholder="Signal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All signals</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={evidenceSubreddit} onValueChange={setEvidenceSubreddit}>
                  <SelectTrigger className="md:w-[180px] h-9" aria-label="Filter by subreddit">
                    <SelectValue placeholder="Subreddit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subreddits</SelectItem>
                    {evidenceSubreddits.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filtersActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEvidenceSearch("");
                      setEvidenceSignal("all");
                      setEvidenceSubreddit("all");
                    }}
                    className="h-9 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" /> Clear
                  </Button>
                )}
              </div>

              {/* Result count */}
              <div className="text-xs text-muted-foreground mb-2 tabular-nums">
                Showing {visibleEvidence.length} of {filteredEvidence.length}
                {filtersActive && filteredEvidence.length !== redditPosts.length && (
                  <> (filtered from {redditPosts.length})</>
                )}
              </div>

              {filteredEvidence.length === 0 ? (
                <EmptyPlaceholder text="No posts match the current filters. Try clearing them." />
              ) : (
                <>
                  <div className="space-y-2">
                    {visibleEvidence.map((post, i) => (
                      <Card
                        key={i}
                        className="p-3 md:p-4 hover:border-primary/40 transition-colors"
                      >
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
                  {filteredEvidence.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setEvidenceExpanded((v) => !v)}
                      className="mt-3 text-sm text-primary hover:underline no-print"
                    >
                      {evidenceExpanded
                        ? "Show fewer posts"
                        : `Show all ${filteredEvidence.length} posts →`}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </section>

        {/* 6. Sentiment */}
        <Card id="sentiment" className="p-4 md:p-5 fade-in scroll-mt-32">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Reddit Sentiment
          </h2>
          <SentimentBars s={analysis.sentiment} />
          {analysis.sentimentSummary && (
            <p className="text-sm text-muted-foreground mt-3 italic">{analysis.sentimentSummary}</p>
          )}
        </Card>

        {/* 7. App Opportunities */}
        <section id="opportunities" className="fade-in scroll-mt-32">
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
        <section id="gaps" className="fade-in scroll-mt-32">
          <h2 className="text-xl font-semibold mb-4">Competitor Gaps</h2>
          {gaps.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
              {gaps.map((g, i) => {
                const tools = (g.affectedTools || "")
                  .split(/[,;|]/)
                  .map((t) => t.trim())
                  .filter(Boolean);
                return (
                  <Card
                    key={i}
                    className="p-4 md:p-5 border-l-[3px] h-full flex flex-col"
                    style={{ borderLeftColor: "hsl(var(--primary))" }}
                  >
                    <h3 className="font-bold text-base mb-1.5 leading-tight">{g.gap}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{g.description}</p>
                    {g.opportunity && (
                      <p className="text-sm text-success font-medium mb-3 flex-1">
                        <span className="font-semibold">Opportunity:</span> {g.opportunity}
                      </p>
                    )}
                    {!g.opportunity && <div className="flex-1" />}
                    {tools.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                        <span className="text-xs text-muted-foreground self-center">Affects:</span>
                        {tools.map((t, ti) => (
                          <Badge
                            key={ti}
                            variant="outline"
                            className="text-xs font-normal bg-muted/50 text-muted-foreground"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* 8b. Revenue Models (NEW) */}
        {analysis.revenueModels && analysis.revenueModels.length > 0 && (
          <RevenueModelsSection models={analysis.revenueModels} />
        )}

        {/* 8c. Competitor Intelligence (NEW) */}
        <CompetitorIntelSection
          keyword={inputs.keyword}
          existingResults={redditPosts}
        />

        {/* 9. Niche Opportunities — grid */}
        <section id="niches" className="fade-in scroll-mt-32">
          <h2 className="text-xl font-semibold mb-1">Niche Opportunities</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Click any card to research that niche.
          </p>
          {analysis.niches.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {analysis.niches.map((n, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => searchNiche(n)}
                  className="text-left p-3 rounded-lg border border-border bg-card hover:bg-primary/5 hover:border-primary/40 transition-all"
                  title={n.description}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-sm leading-tight">{n.niche}</span>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${sizePillClass(n.size)}`}
                    >
                      {n.size}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                  <p className="text-[11px] text-primary mt-2 font-medium">Click to research →</p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 10. Potential First Users */}
        <section id="first-users" className="fade-in scroll-mt-32">
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

        {/* (View Source Posts removed — Reddit Evidence section above already lists them) */}

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
            onClick={() => downloadFile(`${safeFilename(inputs.keyword)}.md`, reportToMarkdown(data), "text/markdown")}
            variant="outline"
            className="flex-1 min-w-[140px]"
          >
            <FileText className="h-4 w-4" /> Markdown
          </Button>
          <Button
            onClick={() => downloadFile(`${safeFilename(inputs.keyword)}.csv`, reportToCsv(data), "text/csv")}
            variant="outline"
            className="flex-1 min-w-[140px]"
          >
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
          <Button
            onClick={copyReport}
            className="flex-1 min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Copy className="h-4 w-4" /> Copy Report
          </Button>
        </div>

        {/* Secondary action: load more results */}
        {rerunning ? (
          <Card className="p-4 md:p-6 fade-in no-print">
            <LoadingSteps
              title="Loading more Reddit data…"
              steps={(() => {
                const activeIdx =
                  rerunStep === "done"
                    ? RERUN_STEPS.length
                    : rerunStep
                      ? RERUN_STEPS.findIndex((s) => s.key === rerunStep)
                      : -1;
                return RERUN_STEPS.map((d, i): LoadingStep => ({
                  key: d.key,
                  label: d.label,
                  detail: rerunDetails[d.key],
                  status:
                    activeIdx === -1
                      ? "pending"
                      : i < activeIdx
                        ? "done"
                        : i === activeIdx
                          ? "active"
                          : "pending",
                }));
              })()}
            />
          </Card>
        ) : canRerun ? (
          <div className="flex justify-center fade-in no-print">
            <button
              type="button"
              onClick={rerunWithMore}
              className="inline-flex items-center gap-2 rounded-lg border border-primary bg-background px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
            >
              <span aria-hidden="true">↓</span> Load 20 more Reddit posts and re-analyze
            </button>
          </div>
        ) : (
          <div className="flex justify-center fade-in no-print">
            <p className="text-sm text-muted-foreground">
              ✓ Analyzed {totalFound} total Reddit posts
            </p>
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
