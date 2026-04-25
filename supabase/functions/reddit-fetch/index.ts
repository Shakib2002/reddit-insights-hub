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
}

function extractSubreddit(link: string): string {
  const m = link.match(/reddit\.com\/r\/([^\/?#]+)/i);
  return m ? `r/${m[1]}` : "r/reddit";
}

function scoreResult(title: string, snippet: string): number {
  const t = (title || "").toLowerCase();
  const s = (snippet || "").toLowerCase();
  let score = 0;

  const high = ["wish", "need", "want", "problem", "hate", "frustrated"];
  const mid = ["would pay", "alternative", "looking for"];
  const low = ["anyone else", "why doesn't", "i hate"];

  for (const w of high) if (t.includes(w)) score += 3;
  for (const w of mid) if (t.includes(w)) score += 2;
  for (const w of low) if (s.includes(w)) score += 1;

  return score;
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

    // Combine + dedupe by URL
    const seen = new Set<string>();
    const combined: SerperResult[] = [];
    for (const batch of batches) {
      for (const o of batch) {
        const link = o?.link ?? "";
        if (!link.includes("reddit.com") || seen.has(link)) continue;
        seen.add(link);
        const title = o?.title ?? "";
        const snippet = o?.snippet ?? "";
        if (!title) continue;
        combined.push({
          title,
          snippet,
          link,
          subreddit: extractSubreddit(link),
          score: scoreResult(title, snippet),
        });
      }
    }

    // Sort by score desc, take top 20 (or numResults if higher)
    const cap = Math.max(20, Math.min(30, Number(numResults) || 20));
    combined.sort((a, b) => b.score - a.score);
    const results = combined.slice(0, cap);

    // Effective subreddits: top sources by frequency (strip "r/" prefix for UI)
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

    return new Response(
      JSON.stringify({
        results,
        effectiveSubreddits,
        totalFound: results.length,
        lowData: results.length < 5,
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
