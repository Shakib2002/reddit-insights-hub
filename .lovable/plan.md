## Premium SaaS Visual Redesign — Plan

**Scope: VISUAL ONLY.** No changes to API routes, edge functions, search/validate/compare logic, history saving, autocomplete behavior, or component data flow. Only Tailwind tokens, class names, and structural JSX wrappers for styling.

---

### 1. Design tokens (`src/index.css`)

Replace the entire CSS variable block to enforce dark-only premium palette per spec:

- `:root` and `.dark` both set to dark values (no light mode):
  - `--background: 240 5% 4%` (#0A0A0B)
  - `--card / --popover: 240 4% 7%` (#111113)
  - `--secondary / --muted: 240 8% 11%` (#1A1A1F)
  - `--border / --input: 240 9% 18%` (#2A2A32)
  - `--foreground: 240 11% 96%` (#F5F5F7)
  - `--muted-foreground: 240 8% 59%` (#8E8EA0)
  - `--primary: 16 100% 50%` (#FF4500), `--primary-foreground: 0 0% 100%`
  - `--accent: 16 100% 10%`, `--ring: 16 100% 50%`
  - `--success: 142 71% 45%`, plus add CSS-only color utilities for verdict gradients
  - `--radius: 1rem` (16px)
- Force `<html>` to always have `dark` class (ThemeToggle becomes a no-op visually but is preserved — see step 7).
- Add base styles:
  - Inter font import in `index.html` `<head>` (`<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">`)
  - `body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }`
  - Custom scrollbar (thin, `#2A2A32` track, `#FF4500` thumb)
  - `::selection { background: rgba(255,69,0,0.3); }`
  - New utility classes: `.glow-primary`, `.shadow-card`, `.gradient-orange`, `.gradient-text-orange`, `.live-dot` (pulse animation)

### 2. `index.html`
- Add Inter font `<link>` tags (preconnect + stylesheet) in `<head>`.
- No other changes.

### 3. Navbar (`src/components/Header.tsx`)
- Background: `bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-[#2A2A32]`, height 60px.
- Logo: orange circle "R" + "Reddit" (white) + "Lens" (orange), weight 600.
- Right side: keep HistoryDrawer + ThemeToggle (rendered but visually styled as ghost; see step 7) + Sign in (outlined orange).
- Preserve `useAuth`, sign-out dropdown, navigate logic exactly.

### 4. Homepage (`src/pages/Index.tsx`) — markup-only restyle
- Keep ALL state, handlers, autocomplete, multi-subreddit logic, EXAMPLES/SUBREDDIT_SUGGESTIONS arrays unchanged.
- Hero: orange pill ("✦ Powered by AI · Real Reddit data"), 56–64px H1 split with gradient ("Worth Building"), subtitle (#8E8EA0), stats row with dot separators.
- Search card: `bg-[#111113] border-[#2A2A32] rounded-[20px] p-7 shadow-card max-w-[640px]`. Tab switcher pill (Search / Validate Idea) styled as `bg-[#1A1A1F]` segmented control. Inputs restyled (dark fields, orange focus ring with `0 0 0 3px rgba(255,69,0,0.1)`). Subreddit chips → pill style. Language toggle → 3 styled pill buttons (En/বাংলা/Both). Analyze button → orange gradient, 52px, glow shadow.
- Example chips: pill style, hover orange.
- Live Pain Feed wrapper: add "● LIVE FROM REDDIT" label with red pulse dot above existing `<LivePainFeed />` (component itself untouched; only its outer wrapper gets new label and a section background). NOTE: card visuals inside LivePainFeed already use `Card`/`Badge` and will inherit new tokens automatically.
- Add Features section, How It Works, Stats Bar, Footer per spec (these already exist in current Index.tsx — restyle classes only, do not duplicate or remove).
- Decorative blobs: keep but tone down to match new dark palette (orange at 8–15% opacity).

### 5. LivePainFeed (`src/components/LivePainFeed.tsx`)
- Update card classes only: `bg-[#111113] border border-[#2A2A32] hover:border-primary hover:-translate-y-0.5 transition-all rounded-xl`. No logic touched.

### 6. Results page (`src/pages/Results.tsx`) + result section components
- Sticky `SectionNav` (`src/components/SectionNav.tsx`): restyle wrapper to `bg-[#0A0A0B]/90 backdrop-blur-xl border-b border-[#2A2A32]`; active link → primary, inactive → muted.
- Stats bar: 5 metrics in `bg-card border rounded-2xl` row with vertical dividers, 28px white numbers, uppercase 11px labels.
- `BuildOrSkipVerdict`: replace `verdictStyles` map with new gradient backgrounds (`linear-gradient(135deg, #0D2818, #0F2E1A)` etc) + 30%-opacity colored borders + matching glow.
- Pain Point cards: `bg-[#1A1A1F] border-l-[3px] border-l-destructive rounded-xl`.
- App Opportunity cards: top 3px orange border; "Get Blueprint →" outlined-orange button (hover fills).
- Competitor Gap cards: left 3px green border; "Affects:" → pill tags.
- `RevenueModelsSection`: recommended card → orange-tinted border + "⭐ Recommended" pill.
- Sentiment bars: track `#1A1A1F`, fills green/muted/red, fully rounded.
- Niche grid cards: `bg-[#1A1A1F]`, hover orange border, "Click to research →" orange.
- Reddit evidence: search input + post hover row restyled.
- Bottom action buttons: 3 outlined ghost + 1 solid orange-gradient "Copy Report" (h-11, rounded-[10px]).
- Loading overlay: dark backdrop 80% + centered LoadingSteps card with new tokens.

### 7. ThemeToggle (`src/components/ThemeToggle.tsx`)
- Per spec "Dark mode is the ONLY mode." Two options:
  - **(A) Recommended:** Remove the toggle from the Header but keep the file (no functional removal of features). The component still exists for any future re-introduction.
  - (B) Keep visible but lock to dark (toggle becomes inert).
- I will go with **(A)**: remove ThemeToggle from `Header.tsx` only. File untouched.
- Force `document.documentElement.classList.add('dark')` once in `src/main.tsx` (one-line addition) so existing `dark:` Tailwind classes throughout all components keep working.

### 8. Validate page (`src/pages/Validate.tsx`) and Compare page (`src/pages/Compare.tsx`)
- Light visual restyle of containers, cards, and verdict colors to match new dark tokens. No logic changes. Will inherit most styling automatically from token updates; only adjust hardcoded color classes.

### 9. Tailwind (`tailwind.config.ts`)
- Extend `keyframes`: add `pulse-dot`, `fade-up`, `marquee` (for Live feed if needed).
- Extend `fontFamily`: `display: ['Inter', 'sans-serif']`.
- Extend `boxShadow`: `card`, `glow`.
- Extend `borderRadius`: keep current `lg/md/sm` mapping (already maps to `--radius`).

---

### Files to modify
1. `index.html` — Inter font links
2. `src/index.css` — full token rewrite + utilities + scrollbar
3. `src/main.tsx` — force `dark` class on html
4. `tailwind.config.ts` — keyframes, fontFamily, shadows
5. `src/components/Header.tsx` — restyle + remove ThemeToggle from layout
6. `src/components/LivePainFeed.tsx` — card class restyle only
7. `src/components/SectionNav.tsx` — wrapper restyle
8. `src/components/LoadingSteps.tsx` — minor styling polish (border, bg)
9. `src/components/results/BuildOrSkipVerdict.tsx` — verdictStyles map rewrite
10. `src/components/results/RevenueModelsSection.tsx` — recommended-card pill restyle
11. `src/components/results/CompetitorIntelSection.tsx` — pill/badge classes
12. `src/components/results/FounderFitSection.tsx` — card classes
13. `src/components/results/TrendStatCard.tsx` — bg/border classes
14. `src/components/results/WeeklyDigestSignup.tsx` — card classes
15. `src/pages/Index.tsx` — markup wrapper + class restyle (handlers/state untouched)
16. `src/pages/Results.tsx` — class restyle on stats bar, cards, action buttons
17. `src/pages/Validate.tsx` — verdict colors, card classes
18. `src/pages/Compare.tsx` — card classes

### What will NOT change
- ❌ No edge function edits (`supabase/functions/**`)
- ❌ No changes to `runOneSearch`, `runValidate`, `runQuickSearch`, autocomplete logic, multi-subreddit parsing, `handleSubmit`
- ❌ No changes to history/db saving, auth flow, navigation, sessionStorage keys
- ❌ No removal of existing features (validate mode, compare mode, examples, advanced settings, language toggle, autocomplete)
- ❌ No new dependencies
- ❌ No changes to `src/integrations/supabase/**` or `src/lib/**`

### Acceptance checks
- TypeScript build passes (`tsc --noEmit`).
- Search, Validate, Compare flows still navigate to correct pages.
- Mobile responsive (search card stacks, hero scales 32→64px).
- All `dark:` classes still work because `<html>` has `dark` class.
- No light flash on first load.