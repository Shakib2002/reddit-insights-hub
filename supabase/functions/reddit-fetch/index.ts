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

interface SearchOutcome {
  organic: any[];
  status: number;
  ok: boolean;
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

async function serperSearch(query: string, apiKey: string): Promise<SearchOutcome> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 10 }),
    });
    const status = res.status;
    if (!res.ok) {
      const body = await res.text();
      console.error(`Serper [${query.slice(0, 60)}] status=${status} body=${body.slice(0, 200)}`);
      return { organic: [], status, ok: false };
    }
    const data = await res.json();
    const organic = data?.organic ?? [];
    console.log(`Serper [${query.slice(0, 60)}] status=${status} organic=${organic.length}`);
    return { organic, status, ok: true };
  } catch (e) {
    console.error(`Serper fetch failed [${query.slice(0, 60)}]:`, e);
    return { organic: [], status: 0, ok: false };
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

    // 5 subreddit-specific queries
    const targetSubs = cleanSub
      ? [cleanSub, "startups", "Entrepreneur", "SomebodyMakeThis", "productrequest"]
      : ["startups", "Entrepreneur", "SomebodyMakeThis", "androidapps", "productrequest"];
    const subQueries = targetSubs.map((s) => `site:reddit.com/r/${s} ${k}`);

    const allQueries = [...broadQueries, ...subQueries];

    const outcomes = await Promise.all(allQueries.map((q) => serperSearch(q, SERPER_API_KEY)));

    // Track auth health: if every query returned a non-ok status, the key is bad
    const anyOk = outcomes.some((o) => o.ok);
    const totalOrganic = outcomes.reduce((sum, o) => sum + o.organic.length, 0);

    let allBatches = outcomes.map((o) => o.organic);

    // If every Serper call succeeded but returned zero results, try simpler fallback queries
    if (anyOk && totalOrganic === 0) {
      console.log("All queries returned 0 organic — running simple fallback queries");
      const fallbackQueries = [`reddit ${k}`, `reddit ${k} app review`];
      const fb = await Promise.all(fallbackQueries.map((q) => serperSearch(q, SERPER_API_KEY)));
      allBatches = allBatches.concat(fb.map((o) => o.organic));
    }

    // Combine + dedupe by URL, score, track cross-query hits
    const byLink = new Map<string, SerperResult>();
    for (const batch of allBatches) {
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

    console.log(`reddit-fetch summary: queries=${allQueries.length} totalOrganic=${totalOrganic} unique=${combined.length} returned=${results.length} serperOk=${anyOk}`);

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

    const rationaleParts: string[] = [];
    rationaleParts.push(`Ran ${allQueries.length} parallel Reddit searches and ranked ${results.length} unique posts.`);
    if (topSignals.length > 0) {
      rationaleParts.push(
        `Top intent signals: ${topSignals.map((t) => `"${t.signal}" ×${t.count}`).join(", ")}.`,
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
      totalQueries: allQueries.length,
    };

    return new Response(
      JSON.stringify({
        results,
        effectiveSubreddits,
        totalFound: results.length,
        lowData: results.length < 5,
        serperOk: anyOk,
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
