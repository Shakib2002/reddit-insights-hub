import type { ResultsPayload, ComparePayload, ValidatePayload } from "./types";

// Encode payload as URL-safe base64 (handles unicode for Bangla)
export function encodeShare(data: ResultsPayload | ComparePayload | ValidatePayload): string {
  const json = JSON.stringify(data);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShare<T = ResultsPayload | ComparePayload | ValidatePayload>(s: string): T | null {
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
