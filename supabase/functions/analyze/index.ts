import { getCorsHeaders, extractJson, errorResponse, verifyAuth } from "../_shared/cors.ts";

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

const AI_GATEWAY_URL = "https://api.fireworks.ai/inference/v1/chat/completions";
const MODEL = "accounts/fireworks/models/deepseek-v4-pro";

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

function clamp10(n: any): number {
  const v = Number(n) || 0;
  return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
}

function normalizeBuildOrSkip(raw: any) {
  if (!raw) return undefined;
  const factors = {
    marketSize: clamp10(raw.factors?.marketSize),
    painIntensity: clamp10(raw.factors?.painIntensity),
    competitionGap: clamp10(raw.factors?.competitionGap),
    monetization: clamp10(raw.factors?.monetization),
    timing: clamp10(raw.factors?.timing),
  };
  const avg =
    (factors.marketSize + factors.painIntensity + factors.competitionGap + factors.monetization + factors.timing) / 5;
  let verdict: "BUILD IT" | "NEEDS WORK" | "SKIP IT";
  if (avg >= 7) verdict = "BUILD IT";
  else if (avg >= 5) verdict = "NEEDS WORK";
  else verdict = "SKIP IT";
  const allowed = ["BUILD IT", "NEEDS WORK", "SKIP IT"];
  if (allowed.includes(raw.verdict)) verdict = raw.verdict;
  return {
    verdict,
    reason: String(raw.reason ?? "").slice(0, 400),
    confidence: clampPct(raw.confidence ?? 70),
    factors,
  };
}

function normalizeTrend(raw: any) {
  if (!raw) return undefined;
  const dir = ["Growing", "Stable", "Declining"].includes(raw.direction) ? raw.direction : "Stable";
  return { direction: dir, reason: String(raw.reason ?? "").slice(0, 300) };
}

function normalizeRevenueModels(raw: any): any[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const types = ["Freemium", "B2B SaaS", "Marketplace", "One-time"];
  const items = raw.slice(0, 3).map((m: any) => ({
    type: types.includes(m.type) ? m.type : "Freemium",
    name: String(m.name ?? "").slice(0, 80),
    description: String(m.description ?? "").slice(0, 280),
    mrrRange: String(m.mrrRange ?? "").slice(0, 40),
    redditEvidence: String(m.redditEvidence ?? "").slice(0, 200),
    recommended: !!m.recommended,
  }));
  if (items.length && !items.some((m: any) => m.recommended)) items[0].recommended = true;
  return items;
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
    affectedTools: g.affectedTools ?? "",
  }));
  const competitorGaps = [...fromOpps, ...fromGaps].slice(0, 8);

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
    buildOrSkip: normalizeBuildOrSkip(raw.buildOrSkip),
    trend: normalizeTrend(raw.trend),
    revenueModels: normalizeRevenueModels(raw.revenueModels),
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { results = [], keyword: rawKeyword, appIdea: rawAppIdea, language = "en" } = body ?? {};
    const keyword = typeof rawKeyword === "string" ? rawKeyword.slice(0, 200) : "";
    const appIdea = typeof rawAppIdea === "string" ? rawAppIdea.slice(0, 500) : "";
    if (!keyword || !keyword.trim()) {
      return new Response(JSON.stringify({ error: "keyword required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(results)) {
      return new Response(JSON.stringify({ error: "results must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const lang = ["en", "bn", "both"].includes(language) ? language : "en";
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
      : "(No Reddit search results retrieved — rely on general knowledge of common Reddit discussions about this topic.)";

    const ideaLine = appIdea && String(appIdea).trim()
      ? `The user's app idea is: "${appIdea}". Use it to bias the validation reasoning.`
      : `The user has NOT provided a specific app idea. Score the overall opportunity strength of this topic on Reddit.`;

    const langInstruction =
      lang === "bn"
        ? `Write ALL textual fields in Bangla (Bengali script). Keep numeric fields, "signal" / "size" / "commercialIntent" / "willingToPay" enums, "subreddit", and "recommendedSubreddits" in English.`
        : lang === "both"
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
    { "gap": "specific gap title", "description": "what existing solutions are missing", "opportunity": "how to exploit this gap", "affectedTools": "comma-separated existing tools that fail at this, e.g. Notion, Trello, Slack" }
  ],
  "firstUserPersonas": [
    { "persona": "User type e.g. Burnt-out developer", "pain": "Their specific pain in one sentence", "willingToPay": "Yes" | "Maybe" | "No" }
  ],
  "sentiment": { "positive": <number>, "neutral": <number>, "negative": <number> },
  "sentimentSummary": "one short sentence describing overall Reddit mood",
  "niches": [
    { "niche": "specific sub-niche keyword phrase searchable on Reddit", "description": "1 sentence on why this niche is underserved", "size": "Large" | "Medium" | "Small" }
  ],
  "recommendedSubreddits": ["string without r/ prefix"],
  "buildOrSkip": {
    "verdict": "BUILD IT" | "NEEDS WORK" | "SKIP IT",
    "reason": "ONE bold sentence explaining the verdict",
    "confidence": <number 0-100>,
    "factors": {
      "marketSize": <0-10>,
      "painIntensity": <0-10>,
      "competitionGap": <0-10>,
      "monetization": <0-10>,
      "timing": <0-10>
    }
  },
  "trend": {
    "direction": "Growing" | "Stable" | "Declining",
    "reason": "one sentence on why this topic is trending in that direction on Reddit"
  },
  "revenueModels": [
    {
      "type": "Freemium" | "B2B SaaS" | "Marketplace" | "One-time",
      "name": "short model name",
      "description": "2 lines on how it works for THIS topic",
      "mrrRange": "e.g. $2K - $15K/mo",
      "redditEvidence": "e.g. 12 Reddit users mentioned willingness to pay for this",
      "recommended": true | false
    }
  ]
}

Rules:
- sentiment numbers MUST sum to 100
- Return 5 to 7 pain points. Each pain point must be from a DIFFERENT angle. Do not repeat similar complaints. Cover separately: usability, pricing, missing features, integration issues, and performance.
- You MUST return EXACTLY 4 competitor gaps (5 maximum). Never return fewer than 4. If you cannot find 4 from the data, use your knowledge of the topic to fill in the rest.
- Return 4 to 6 niche opportunities. Cover a range of sizes: at least one Large, one Medium, one Small.
- Provide 3 app opportunities, 3-4 personas, and 4-6 recommended subreddits.
- For each competitor gap, name the SPECIFIC existing tools (like Notion, Trello, Slack, Obsidian) in "affectedTools" — be concrete about which tools fail at what
- buildOrSkip: score each factor 0-10 honestly based on the discussions. Verdict logic: avg>=7 BUILD IT, 5-6.9 NEEDS WORK, <5 SKIP IT.
- trend: judge whether interest in this topic is Growing, Stable, or Declining based on the recency and volume of discussions.
- revenueModels: return EXACTLY 3 models, each a different type if possible. Mark exactly ONE as recommended:true (the strongest fit).`;

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
