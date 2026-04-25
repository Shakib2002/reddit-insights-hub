## Diagnosis

**Serper issue (Fix 2):** Edge function logs show `Serper error: 403 Unauthorized` for all 10 parallel queries — that's why the latest run returned `totalFound: 0`. The 5 broad + 5 subreddit queries themselves are fine; the API key is rejecting them. The user needs to **rotate `SERPER_API_KEY`** in Lovable Cloud secrets (current key appears invalid/expired). I'll also add the requested simpler fallback queries, structured logging, and a clean mapper so transient Serper hiccups degrade gracefully instead of returning empty.

**Layout:** `Results.tsx` currently shows: header → "Why these results" → Summary → Sentiment → Pain Points → Idea Validation → App Opportunities → Niches (cards) → First Users → Subreddits → Actions. There is **no stats bar, no Reddit evidence section, no empty-state placeholders**, and niches are full cards. Pain point cards have a separate "from r/x" line instead of a footer row.

---

## Plan

### 1. `supabase/functions/reddit-fetch/index.ts` — harden Serper layer
- Add 2 simple fallback queries (`reddit ${keyword}`, `reddit ${keyword} app review`) that run if the main 10 queries return zero combined organic results — guards against over-restrictive operators.
- Add structured logs: per-query `status`, `organic.length`, and a final `totalUnique` summary so debugging is one log line.
- Tighten the result mapper (`title || ""`, `snippet || ""`, `link || ""`, robust `extractSubreddit`, single `scoreResult(item)` call).
- Keep tiered scoring + cross-query boost intact.
- Return a new `serperOk: boolean` flag so the UI can distinguish "auth failed" from "no posts found".

### 2. `src/lib/types.ts` — extend `SearchInputs` / payload
- Add optional `redditPosts?: Array<{ title; snippet; link; subreddit; score }>` on `SearchInputs` so the Evidence section can render real posts.
- Add optional `serperOk?: boolean` and `totalFound?: number`.

### 3. `src/pages/Index.tsx` — propagate raw posts
- Pass `redditData.results`, `serperOk`, and `totalFound` into the `ResultsPayload.inputs` saved to sessionStorage / history / share.

### 4. `src/pages/Results.tsx` — full redesign per spec
Replace the current layout in this exact order:

1. **Hero Stats Bar** — 4 metric cards on `bg-[#FFF5F0]` (light orange) with bottom border. On mobile: 2x2 grid.
   - Pain Score (`ideaMatchScore`/100)
   - Posts Found (`inputs.totalFound ?? redditPosts.length`)
   - Avg Signal (derived from `rationale.avgScore` → "High/Medium/Low")
   - Top Subreddit (first of `effectiveSubreddits`)
2. **Yellow warning banner** when `serperOk === false` OR `totalFound === 0`: *"⚠️ No Reddit posts found. Showing AI-generated insights based on general knowledge. For real Reddit data, try a more specific keyword."*
3. **Summary** (single card, max 3 lines via `line-clamp-3`)
4. **Pain Points** — 2-col grid desktop, 1-col mobile. Each card:
   - 3px red left border, 16px padding (mobile + desktop)
   - Bold 16px title
   - Description: `line-clamp-2` with "Read more" toggle (local state per card)
   - Footer row: `[r/sub tag] [signal badge] [💰 commercial intent badge]` plus the existing "View on Reddit" link
   - Remove the standalone "from r/source" line
5. **Reddit Evidence** (NEW) — renders `inputs.redditPosts`. Each item: clickable title → opens link, r/subreddit chip, 1-line snippet (`line-clamp-1`), signal-score badge. Show top 5 with `Show all X posts →` toggle. Empty-state placeholder if none.
6. **Sentiment** — keep horizontal bars, compact padding.
7. **App Opportunities** — 3-col desktop / 1-col mobile. White card, **3px orange top border**, app name (16px bold), 2-line description, `Unique angle:` line in green italic (when `g.opportunity` exists), "Get Blueprint →" button at bottom.
8. **Competitor Gaps** — 2-col grid (separate section from opportunities, using same `competitorGaps` data but rendered as a compact info grid without Blueprint button). *Note: spec lists Opportunities and Gaps as separate sections but our analyzer merges them; I'll split visually — first 3 entries → Opportunities, remainder → Gaps. If only one set exists, hide the empty section with placeholder.*
9. **Niche Opportunities** — replace card grid with **horizontal scrollable chips**: `🎯 {niche} · {size}`. Click → `searchNiche(n)`. Use `overflow-x-auto` + `flex gap-2 snap-x`.
10. **Potential First Users** — compact 3-col grid (was 2-col), 1-col mobile. Keep persona + willingToPay badge.
11. **Recommended Subreddits** — keep as tags.
12. **Action Bar** — keep current 4 buttons (Search Again, Share, Export PDF, Copy Report). Move "Use more results" into a secondary row or icon button to keep the primary bar clean.

**Removed:**
- "Why these results" rationale card (data still exists in payload, just not rendered)
- "Idea Validation" section in Search mode (the 6-dimension validation lives in `/validate`)

**Empty-state helper:** small `<EmptyPlaceholder text="Not enough Reddit data found for this section" />` component used by Pain Points, Evidence, Opportunities, Gaps, Niches, Personas when their array is empty — never render a bare heading.

**Mobile:** all cards `p-4 md:p-5` (16px mobile), grids collapse to 1 col below `md`, stats bar uses `grid-cols-2 md:grid-cols-4`.

### 5. `src/lib/share.ts` / `src/lib/history.ts`
- No schema change needed — `inputs.redditPosts` rides along through existing JSON encoding.

### 6. ⚠️ Action required from you
After this code lands, **rotate the Serper API key**: the current `SERPER_API_KEY` is returning 403 Unauthorized on every request. Get a fresh key from https://serper.dev (free tier: 2,500 searches) and I'll update the secret. Until then, the warning banner will trigger and the analyzer falls back to general knowledge — exactly the graceful-degradation behavior Fix 2 calls for.

---

## Files touched
- `supabase/functions/reddit-fetch/index.ts` (harden + simpler fallback queries + logs)
- `src/lib/types.ts` (add `redditPosts`, `serperOk`, `totalFound`)
- `src/pages/Index.tsx` (propagate raw posts into payload)
- `src/pages/Results.tsx` (full layout redesign)

No DB migrations, no new edge functions, no new dependencies. Compare and Validate pages are untouched.