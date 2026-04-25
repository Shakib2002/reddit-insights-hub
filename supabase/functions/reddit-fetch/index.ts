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

// Tiered keyword sets — each scored in BOTH title and snippet (title weighted higher)
const HIGH_SIGNALS = ["wish", "need", "want", "problem", "hate", "frustrated", "frustrating", "broken", "useless"];
const MID_SIGNALS = ["would pay", "alternative", "looking for", "recommend", "worth it", "subscription"];
const LOW_SIGNALS = ["anyone else", "why doesn't", "i hate", "someone should build", "need an app"];

function scoreResult(title: string, snippet: string): { score: number; matched: string[] } {
  const t = (title || "").toLowerCase();
  const s = (snippet || "").toLowerCase();
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

async function serperSearch(query: string, apiKey: string): Promise<any[]> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 10, tbs: "qdr:m6" }),
    });
    if (!res.ok) {
      console.error("Serper error:", res.status, await res.text());
      return [];
    }
    const data = await res.json();
    return data?.organic ?? [];
  } catch (e) {
    console.error("Serper fetch failed:", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword, subreddit, numResults } = await req.json();
    if (!keyword || typeof keyword !== "string") {
      return new Response(JSON.stringify({ error: "keyword required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    if (!SERPER_API_KEY) throw new Error("SERPER_API_KEY not configured");

    const cleanSub = (subreddit ?? "").replace(/^r\//, "").trim();
    const k = keyword.trim();

    // 5 broad pain/intent queries
    const broadQueries = [
      `site:reddit.com ${k} problem`,
      `site:reddit.com ${k} "I wish" OR "need an app" OR "someone should build"`,
      `site:reddit.com ${k} frustrating OR hate OR broken OR useless`,
      `site:reddit.com ${k} alternative OR "looking for" OR "recommend"`,
      `site:reddit.com ${k} "would pay" OR "worth it" OR "subscription"`,
    ];

    // 5 subreddit-specific queries: prefer the user's subreddit if provided
    const targetSubs = cleanSub
      ? [cleanSub, "startups", "Entrepreneur", "SomebodyMakeThis", "productrequest"]
      : ["startups", "Entrepreneur", "SomebodyMakeThis", "androidapps", "productrequest"];
    const subQueries = targetSubs.map((s) => `site:reddit.com/r/${s} ${k}`);

    const allQueries = [...broadQueries, ...subQueries];

    // Run all 10 in parallel
    const batches = await Promise.all(
      allQueries.map((q) => serperSearch(q, SERPER_API_KEY)),
    );

    // Combine + dedupe by URL, but track how many of the 10 queries each URL appeared in
    const byLink = new Map<string, SerperResult>();
    for (const batch of batches) {
      for (const o of batch) {
        const link = o?.link ?? "";
        if (!link.includes("reddit.com")) continue;
        const title = o?.title ?? "";
        const snippet = o?.snippet ?? "";
        if (!title) continue;

        const existing = byLink.get(link);
        if (existing) {
          existing.queryHits = (existing.queryHits ?? 1) + 1;
          continue;
        }
        const { score, matched } = scoreResult(title, snippet);
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

    // Cross-query boost: +2 per extra query that surfaced this URL
    const combined: SerperResult[] = [...byLink.values()].map((r) => ({
      ...r,
      score: r.score + Math.max(0, (r.queryHits ?? 1) - 1) * 2,
    }));

    // Sort by score desc, take top N
    const cap = Math.max(20, Math.min(30, Number(numResults) || 20));
    combined.sort((a, b) => b.score - a.score);
    const results = combined.slice(0, cap);

    // Effective subreddits
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

    // "Why these results" rationale: top signals + cross-query overlap stats
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

    const rationaleParts: string[] = [];
    rationaleParts.push(`Ran 10 parallel Reddit searches and ranked ${results.length} unique posts.`);
    if (topSignals.length > 0) {
      rationaleParts.push(
        `Top intent signals: ${topSignals.map((t) => `“${t.signal}” ×${t.count}`).join(", ")}.`,
      );
    }
    if (multiQueryHits > 0) {
      rationaleParts.push(
        `${multiQueryHits} post${multiQueryHits === 1 ? "" : "s"} surfaced in multiple queries (cross-query boost applied).`,
      );
    }
    if (effectiveSubreddits.length > 0) {
      rationaleParts.push(`Strongest sources: ${effectiveSubreddits.slice(0, 3).map((s) => `r/${s}`).join(", ")}.`);
    }

    const rationale = {
      summary: rationaleParts.join(" "),
      topSignals,
      multiQueryHits,
      avgScore,
      totalQueries: 10,
    };

    return new Response(
      JSON.stringify({
        results,
        effectiveSubreddits,
        totalFound: results.length,
        lowData: results.length < 5,
        rationale,
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
