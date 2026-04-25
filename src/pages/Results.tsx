import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, ExternalLink, TrendingUp } from "lucide-react";
import type { ResultsPayload } from "@/lib/types";

const signalVariant = (s: string) => {
  if (s === "High") return "bg-primary text-primary-foreground";
  if (s === "Medium") return "bg-accent text-accent-foreground";
  return "bg-muted text-muted-foreground";
};

const Results = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState<ResultsPayload | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("redditlens_results");
    if (!stored) {
      navigate("/");
      return;
    }
    setData(JSON.parse(stored));
  }, [navigate]);

  if (!data) return null;
  const { inputs, analysis } = data;

  const copyReport = async () => {
    const text = `RedditLens Report
================
Keyword: ${inputs.keyword}
App idea: ${inputs.appIdea}
Subreddit: r/${inputs.subreddit}
Idea Match Score: ${analysis.ideaMatchScore}/100

SUMMARY
${analysis.summary}

PAIN POINTS
${analysis.painPoints.map((p) => `• [${p.signal}] ${p.title} (r/${p.source})\n  ${p.description}`).join("\n")}

IDEA VALIDATION (${analysis.ideaValidation.matchPercentage}%)
${analysis.ideaValidation.reasons.map((r) => `• ${r}`).join("\n")}

COMPETITOR GAPS
${analysis.competitorGaps.map((g) => `• ${g.gap}: ${g.description}`).join("\n")}

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
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Idea:</span> {inputs.appIdea}
            </p>
            {inputs.subreddit && (
              <p className="text-sm text-muted-foreground">
                Searched in <span className="font-medium">r/{inputs.subreddit}</span>
              </p>
            )}
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

        {/* Summary */}
        <Card className="p-6 fade-in">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Summary
          </h2>
          <p className="text-foreground leading-relaxed">{analysis.summary}</p>
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
                  <Badge className={signalVariant(p.signal)}>{p.signal}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                <p className="text-xs text-muted-foreground">from r/{p.source}</p>
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

        {/* Competitor gaps */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-4">Competitor Gaps</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {analysis.competitorGaps.map((g, i) => (
              <Card
                key={i}
                className="p-5 border-l-4"
                style={{ borderLeftColor: "hsl(var(--success))" }}
              >
                <h3 className="font-semibold mb-2">{g.gap}</h3>
                <p className="text-sm text-muted-foreground">{g.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* First users */}
        <section className="fade-in">
          <h2 className="text-xl font-semibold mb-4">Potential First Users</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {analysis.firstUserPersonas.map((p, i) => (
              <Card key={i} className="p-5">
                <h3 className="font-semibold mb-1">{p.persona}</h3>
                <p className="text-sm text-muted-foreground">{p.pain}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Recommended subreddits */}
        <section className="fade-in">
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
        <div className="flex flex-col sm:flex-row gap-3 pt-4 fade-in">
          <Button onClick={() => navigate("/")} variant="outline" className="flex-1">
            <ArrowLeft className="h-4 w-4" /> Search Again
          </Button>
          <Button onClick={copyReport} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Copy className="h-4 w-4" /> Copy Report
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Results;
