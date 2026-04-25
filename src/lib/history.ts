import type { HistoryItem, ResultsPayload, ValidatePayload } from "./types";

const KEY = "redditlens_history";
const MAX = 10;

export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveToHistory(payload: ResultsPayload) {
  const item: HistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    keyword: payload.inputs.keyword,
    timestamp: Date.now(),
    painScore: Math.round(payload.analysis.ideaMatchScore || 0),
    summary: payload.analysis.summary || "",
    payload,
    kind: "search",
  };
  const list = [item, ...getHistory().filter((h) => h.keyword !== item.keyword || h.kind === "validate")].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function saveValidationToHistory(payload: ValidatePayload) {
  const item: HistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    keyword: payload.inputs.keyword,
    timestamp: Date.now(),
    painScore: Math.round(payload.validation.overallScore || 0),
    summary: payload.validation.verdictReason || payload.validation.verdict,
    payload,
    kind: "validate",
  };
  const list = [
    item,
    ...getHistory().filter(
      (h) => !(h.keyword === item.keyword && h.kind === "validate"),
    ),
  ].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}
