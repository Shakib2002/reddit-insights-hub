import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Loader2, Search, ChevronDown, GitCompare, X, Sparkles, ShieldCheck } from "lucide-react";
import type { ResultsPayload, ComparePayload } from "@/lib/types";
import { saveToHistory, saveValidationToHistory } from "@/lib/history";

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
];

const LOADING_STAGES = [
  { label: "Running 10 Reddit searches…", until: 55 },
  { label: "Analyzing results…", until: 85 },
  { label: "Building report…", until: 100 },
];

const VALIDATE_LOADING_STAGES = [
  { label: "Searching Reddit for evidence…", until: 35 },
  { label: "Collecting discussions…", until: 55 },
  { label: "Running idea validation…", until: 75 },
  { label: "Scoring 6 dimensions…", until: 90 },
  { label: "Building your validation report…", until: 100 },
];

async function runOneSearch(opts: {
  keyword: string;
  appIdea: string;
  subreddit: string;
  numResults: number;
  includeAllContext: boolean;
  language: "en" | "bn" | "both";
}): Promise<{ payload: ResultsPayload; lowData: boolean; totalFound: number }> {
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
  if (redditErr) throw redditErr;

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
    const msg = (analyzeErr as any).context?.body
      ? JSON.parse((analyzeErr as any).context.body).error
      : analyzeErr.message;
    throw new Error(msg);
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
  language: "en" | "bn" | "both";
}): Promise<{ payload: import("@/lib/types").ValidatePayload; lowData: boolean; totalFound: number }> {
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
  if (redditErr) throw redditErr;

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
      ? JSON.parse((validateErr as any).context.body).error
      : validateErr.message;
    throw new Error(msg);
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
  const [keyword, setKeyword] = useState("");
  const [keyword2, setKeyword2] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [validateMode, setValidateMode] = useState(false);
  const [appIdea, setAppIdea] = useState("");
  const [subreddit, setSubreddit] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [numResults, setNumResults] = useState(10);
  const [includeAllContext, setIncludeAllContext] = useState(true);
  const [language, setLanguage] = useState<"en" | "bn" | "both">("en");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);

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

  const activeStages = validateMode ? VALIDATE_LOADING_STAGES : LOADING_STAGES;

  // Animate progress while loading + auto-advance stage label
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const ceiling = activeStages[stageIdx]?.until ?? 95;
        if (p >= ceiling) return p;
        const delta = Math.max(0.4, (ceiling - p) * 0.06);
        return Math.min(ceiling, p + delta);
      });
    }, 200);
    return () => clearInterval(id);
  }, [loading, stageIdx, activeStages]);

  // Auto-advance label every ~2.5s while loading
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, activeStages.length - 2));
    }, 2500);
    return () => clearInterval(t);
  }, [loading, activeStages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    setProgress(0);
    setStageIdx(0);

    try {
      if (validateMode) {
        const result = await runValidate({
          keyword,
          appIdea,
          subreddit,
          numResults,
          language,
        });
        setStageIdx(VALIDATE_LOADING_STAGES.length - 1);
        if (result.lowData) {
          toast({
            title: "Limited Reddit data found",
            description: `Only ${result.totalFound} relevant Reddit results — validation may be less accurate.`,
          });
        }
        sessionStorage.setItem("redditlens_validate", JSON.stringify(result.payload));
        saveValidationToHistory(result.payload);
        setProgress(100);
        navigate("/validate?mode=validate");
      } else if (compareMode) {
        const [left, right] = await Promise.all([
          runOneSearch({ keyword, appIdea, subreddit, numResults, includeAllContext, language }),
          runOneSearch({ keyword: keyword2, appIdea, subreddit, numResults, includeAllContext, language }),
        ]);
        setStageIdx(LOADING_STAGES.length - 1);
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
        setProgress(100);
        navigate("/compare");
      } else {
        const result = await runOneSearch({
          keyword,
          appIdea,
          subreddit,
          numResults,
          includeAllContext,
          language,
        });
        setStageIdx(LOADING_STAGES.length - 1);
        if (result.lowData) {
          toast({
            title: "Limited Reddit data found",
            description: `Only ${result.totalFound} relevant Reddit results — analysis may be less accurate.`,
          });
        }
        sessionStorage.setItem("redditlens_results", JSON.stringify(result.payload));
        saveToHistory(result.payload);
        setProgress(100);
        navigate("/results");
      }
    } catch (e) {
      console.error(e);
      toast({
        title: validateMode ? "Validation failed" : "Analysis failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-3xl py-12 md:py-20">
        <div className="text-center mb-10 fade-in">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-3">
            Reddit<span className="text-primary">Lens</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground">
            Discover what Reddit really wants
          </p>
        </div>

        <Card className="p-6 md:p-8 fade-in">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-base md:text-lg font-medium text-center">
                {LOADING_STAGES[stageIdx]?.label}
              </p>
              <div className="w-full max-w-sm">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.round(progress)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2 tabular-nums">
                  <span>{Math.round(progress)}%</span>
                  <span>{validateMode ? "Idea validation" : "10 parallel searches"}</span>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="keyword">
                    {compareMode ? "Keyword A" : "Keyword or topic"}
                  </Label>
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
                  Your app idea <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="idea"
                  placeholder="e.g. a bilingual AI mental coach for Bangladesh"
                  value={appIdea}
                  onChange={(e) => setAppIdea(e.target.value)}
                  maxLength={300}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subreddit">
                  Subreddit <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="subreddit"
                  placeholder="e.g. startups, androidapps, entrepreneur"
                  value={subreddit}
                  onChange={(e) => setSubreddit(e.target.value)}
                  maxLength={50}
                />
                {!subreddit.trim() && (
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground mb-2">
                      Popular subreddits — click to use one:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUBREDDIT_SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSubreddit(s)}
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
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "en", label: "English" },
                    { value: "bn", label: "বাংলা" },
                    { value: "both", label: "Both" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLanguage(opt.value)}
                      className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                        language === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base h-12"
              >
                <Search className="h-5 w-5" />
                {compareMode ? "Compare both" : "Analyze Reddit"}
              </Button>
            </form>
          )}
        </Card>

        {!loading && (
          <div className="mt-8 fade-in">
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Try an example:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setKeyword(ex)}
                  className="px-3 py-1.5 rounded-full text-sm bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground transition-colors border border-border"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
