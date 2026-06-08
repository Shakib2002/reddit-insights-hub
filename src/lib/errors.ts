// Friendly error normalization for edge-function and network failures.
// Maps low-level Supabase / fetch errors into user-readable titles + descriptions.

export type FriendlyError = {
  title: string;
  description: string;
  hint?: string;
  /** which stage failed — useful for UI accent color */
  stage: "reddit" | "ai" | "validate" | "network" | "input" | "unknown";
  /** when true, the user should retry the same action */
  retryable: boolean;
};

function pickMessage(e: unknown): string {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || "";
  const anyE = e as any;
  // Supabase functions invoke errors carry a context.body JSON
  if (anyE?.context?.body) {
    try {
      const parsed = typeof anyE.context.body === "string" ? JSON.parse(anyE.context.body) : anyE.context.body;
      return parsed?.error || parsed?.message || anyE.message || "";
    } catch {
      return anyE.message ?? String(anyE);
    }
  }
  return anyE?.message ?? String(anyE);
}

export function toFriendlyError(
  e: unknown,
  stage: FriendlyError["stage"] = "unknown",
): FriendlyError {
  const raw = pickMessage(e).trim();
  const lower = raw.toLowerCase();

  // Network / connectivity
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("aborted") || lower.includes("timeout")) {
    return {
      title: "Connection problem",
      description: "We couldn't reach the analysis service. Check your internet connection and try again.",
      stage: "network",
      retryable: true,
    };
  }

  // Monthly free search limit
  if (lower.includes("monthly search limit") || lower.includes("rate_limited") || lower.includes("3/month")) {
    return {
      title: "🔒 Free searches used up",
      description: "You've used all 3 free searches this month. Upgrade to Pro for unlimited searches, deeper analysis, and priority support.",
      hint: "Your free searches reset on the 1st of each month.",
      stage: "rate_limit" as any,
      retryable: false,
    };
  }

  // AI gateway rate limit (different from monthly limit)
  if (lower.includes("rate limit") || raw.includes("429")) {
    return {
      title: "Rate limit reached",
      description: "The AI service is throttling requests. Wait a moment and try again.",
      hint: "Usually clears within 30 seconds.",
      stage: "ai",
      retryable: true,
    };
  }
  if (lower.includes("credits exhausted") || lower.includes("ai credits") || raw.includes("402")) {
    return {
      title: "AI credits exhausted",
      description: "Your AI service has run out of credits. Please check your Fireworks AI account.",
      stage: "ai",
      retryable: false,
    };
  }
  if (lower.includes("malformed json") || lower.includes("model returned")) {
    return {
      title: "AI response was invalid",
      description: "The AI returned an unexpected response. Please retry — this is usually a one-off glitch.",
      stage: "ai",
      retryable: true,
    };
  }
  if (lower.includes("fireworks_api_key") || lower.includes("lovable_api_key")) {
    return {
      title: "AI service not configured",
      description: "The AI API key is missing. Set FIREWORKS_API_KEY in your Supabase edge function secrets.",
      stage: "ai",
      retryable: false,
    };
  }

  // Reddit / Serper specific
  if (lower.includes("serper_api_key") || lower.includes("serper")) {
    return {
      title: "Reddit search unavailable",
      description: "The Reddit search service isn't configured correctly. We'll fall back to AI insights.",
      stage: "reddit",
      retryable: true,
    };
  }

  // Validation input errors
  if (lower.includes("keyword required")) {
    return {
      title: "Keyword is required",
      description: "Please enter a topic or product name to research.",
      stage: "input",
      retryable: false,
    };
  }

  // Stage-default fallback
  if (stage === "reddit") {
    return {
      title: "Couldn't fetch Reddit posts",
      description: raw || "Reddit search failed. We can still try to generate AI insights.",
      stage,
      retryable: true,
    };
  }
  if (stage === "ai") {
    return {
      title: "AI analysis failed",
      description: raw || "Something went wrong generating the report. Please retry.",
      stage,
      retryable: true,
    };
  }
  if (stage === "validate") {
    return {
      title: "Validation failed",
      description: raw || "Couldn't score your idea right now. Please retry.",
      stage,
      retryable: true,
    };
  }

  return {
    title: "Something went wrong",
    description: raw || "An unexpected error occurred. Please try again.",
    stage: "unknown",
    retryable: true,
  };
}

/**
 * Extract a user-facing error message from a Supabase edge function error.
 * Handles the common `error.context.body` JSON pattern.
 * Use this instead of inline `(error as any).context?.body` IIFEs.
 */
export function extractEdgeFunctionError(error: unknown): string {
  return pickMessage(error) || "An unexpected error occurred.";
}
