const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found");
  return JSON.parse(candidate.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Generate 10 realistic Reddit pain-point cards a curious founder might find right now. Cover varied popular topics: productivity, mental health, fitness, food delivery, AI tools, side projects, freelancing, parenting, study habits, finance.

Return ONLY this JSON:
{
  "items": [
    {
      "quote": "a short, realistic Reddit-style complaint or wish (1-2 sentences, first person)",
      "topic": "short topic tag (e.g. productivity)",
      "signal": "High" | "Medium",
      "subreddit": "subreddit name without r/ prefix"
    }
  ]
}

Rules:
- Exactly 10 items, all different topics
- Quotes must sound like real Reddit users, not marketing
- Mix High and Medium signals`;

    const resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You generate realistic-sounding Reddit pain-point snippets. Return valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error ${resp.status}`);
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);

    const items = (parsed.items ?? []).slice(0, 10).map((it: any) => ({
      quote: String(it.quote ?? "").slice(0, 280),
      topic: String(it.topic ?? "").slice(0, 40),
      signal: ["High", "Medium"].includes(it.signal) ? it.signal : "Medium",
      subreddit: String(it.subreddit ?? "").replace(/^r\//, "").slice(0, 40),
    })).filter((it: any) => it.quote && it.topic);

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
    });
  } catch (e) {
    console.error("feed error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
