import type { ResultsPayload, ComparePayload, ValidatePayload } from "./types";

// Encode payload as URL-safe base64 (handles unicode for Bangla)
// Uses TextEncoder instead of deprecated escape/unescape
export function encodeShare(data: ResultsPayload | ComparePayload | ValidatePayload): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShare<T = ResultsPayload | ComparePayload | ValidatePayload>(s: string): T | null {
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
