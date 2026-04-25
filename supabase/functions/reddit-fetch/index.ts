const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SerperResult {
  title: string;
  snippet: string;
  link: string;
  subreddit: string;
  score: number;
  matchedSignals?: string[];
  queryHits?: number;
}

function extractSubreddit(link: string): string {
  const m = link.match(/reddit\.com\/r\/([^\/?#]+)/i);
  return m ? `r/${m[1]}` : "r/reddit";
}

const HIGH_SIGNALS = ["wish", "need", "want", "problem", "hate", "frustrated", "frustrating", "broken", "useless"];
const MID_SIGNALS = ["would pay", "alternative", "looking for", "recommend", "worth it", "subscription"];
const LOW_SIGNALS = ["anyone else", "why doesn't", "i hate", "someone should build", "need an app"];

function scoreResult(item: { title?: string; snippet?: string }): { score: number; matched: string[] } {
  const t = (item.title || "").toLowerCase();
  const s = (item.snippet || "").toLowerCase();
  let score = 0;
  const matched = new Set<string>();
  for (const w of HIGH_SIGNALS) {
    if (t.includes(w)) { score += 3; matched.add(w); }
    if (s.includes(w)) { score += 2; matched.add(w); }
  }
  for (const w of MID_SIGNALS) {
    if (t.includes(w)) { score += 2; matched.add(w); }
    if (s.includes(w)) { score += 1; matched.add(w); }
  }
  for (const w of LOW_SIGNALS) {
    if (t.includes(w)) { score += 2; matched.add(w); }
    if (s.includes(w)) { score += 1; matched.add(w); }
  }
  return { score, matched: [...matched] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    if (!SERPER_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "SERPER_API_KEY is not set",
          results: [],
          debug: { totalFound: 0, queriesRun: 0, apiKeySet: false },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { keyword, subreddit, numResults } = await req.json();
    if (!keyword || typeof keyword !== "string") {
      return new Response(JSON.stringify({ error: "keyword required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const k = keyword.trim();
    const cleanSub = (subreddit ?? "").replace(/^r\//, "").trim();

    // Simple, reliable queries
    const queries = [
      `${k} site:reddit.com`,
      `${k} reddit discussion`,
      `${k} reddit review`,
    ];
    if (cleanSub) queries.push(`${k} site:reddit.com/r/${cleanSub}`);

    const resultsArray = await Promise.all(
      queries.map(async (query) => {
        try {
          const response = await fetch("https://google.serper.dev/search", {
            method: "POST",
            headers: {
              "X-API-KEY": SERPER_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ q: query, num: 10 }),
          });
          const data = await response.json();
          console.log("Serper status:", response.status);
          console.log("Serper results:", data.organic?.length ?? 0);
          return { ok: response.ok, status: response.status, organic: data?.organic ?? [] };
        } catch (e) {
          console.error("Serper fetch failed:", e);
          return { ok: false, status: 0, organic: [] };
        }
      }),
    );

    const anyOk = resultsArray.some((r) => r.ok);

    // Combine + dedupe by URL, keep only reddit.com, score, track cross-query hits
    const byLink = new Map<string, SerperResult>();
    for (const batch of resultsArray) {
      const redditResults = (batch.organic ?? []).filter((item: any) =>
        item?.link?.includes("reddit.com"),
      );
      for (const o of redditResults) {
        const link = o.link as string;
        const title = o.title ?? "";
        const snippet = o.snippet ?? "";
        if (!title) continue;
        const existing = byLink.get(link);
        if (existing) {
          existing.queryHits = (existing.queryHits ?? 1) + 1;
          continue;
        }
        const { score, matched } = scoreResult({ title, snippet });
        byLink.set(link, {
          title,
          snippet,
          link,
          subreddit: extractSubreddit(link),
          score,
          matchedSignals: matched,
          queryHits: 1,
        });
      }
    }

    const combined: SerperResult[] = [...byLink.values()].map((r) => ({
      ...r,
      score: r.score + Math.max(0, (r.queryHits ?? 1) - 1) * 2,
    }));

    const cap = Math.max(20, Math.min(30, Number(numResults) || 20));
    combined.sort((a, b) => b.score - a.score);
    const results = combined.slice(0, cap);

    const subCounts = new Map<string, number>();
    for (const r of results) {
      const clean = r.subreddit.replace(/^r\//, "");
      if (!clean || clean === "reddit") continue;
      subCounts.set(clean, (subCounts.get(clean) ?? 0) + 1);
    }
    const effectiveSubreddits = [...subCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([s]) => s);

    const signalCounts = new Map<string, number>();
    for (const r of results) {
      for (const sig of r.matchedSignals ?? []) {
        signalCounts.set(sig, (signalCounts.get(sig) ?? 0) + 1);
      }
    }
    const topSignals = [...signalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([sig, n]) => ({ signal: sig, count: n }));

    const multiQueryHits = results.filter((r) => (r.queryHits ?? 1) > 1).length;
    const avgScore =
      results.length > 0
        ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 10) / 10
        : 0;

    const rationale = {
      summary: `Ran ${queries.length} parallel Reddit searches and ranked ${results.length} unique posts.`,
      topSignals,
      multiQueryHits,
      avgScore,
      totalQueries: queries.length,
    };

    const debug = {
      totalFound: results.length,
      queriesRun: queries.length,
      apiKeySet: true,
      anySerperOk: anyOk,
      perQueryStatuses: resultsArray.map((r) => r.status),
    };

    console.log("reddit-fetch summary:", JSON.stringify(debug));

    return new Response(
      JSON.stringify({
        results,
        effectiveSubreddits,
        totalFound: results.length,
        lowData: results.length < 5,
        serperOk: anyOk,
        rationale,
        debug,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("reddit-fetch error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
