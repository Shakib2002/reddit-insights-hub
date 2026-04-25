## Plan — 5 targeted fixes (no existing features removed)

### Fix 1 — Improved Signal Scoring (`supabase/functions/reddit-fetch/index.ts`)

Replace `scoreResult()` with a richer keyword/sub-bonus version:
- **High (+3 each)**: `wish`, `need`, `want`, `problem`, `hate`, `frustrated`, `annoying`, `broken`, `terrible`, `would pay`, `please build`, `someone should`
- **Medium (+2 each)**: `alternative`, `looking for`, `recommend`, `better than`, `switch from`, `replace`, `disappointed`, `missing feature`, `lacks`
- **Low (+1 each)**: `anyone else`, `how do you`, `what do you use`, `thoughts on`, `review`, `experience with`
- **+2 bonus** if subreddit is in: `startups, entrepreneur, SomebodyMakeThis, androidapps, productrequest, iosapps`

Score now applied to combined `title + snippet` (not separately), so values rise — boosting AVG Signal.

In `src/pages/Results.tsx`, retune `avgSignalLabel`:
- `>= 4` → "High"
- `>= 2` → "Medium"
- `< 2` → "Low"

### Fix 2 — More & richer Competitor Gaps (`supabase/functions/analyze/index.ts` + types + UI)

**Edge function (`analyze`)**:
- Update prompt: ask for **4–5 competitor gaps**, each must include a new `affectedTools` field naming concrete tools (Notion, Trello, Slack…).
- Update JSON schema in prompt and bump rule line ("Provide … 4-5 competitor gaps …").
- `normalizeAnalysis` propagates `affectedTools` through.

**Types (`src/lib/types.ts`)**: add `affectedTools?: string` to `CompetitorGap`.

**UI (`src/pages/Results.tsx`)** — Competitor Gaps card redesign:
- 3px **orange left border** (`border-l-[3px]` with destructive/orange hue)
- Bold gap title
- Description
- **Opportunity:** line in green (success color)
- "Affects: Notion, Trello…" rendered as small gray badges at the bottom
- Grid: `grid-cols-1 md:grid-cols-2`, equal card heights via `h-full` + flex column
- Show **all** gaps (currently only items past index 3 are shown — change split so opportunities = first 3, gaps = remaining ALL items, ensuring 4–5 cards visible)

### Fix 3 — Niche Opportunities → 3-column grid (`Results.tsx`)

Replace horizontal scroll chips with:
- `grid grid-cols-1 md:grid-cols-3 gap-3`
- Each card: clickable (keeps existing `searchNiche(n)`), 1px border, rounded, hover bg `primary/5`
- Header row: niche name (semibold) + size pill (Large=blue, Medium=amber, Small=gray) using existing tokens
- Description in muted text
- Footer line: "Click to research →" in primary color

Mobile: 1 column (already from `grid-cols-1`).

### Fix 4 — "Load 20 more Reddit posts and re-analyze →" button (`Results.tsx` + types)

Replace the current "Use more results (N)" ghost button with a prominent CTA:
- Label: **"Load 20 more Reddit posts and re-analyze →"**
- Loading state: "Loading more Reddit data…"
- On click:
  1. Call `reddit-fetch` with the existing keyword + `numResults: 20` and an extra body flag `extraQueries: true` so the edge function appends 3 more queries:
     - `${keyword} reddit problems 2024`
     - `${keyword} reddit complaints`
     - `${keyword} reddit suggestions`
  2. Merge new `results` with current `inputs.redditPosts`, **dedupe by `link`**, keep highest score on collision.
  3. Call `analyze` with the combined results.
  4. Update `data` + `sessionStorage` + `saveToHistory` (history continues to work; merged state persists as part of payload).
- Add a new `inputs.loadedMore?: boolean` flag in `SearchInputs` (types). When true:
  - Hide the Load-more button
  - Show muted line: **"✓ Analyzed {totalFound} total Reddit posts"**
- Posts Found StatCard: when `loadedMore`, render a small green "Updated" badge next to the value (extend `StatCard` with optional `successBadge` prop so we don't break the existing red `badge` for API issues).

**Edge function change**: `reddit-fetch` accepts optional `extraQueries: boolean`; when true, appends the 3 queries above to its existing query list (capped at `num: 20` per Serper call). No breaking change to existing callers.

### Fix 5 — Competitor Gaps grid sizing

Already covered in Fix 2: enforce `grid-cols-1 md:grid-cols-2`, `h-full` flex cards so heights match. All 4–5 gaps render (no slicing).

---

### Files touched
- `supabase/functions/reddit-fetch/index.ts` — new scoring fn, optional `extraQueries`
- `supabase/functions/analyze/index.ts` — prompt asks 4–5 gaps + `affectedTools`, normalizer passes it through
- `src/lib/types.ts` — `CompetitorGap.affectedTools?`, `SearchInputs.loadedMore?`
- `src/pages/Results.tsx` — scoring label thresholds, gaps UI/grid, niches grid, Load-more CTA + dedupe + post-load state, StatCard `successBadge`

### Out of scope / preserved
- History drawer, share links, Validate/Compare pages, Blueprint dialog, evidence search/filters, sentiment, personas, recommended subreddits, PDF print — all untouched.
- Niche click → new search behavior preserved.
- Existing red "API Key Issue?" badge preserved (new green "Updated" badge is additive).