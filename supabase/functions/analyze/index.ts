const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = "You are a Reddit research expert and startup advisor.";

const TOOL = {
  type: "function",
  function: {
    name: "submit_analysis",
    description: "Submit a structured Reddit research analysis.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2-3 sentence overview" },
        ideaMatchScore: { type: "number", description: "0-100" },
        painPoints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              source: { type: "string", description: "subreddit name without r/" },
              signal: { type: "string", enum: ["High", "Medium", "Low"] },
            },
            required: ["title", "description", "source", "signal"],
            additionalProperties: false,
          },
        },
        ideaValidation: {
          type: "object",
          properties: {
            matchPercentage: { type: "number" },
            reasons: { type: "array", items: { type: "string" } },
          },
          required: ["matchPercentage", "reasons"],
          additionalProperties: false,
        },
        competitorGaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              gap: { type: "string" },
              description: { type: "string" },
            },
            required: ["gap", "description"],
            additionalProperties: false,
          },
        },
        firstUserPersonas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              persona: { type: "string" },
              pain: { type: "string" },
            },
            required: ["persona", "pain"],
            additionalProperties: false,
          },
        },
        recommendedSubreddits: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "summary",
        "ideaMatchScore",
        "painPoints",
        "ideaValidation",
        "competitorGaps",
        "firstUserPersonas",
        "recommendedSubreddits",
      ],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { posts = [], keyword, appIdea } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const postsText = posts.length
      ? posts
          .slice(0, 25)
          .map(
            (p: any, i: number) =>
              `[${i + 1}] r/${p.subreddit} (↑${p.score}, ${p.num_comments} comments)\nTitle: ${p.title}\n${p.body ? `Body: ${p.body.slice(0, 400)}` : ""}`,
          )
          .join("\n\n")
      : "(No Reddit posts retrieved — rely on your training knowledge of Reddit discussions about this topic.)";

    const userPrompt = `Keyword/topic: ${keyword}
User's app idea: ${appIdea}

Reddit posts:
${postsText}

Analyze these discussions. Extract 4-5 pain points (with the source subreddit and an upvote signal of High/Medium/Low based on relative scores). Score how well the user's app idea matches those pain points (0-100). Identify 3 gaps in existing solutions. Suggest 3-4 fictional first-user personas (do NOT use real Reddit usernames — use descriptive labels like "Burned-out grad student"). Recommend 4-6 relevant subreddits (without the r/ prefix).`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "submit_analysis" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data).slice(0, 500));
      throw new Error("Model did not return structured analysis");
    }

    const analysis = JSON.parse(toolCall.function.arguments);
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
