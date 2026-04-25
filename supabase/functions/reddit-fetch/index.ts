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
}

function extractSubreddit(link: string): string {
  const m = link.match(/reddit\.com\/r\/([^\/]+)/i);
  return m ? m[1] : "";
}

async function serperSearch(query: string, apiKey: string, num: number): Promise<SerperResult[]> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num }),
    });
    if (!res.ok) {
      console.error("Serper error:", res.status, await res.text());
      return [];
    }
    const data = await res.json();
    const organic = data?.organic ?? [];
    return organic
      .map((o: any) => ({
        title: o.title ?? "",
        snippet: o.snippet ?? "",
        link: o.link ?? "",
        subreddit: extractSubreddit(o.link ?? ""),
      }))
      .filter((r: SerperResult) => r.title && r.link.includes("reddit.com"));
  } catch (e) {
    console.error("Serper fetch failed:", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword, subreddit, numResults, includeAllContext } = await req.json();
    if (!keyword || typeof keyword !== "string") {
      return new Response(JSON.stringify({ error: "keyword required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    if (!SERPER_API_KEY) throw new Error("SERPER_API_KEY not configured");

    const cleanSub = (subreddit ?? "").replace(/^r\//, "").trim();
    const num = Math.max(5, Math.min(30, Number(numResults) || 10));
    const includeAll = includeAllContext !== false; // default true

    const primaryQuery = cleanSub
      ? `site:reddit.com/r/${cleanSub} ${keyword}`
      : `site:reddit.com ${keyword} discussion`;

    const painQuery = `site:reddit.com ${keyword} "I wish" OR "why doesn't" OR "I hate" OR "need an app"`;

    const searches: Promise<SerperResult[]>[] = [
      serperSearch(primaryQuery, SERPER_API_KEY, num),
    ];
    if (includeAll) {
      searches.push(serperSearch(painQuery, SERPER_API_KEY, Math.min(num, 10)));
    }

    const batches = await Promise.all(searches);

    const seen = new Set<string>();
    const results = batches.flat().filter((r) => {
      if (seen.has(r.link)) return false;
      seen.add(r.link);
      return true;
    });

    // Effective subreddits: top sources actually returned, ranked by frequency
    const subCounts = new Map<string, number>();
    for (const r of results) {
      if (!r.subreddit) continue;
      subCounts.set(r.subreddit, (subCounts.get(r.subreddit) ?? 0) + 1);
    }
    const effectiveSubreddits = [...subCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([s]) => s);

    return new Response(JSON.stringify({ results, effectiveSubreddits }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reddit-fetch error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
