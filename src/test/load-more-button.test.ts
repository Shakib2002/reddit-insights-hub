import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * UI regression: the "Load 20 more Reddit posts and re-analyze" button
 * must keep its outlined style with a ↓ icon and the exact label.
 *
 * If a future edit (or hot-reload mishap) reverts it to the old
 * `<Plus />` icon or appends a trailing "→", this test fails loudly.
 */
const RESULTS_SRC = readFileSync(
  resolve(__dirname, "../pages/Results.tsx"),
  "utf8",
);

const EXPECTED_LABEL = "Load 20 more Reddit posts and re-analyze";

describe("Load More button (Results page)", () => {
  it("renders the exact label exactly once", () => {
    const occurrences = RESULTS_SRC.split(EXPECTED_LABEL).length - 1;
    expect(occurrences).toBe(1);
  });

  it("uses a ↓ arrow icon next to the label", () => {
    // The down-arrow span must appear within ~120 chars before the label.
    const idx = RESULTS_SRC.indexOf(EXPECTED_LABEL);
    expect(idx).toBeGreaterThan(-1);
    const window = RESULTS_SRC.slice(Math.max(0, idx - 200), idx);
    expect(window).toMatch(/↓/);
  });

  it("does NOT use the old <Plus /> icon for the load-more button", () => {
    const idx = RESULTS_SRC.indexOf(EXPECTED_LABEL);
    const window = RESULTS_SRC.slice(Math.max(0, idx - 400), idx);
    expect(window).not.toMatch(/<Plus\b/);
  });

  it("does NOT append a trailing → arrow after the label", () => {
    // Match the label followed by optional whitespace and a trailing →
    expect(RESULTS_SRC).not.toMatch(
      new RegExp(`${EXPECTED_LABEL}\\s*→`),
    );
  });

  it("uses the proper outlined orange button styling", () => {
    const idx = RESULTS_SRC.indexOf(EXPECTED_LABEL);
    const block = RESULTS_SRC.slice(Math.max(0, idx - 400), idx);
    // Key style markers from the agreed design
    expect(block).toMatch(/border-primary\b/);
    expect(block).toMatch(/text-primary\b/);
    expect(block).toMatch(/rounded-lg\b/);
  });
});
