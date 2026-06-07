import { supabase } from "@/integrations/supabase/client";
import type { PlanTier } from "./pricing";

const DAILY_COUNT_KEY = "redditlens_daily_searches";

interface DailyCount {
  date: string; // YYYY-MM-DD
  count: number;
}

/** Get today's search count from localStorage (works for free users without auth) */
export function getDailySearchCount(): number {
  try {
    const raw = localStorage.getItem(DAILY_COUNT_KEY);
    if (!raw) return 0;
    const data: DailyCount = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    if (data.date !== today) return 0; // Reset at midnight
    return data.count;
  } catch {
    return 0;
  }
}

/** Increment today's search count */
export function incrementDailySearchCount(): void {
  const today = new Date().toISOString().slice(0, 10);
  const current = getDailySearchCount();
  localStorage.setItem(
    DAILY_COUNT_KEY,
    JSON.stringify({ date: today, count: current + 1 }),
  );
}

/** Check if the user has reached their daily search limit */
export function hasReachedLimit(tier: PlanTier): boolean {
  if (tier !== "free") return false; // Paid users have no limit
  return getDailySearchCount() >= 3;
}

/** Get remaining searches for today */
export function getRemainingSearches(tier: PlanTier): number {
  if (tier !== "free") return Infinity;
  return Math.max(0, 3 - getDailySearchCount());
}

/**
 * Get the user's subscription tier from Supabase.
 * Falls back to "free" if no subscription record exists.
 */
export async function getUserTier(userId: string): Promise<PlanTier> {
  const { data } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .maybeSingle();
  return (data?.subscription_tier as PlanTier) ?? "free";
}
