import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { toFriendlyError } from "@/lib/errors";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Search, ChevronDown, GitCompare, X, ShieldCheck } from "lucide-react";
import type { ResultsPayload, ComparePayload } from "@/lib/types";
import { saveToHistory, saveValidationToHistory } from "@/lib/history";
import { dbSaveSearch, dbSaveValidation } from "@/lib/db-history";
import { useAuth } from "@/hooks/useAuth";
import { type LoadingStep } from "@/components/LoadingSteps";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { LivePainFeed } from "@/components/LivePainFeed";
import { HeroBackground, HeroHeadline } from "@/components/home/HeroSection";
import { FeatureCards } from "@/components/home/FeatureCards";
import { HowItWorks } from "@/components/home/HowItWorks";
import { StatsStrip } from "@/components/home/StatsStrip";
import { CtaBanner } from "@/components/home/CtaBanner";
import { UpgradeModal } from "@/components/UpgradeModal";
import { hasReachedLimit, incrementDailySearchCount, getRemainingSearches, getUserTier } from "@/lib/usage";
import type { PlanTier } from "@/lib/pricing";

const EXAMPLES = [
  "mental health apps",
  "productivity tools",
  "food delivery",
  "habit tracker",
  "AI tools",
  "journaling apps",
];

const SUBREDDIT_SUGGESTIONS = [
  "startups",
  "Entrepreneur",
  "SideProject",
  "SaaS",
  "smallbusiness",
  "androidapps",
  "iOSProgramming",
  "webdev",
  "indiehackers",
  "productivity",
  "Notion",
  "ObsidianMD",
  "ArtificialIntelligence",
  "ChatGPT",
  "MachineLearning",
  "marketing",
  "freelance",
  "nocode",
  "ecommerce",
  "Shopify",
  "fitness",
  "loseit",
  "personalfinance",
  "investing",
  "cryptocurrency",
  "reactjs",
  "javascript",
  "Python",
  "learnprogramming",
  "DigitalNomad",
  "remotework",
  "selfimprovement",
  "getdisciplined",
  "Anxiety",
  "depression",
  "mentalhealth",
  "parenting",
  "teachers",
  "students",
  "college",
  "gamedev",
  "Unity3D",
  "Design",
  "UXDesign",
  "graphic_design",
];

type StepKey =
  | "fetch"
  | "score"
  | "ai"
  | "render"
  | "validate-ai"
  | "validate-score";

const SEARCH_STEPS: { key: StepKey; label: string }[] = [
  { key: "fetch", label: "Fetching Reddit posts (Serper search)" },
  { key: "score", label: "Scoring & merging results" },
  { key: "ai", label: "Calling AI to analyze discussions" },
  { key: "render", label: "Rendering report" },
];

const VALIDATE_STEPS: { key: StepKey; label: string }[] = [
  { key: "fetch", label: "Fetching Reddit evidence (Serper search)" },
  { key: "score", label: "Scoring & merging results" },
  { key: "validate-ai", label: "Running 6-dimension idea validation (AI)" },
  { key: "render", label: "Rendering validation report" },
];

function buildSteps(
  defs: { key: StepKey; label: string }[],
  activeKey: StepKey | "done" | null,
  details: Partial<Record<StepKey, string>> = {},
): LoadingStep[] {
  if (activeKey === "done") {
    return defs.map((d) => ({ ...d, status: "done", detail: details[d.key] }));
  }
  const activeIdx = activeKey ? defs.findIndex((d) => d.key === activeKey) : -1;
  return defs.map((d, i) => ({
    ...d,
    status:
      activeIdx === -1
        ? "pending"
        : i < activeIdx
          ? "done"
          : i === activeIdx
            ? "active"
            : "pending",
    detail: details[d.key],
  }));
}

async function runOneSearch(opts: {
  keyword: string;
  appIdea: string;
  subreddit: string;
  numResults: number;
  includeAllContext: boolean;
  language: string;
  onStep?: (key: StepKey, detail?: string) => void;
}): Promise<{ payload: ResultsPayload; lowData: boolean; totalFound: number }> {
  opts.onStep?.("fetch", `Searching for "${opts.keyword}"`);
  const { data: redditData, error: redditErr } = await supabase.functions.invoke(
    "reddit-fetch",
    {
      body: {
        keyword: opts.keyword,
        subreddit: opts.subreddit,
        numResults: opts.numResults,
        includeAllContext: opts.includeAllContext,
      },
    },
  );
  if (redditErr) {
    const err = new Error((redditErr as any).message ?? "Reddit fetch failed");
    (err as any)._stage = "reddit";
    throw err;
  }

  const fetched = redditData?.results?.length ?? 0;
  opts.onStep?.("score", `Merged & ranked ${fetched} unique posts`);

  opts.onStep?.("ai", `Analyzing ${fetched} posts with Gemini`);
  const { data: analyzeData, error: analyzeErr } = await supabase.functions.invoke(
    "analyze",
    {
      body: {
        results: redditData?.results ?? [],
        keyword: opts.keyword,
        appIdea: opts.appIdea,
        language: opts.language,
      },
    },
  );
  if (analyzeErr) {
    console.error("analyze error full:", analyzeErr, "context:", (analyzeErr as any).context);
    const msg = (analyzeErr as any).context?.body
      ? (() => { try { return JSON.parse((analyzeErr as any).context.body).error; } catch { return analyzeErr.message; } })()
      : analyzeErr.message;
    const err = new Error(msg);
    (err as any)._stage = "ai";
    throw err;
  }

  return {
    payload: {
      inputs: {
        keyword: opts.keyword,
        appIdea: opts.appIdea,
        subreddit: opts.subreddit.replace(/^r\//, ""),
        numResults: opts.numResults,
        effectiveSubreddits: redditData?.effectiveSubreddits ?? [],
        language: opts.language,
        rationale: redditData?.rationale,
        redditPosts: redditData?.results ?? [],
        totalFound: Number(redditData?.totalFound ?? (redditData?.results?.length ?? 0)),
        serperOk: redditData?.serperOk !== false,
        debug: redditData?.debug,
      },
      analysis: analyzeData.analysis,
    } as ResultsPayload,
    lowData: !!redditData?.lowData,
    totalFound: Number(redditData?.totalFound ?? (redditData?.results?.length ?? 0)),
  };
}

async function runValidate(opts: {
  keyword: string;
  appIdea: string;
  subreddit: string;
  numResults: number;
  language: string;
  onStep?: (key: StepKey, detail?: string) => void;
}): Promise<{ payload: import("@/lib/types").ValidatePayload; lowData: boolean; totalFound: number }> {
  opts.onStep?.("fetch", `Searching for "${opts.keyword}"`);
  const { data: redditData, error: redditErr } = await supabase.functions.invoke(
    "reddit-fetch",
    {
      body: {
        keyword: opts.keyword,
        subreddit: opts.subreddit,
        numResults: opts.numResults,
      },
    },
  );
  if (redditErr) {
    const err = new Error((redditErr as any).message ?? "Reddit fetch failed");
    (err as any)._stage = "reddit";
    throw err;
  }

  const fetched = redditData?.results?.length ?? 0;
  opts.onStep?.("score", `Merged & ranked ${fetched} unique posts`);

  opts.onStep?.("validate-ai", `Scoring 6 dimensions across ${fetched} posts`);
  const { data: validateData, error: validateErr } = await supabase.functions.invoke(
    "validate",
    {
      body: {
        keyword: opts.keyword,
        appIdea: opts.appIdea,
        results: redditData?.results ?? [],
        language: opts.language,
      },
    },
  );
  if (validateErr) {
    const msg = (validateErr as any).context?.body
      ? (() => { try { return JSON.parse((validateErr as any).context.body).error; } catch { return validateErr.message; } })()
      : validateErr.message;
    const err = new Error(msg);
    (err as any)._stage = "validate";
    throw err;
  }

  return {
    payload: {
      mode: "validate",
      inputs: {
        keyword: opts.keyword,
        appIdea: opts.appIdea,
        subreddit: opts.subreddit.replace(/^r\//, ""),
        numResults: opts.numResults,
        effectiveSubreddits: redditData?.effectiveSubreddits ?? [],
        language: opts.language,
        rationale: redditData?.rationale,
        redditPosts: redditData?.results ?? [],
        totalFound: Number(redditData?.totalFound ?? (redditData?.results?.length ?? 0)),
        serperOk: redditData?.serperOk !== false,
        debug: redditData?.debug,
      },
      validation: validateData.validation,
    },
    lowData: !!redditData?.lowData,
    totalFound: Number(redditData?.totalFound ?? (redditData?.results?.length ?? 0)),
  };
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [validateMode, setValidateMode] = useState(false);
  const [appIdea, setAppIdea] = useState("");
  const [subreddit, setSubreddit] = useState("");
  const [subOpen, setSubOpen] = useState(false);
  const [subActiveIdx, setSubActiveIdx] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [numResults, setNumResults] = useState(10);
  const [includeAllContext, setIncludeAllContext] = useState(true);
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<StepKey | "done" | null>(null);
  const [stepDetails, setStepDetails] = useState<Partial<Record<StepKey, string>>>({});
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [userTier, setUserTier] = useState<PlanTier>("free");

  // Fetch real subscription tier from Supabase when user is logged in
  useEffect(() => {
    if (!user) { setUserTier("free"); return; }
    getUserTier(user.id).then(setUserTier).catch(() => setUserTier("free"));
  }, [user]);

  const onStep = (key: StepKey, detail?: string) => {
    setActiveStep(key);
    if (detail !== undefined) {
      setStepDetails((prev) => ({ ...prev, [key]: detail }));
    }
  };

  // Pre-fill from /results "search this niche" + ?mode=validate URL hint
  useEffect(() => {
    const prefill = sessionStorage.getItem("redditlens_prefill");
    if (prefill) {
      setKeyword(prefill);
      sessionStorage.removeItem("redditlens_prefill");
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "validate") {
      setValidateMode(true);
      setCompareMode(false);
    }
  }, []);

  const runQuickSearch = async (topic: string) => {
    // Must be logged in to search
    if (authLoading) return; // Still loading auth state, wait
    if (!user) {
      sessionStorage.setItem("redditlens_prefill", topic);
      toast({ title: "Sign in to search", description: "Create a free account to analyze Reddit data." });
      navigate("/auth");
      return;
    }
    if (hasReachedLimit(userTier)) {
      setShowUpgrade(true);
      return;
    }
    setKeyword(topic);
    setValidateMode(false);
    setCompareMode(false);
    setLoading(true);
    setActiveStep(null);
    setStepDetails({});
    try {
      const result = await runOneSearch({
        keyword: topic,
        appIdea: "",
        subreddit: "",
        numResults,
        includeAllContext,
        language,
        onStep,
      });
      onStep("render", `Building report from ${result.totalFound} posts`);
      if (result.lowData) {
        toast({
          title: "Limited Reddit data found",
          description: `Only ${result.totalFound} relevant Reddit results — analysis may be less accurate.`,
        });
      }
      sessionStorage.setItem("redditlens_results", JSON.stringify(result.payload));
      saveToHistory(result.payload);
      if (user) {
        dbSaveSearch(user.id, result.payload).catch(() => {});
      }
      setActiveStep("done");
      incrementDailySearchCount();
      navigate("/results");
    } catch (e) {
      console.error(e);
      const stage = (e as any)?._stage as any;
      const friendly = toFriendlyError(e, stage);
      toast({
        title: friendly.title,
        description: friendly.hint
          ? `${friendly.description} ${friendly.hint}`
          : friendly.description,
        variant: "destructive",
        action: friendly.retryable ? (
          <ToastAction altText="Retry" onClick={() => runQuickSearch(topic)}>
            Retry
          </ToastAction>
        ) : undefined,
      });
      setLoading(false);
    }
  };

  const stepDefs = validateMode ? VALIDATE_STEPS : SEARCH_STEPS;
  const steps = buildSteps(stepDefs, activeStep, stepDetails);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Must be logged in to search
    if (authLoading) return; // Still loading auth state, wait
    if (!user) {
      sessionStorage.setItem("redditlens_prefill", keyword);
      toast({ title: "Sign in to search", description: "Create a free account to analyze Reddit data." });
      navigate("/auth");
      return;
    }
    // Usage limit check
    if (hasReachedLimit(userTier)) {
      setShowUpgrade(true);
      return;
    }
    if (!keyword.trim()) {
      toast({ title: "Keyword is required", variant: "destructive" });
      return;
    }
    if (validateMode && !appIdea.trim()) {
      toast({
        title: "Describe your app idea",
        description: "Idea validation needs an idea to score against.",
        variant: "destructive",
      });
      return;
    }
    if (compareMode && !keyword2.trim()) {
      toast({ title: "Add a second keyword to compare", variant: "destructive" });
      return;
    }

    setLoading(true);
    setActiveStep(null);
    setStepDetails({});

    try {
      if (validateMode) {
        const result = await runValidate({
          keyword,
          appIdea,
          subreddit,
          numResults,
          language,
          onStep,
        });
        onStep("render", `Building report from ${result.totalFound} posts`);
        if (result.lowData) {
          toast({
            title: "Limited Reddit data found",
            description: `Only ${result.totalFound} relevant Reddit results — validation may be less accurate.`,
          });
        }
        sessionStorage.setItem("redditlens_validate", JSON.stringify(result.payload));
        saveValidationToHistory(result.payload);
        if (user) {
          dbSaveValidation(user.id, result.payload).catch((err) =>
            console.warn("DB save failed (non-blocking)", err),
          );
        }
        setActiveStep("done");
        incrementDailySearchCount();
        navigate("/validate?mode=validate");
      } else if (compareMode) {
        const [left, right] = await Promise.all([
          runOneSearch({ keyword, appIdea, subreddit, numResults, includeAllContext, language, onStep }),
          runOneSearch({ keyword: keyword2, appIdea, subreddit, numResults, includeAllContext, language, onStep }),
        ]);
        onStep(
          "render",
          `Building reports from ${left.totalFound + right.totalFound} posts`,
        );
        if (left.lowData || right.lowData) {
          toast({
            title: "Limited Reddit data found",
            description: "Results may be less accurate.",
          });
        }
        const compare: ComparePayload = {
          mode: "compare",
          left: left.payload,
          right: right.payload,
        };
        sessionStorage.setItem("redditlens_compare", JSON.stringify(compare));
        saveToHistory(left.payload);
        saveToHistory(right.payload);
        if (user) {
          dbSaveSearch(user.id, left.payload).catch(() => {});
          dbSaveSearch(user.id, right.payload).catch(() => {});
        }
        setActiveStep("done");
        incrementDailySearchCount();
        navigate("/compare");
      } else {
        const result = await runOneSearch({
          keyword,
          appIdea,
          subreddit,
          numResults,
          includeAllContext,
          language,
          onStep,
        });
        onStep("render", `Building report from ${result.totalFound} posts`);
        if (result.lowData) {
          toast({
            title: "Limited Reddit data found",
            description: `Only ${result.totalFound} relevant Reddit results — analysis may be less accurate.`,
          });
        }
        sessionStorage.setItem("redditlens_results", JSON.stringify(result.payload));
        saveToHistory(result.payload);
        if (user) {
          dbSaveSearch(user.id, result.payload).catch(() => {});
        }
        setActiveStep("done");
        incrementDailySearchCount();
        navigate("/results");
      }
    } catch (e) {
      console.error(e);
      const stage = (e as any)?._stage ?? (validateMode ? "validate" : "unknown");
      const friendly = toFriendlyError(e, stage);
      toast({
        title: friendly.title,
        description: friendly.hint
          ? `${friendly.description} ${friendly.hint}`
          : friendly.description,
        variant: "destructive",
        action: friendly.retryable ? (
          <ToastAction
            altText="Retry"
            onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
          >
            Retry
          </ToastAction>
        ) : undefined,
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <Header />

      <HeroBackground />

      <main className="container max-w-3xl pt-16 md:pt-24 pb-12 md:pb-16 relative z-10">
          <HeroHeadline />

        {/* Search Card with 3D tilt + animated gradient border */}
        <div
          id="search-card"
          className="relative max-w-[640px] mx-auto hero-rise card-3d-container"
          style={{ animationDelay: "460ms", perspective: "1000px" }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width - 0.5;
            const y = (e.clientY - rect.top) / rect.height - 0.5;
            const card = e.currentTarget.querySelector<HTMLElement>(".card-3d");
            if (card) {
              card.style.transform = `rotateY(${x * 6}deg) rotateX(${-y * 6}deg)`;
            }
            // Move glow to cursor
            const glow = e.currentTarget.querySelector<HTMLElement>(".card-cursor-glow");
            if (glow) {
              glow.style.left = `${e.clientX - rect.left}px`;
              glow.style.top = `${e.clientY - rect.top}px`;
              glow.style.opacity = "1";
            }
          }}
          onMouseLeave={(e) => {
            const card = e.currentTarget.querySelector<HTMLElement>(".card-3d");
            if (card) card.style.transform = "rotateY(0deg) rotateX(0deg)";
            const glow = e.currentTarget.querySelector<HTMLElement>(".card-cursor-glow");
            if (glow) glow.style.opacity = "0";
          }}
        >
          {/* Animated rotating border */}
          <div aria-hidden className="absolute -inset-px rounded-[22px] animated-border-glow opacity-60" />
          {/* Cursor-following glow */}
          <div aria-hidden className="card-cursor-glow absolute h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-opacity duration-300 opacity-0 z-0"
            style={{ background: "radial-gradient(closest-side, rgba(255,69,0,0.15), transparent)", filter: "blur(20px)" }}
          />
          <Card className="card-3d relative p-5 sm:p-7 md:p-8 search-card-glow border-border bg-card rounded-[20px] transition-transform duration-200 ease-out">
          {(
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
                <button
                  type="button"
                  onClick={() => { setValidateMode(false); }}
                  className={`px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors inline-flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                    !validateMode
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Search
                </button>
                <button
                  type="button"
                  onClick={() => { setValidateMode(true); setCompareMode(false); }}
                  className={`px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors inline-flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                    validateMode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Validate Idea
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="keyword">
                    {compareMode ? "Keyword A" : validateMode ? "Topic to research on Reddit" : "Keyword or topic"}
                  </Label>
                  {!validateMode && (
                    <Button
                      type="button"
                      variant={compareMode ? "default" : "outline"}
                      size="sm"
                      className={`h-7 gap-1 text-xs ${compareMode ? "bg-primary hover:bg-primary/90" : ""}`}
                      onClick={() => setCompareMode((v) => !v)}
                    >
                      <GitCompare className="h-3.5 w-3.5" />
                      Compare
                    </Button>
                  )}
                </div>
                <Input
                  id="keyword"
                  placeholder="e.g. mental health apps"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  maxLength={100}
                />
              </div>

              {compareMode && (
                <div className="space-y-2 fade-in">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="keyword2">Keyword B</Label>
                    <button
                      type="button"
                      onClick={() => { setCompareMode(false); setKeyword2(""); }}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <X className="h-3 w-3" /> remove
                    </button>
                  </div>
                  <Input
                    id="keyword2"
                    placeholder="e.g. journaling apps"
                    value={keyword2}
                    onChange={(e) => setKeyword2(e.target.value)}
                    maxLength={100}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="idea">
                  {validateMode ? (
                    <>Your app idea <span className="text-primary font-normal">*</span></>
                  ) : (
                    <>Your app idea <span className="text-muted-foreground font-normal">(optional)</span></>
                  )}
                </Label>
                <Input
                  id="idea"
                  placeholder={validateMode ? "Describe your app idea… e.g. A bilingual AI mental coach for Bangladesh" : "e.g. a bilingual AI mental coach for Bangladesh"}
                  value={appIdea}
                  onChange={(e) => setAppIdea(e.target.value)}
                  maxLength={300}
                  required={validateMode}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subreddit">
                  Subreddits <span className="text-muted-foreground font-normal">(optional, comma-separated)</span>
                </Label>
                {(() => {
                  // Split into existing tokens + the in-progress token (after last comma)
                  const segments = subreddit.split(",");
                  const lastRaw = segments[segments.length - 1] ?? "";
                  const headRaw = segments.slice(0, -1).join(",");
                  const lastQuery = lastRaw.replace(/^\s*r\//i, "").trim().toLowerCase();
                  const alreadyChosen = new Set(
                    segments
                      .slice(0, -1)
                      .map((s) => s.replace(/^\s*r\//i, "").trim().toLowerCase())
                      .filter(Boolean),
                  );
                  const matches = lastQuery
                    ? SUBREDDIT_SUGGESTIONS.filter(
                        (s) =>
                          s.toLowerCase().includes(lastQuery) &&
                          !alreadyChosen.has(s.toLowerCase()),
                      ).slice(0, 6)
                    : [];
                  const appendSubreddit = (name: string) => {
                    // Replace the in-progress token with the picked name + ", " for the next one
                    const head = headRaw.length > 0 ? `${headRaw.replace(/,\s*$/, "")}, ` : "";
                    setSubreddit(`${head}${name}, `);
                    setSubOpen(false);
                    setSubActiveIdx(0);
                  };
                  return (
                    <div className="relative">
                      <Input
                        id="subreddit"
                        placeholder="e.g. startups, productivity, SaaS"
                        value={subreddit}
                        onChange={(e) => {
                          setSubreddit(e.target.value);
                          setSubOpen(true);
                          setSubActiveIdx(0);
                        }}
                        onFocus={() => setSubOpen(true)}
                        onBlur={() => window.setTimeout(() => setSubOpen(false), 150)}
                        onKeyDown={(e) => {
                          if (!subOpen || matches.length === 0) return;
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setSubActiveIdx((i) => (i + 1) % matches.length);
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setSubActiveIdx((i) => (i - 1 + matches.length) % matches.length);
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            appendSubreddit(matches[subActiveIdx]);
                          } else if (e.key === "Escape") {
                            setSubOpen(false);
                          }
                        }}
                        autoComplete="off"
                        maxLength={200}
                      />
                      {subOpen && matches.length > 0 && (
                        <div
                          role="listbox"
                          className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
                        >
                          {matches.map((s, i) => (
                            <button
                              key={s}
                              type="button"
                              role="option"
                              aria-selected={i === subActiveIdx}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                appendSubreddit(s);
                              }}
                              onMouseEnter={() => setSubActiveIdx(i)}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                                i === subActiveIdx
                                  ? "bg-accent text-accent-foreground"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <span className="text-muted-foreground">r/</span>
                              <span className="font-medium">{s}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                {!subreddit.trim() && (
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground mb-2">
                      Popular subreddits — click to add (you can pick multiple):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUBREDDIT_SUGGESTIONS.slice(0, 9).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            // Append, never replace, so users can build a list
                            setSubreddit((prev) => {
                              const trimmed = prev.trim().replace(/,\s*$/, "");
                              const tokens = trimmed
                                ? trimmed.split(/[,\s]+/).map((t) => t.replace(/^r\//i, "").toLowerCase())
                                : [];
                              if (tokens.includes(s.toLowerCase())) return prev;
                              return trimmed ? `${trimmed}, ${s}` : s;
                            });
                          }}
                          className="px-2.5 py-1 rounded-full text-xs bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors border border-border"
                        >
                          r/{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                  />
                  Advanced search
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-5 rounded-lg bg-muted/40 p-4 border border-border">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="numResults" className="text-sm">
                          Reddit results to fetch
                        </Label>
                        <span className="text-sm font-medium tabular-nums">{numResults}</span>
                      </div>
                      <Slider
                        id="numResults"
                        min={5}
                        max={30}
                        step={1}
                        value={[numResults]}
                        onValueChange={(v) => setNumResults(v[0])}
                      />
                      <p className="text-xs text-muted-foreground">
                        More results = richer analysis but slower.
                      </p>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label htmlFor="includeAll" className="text-sm">
                          Include r/all context
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Adds a second search for pain-point phrases across all of Reddit.
                        </p>
                      </div>
                      <Switch
                        id="includeAll"
                        checked={includeAllContext}
                        onCheckedChange={setIncludeAllContext}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Report language</Label>
                <div className="flex flex-wrap gap-2">
                  {([
                    "English", "বাংলা", "हिन्दी", "Español", "Français",
                    "Deutsch", "Português", "العربية", "中文", "日本語",
                    "한국어", "Русский", "Türkçe", "Italiano", "Nederlands",
                  ]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        language === lang
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <Input
                  type="text"
                  placeholder="Or type any language..."
                  value={![
                    "English", "বাংলা", "हिन्दी", "Español", "Français",
                    "Deutsch", "Português", "العربية", "中文", "日本語",
                    "한국어", "Русский", "Türkçe", "Italiano", "Nederlands",
                  ].includes(language) ? language : ""}
                  onChange={(e) => setLanguage(e.target.value || "English")}
                  className="mt-2 h-8 text-sm"
                />
              </div>

              {validateMode && compareMode && (
                <p className="text-xs text-muted-foreground text-center -mt-2">
                  Switch to single search to validate your idea.
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="w-full gradient-orange text-white font-semibold text-[16px] h-[52px] rounded-xl shadow-glow-strong hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(255,69,0,0.5)] transition-all border-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {validateMode ? <ShieldCheck className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                {validateMode
                  ? "Validate Idea →"
                  : compareMode
                    ? "Compare both"
                    : "Analyze Reddit"}
              </Button>
            </form>
          )}
          </Card>

          <LoadingOverlay
            open={loading}
            title={validateMode ? "Validating your idea…" : "Researching Reddit…"}
            subtitle={
              validateMode
                ? "Stress-testing your concept against real founder pain on Reddit."
                : "Scanning Reddit threads, clustering pain points, and ranking opportunities."
            }
            steps={steps}
          />
        </div>

        {!loading && (
          <div className="mt-10 fade-in" style={{ animationDelay: "150ms" }}>
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Try an example:
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-[640px] mx-auto">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setKeyword(ex)}
                  className="px-3.5 py-1.5 rounded-full text-[13px] bg-card text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/[0.05] transition-colors border border-border"
                >
                  {ex}
                </button>
              ))}
            </div>

            <LivePainFeed onPick={(topic) => runQuickSearch(topic)} />
          </div>
        )}
      </main>

      {!loading && <div aria-hidden className="h-px section-divider relative z-10" />}
      {!loading && <FeatureCards />}
      {!loading && <div aria-hidden className="h-px section-divider relative z-10" />}
      {!loading && <HowItWorks />}
      {!loading && <StatsStrip />}
      {!loading && <div aria-hidden className="h-px section-divider relative z-10" />}
      {!loading && <CtaBanner />}

      {/* Usage counter for free users */}
      {!loading && userTier === "free" && (
        <div className="fixed bottom-4 right-4 z-40 bg-card/90 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg text-xs text-muted-foreground flex items-center gap-2">
          <span>{getRemainingSearches(userTier)}/3 free searches left</span>
          <button
            onClick={() => navigate("/pricing")}
            className="text-primary font-medium hover:underline"
          >
            Upgrade
          </button>
        </div>
      )}

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} reason="limit" />

    </div>
  );
};

export default Index;
