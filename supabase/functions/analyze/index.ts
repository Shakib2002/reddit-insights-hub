const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a world-class product researcher who specializes in finding validated startup opportunities from Reddit discussions.

Your job:
1. Find SPECIFIC, ACTIONABLE pain points — not vague complaints
2. Prioritize pain points with HIGH COMMERCIAL INTENT
3. Spot patterns that appear across multiple Reddit communities
4. Rate each pain point by frequency, intensity, and willingness to pay
5. Generate app ideas that DIRECTLY solve the discovered pain points

Rules:
- Only include pain points mentioned by multiple users
- Prioritize pain points where users mention money (I'd pay, worth it, subscription)
- Ignore generic complaints with no actionable solution
- Be specific: 'Notion is too complex for simple task lists' not 'apps are bad'
- Always return valid JSON only — no markdown, no explanation`;

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

function clampPct(n: any): number {
  const v = Number(n) || 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normEnum(v: any, allowed: string[], fallback: string): string {
  return allowed.includes(v) ? v : fallback;
}

function normalizeSentiment(raw: any) {
  const pos = clampPct(raw?.positive);
  const neu = clampPct(raw?.neutral);
  const neg = clampPct(raw?.negative);
  const total = pos + neu + neg;
  if (total === 0) return { positive: 33, neutral: 34, negative: 33 };
  const p = Math.round((pos / total) * 100);
  const n = Math.round((neu / total) * 100);
  return { positive: p, neutral: n, negative: 100 - p - n };
}

function normalizeAnalysis(raw: any) {
  // Pain score from new prompt; fall back to ideaMatchScore for compat
  const painScore = clampPct(raw.painScore ?? raw.ideaMatchScore ?? 0);

  // Merge new appOpportunities[] into competitorGaps[] shape used by UI
  const fromOpps = (raw.appOpportunities ?? []).map((o: any) => ({
    gap: o.name ?? o.gap ?? "",
    description: o.description ?? "",
    opportunity: o.uniqueAngle ?? o.opportunity ?? "",
  }));
  const fromGaps = (raw.competitorGaps ?? []).map((g: any) => ({
    gap: g.gap ?? "",
    description: g.description ?? "",
    opportunity: g.opportunity ?? "",
  }));
  const competitorGaps = [...fromOpps, ...fromGaps].slice(0, 6);

  return {
    summary: raw.summary ?? "",
    ideaMatchScore: painScore,
    painPoints: (raw.painPoints ?? []).map((p: any, i: number) => ({
      title: p.title ?? "",
      description: p.description ?? "",
      source: (p.subreddit ?? p.source ?? "").replace(/^r\//, ""),
      signal: normEnum(p.signal, ["High", "Medium", "Low"], "Medium"),
      commercialIntent: normEnum(p.commercialIntent, ["High", "Medium", "Low"], "Medium"),
      sourceIndex: typeof p.sourceIndex === "number" ? p.sourceIndex : i + 1,
    })),
    ideaValidation: {
      matchPercentage: clampPct(raw.ideaValidation?.matchPercentage ?? painScore),
      reasons: raw.ideaValidation?.reasons ?? [],
    },
    competitorGaps,
    firstUserPersonas: (raw.firstUserPersonas ?? []).map((p: any) => ({
      persona: p.persona ?? "",
      pain: p.pain ?? "",
      willingToPay: normEnum(p.willingToPay, ["Yes", "Maybe", "No"], "Maybe"),
    })),
    recommendedSubreddits: (raw.recommendedSubreddits ?? []).map((s: string) =>
      s.replace(/^r\//, ""),
    ),
    sentiment: normalizeSentiment(raw.sentiment),
    sentimentSummary: raw.sentimentSummary ?? "",
    niches: (raw.niches ?? []).map((n: any) => ({
      niche: n.niche ?? "",
      description: n.description ?? "",
      size: normEnum(n.size, ["Large", "Medium", "Small"], "Medium"),
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { results = [], keyword, appIdea, language = "en" } = await req.json();
    const API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const resultsText = results.length
      ? results
          .slice(0, 25)
          .map(
            (r: any, i: number) =>
              `[${i + 1}] Title: ${r.title}\nSubreddit: ${r.subreddit || "r/reddit"}\nSnippet: ${r.snippet}\nSignal Score: ${r.score ?? 0}`,
          )
          .join("\n\n")
      : "(No Reddit search results retrieved — rely on general knowledge of common Reddit discussions about this topic.)";

    const ideaLine = appIdea && String(appIdea).trim()
      ? `The user's app idea is: "${appIdea}". Use it to bias the validation reasoning.`
      : `The user has NOT provided a specific app idea. Score the overall opportunity strength of this topic on Reddit.`;

    const langInstruction =
      language === "bn"
        ? `Write ALL textual fields in Bangla (Bengali script). Keep numeric fields, "signal" / "size" / "commercialIntent" / "willingToPay" enums, "subreddit", and "recommendedSubreddits" in English.`
        : language === "both"
          ? `For every textual field provide BOTH English and Bangla in this exact format: "English text || বাংলা টেক্সট". Keep numeric fields, enums, "subreddit", and "recommendedSubreddits" in English only.`
          : `Write all textual fields in clear, natural English.`;

    const userPrompt = `Analyze these Reddit discussions about "${keyword}". ${ideaLine}

${langInstruction}

DISCUSSIONS (sorted by relevance):
${resultsText}

Instructions:
- Focus on discussions with higher signal scores
- Look for patterns repeated across multiple subreddits
- Prioritize commercial pain points (where money is mentioned)
- Be specific and actionable in all outputs
- For each pain point, set "sourceIndex" to the [number] of the most relevant discussion above (1-based)

Return ONLY this JSON (no prose, no code fences):
{
  "summary": "2-3 sentences on what Reddit says about this topic",
  "painScore": <number 0-100 based on intensity and frequency of complaints>,
  "painPoints": [
    {
      "title": "specific pain point title",
      "description": "detailed description with specific examples from discussions",
      "subreddit": "r/subreddit where this was found",
      "signal": "High" | "Medium" | "Low",
      "commercialIntent": "High" | "Medium" | "Low",
      "sourceIndex": <1-based index into the discussions list>
    }
  ],
  "ideaValidation": {
    "matchPercentage": <number 0-100>,
    "reasons": ["string", "string", "string"]
  },
  "appOpportunities": [
    { "name": "App name", "description": "What it does and which pain point it solves", "uniqueAngle": "What makes it different from existing solutions" }
  ],
  "competitorGaps": [
    { "gap": "specific gap title", "description": "what existing solutions are missing", "opportunity": "how to exploit this gap" }
  ],
  "firstUserPersonas": [
    { "persona": "User type e.g. Burnt-out developer", "pain": "Their specific pain in one sentence", "willingToPay": "Yes" | "Maybe" | "No" }
  ],
  "sentiment": { "positive": <number>, "neutral": <number>, "negative": <number> },
  "sentimentSummary": "one short sentence describing overall Reddit mood",
  "niches": [
    { "niche": "specific sub-niche keyword phrase searchable on Reddit", "description": "1 sentence on why this niche is underserved", "size": "Large" | "Medium" | "Small" }
  ],
  "recommendedSubreddits": ["string without r/ prefix"]
}

Rules:
- sentiment numbers MUST sum to 100
- Provide 4-5 pain points, 3 app opportunities, 2-3 competitor gaps, 3-4 personas, 4-6 recommended subreddits, and 3-4 niches`;

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

    // Attach the actual Reddit link + extracted subreddit to each pain point using sourceIndex
    const extractSubFromLink = (link: string): string => {
      const m = link?.match(/reddit\.com\/r\/([^/?#]+)/i);
      return m ? m[1] : "";
    };
    analysis.painPoints = analysis.painPoints.map((p: any) => {
      const idx = (p.sourceIndex ?? 0) - 1;
      const src = idx >= 0 && idx < results.length ? results[idx] : null;
      const link = src?.link ?? "";
      const subFromLink =
        extractSubFromLink(link) || (src?.subreddit ?? "").replace(/^r\//, "") || "";
      return {
        ...p,
        link,
        source: subFromLink || p.source,
      };
    });

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
