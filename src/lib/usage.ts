import { supabase } from "@/integrations/supabase/client";
import type { PlanTier } from "./pricing";

const MONTHLY_COUNT_KEY = "redditlens_monthly_searches";

interface MonthlyCount {
  month: string; // YYYY-MM
  count: number;
}

/** Get current month's search count from localStorage */
export function getMonthlySearchCount(): number {
  try {
    const raw = localStorage.getItem(MONTHLY_COUNT_KEY);
    if (!raw) return 0;
    const data: MonthlyCount = JSON.parse(raw);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    if (data.month !== currentMonth) return 0; // Reset at new month
    return data.count;
  } catch {
    return 0;
  }
}

/** Increment current month's search count */
export function incrementDailySearchCount(): void {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const current = getMonthlySearchCount();
  localStorage.setItem(
    MONTHLY_COUNT_KEY,
    JSON.stringify({ month: currentMonth, count: current + 1 }),
  );
}

/** Check if the user has reached their monthly search limit */
export function hasReachedLimit(tier: PlanTier): boolean {
  if (tier !== "free") return false; // Paid users have no limit
  return getMonthlySearchCount() >= 3;
}

/** Get remaining searches for this month */
export function getRemainingSearches(tier: PlanTier): number {
  if (tier !== "free") return Infinity;
  return Math.max(0, 3 - getMonthlySearchCount());
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
