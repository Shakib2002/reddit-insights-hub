import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Results-page structural audit.
 *
 * Locks in:
 *  - exactly the intended sections (no duplicates like a second
 *    "View Source Posts" list after we removed it),
 *  - prompt-driven count targets in supabase/functions/analyze
 *    (pain points 5-7, competitor gaps exactly 4, niches 4-6, etc.).
 *
 * These are static-source checks — fast, deterministic, no rendering.
 */

const ROOT = resolve(__dirname, "../..");
const RESULTS_SRC = readFileSync(
  resolve(ROOT, "src/pages/Results.tsx"),
  "utf8",
);
const ANALYZE_SRC = readFileSync(
  resolve(ROOT, "supabase/functions/analyze/index.ts"),
  "utf8",
);

/** Count case-sensitive substring occurrences. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("Results page — section uniqueness", () => {
  it("renders the Reddit Evidence section heading exactly once", () => {
    // Match only as JSX text (between > and <), so comments/prose don't count.
    const matches = RESULTS_SRC.match(/>\s*Reddit Evidence\s*</g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("does NOT render a 'View Source Posts' section anywhere", () => {
    // The Reddit Evidence section already lists the source posts.
    // We removed the duplicate "View Source Posts" block, so the literal
    // heading text must not appear in the JSX.
    expect(RESULTS_SRC).not.toMatch(/>\s*View Source Posts\s*</);
  });

  it("renders each top-level report section heading exactly once", () => {
    const SINGLE_HEADINGS = [
      "Pain Points",
      "Competitor Gaps",
      "Niche Opportunities",
      "Potential First Users",
      "Recommended Subreddits",
      "Summary",
    ];
    for (const h of SINGLE_HEADINGS) {
      // Match the heading as visible JSX text (allow surrounding whitespace).
      const re = new RegExp(`>\\s*${h}\\s*<`, "g");
      const matches = RESULTS_SRC.match(re) ?? [];
      expect(
        matches.length,
        `Section heading "${h}" should appear exactly once in JSX (found ${matches.length})`,
      ).toBe(1);
    }
  });
});

describe("Analyze prompt — count targets", () => {
  it("requires 5 to 7 pain points from different angles", () => {
    expect(ANALYZE_SRC).toMatch(/5\s*to\s*7\s*pain points/i);
    expect(ANALYZE_SRC).toMatch(/different angle/i);
  });

  it("requires EXACTLY 4 competitor gaps (max 5)", () => {
    expect(ANALYZE_SRC).toMatch(/EXACTLY\s*4\s*competitor gaps/);
    expect(ANALYZE_SRC).toMatch(/Never return fewer than 4/i);
  });

  it("requires 4 to 6 niche opportunities with mixed sizes", () => {
    expect(ANALYZE_SRC).toMatch(/4\s*to\s*6\s*niche/i);
    expect(ANALYZE_SRC).toMatch(/Large.*Medium.*Small/i);
  });

  it("requires the affectedTools field for competitor gaps", () => {
    // The UI relies on this field to render the "Affected tools" badges.
    expect(ANALYZE_SRC).toMatch(/affectedTools/);
  });
});

describe("Avg Signal thresholds (UI)", () => {
  it("uses High >= 6, Medium >= 4, Low < 4", () => {
    // Locks the thresholds we just tuned so the UI never silently
    // drifts back to the old (too-lenient) values.
    expect(RESULTS_SRC).toMatch(/avg\s*>=\s*6\)\s*return\s*"High"/);
    expect(RESULTS_SRC).toMatch(/avg\s*>=\s*4\)\s*return\s*"Medium"/);
    expect(RESULTS_SRC).toMatch(/return\s*"Low"/);
  });
});
