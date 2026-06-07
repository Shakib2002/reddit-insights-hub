import { supabase } from "@/integrations/supabase/client";
import type {
  HistoryItem,
  ResultsPayload,
  ValidatePayload,
} from "./types";

type SearchRow = {
  id: string;
  kind: "search" | "validate" | "compare";
  keyword: string;
  pain_score: number | null;
  summary: string | null;
  payload: any;
  created_at: string;
  is_public: boolean;
};

function rowToItem(r: SearchRow): HistoryItem {
  return {
    id: r.id,
    keyword: r.keyword,
    timestamp: new Date(r.created_at).getTime(),
    painScore: r.pain_score ?? 0,
    summary: r.summary ?? "",
    payload: r.payload,
    kind: r.kind === "compare" ? "search" : r.kind,
  };
}

export async function dbSaveSearch(
  userId: string,
  payload: ResultsPayload,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("searches")
    .insert({
      user_id: userId,
      kind: "search",
      keyword: payload.inputs.keyword,
      app_idea: payload.inputs.appIdea ?? null,
      subreddit: payload.inputs.subreddit ?? null,
      pain_score: Math.round(payload.analysis.ideaMatchScore || 0),
      summary: payload.analysis.summary ?? "",
      payload: payload as unknown as any,
    })
    .select("id")
    .single();
  if (error) {
    console.error("dbSaveSearch failed", error);
    return null;
  }
  return data?.id ?? null;
}

export async function dbSaveValidation(
  userId: string,
  payload: ValidatePayload,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("searches")
    .insert({
      user_id: userId,
      kind: "validate",
      keyword: payload.inputs.keyword,
      app_idea: payload.inputs.appIdea ?? null,
      subreddit: payload.inputs.subreddit ?? null,
      pain_score: Math.round(payload.validation.overallScore || 0),
      summary: payload.validation.verdictReason || payload.validation.verdict,
      payload: payload as unknown as any,
    })
    .select("id")
    .single();
  if (error) {
    console.error("dbSaveValidation failed", error);
    return null;
  }
  return data?.id ?? null;
}

export async function dbListHistory(userId: string): Promise<HistoryItem[]> {
  const { data, error } = await supabase
    .from("searches")
    .select("id, kind, keyword, pain_score, summary, payload, created_at, is_public")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    console.error("dbListHistory failed", error);
    return [];
  }
  return (data ?? []).map(rowToItem);
}

export async function dbDeleteSearch(id: string): Promise<boolean> {
  const { error } = await supabase.from("searches").delete().eq("id", id);
  if (error) {
    console.error("dbDeleteSearch failed", error);
    return false;
  }
  return true;
}

export async function dbGetPublicSearch(id: string) {
  const { data, error } = await supabase
    .from("searches")
    .select("payload, kind")
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as { payload: any; kind: "search" | "validate" | "compare" };
}

export async function dbSetPublic(id: string, isPublic: boolean): Promise<boolean> {
  const { error } = await supabase
    .from("searches")
    .update({ is_public: isPublic })
    .eq("id", id);
  if (error) {
    console.error("dbSetPublic failed", error);
    return false;
  }
  return true;
}
