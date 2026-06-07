/**
 * Shared CORS + JSON utilities for all Supabase edge functions.
 * Import with: import { getCorsHeaders, extractJson } from "../_shared/cors.ts";
 */

const ALLOWED_ORIGINS = [
  "https://reddit-insights-hub.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

/** Build CORS headers for the given request, restricting to known origins. */
export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  return JSON.parse(candidate.slice(start, end + 1));
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
