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
import { Loader2, Search, ChevronDown } from "lucide-react";
import type { ResultsPayload } from "@/lib/types";

const EXAMPLES = [
  "mental health apps",
  "productivity tools",
  "food delivery",
  "habit tracker",
  "AI tools",
  "journaling apps",
];

const LOADING_STEPS = [
  "Searching Reddit…",
  "Reading discussions…",
  "Analyzing with AI…",
  "Building report…",
];

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [keyword, setKeyword] = useState("");
  const [appIdea, setAppIdea] = useState("");
  const [subreddit, setSubreddit] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [numResults, setNumResults] = useState(10);
  const [includeAllContext, setIncludeAllContext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setStep((s) => (s + 1) % LOADING_STEPS.length), 1800);
    return () => clearInterval(id);
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      toast({ title: "Keyword is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    setStep(0);

    try {
      const { data: redditData, error: redditErr } = await supabase.functions.invoke(
        "reddit-fetch",
        { body: { keyword, subreddit, numResults, includeAllContext } },
      );
      if (redditErr) throw redditErr;

      setStep(1);
      // brief pause so the "reading discussions" step is visible
      await new Promise((r) => setTimeout(r, 600));

      setStep(2);
      const { data: analyzeData, error: analyzeErr } = await supabase.functions.invoke(
        "analyze",
        { body: { results: redditData?.results ?? [], keyword, appIdea } },
      );
      if (analyzeErr) {
        const msg = (analyzeErr as any).context?.body
          ? JSON.parse((analyzeErr as any).context.body).error
          : analyzeErr.message;
        throw new Error(msg);
      }

      setStep(3);
      const payload: ResultsPayload = {
        inputs: { keyword, appIdea, subreddit: subreddit.replace(/^r\//, "") },
        analysis: analyzeData.analysis,
      };
      sessionStorage.setItem("redditlens_results", JSON.stringify(payload));
      navigate("/results");
    } catch (e) {
      console.error(e);
      toast({
        title: "Analysis failed",
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
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium transition-opacity duration-500">
                {LOADING_STEPS[step]}
              </p>
              <div className="flex gap-2 mt-2">
                {LOADING_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-10 rounded-full transition-colors ${
                      i <= step ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="keyword">Keyword or topic</Label>
                <Input
                  id="keyword"
                  placeholder="e.g. mental health apps"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  maxLength={100}
                />
              </div>
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
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base h-12"
              >
                <Search className="h-5 w-5" />
                Analyze Reddit
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
