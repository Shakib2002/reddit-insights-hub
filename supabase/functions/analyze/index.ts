const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM =
  "You are a Reddit research expert and startup advisor. Analyze Reddit discussion snippets to extract pain points, validate app ideas, and find market opportunities. Always return valid JSON only.";

const MODEL_ROUTER_URL = "https://api.modelrouter.app/v1/chat/completions";
const MODEL = "gemini-3-flash-preview";

function extractJson(text: string): any {
  // Strip code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  // Find first { ... last }
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeAnalysis(raw: any) {
  return {
    summary: raw.summary ?? "",
    ideaMatchScore: Number(raw.ideaMatchScore ?? 0),
    painPoints: (raw.painPoints ?? []).map((p: any) => ({
      title: p.title ?? "",
      description: p.description ?? "",
      source: p.source ?? p.subreddit ?? "",
      signal: p.signal ?? "Medium",
    })),
    ideaValidation: {
      matchPercentage: Number(raw.ideaValidation?.matchPercentage ?? 0),
      reasons: raw.ideaValidation?.reasons ?? [],
    },
    competitorGaps: (raw.competitorGaps ?? []).map((g: any) => ({
      gap: g.gap ?? "",
      description: g.description ?? "",
    })),
    firstUserPersonas: (raw.firstUserPersonas ?? []).map((p: any) => ({
      persona: p.persona ?? "",
      pain: p.pain ?? "",
    })),
    recommendedSubreddits: (raw.recommendedSubreddits ?? []).map((s: string) =>
      s.replace(/^r\//, ""),
    ),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { results = [], keyword, appIdea, language = "en" } = await req.json();
    const API_KEY = Deno.env.get("MODELROUTER_API_KEY");
    if (!API_KEY) throw new Error("MODELROUTER_API_KEY not configured");

    const resultsText = results.length
      ? results
          .slice(0, 20)
          .map(
            (r: any, i: number) =>
              `[${i + 1}] r/${r.subreddit || "unknown"}\nTitle: ${r.title}\nSnippet: ${r.snippet}`,
          )
          .join("\n\n")
      : "(No Reddit search results retrieved — rely on general knowledge of common Reddit discussions about this topic.)";

    const ideaLine = appIdea && String(appIdea).trim()
      ? `The user's app idea is: "${appIdea}". Score how well this idea matches the discussions found.`
      : `The user has NOT provided a specific app idea. For "ideaMatchScore" and "ideaValidation.matchPercentage", instead score the overall opportunity strength of this topic on Reddit (0-100). For "ideaValidation.reasons", list 3 reasons why this topic is or isn't a strong opportunity for a new product.`;

    const langInstruction =
      language === "bn"
        ? `Write ALL textual fields (summary, pain point titles & descriptions, validation reasons, competitor gaps, persona labels & pains) in Bangla (Bengali script). Keep numeric fields, "signal" enum values (High/Medium/Low), "source", and "recommendedSubreddits" in English.`
        : language === "both"
          ? `For every textual field (summary, pain point title & description, validation reasons, competitor gap & description, persona & pain) provide BOTH English and Bangla, in this exact format: "English text || বাংলা টেক্সট". Keep numeric fields, "signal" enum values (High/Medium/Low), "source", and "recommendedSubreddits" in English only.`
          : `Write all textual fields in clear, natural English.`;

    const userPrompt = `Analyze these Reddit discussions about "${keyword}". ${ideaLine}

${langInstruction}

Reddit discussions found:
${resultsText}

Return ONLY a JSON object (no prose, no code fences) with this exact structure:
{
  "summary": "2-3 sentence overview",
  "ideaMatchScore": <number 0-100>,
  "painPoints": [
    { "title": "string", "description": "string", "source": "subreddit name without r/", "signal": "High" | "Medium" | "Low" }
  ],
  "ideaValidation": {
    "matchPercentage": <number 0-100>,
    "reasons": ["string", "string", "string"]
  },
  "competitorGaps": [
    { "gap": "string", "description": "string" }
  ],
  "firstUserPersonas": [
    { "persona": "descriptive label, NOT a real username", "pain": "string" }
  ],
  "recommendedSubreddits": ["string without r/ prefix"]
}

Provide 4-5 pain points, 3 competitor gaps, 3-4 personas, and 4-6 recommended subreddits.`;

    const resp = await fetch(MODEL_ROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("Model router error:", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 401 || resp.status === 403) {
        return new Response(JSON.stringify({ error: "Invalid API key for the model router." }), {
          status: resp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI analysis failed (${resp.status})` }), {
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
    } catch (e) {
      console.error("JSON parse failed. Content:", content.slice(0, 800));
      throw new Error("Model returned malformed JSON. Please retry.");
    }

    const analysis = normalizeAnalysis(parsed);
    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
