import { getCorsHeaders, extractJson, errorResponse, verifyAuth, checkRateLimit, AI_GATEWAY_URL, MODEL } from "../_shared/cors.ts";

function clampPct(n: any): number {
  const v = Number(n) || 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth + rate limiting (competitor is a Pro feature)
    const authResult = await verifyAuth(req, corsHeaders);
    if ("error" in authResult) return authResult.error;
    const rateLimited = await checkRateLimit(req, corsHeaders, authResult.auth, "competitor");
    if (rateLimited) return rateLimited;

    const body = await req.json().catch(() => ({}));
    const competitor = String(body?.competitor ?? "").trim().slice(0, 80);
    const keyword = String(body?.keyword ?? "").trim().slice(0, 100);
    const existingResults = Array.isArray(body?.existingResults) ? body.existingResults.slice(0, 20) : [];

    if (!competitor || !keyword) {
      return new Response(JSON.stringify({ error: "competitor and keyword required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const API_KEY = Deno.env.get("FIREWORKS_API_KEY");
    if (!API_KEY) throw new Error("FIREWORKS_API_KEY not configured");

    const evidenceText = existingResults.length
      ? existingResults.map((r: any, i: number) =>
        `[${i + 1}] ${r.title}\nr/${r.subreddit || "reddit"}: ${r.snippet}`).join("\n\n")
      : "(No Reddit posts provided — rely on general knowledge of common Reddit discussions about this competitor.)";

    const prompt = `Based on Reddit discussions about "${keyword}", analyze what Reddit users say about ${competitor}. Focus on complaints, missing features, and what users wish ${competitor} would do differently.

REDDIT DISCUSSIONS:
${evidenceText}

Return ONLY this JSON (no prose, no code fences):
{
  "overallSentiment": "Positive" | "Mixed" | "Negative",
  "sentimentScore": <number 0-100>,
  "topComplaints": [
    { "complaint": "specific complaint", "frequency": "High" | "Medium" | "Low" }
  ],
  "missingFeatures": ["feature users want but ${competitor} lacks"],
  "whatUsersLove": ["thing users praise about ${competitor}"],
  "switchingTrigger": "one sentence on what would make users switch to a better alternative",
  "opportunityScore": <number 0-100, higher = more room for a competing product>
}

Rules:
- 3-5 topComplaints
- 3-5 missingFeatures
- 2-4 whatUsersLove
- Be specific and actionable`;

    const resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        temperature: 0.3,
        messages: [
          { role: "system", content: "You are a competitor intelligence analyst. Return valid JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error ${resp.status}`);
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);

    const allowedSent = ["Positive", "Mixed", "Negative"];
    const allowedFreq = ["High", "Medium", "Low"];
    const result = {
      overallSentiment: allowedSent.includes(parsed.overallSentiment) ? parsed.overallSentiment : "Mixed",
      sentimentScore: clampPct(parsed.sentimentScore),
      topComplaints: (parsed.topComplaints ?? []).slice(0, 5).map((c: any) => ({
        complaint: String(c.complaint ?? "").slice(0, 200),
        frequency: allowedFreq.includes(c.frequency) ? c.frequency : "Medium",
      })),
      missingFeatures: (parsed.missingFeatures ?? []).slice(0, 5).map((s: any) => String(s).slice(0, 160)),
      whatUsersLove: (parsed.whatUsersLove ?? []).slice(0, 4).map((s: any) => String(s).slice(0, 160)),
      switchingTrigger: String(parsed.switchingTrigger ?? "").slice(0, 280),
      opportunityScore: clampPct(parsed.opportunityScore),
    };

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("competitor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
