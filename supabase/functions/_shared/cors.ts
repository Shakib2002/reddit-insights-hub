/**
 * Shared CORS + JSON utilities for all Supabase edge functions.
 * Import with: import { getCorsHeaders, extractJson } from "../_shared/cors.ts";
 */

const ALLOWED_ORIGINS = [
  "https://redditlens.cc",
  "https://www.redditlens.cc",
  "https://reddit-insights-hub.vercel.app",
  "https://reddit-insights-hub.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

/** Build CORS headers for the given request, restricting to known origins. */
export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-fp",
    "Vary": "Origin",
  };
}

/** Handle CORS preflight. Returns a Response if it's an OPTIONS request, null otherwise. */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}

/** Extract a JSON object from AI model text that may include markdown fences. */
export function extractJson(text: string): any {
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  let jsonStr = candidate.slice(start, end + 1);

  // Attempt 1: direct parse
  try { return JSON.parse(jsonStr); } catch { /* continue to repair */ }

  // Attempt 2: basic cleanup
  let cleaned = jsonStr
    // Remove trailing commas before } or ]
    .replace(/,\s*([}\]])/g, "$1")
    // Remove control characters (keep printable + unicode)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
    // Replace literal newlines/tabs inside the string with escaped versions
    .replace(/\t/g, "\\t");

  // Replace unescaped newlines inside JSON string values
  // Walk through and only escape newlines that are inside quotes
  let inString = false;
  let escaped = false;
  let result = "";
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) { result += ch; escaped = false; continue; }
    if (ch === "\\") { result += ch; escaped = true; continue; }
    if (ch === '"') { result += ch; inString = !inString; continue; }
    if (inString && ch === "\n") { result += "\\n"; continue; }
    if (inString && ch === "\r") { result += "\\r"; continue; }
    result += ch;
  }

  try { return JSON.parse(result); } catch { /* continue */ }

  // Attempt 3: bracket-balanced substring
  let depth = 0, bestEnd = -1;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === "{") depth++;
    else if (result[i] === "}") { depth--; if (depth === 0) { bestEnd = i; break; } }
  }
  if (bestEnd > 0) {
    try { return JSON.parse(result.slice(0, bestEnd + 1)); } catch { /* give up */ }
  }

  throw new Error("Failed to parse JSON from model output");
}

/** Fireworks AI gateway URL */
export const AI_GATEWAY_URL = "https://api.fireworks.ai/inference/v1/chat/completions";

/** Default model for heavy analysis tasks */
export const MODEL = "accounts/fireworks/models/deepseek-v4-pro";

/** Get the Fireworks API key or throw */
export function getApiKey(): string {
  const key = Deno.env.get("FIREWORKS_API_KEY");
  if (!key) throw new Error("FIREWORKS_API_KEY not configured");
  return key;
}

/** Build an error response with CORS headers */
export function errorResponse(
  corsHeaders: Record<string, string>,
  message: string,
  status = 500,
) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Build a success JSON response with CORS headers */
export function jsonResponse(
  corsHeaders: Record<string, string>,
  data: unknown,
  extraHeaders?: Record<string, string>,
) {
  return new Response(
    JSON.stringify(data),
    { headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders } },
  );
}

// ---------- Auth middleware ----------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Create a Supabase admin client (service_role) */
export function createSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

export interface AuthResult {
  userId: string | null;
  tier: string;
}

/**
 * Verify the Authorization header JWT and return user info + tier.
 * For public-facing endpoints that allow anonymous access, set `required: false`.
 * Returns an error Response if auth is required but missing/invalid.
 */
export async function verifyAuth(
  req: Request,
  corsHeaders: Record<string, string>,
  options: { required?: boolean } = {},
): Promise<{ auth: AuthResult } | { error: Response }> {
  const { required = false } = options;
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (required) {
      return { error: errorResponse(corsHeaders, "Authentication required", 401) };
    }
    return { auth: { userId: null, tier: "free" } };
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = createSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      if (required) {
        return { error: errorResponse(corsHeaders, "Invalid or expired token", 401) };
      }
      return { auth: { userId: null, tier: "free" } };
    }

    // Fetch subscription tier
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .maybeSingle();

    return {
      auth: {
        userId: user.id,
        tier: (profile?.subscription_tier as string) ?? "free",
      },
    };
  } catch {
    if (required) {
      return { error: errorResponse(corsHeaders, "Auth verification failed", 401) };
    }
    return { auth: { userId: null, tier: "free" } };
  }
}

// ---------- Rate limiting ----------

const FREE_MONTHLY_LIMIT = 3;

const rateLimitResponse = (corsHeaders: Record<string, string>, monthStart: string) =>
  new Response(
    JSON.stringify({
      error: "Monthly search limit reached (3/month on free plan). Upgrade for unlimited searches.",
      code: "RATE_LIMITED",
      limit: FREE_MONTHLY_LIMIT,
      resetAt: monthStart,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": "86400",
      },
    },
  );

/**
 * Server-side rate limiting for free users.
 * Uses DUAL-KEY enforcement: checks both user_id AND IP separately.
 * Even if a user creates a new account, the same IP/device is still blocked.
 * Also accepts x-device-fp header for browser fingerprint tracking.
 * Paid users always pass.
 */
export async function checkRateLimit(
  req: Request,
  corsHeaders: Record<string, string>,
  auth: AuthResult,
  endpoint = "search",
): Promise<Response | null> {
  // Paid users have unlimited access
  if (auth.tier !== "free") return null;

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const deviceFp = req.headers.get("x-device-fp")?.trim();

  // Build all keys to check — ANY key exceeding limit = blocked
  const keys: string[] = [];
  if (auth.userId) keys.push(auth.userId);
  if (clientIp !== "unknown") keys.push(`ip:${clientIp}`);
  if (deviceFp && deviceFp.length > 8) keys.push(`fp:${deviceFp}`);
  // Fallback: if no keys at all, use IP
  if (keys.length === 0) keys.push(`ip:unknown`);

  // First day of current month
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01T00:00:00Z`;

  try {
    const supabase = createSupabaseAdmin();

    // Check ALL keys — if ANY key has hit the limit, block
    for (const key of keys) {
      const { count, error: countError } = await supabase
        .from("rate_limits")
        .select("*", { count: "exact", head: true })
        .eq("key", key)
        .eq("endpoint", endpoint)
        .gte("created_at", monthStart);

      if (countError) {
        console.error("Rate limit check failed:", countError);
        continue; // Skip this key, check others
      }

      if ((count ?? 0) >= FREE_MONTHLY_LIMIT) {
        return rateLimitResponse(corsHeaders, monthStart);
      }
    }

    // Record usage under ALL keys so switching accounts doesn't help
    const inserts = keys.map((key) => ({ key, endpoint }));
    await supabase.from("rate_limits").insert(inserts);
    return null;
  } catch (e) {
    console.error("Rate limit error:", e);
    // Fail open
    return null;
  }
}
