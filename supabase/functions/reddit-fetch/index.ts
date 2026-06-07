import { getCorsHeaders, errorResponse, verifyAuth } from "../_shared/cors.ts";

interface SerperResult {
  title: string;
  snippet: string;
  link: string;
  subreddit: string;
  score: number;
  isReddit?: boolean;
  matchedSignals?: string[];
  queryHits?: number;
}

function extractSubreddit(link: string): string {
  if (!link) return "r/reddit";
  const m = link.match(/reddit\.com\/r\/([^\/?#]+)/i);
  return m ? `r/${m[1]}` : "r/reddit";
}

const HIGH_SIGNALS = [
  "wish", "need", "want", "problem", "hate",
  "frustrated", "annoying", "broken", "terrible",
  "would pay", "please build", "someone should",
  "fix", "worst",
];
const MID_SIGNALS = [
  "alternative", "looking for", "recommend",
  "better than", "switch from", "replace",
  "disappointed", "missing feature", "lacks",
  "missing", "difficult", "issue",
];
const LOW_SIGNALS = [
  "anyone", "how do", "what do",
  "thoughts", "review", "experience",
  "use", "best", "top", "help", "question", "advice",
];
const HIGH_VALUE_SUBS = [
  "startups", "entrepreneur", "somebodymakethis",
  "androidapps", "productrequest", "iosapps",
  "sideproject", "indiehackers",
];

function scoreResult(item: { title?: string; snippet?: string; link?: string }): { score: number; matched: string[] } {
  const combined = `${item.title || ""} ${item.snippet || ""}`.toLowerCase();
  let score = 3;
  const matched = new Set<string>();
  for (const w of HIGH_SIGNALS) {
    if (combined.includes(w)) { score += 3; matched.add(w); }
  }
  for (const w of MID_SIGNALS) {
    if (combined.includes(w)) { score += 2; matched.add(w); }
  }
  for (const w of LOW_SIGNALS) {
    if (combined.includes(w)) { score += 1; matched.add(w); }
  }
  const sub = (extractSubreddit(item.link || "").replace(/^r\//, "")).toLowerCase();
  if (sub && HIGH_VALUE_SUBS.some((s) => sub.includes(s.toLowerCase()))) score += 3;
  return { score, matched: [...matched] };
}

async function fetchWithTimeout(url: string, options: RequestInit, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

async function callSerper(query: string, apiKey: string): Promise<{ ok: boolean; status: number; organic: any[]; related: any[] }> {
  const doFetch = async () => {
    const res = await fetchWithTimeout("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 10, gl: "us", hl: "en" }),
    }, 8000);
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      organic: data?.organic ?? [],
      related: (data?.relatedSearches ?? []).map((r: any) => ({
        title: r.query ?? "",
        snippet: "",
        link: "",
      })),
    };
  };
  // One retry on failure
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const result = await doFetch();
      if (result.ok && (result.organic.length > 0 || result.related.length > 0 || attempt === 1)) {
        return result;
      }
      if (!result.ok && attempt === 1) return result;
    } catch (e) {
      console.error(`Serper attempt ${attempt + 1} failed for "${query}":`, e);
      if (attempt === 1) return { ok: false, status: 0, organic: [], related: [] };
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return { ok: false, status: 0, organic: [], related: [] };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    if (!SERPER_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "SERPER_API_KEY is not set",
          results: [],
          debug: { totalFound: 0, queriesRun: 0, apiKeySet: false, redditCount: 0 },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { keyword: rawKeyword, subreddit, numResults, extraQueries } = body ?? {};
    if (!rawKeyword || typeof rawKeyword !== "string") {
      return new Response(JSON.stringify({ error: "keyword required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // SEC-4: Cap input lengths to prevent prompt injection & cost abuse
    const keyword = rawKeyword.slice(0, 200);

    const k = keyword.trim();
    const subList: string[] = (subreddit ?? "")
      .toString()
      .slice(0, 500)
      .split(/[,\s]+/)
      .map((s: string) => s.replace(/^r\//i, "").trim())
      .filter((s: string) => s.length > 0 && s.length <= 50)
      .slice(0, 10);

    // Simple, proven queries
    const queries = [
      `${k} reddit`,
      `${k} site:reddit.com`,
      `${k} reddit review`,
      `${k} reddit discussion`,
      `${k} reddit problems`,
    ];
    for (const s of subList) {
      queries.push(`${k} site:reddit.com/r/${s}`);
    }
    if (extraQueries) {
      queries.push(`${k} reddit complaints`);
      queries.push(`${k} reddit suggestions`);
    }

    const resultsArray = await Promise.all(
      queries.map((q) => callSerper(q, SERPER_API_KEY)),
    );

    const anyOk = resultsArray.some((r) => r.ok);
    const totalFetched = resultsArray.reduce((n, r) => n + r.organic.length + r.related.length, 0);

    // Combine all (organic + related), dedupe by link
    const seen = new Set<string>();
    const flat: any[] = [];
    for (const batch of resultsArray) {
      for (const item of [...batch.organic, ...batch.related]) {
        const link = item?.link ?? "";
        const title = item?.title ?? "";
        if (!title) continue;
        const key = link || `noLink::${title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        flat.push({ ...item, link });
      }
    }

    const redditOnly = flat.filter((r) => (r.link || "").includes("reddit.com"));
    const nonReddit = flat.filter((r) => !(r.link || "").includes("reddit.com"));

    const byLink = new Map<string, SerperResult>();
    const ingest = (arr: any[], isReddit: boolean) => {
      for (const o of arr) {
        const link = (o.link as string) || "";
        const title = o.title ?? "";
        const snippet = o.snippet ?? "";
        const key = link || `noLink::${title}`;
        const existing = byLink.get(key);
        if (existing) {
          existing.queryHits = (existing.queryHits ?? 1) + 1;
          continue;
        }
        const { score, matched } = scoreResult({ title, snippet, link });
        byLink.set(key, {
          title,
          snippet,
          link,
          subreddit: extractSubreddit(link),
          score,
          isReddit,
          matchedSignals: matched,
          queryHits: 1,
        });
      }
    };
    ingest(redditOnly, true);
    ingest(nonReddit, false);

    const combined: SerperResult[] = [...byLink.values()].map((r) => ({
      ...r,
      score: r.score + Math.max(0, (r.queryHits ?? 1) - 1) * 2,
    }));

    // Reddit results first, then by score
    combined.sort((a, b) => {
      if (a.isReddit && !b.isReddit) return -1;
      if (!a.isReddit && b.isReddit) return 1;
      return b.score - a.score;
    });

    const cap = Math.max(20, Math.min(30, Number(numResults) || 25));
    const results = combined.slice(0, cap);
    const redditCount = results.filter((r) => r.isReddit).length;

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
      summary: `Ran ${queries.length} parallel Reddit searches and ranked ${results.length} unique posts (${redditCount} from reddit.com).`,
      topSignals,
      multiQueryHits,
      avgScore,
      totalQueries: queries.length,
    };

    const debug = {
      totalFound: results.length,
      totalFetched,
      redditCount,
      finalCount: results.length,
      queriesRun: queries.length,
      apiKeySet: true,
      anySerperOk: anyOk,
      perQueryStatuses: resultsArray.map((r) => r.status),
    };

    console.log(`[reddit-fetch] keyword="${k}" fetched=${totalFetched} reddit=${redditCount} final=${results.length}`);

    return new Response(
      JSON.stringify({
        results,
        effectiveSubreddits,
        totalFound: results.length,
        redditCount,
        lowData: redditCount < 5,
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
