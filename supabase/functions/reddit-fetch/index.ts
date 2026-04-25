const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RedditPost {
  title: string;
  body: string;
  score: number;
  num_comments: number;
  subreddit: string;
}

const UA = "RedditLens/1.0 (research tool)";

async function searchReddit(url: string): Promise<RedditPost[]> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const data = await res.json();
    const children = data?.data?.children ?? [];
    return children.map((c: any) => ({
      title: c.data?.title ?? "",
      body: (c.data?.selftext ?? "").slice(0, 800),
      score: c.data?.score ?? 0,
      num_comments: c.data?.num_comments ?? 0,
      subreddit: c.data?.subreddit ?? "",
    }));
  } catch (e) {
    console.error("reddit fetch failed:", e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { keyword, subreddit } = await req.json();
    if (!keyword || typeof keyword !== "string") {
      return new Response(JSON.stringify({ error: "keyword required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanSub = (subreddit ?? "").replace(/^r\//, "").trim();
    const q = encodeURIComponent(keyword);

    const urls: string[] = [];
    if (cleanSub) {
      urls.push(
        `https://www.reddit.com/r/${cleanSub}/search.json?q=${q}&restrict_sr=1&sort=top&limit=25&t=year`,
      );
    }
    urls.push(`https://www.reddit.com/search.json?q=${q}&sort=top&limit=15&t=year`);

    const results = await Promise.all(urls.map(searchReddit));
    const seen = new Set<string>();
    const posts = results.flat().filter((p) => {
      if (!p.title || seen.has(p.title)) return false;
      seen.add(p.title);
      return true;
    });

    return new Response(JSON.stringify({ posts }), {
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
