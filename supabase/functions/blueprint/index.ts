import { getCorsHeaders, extractJson, errorResponse, verifyAuth, AI_GATEWAY_URL, MODEL } from "../_shared/cors.ts";

const SYSTEM = "You are a startup advisor and product architect.";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth (rate limiting is handled by reddit-fetch)
    const authResult = await verifyAuth(req, corsHeaders);
    if ("error" in authResult) return authResult.error;

    const { appName, appDescription, painPoints = [], language = "en" } = await req.json();
    if (!appName || typeof appName !== "string") {
      return new Response(JSON.stringify({ error: "appName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const API_KEY = Deno.env.get("FIREWORKS_API_KEY");
    if (!API_KEY) throw new Error("FIREWORKS_API_KEY not configured");

    const painText = Array.isArray(painPoints) && painPoints.length
      ? painPoints
          .slice(0, 6)
          .map((p: any, i: number) =>
            typeof p === "string"
              ? `[${i + 1}] ${p}`
              : `[${i + 1}] ${p.title ?? ""}: ${p.description ?? ""}`,
          )
          .join("\n")
      : "(No pain points provided.)";

    const langInstruction =
      language === "bn"
        ? `Write all textual values in Bangla (Bengali script). Keep array of techStack items in English (real tech names).`
        : language === "both"
          ? `For every textual value provide BOTH English and Bangla in this exact format: "English text || বাংলা টেক্সট". Keep techStack items in English only.`
          : `Write all textual values in clear, natural English.`;

    const userPrompt = `Design a startup MVP blueprint for this product opportunity.

App name / opportunity: ${appName}
Description: ${appDescription ?? "(none)"}

Validated user pain points from Reddit:
${painText}

${langInstruction}

Return ONLY this JSON object (no prose, no code fences):
{
  "mvpFeatures": ["string", "string", "string", "string", "string"],
  "techStack": ["string", "string", "string"],
  "targetUser": "string",
  "revenueModel": "string",
  "timeToMVP": "string e.g. 4-6 weeks",
  "firstMilestone": "string"
}

Provide exactly 5 mvpFeatures, 4-6 techStack items.`;

    const resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        temperature: 0.3,
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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
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
      return new Response(JSON.stringify({ error: `Blueprint failed (${resp.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("Empty model response");

    let parsed;
    try {
      parsed = extractJson(content);
    } catch {
      console.error("Blueprint JSON parse failed:", content.slice(0, 500));
      throw new Error("Model returned malformed JSON. Please retry.");
    }

    const blueprint = {
      mvpFeatures: Array.isArray(parsed.mvpFeatures) ? parsed.mvpFeatures.slice(0, 5) : [],
      techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
      targetUser: parsed.targetUser ?? "",
      revenueModel: parsed.revenueModel ?? "",
      timeToMVP: parsed.timeToMVP ?? "",
      firstMilestone: parsed.firstMilestone ?? "",
    };

    return new Response(JSON.stringify({ blueprint }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("blueprint error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
