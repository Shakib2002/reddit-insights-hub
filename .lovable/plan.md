# RedditLens — Full Improvement Plan

Implemented in 5 phases. Each phase is independently shippable so we can stop/adjust at any point.

---

## Phase 1 — Refactor `Results.tsx` (maintainability)

**Why:** File is ~1050 lines, hard to evolve safely.

**Changes:**
- Split `src/pages/Results.tsx` into focused components under `src/components/results/`:
  - `StatBar.tsx` (top stats row + `StatCard`)
  - `SummarySection.tsx`
  - `PainPointsSection.tsx` (+ `PainPointCard`)
  - `RedditEvidence.tsx` (search/filter list)
  - `SentimentSection.tsx` (+ `Bar`, `SentimentBars`)
  - `OpportunitiesSection.tsx`
  - `CompetitorGapsSection.tsx`
  - `NichesSection.tsx`
  - `FirstUsersSection.tsx`
  - `ResultsActionBar.tsx` (share / copy / export PDF / blueprint)
  - `LoadMoreButton.tsx` (the orange outlined button — keeps regression tests valid)
- Extract logic into hooks:
  - `src/hooks/useResultsPayload.ts` — load from `?data=` or sessionStorage
  - `src/hooks/useRerunWithMore.ts` — fetch + merge + re-analyze flow
- Keep all existing section IDs, headings, classNames, and copy intact so `results-audit.test.ts` and `load-more-button.test.ts` continue to pass.

---

## Phase 2 — Auth + persistent searches (Lovable Cloud)

**Why:** Today, refresh loses everything; share links carry full payload in URL.

**Backend (migration):**
- `profiles` table (id → auth.users, display_name, created_at) + RLS (own row).
- `app_role` enum + `user_roles` table + `has_role()` SECURITY DEFINER (per security guidelines).
- `searches` table:
  - `id uuid pk`, `user_id uuid`, `kind text check in ('search','validate','compare')`,
  - `keyword text`, `app_idea text`, `subreddit text`,
  - `payload jsonb`, `pain_score int`, `summary text`,
  - `is_public bool default false`, `created_at timestamptz default now()`.
  - RLS: owner full access; anon SELECT only when `is_public = true`.
- Trigger: auto-create `profiles` row on signup.

**Auth pages:**
- `/auth` with email+password and Google sign-in (per defaults).
- Session via `onAuthStateChange` + `getSession`, stored in a `useAuth` hook.
- Header: show Sign in / avatar menu (Sign out).

**App wiring:**
- Save searches to DB when logged in (in addition to current localStorage history fallback for guests).
- `HistoryDrawer`: when logged in, read from `searches` table; otherwise localStorage.
- `/results?id=<uuid>` loads from DB (public or owned). Existing `?data=` short-link kept for back-compat.
- "Make public" toggle on results page → returns short `/results?id=…` link.

---

## Phase 3 — Edge function hardening

**`supabase/functions/reddit-fetch/index.ts`:**
- Zod validation of body (`keyword`, optional `subreddit`, `numResults`, `extraQueries`).
- Graceful Serper failure: if `anyOk === false`, return `{ results: [], serperOk: false, lowData: true }` with a clear `error` field. Frontend already surfaces `serperOk`.
- Simple in-memory IP rate limit (e.g. 20 req / 5 min per IP) with 429 response.

**`supabase/functions/analyze/index.ts` and `validate/index.ts`:**
- Zod validation of payload.
- Refuse to call AI when `posts.length === 0` → return a structured "insufficient data" payload so UI can show a friendly empty state instead of hallucinated analysis.
- Same lightweight IP rate limit.

**Frontend (`runOneSearch` in `Index.tsx`):**
- If `serperOk === false` or `totalFound === 0`, show toast + skip analyze step and stay on form (don't navigate to a misleading report).

---

## Phase 4 — UX polish & accessibility

- **Exports:** Add "Copy as Markdown" and "Export CSV" (pain points + evidence) next to existing PDF/Share in `ResultsActionBar`.
- **Loading UI:** `LoadingSteps` — for the `ai` step show indeterminate sub-progress (animated bar) since AI calls take 5–20s; keep step model unchanged.
- **Accessibility:**
  - Sentiment bars: `role="img"` + `aria-label="Positive 40%, Neutral 50%, Negative 10%"`.
  - SectionNav links already have `aria-current` ✅; add `aria-label` to nav landmark.
  - Ensure all icon-only buttons have `aria-label`.
- **SEO:** Add `react-helmet-async` and per-page `<title>` + `<meta name="description">` (Index, Results, Validate, Compare). Dynamic title on Results: `"<keyword> — Reddit pain analysis | RedditLens"`.
- **i18n scaffold:** Install `react-i18next`, add `en` and `bn` resource files, wire the existing language toggle so static UI labels (buttons, headings) translate too — not just AI output.
- **Flow continuity:** From `/validate` and `/compare`, add a "Run full analysis" CTA that pre-fills `/` with the same keyword/idea.

---

## Phase 5 — Testing expansion

- **Component tests** (Vitest + Testing Library) for new split components: `StatBar`, `SentimentSection`, `LoadMoreButton`, `RedditEvidence` (filter behavior).
- **Edge function tests** (`supabase--test_edge_functions`):
  - `reddit-fetch`: validation errors, missing API key path, scoring math.
  - `analyze`: normalization (`normalizeSentiment`, `normalizeAnalysis` clamping).
  - `validate`: schema shape.
- **Audit suite extension** (`results-audit.test.ts`):
  - Assert each new section component is rendered exactly once on the page.
  - Assert SEO `<title>` is set on Results.

---

## Files added / changed (high-level)

**New:**
- `src/components/results/*` (10 files)
- `src/hooks/useResultsPayload.ts`, `src/hooks/useRerunWithMore.ts`, `src/hooks/useAuth.tsx`
- `src/pages/Auth.tsx`
- `src/lib/db-history.ts` (DB-backed history)
- `src/lib/exporters.ts` (markdown + CSV)
- `src/i18n/index.ts`, `src/i18n/en.json`, `src/i18n/bn.json`
- Migration: `profiles`, `user_roles`, `app_role`, `has_role`, `searches` + RLS + trigger
- Tests: `src/test/components/*.test.tsx`, `supabase/functions/*/index_test.ts`

**Edited:**
- `src/pages/Results.tsx` (slim shell composing new components — IDs/headings preserved)
- `src/pages/Index.tsx`, `src/pages/Validate.tsx`, `src/pages/Compare.tsx`
- `src/components/Header.tsx` (auth menu)
- `src/components/HistoryDrawer.tsx` (DB-aware)
- `supabase/functions/reddit-fetch/index.ts`, `analyze/index.ts`, `validate/index.ts`
- `src/App.tsx` (Helmet provider, `/auth` route)

**Preserved:**
- All current section IDs, headings, button label/icon (`↓ Load 20 more Reddit posts and re-analyze`), thresholds (High≥6 / Medium≥4), and existing audit tests.
