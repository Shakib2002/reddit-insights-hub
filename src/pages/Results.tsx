import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { toFriendlyError } from "@/lib/errors";
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

// Map a niche/topic string to a relevant emoji.
const nicheEmoji = (s: string): string => {
  const t = s.toLowerCase();
  const map: [RegExp, string][] = [
    [/mobile|ios|android|app/, "📱"],
    [/ai|machine|gpt|llm|model/, "🤖"],
    [/health|wellness|therapy|mental|medical|doctor/, "🩺"],
    [/fitness|workout|exercise|gym/, "💪"],
    [/food|recipe|meal|cook|restaurant/, "🍽️"],
    [/finance|money|budget|invest|crypto|bank/, "💰"],
    [/edu|learn|study|course|school|student/, "🎓"],
    [/game|gaming|play/, "🎮"],
    [/music|audio|sound|podcast/, "🎧"],
    [/travel|trip|hotel|flight/, "✈️"],
    [/shop|ecommerce|store|retail|market/, "🛒"],
    [/parent|kid|child|baby|family/, "👶"],
    [/pet|dog|cat|animal/, "🐾"],
    [/home|house|real estate|rent/, "🏠"],
    [/car|auto|vehicle|drive/, "🚗"],
    [/work|job|career|hr|hiring/, "💼"],
    [/social|community|chat|message/, "💬"],
    [/photo|video|camera|design/, "🎨"],
    [/security|privacy|crypto|password/, "🔒"],
    [/target|niche|market|focus/, "🎯"],
    [/news|media|content|blog/, "📰"],
    [/data|analytics|metric|dashboard/, "📊"],
    [/calendar|schedule|time|productivity/, "⏰"],
    [/email|mail|inbox/, "✉️"],
    [/eco|green|climate|sustain/, "🌱"],
  ];
  for (const [re, e] of map) if (re.test(t)) return e;
  return "🔍";
};

const StatCard = ({
  label,
  value,
  sub,
  badge,
  successBadge,
  valueClassName,
  valueTitle,
  glow,
}: {
  label: string;
  value: string | number;
  sub?: string;
  badge?: string;
  successBadge?: string;
  valueClassName?: string;
  valueTitle?: string;
  glow?: "orange" | "green" | "red";
}) => (
  <div className="flex flex-col justify-center px-3 md:px-4 py-2 min-w-0 border-b md:border-b-0 md:border-r border-border last:border-b-0 md:last:border-r-0 pb-4 md:pb-2">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[10px] uppercase tracking-[1.5px] text-[#555566] font-semibold whitespace-nowrap">
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
      className={`mt-2 font-bold tabular-nums leading-none whitespace-nowrap overflow-hidden text-ellipsis ${
        glow === "orange"
          ? "stat-glow-orange"
          : glow === "green"
            ? "stat-glow-green"
            : glow === "red"
              ? "stat-glow-red"
              : "text-foreground"
      } ${valueClassName ?? "text-[20px] md:text-[22px]"}`}
      title={valueTitle ?? (typeof value === "string" ? value : undefined)}
    >
      {value}
    </div>
    {sub && (
      <div
        className={`text-[11px] mt-1.5 ${badge ? "text-destructive line-clamp-2" : "text-muted-foreground truncate"}`}
      >
        {sub}
      </div>
    )}
  </div>
);

const PainPointCard = ({ p }: { p: ResultsPayload["analysis"]["painPoints"][number] }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="pain-card pl-5 pr-4 py-4 md:py-5 flex flex-col gap-2 border-border">
      <h3 className="font-semibold text-[15px] leading-tight text-foreground">{p.title}</h3>
      <div>
        <p
          className={`text-[13px] text-muted-foreground leading-[1.6] ${
            expanded ? "" : "line-clamp-2"
          }`}
        >
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
      <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-3">
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
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline no-print"
          >
            View on Reddit →
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
  const [summaryExpanded, setSummaryExpanded] = useState(false);

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
    try {
      const parsed: ResultsPayload = JSON.parse(stored);
      setData(parsed);
      if (parsed.inputs.numResults) setNumResults(parsed.inputs.numResults);
    } catch {
      console.error("Failed to parse stored results");
      navigate("/");
    }
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
  const redditCount =
    data?.inputs.debug?.redditCount ??
    redditPosts.filter((p) => (p.link || "").includes("reddit.com")).length;
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

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-2xl mx-auto px-4 pt-32 pb-16">
          <Card className="p-8 md:p-10 text-center border-border bg-card flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <SearchIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">No report loaded</h1>
            <p className="text-sm text-muted-foreground max-w-md">
              We couldn't find a saved analysis for this session. This usually happens after a
              refresh, a long idle period, or if the previous run failed before finishing.
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Button onClick={() => navigate("/")} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Start a new search
              </Button>
              <Button variant="outline" onClick={() => navigate("/?mode=validate")}>
                Validate an idea
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }
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
      const friendly = toFriendlyError(e, "ai");
      toast({
        title: friendly.title,
        description: friendly.hint
          ? `${friendly.description} ${friendly.hint}`
          : friendly.description,
        variant: "destructive",
        action: friendly.retryable ? (
          <ToastAction altText="Retry" onClick={() => rerunWithMore()}>
            Retry
          </ToastAction>
        ) : undefined,
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
          className="rounded-2xl border border-border px-4 py-4 md:px-6 md:py-5 grid grid-cols-2 md:grid-cols-5 gap-x-0 gap-y-0 reveal-up bg-card shadow-card"
        >
          <StatCard label="Pain Score" value={`${score}/100`} glow="orange" />
          <StatCard
            label="Posts Found"
            value={redditCount > 0 ? `${redditCount} Reddit` : totalFound > 0 ? "AI insights" : "0 posts"}
            valueClassName={
              redditCount > 0
                ? "text-[18px] md:text-[20px] font-bold text-green-500"
                : totalFound > 0
                  ? "text-[18px] md:text-[20px] font-bold text-yellow-500"
                  : "text-[18px] md:text-[20px] font-bold text-red-500"
            }
            sub={
              totalFound === 0 && inputs.debug?.apiKeySet === false
                ? "⚠ API Key Issue? Check SERPER_API_KEY env var"
                : totalFound === 0 && inputs.serperOk === false
                  ? "⚠ API Key Issue? Serper rejected the request"
                  : redditCount === 0 && totalFound > 0
                    ? "No Reddit posts — AI fallback"
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
            glow={
              avgSignalLabel(avgSig) === "High"
                ? "green"
                : avgSignalLabel(avgSig) === "Low"
                  ? "red"
                  : undefined
            }
          />
          <StatCard
            label="Top Subreddit"
            value={topSubreddit !== "—" ? topSubreddit : "—"}
            valueClassName="text-[14px] md:text-[16px] font-semibold leading-tight"
            valueTitle={topSubreddit !== "—" ? `r/${topSubreddit}` : undefined}
          />
          <TrendStatCard trend={analysis.trend} />
        </div>

        {/* 2. Smart data-source banner */}
        {redditCount >= 10 ? (
          <div
            role="status"
            className="flex items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 p-3 fade-in"
          >
            <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
              ✓ {redditCount} real Reddit posts analyzed
            </span>
          </div>
        ) : redditCount >= 1 ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 fade-in"
          >
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              ⚠️ Only <strong>{redditCount}</strong> Reddit posts found. Try a more specific keyword
              for better results.
            </p>
          </div>
        ) : (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-orange-500/40 bg-orange-500/10 p-4 fade-in"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-900 dark:text-orange-100">
                🤖 <strong>No Reddit posts found</strong> for this keyword. Showing AI-generated
                insights based on general Reddit knowledge. Results may be less accurate
                {inputs.serperOk === false ? " (the Serper API key may be invalid)" : ""}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pl-8">
              <span className="text-xs text-orange-900/80 dark:text-orange-100/80 self-center">
                Try:
              </span>
              {[
                `${inputs.keyword} app`,
                `${inputs.keyword} problems`,
                `${inputs.keyword} reddit`,
              ].map((sug) => (
                <button
                  key={sug}
                  onClick={() => {
                    sessionStorage.setItem("rl_keyword", sug);
                    navigate("/");
                  }}
                  className="text-xs px-2.5 py-1 rounded-md border border-orange-500/40 bg-background hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
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
        <Card id="summary" className="summary-card p-6 md:p-7 reveal-up scroll-mt-32 relative">
          <h2 className="text-[11px] font-semibold text-[#555566] uppercase tracking-[2px] mb-3">
            Summary
          </h2>
          <p className={`text-[15px] text-muted-foreground leading-[1.8] ${summaryExpanded ? "" : "line-clamp-3"}`}>
            {analysis.summary}
          </p>
          {analysis.summary && analysis.summary.length > 200 && (
            <button
              type="button"
              onClick={() => setSummaryExpanded((v) => !v)}
              className="text-xs text-primary hover:underline mt-2 no-print"
            >
              {summaryExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </Card>

        {/* 4. Pain Points */}
        <section id="pain-points" className="reveal-up scroll-mt-32">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-semibold section-accent">Pain Points</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {analysis.painPoints.length} found
            </span>
          </div>
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
        <section id="evidence" className="reveal-up scroll-mt-32">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-semibold section-accent flex items-center">
                Reddit Evidence
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Real posts retrieved by the search — proof the analysis is grounded in actual
                discussions.
              </p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {redditPosts.length} posts
            </span>
          </div>

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
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    {visibleEvidence.map((post, i) => (
                      <div
                        key={i}
                        className={`evidence-row px-4 py-3 ${
                          i < visibleEvidence.length - 1 ? "border-b border-[#1A1A1F]" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <a
                              href={post.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[14px] font-medium text-foreground hover:text-primary line-clamp-1"
                            >
                              {post.title}
                            </a>
                            <p className="text-[12px] text-[#555566] line-clamp-2 mt-1 leading-relaxed">
                              {post.snippet || "(no snippet)"}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-[11px] font-normal">
                                r/{post.subreddit.replace(/^r\//i, "")}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                signal {post.score}
                              </span>
                            </div>
                          </div>
                          <a
                            href={post.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#555566] hover:text-primary shrink-0 no-print mt-1"
                            aria-label="Open on Reddit"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
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
        <Card id="sentiment" className="p-5 md:p-6 reveal-up scroll-mt-32">
          <h2 className="text-[11px] font-semibold text-[#555566] uppercase tracking-[2px] mb-4">
            Reddit Sentiment
          </h2>
          <SentimentBars s={analysis.sentiment} />
          {analysis.sentimentSummary && (
            <p className="text-sm text-muted-foreground mt-4 italic leading-relaxed">
              {analysis.sentimentSummary}
            </p>
          )}
        </Card>

        {/* 7. App Opportunities */}
        <section id="opportunities" className="reveal-up scroll-mt-32">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-semibold section-accent">App Opportunities</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Gaps in existing solutions you could fill. Click <strong>Get Blueprint</strong> for an
                MVP plan.
              </p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {opportunities.length} found
            </span>
          </div>
          {opportunities.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
              {opportunities.map((g, i) => (
                <Card
                  key={i}
                  className="opp-card pt-5 px-5 pb-5 flex flex-col border-border bg-card"
                >
                  <h3 className="font-bold text-[16px] mb-2 leading-tight text-foreground">
                    {g.gap}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                    {g.description}
                  </p>
                  {g.opportunity && (
                    <p className="text-sm font-medium mb-4 flex-1 leading-relaxed">
                      <span
                        className="block text-[12px] font-medium mb-1"
                        style={{ color: "#22C55E" }}
                      >
                        Unique angle:
                      </span>
                      <span className="text-foreground">{g.opportunity}</span>
                    </p>
                  )}
                  {!g.opportunity && <div className="flex-1" />}
                  <button
                    type="button"
                    className="opp-blueprint-btn no-print mt-2"
                    onClick={() => setBlueprintFor({ name: g.gap, description: g.description })}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Get Blueprint →
                  </button>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* 8. Competitor Gaps */}
        <section id="gaps" className="reveal-up scroll-mt-32">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-semibold section-accent">Competitor Gaps</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {gaps.length} found
            </span>
          </div>
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
                  <Card key={i} className="gap-card p-5 h-full flex flex-col bg-card border-border">
                    <h3 className="font-bold text-[15px] mb-1.5 leading-tight text-foreground">
                      {g.gap}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                      {g.description}
                    </p>
                    {g.opportunity && (
                      <p className="text-sm font-medium mb-3 flex-1 leading-relaxed">
                        <span className="font-semibold" style={{ color: "#22C55E" }}>
                          Opportunity:
                        </span>{" "}
                        <span className="text-foreground">{g.opportunity}</span>
                      </p>
                    )}
                    {!g.opportunity && <div className="flex-1" />}
                    {tools.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/60">
                        <span className="text-[11px] text-muted-foreground self-center">
                          Affects:
                        </span>
                        {tools.map((t, ti) => (
                          <Badge
                            key={ti}
                            variant="outline"
                            className="text-[11px] font-normal rounded-full bg-secondary text-muted-foreground"
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
        <section id="niches" className="reveal-up scroll-mt-32">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-semibold section-accent">Niche Opportunities</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Click any card to research that niche.
              </p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {analysis.niches.length} niches
            </span>
          </div>
          {analysis.niches.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {analysis.niches.map((n, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => searchNiche(n)}
                  className="niche-card relative text-left p-4 pb-7 rounded-xl border border-border bg-card"
                  title={n.description}
                >
                  <span
                    className={`absolute top-3 right-3 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${sizePillClass(n.size)}`}
                  >
                    {n.size}
                  </span>
                  <div className="text-2xl mb-2" aria-hidden>
                    {nicheEmoji(`${n.niche} ${n.description ?? ""}`)}
                  </div>
                  <div className="font-semibold text-[14px] leading-tight text-foreground mb-1.5 pr-14">
                    {n.niche}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {n.description}
                  </p>
                  <p className="niche-cta absolute bottom-2.5 left-4 text-[11px] text-primary font-medium">
                    Click to research →
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 10. Potential First Users */}
        <section id="first-users" className="reveal-up scroll-mt-32">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-semibold section-accent">Potential First Users</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {analysis.firstUserPersonas.length} personas
            </span>
          </div>
          {analysis.firstUserPersonas.length === 0 ? (
            <EmptyPlaceholder text="Not enough Reddit data found for this section" />
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
              {analysis.firstUserPersonas.map((p, i) => (
                <Card key={i} className="p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30">
                  <h3 className="font-semibold text-[14px] leading-tight text-foreground mb-1.5">
                    {p.persona}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {p.pain}
                  </p>
                  {p.willingToPay && (
                    <Badge
                      variant="outline"
                      className={`text-xs mt-2.5 ${payVariant(p.willingToPay)}`}
                    >
                      Pays: {p.willingToPay}
                    </Badge>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* 10b. Founder-Market Fit (NEW, collapsible) */}
        <FounderFitSection
          keyword={inputs.keyword}
          painPoints={analysis.painPoints}
          opportunities={analysis.competitorGaps}
        />

        {/* 11. Recommended Subreddits */}
        <section className="reveal-up no-print">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-semibold section-accent">Recommended Subreddits</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {analysis.recommendedSubreddits.length} subs
            </span>
          </div>
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
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-secondary text-secondary-foreground hover:text-primary hover:border-primary/40 transition-colors border border-border"
                  >
                    r/{clean}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* 11b. Weekly Digest Signup (NEW) */}
        <WeeklyDigestSignup keyword={inputs.keyword} />

        {/* 12. Action Bar */}
        <div className="flex flex-wrap justify-center gap-3 pt-6 reveal-up no-print">
          <Button
            onClick={() => navigate("/")}
            variant="outline"
            className="h-11 px-5 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            <ArrowLeft className="h-4 w-4" /> Search Again
          </Button>
          <Button
            onClick={shareReport}
            variant="outline"
            className="h-11 px-5 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="h-11 px-5 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            <Printer className="h-4 w-4" /> Export PDF
          </Button>
          <Button
            onClick={() => downloadFile(`${safeFilename(inputs.keyword)}.md`, reportToMarkdown(data), "text/markdown")}
            variant="outline"
            className="h-11 px-5 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            <FileText className="h-4 w-4" /> Markdown
          </Button>
          <Button
            onClick={() => downloadFile(`${safeFilename(inputs.keyword)}.csv`, reportToCsv(data), "text/csv")}
            variant="outline"
            className="h-11 px-5 border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </Button>
          <Button
            onClick={copyReport}
            className="h-11 px-7 btn-copy-orange font-semibold"
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
