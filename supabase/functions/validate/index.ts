const ALLOWED_ORIGINS = [
  "https://reddit-insights-hub.vercel.app",
  "https://reddit-insights-hub.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

const SYSTEM = `You are a brutal but fair startup validator. You have seen thousands of startup ideas fail and succeed. Your job is to validate app ideas against real Reddit data — not hype, not assumptions, only evidence.

Be honest. If the idea is bad, say so clearly. If it is good, explain why with specific evidence from Reddit discussions. Always return valid JSON only.`;

const AI_GATEWAY_URL = "https://api.fireworks.ai/inference/v1/chat/completions";
const MODEL = "accounts/fireworks/models/deepseek-v4-pro";

const DIMENSION_NAMES = [
  "Problem Validation",
  "Market Demand",
  "Willingness to Pay",
  "Competition Gap",
  "Target Audience Clarity",
  "Unique Value Proposition",
] as const;

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

function clampScore(n: any): number {
  const v = Number(n) || 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function deriveVerdict(score: number): string {
  if (score >= 80) return "Strong Idea";
  if (score >= 60) return "Good Idea";
  if (score >= 40) return "Needs Work";
  return "Pivot Needed";
}

function normalizeValidation(raw: any, evidenceCount: number) {
  const overallScore = clampScore(raw.overallScore);
  const dimsRaw = Array.isArray(raw.dimensions) ? raw.dimensions : [];

  // Ensure all 6 dimensions are present in the right order
  const dimensions = DIMENSION_NAMES.map((name) => {
    const found = dimsRaw.find(
      (d: any) => (d?.name ?? "").toLowerCase() === name.toLowerCase(),
    ) ?? {};
    return {
      name,
      score: clampScore(found.score),
      verdict: String(found.verdict ?? "").trim() || "Partial",
      evidence: String(found.evidence ?? "").trim(),
      redditQuote: String(found.redditQuote ?? "").trim(),
    };
  });

  return {
    overallScore,
    verdict:
      typeof raw.verdict === "string" && raw.verdict.trim()
        ? raw.verdict.trim()
        : deriveVerdict(overallScore),
    verdictReason: String(raw.verdictReason ?? "").trim(),
    dimensions,
    strengths: (Array.isArray(raw.strengths) ? raw.strengths : []).slice(0, 5).map(String),
    weaknesses: (Array.isArray(raw.weaknesses) ? raw.weaknesses : []).slice(0, 5).map(String),
    pivotSuggestions: (Array.isArray(raw.pivotSuggestions) ? raw.pivotSuggestions : [])
      .slice(0, 3)
      .map(String),
    nextSteps: (Array.isArray(raw.nextSteps) ? raw.nextSteps : []).slice(0, 4).map(String),
    redditEvidenceCount:
      typeof raw.redditEvidenceCount === "number"
        ? raw.redditEvidenceCount
        : evidenceCount,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { keyword: rawKeyword, appIdea: rawAppIdea, results = [], language = "en" } = body;
    // SEC-4: Cap input lengths
    const keyword = typeof rawKeyword === "string" ? rawKeyword.slice(0, 200) : "";
    const appIdea = typeof rawAppIdea === "string" ? rawAppIdea.slice(0, 500) : "";

    if (!keyword || !keyword.trim()) {
      return new Response(JSON.stringify({ error: "keyword required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!appIdea || !appIdea.trim()) {
      return new Response(JSON.stringify({ error: "appIdea required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const API_KEY = Deno.env.get("FIREWORKS_API_KEY");
    if (!API_KEY) throw new Error("FIREWORKS_API_KEY not configured");

    const resultsText = results.length
      ? results
          .slice(0, 25)
          .map(
            (r: any, i: number) =>
              `[${i + 1}] Title: ${r.title}\nSubreddit: ${r.subreddit || "r/reddit"}\nSnippet: ${r.snippet}\nSignal Score: ${r.score ?? 0}`,
          )
          .join("\n\n")
      : "(No Reddit search results retrieved — base your analysis on general knowledge of common Reddit discussions about this topic, and lower confidence accordingly.)";

    const langInstruction =
      language === "bn"
        ? `Write ALL textual fields (verdictReason, evidence, redditQuote, strengths, weaknesses, pivotSuggestions, nextSteps) in Bangla (Bengali script). Keep numeric fields, "verdict" enum values, and dimension "name" values in English.`
        : language === "both"
          ? `For every textual field provide BOTH English and Bangla in this exact format: "English text || বাংলা টেক্সট". Keep numeric fields, "verdict" enums, and dimension "name" values in English only.`
          : `Write all textual fields in clear, natural English.`;

    const userPrompt = `Validate this app idea against real Reddit discussions.

APP IDEA: ${appIdea}
TOPIC SEARCHED: ${keyword}

REDDIT DISCUSSIONS FOUND:
${resultsText}

${langInstruction}

Validate the idea on these 6 dimensions and return ONLY this JSON (no prose, no code fences):
{
  "overallScore": <number 0-100>,
  "verdict": "Strong Idea" | "Good Idea" | "Needs Work" | "Pivot Needed",
  "verdictReason": "One sentence summary of the verdict",
  "dimensions": [
    { "name": "Problem Validation", "score": <0-100>, "verdict": "Validated" | "Partial" | "Not Validated", "evidence": "Specific Reddit evidence supporting or refuting this", "redditQuote": "A paraphrased example from the discussions" },
    { "name": "Market Demand", "score": <0-100>, "verdict": "High" | "Medium" | "Low", "evidence": "How many people seem to want this", "redditQuote": "A paraphrased example" },
    { "name": "Willingness to Pay", "score": <0-100>, "verdict": "High" | "Medium" | "Low", "evidence": "Evidence of commercial intent", "redditQuote": "A paraphrased example" },
    { "name": "Competition Gap", "score": <0-100>, "verdict": "Clear Gap" | "Some Gap" | "Crowded", "evidence": "What existing solutions Reddit users mention and hate", "redditQuote": "A paraphrased example" },
    { "name": "Target Audience Clarity", "score": <0-100>, "verdict": "Clear" | "Broad" | "Unclear", "evidence": "Who exactly is complaining about this on Reddit", "redditQuote": "A paraphrased example" },
    { "name": "Unique Value Proposition", "score": <0-100>, "verdict": "Strong" | "Moderate" | "Weak", "evidence": "Is this idea different from what users already know", "redditQuote": "A paraphrased example" }
  ],
  "strengths": ["string", "string", "string"],
  "weaknesses": ["string", "string", "string"],
  "pivotSuggestions": ["string", "string"],
  "nextSteps": ["string", "string", "string"],
  "redditEvidenceCount": <number, count of discussions you used as evidence>
}

Rules:
- Be brutally honest. If discussions don't support the idea, score low.
- Each redditQuote must be a paraphrased synthesis of real snippets above, not a direct quote.
- All 6 dimensions are required, in this exact order, with these exact names.
- overallScore should reflect a weighted average across dimensions.`;

    const resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your Lovable workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Validation failed (${resp.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    if (!content) {
      console.error("Empty model response:", JSON.stringify(data).slice(0, 500));
      throw new Error("Model returned empty response");
    }

    let parsed;
    try {
      parsed = extractJson(content);
    } catch {
      console.error("Validate JSON parse failed:", content.slice(0, 800));
      throw new Error("Model returned malformed JSON. Please retry.");
    }

    const validation = normalizeValidation(parsed, results.length);

    return new Response(JSON.stringify({ validation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
