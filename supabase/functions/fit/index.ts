import { getCorsHeaders, extractJson, errorResponse, verifyAuth, checkRateLimit, AI_GATEWAY_URL, MODEL } from "../_shared/cors.ts";

function clampPct(n: any): number {
  const v = Number(n) || 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth + rate limiting
    const authResult = await verifyAuth(req, corsHeaders);
    if ("error" in authResult) return authResult.error;
    const rateLimited = await checkRateLimit(req, corsHeaders, authResult.auth, "fit");
    if (rateLimited) return rateLimited;

    const body = await req.json().catch(() => ({}));
    const background = String(body?.background ?? "").trim().slice(0, 60);
    const location = String(body?.location ?? "").trim().slice(0, 80);
    const time = String(body?.time ?? "").trim().slice(0, 60);
    const keyword = String(body?.keyword ?? "").trim().slice(0, 100);
    const painPoints = Array.isArray(body?.painPoints) ? body.painPoints.slice(0, 6) : [];
    const opportunities = Array.isArray(body?.opportunities) ? body.opportunities.slice(0, 6) : [];

    if (!keyword || !background) {
      return new Response(JSON.stringify({ error: "keyword and background required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const API_KEY = Deno.env.get("FIREWORKS_API_KEY");
    if (!API_KEY) throw new Error("FIREWORKS_API_KEY not configured");

    const painText = painPoints.map((p: any, i: number) => `${i + 1}. ${p.title ?? p}`).join("\n") || "(none)";
    const oppText = opportunities.map((o: any, i: number) => `${i + 1}. ${o.gap ?? o}`).join("\n") || "(none)";

    const prompt = `Score the founder-market fit for someone with this profile building a product around "${keyword}".

Founder profile:
- Background: ${background}
- Location/market: ${location || "(unspecified)"}
- Available time: ${time || "(unspecified)"}

Top pain points discovered:
${painText}

App opportunities:
${oppText}

Return ONLY this JSON:
{
  "fitScore": <0-100>,
  "fitVerdict": "Great Fit" | "Good Fit" | "Challenging" | "Poor Fit",
  "reasons": ["string", "string", "string"],
  "advantages": ["string", "string"],
  "challenges": ["string", "string"],
  "recommendation": "one paragraph of practical advice tailored to this founder"
}

Rules:
- Be honest. A developer building dev tools = Great Fit; a marketer building heavy infra = Challenging.
- Consider time constraints (weekends-only ≠ enterprise sales).
- Consider location for GTM realities.
- Exactly 3 reasons, 2 advantages, 2 challenges.`;

    const resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You are a startup advisor scoring founder-market fit. Return valid JSON only." },
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
    const allowedV = ["Great Fit", "Good Fit", "Challenging", "Poor Fit"];

    const result = {
      fitScore: clampPct(parsed.fitScore),
      fitVerdict: allowedV.includes(parsed.fitVerdict) ? parsed.fitVerdict : "Good Fit",
      reasons: (parsed.reasons ?? []).slice(0, 3).map((s: any) => String(s).slice(0, 200)),
      advantages: (parsed.advantages ?? []).slice(0, 2).map((s: any) => String(s).slice(0, 160)),
      challenges: (parsed.challenges ?? []).slice(0, 2).map((s: any) => String(s).slice(0, 160)),
      recommendation: String(parsed.recommendation ?? "").slice(0, 600),
    };

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
