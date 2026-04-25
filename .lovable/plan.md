## Homepage SaaS-Style Redesign

Redesign `src/pages/Index.tsx` with a premium SaaS look while keeping ALL existing functionality (search, validate, compare modes, LivePainFeed, examples, history saving) untouched.

### Changes

**1. `src/pages/Index.tsx` — UI markup only**
- **Hero section**: Add "✨ Powered by AI" trust pill, large gradient headline ("Find Real Problems Worth Building"), subheadline, social-proof line ("2,400+ ideas analyzed by founders").
- **Search card**: Wrap existing search/mode/validate/compare form in an elevated card with gradient border glow, subtle backdrop-blur. Keep ALL existing inputs, toggles, buttons, and handlers as-is.
- **Background polish**: Add decorative gradient blobs (absolute positioned, blurred orange/accent) behind hero — pointer-events-none.
- **Feature highlights** (new section, below LivePainFeed): 3 icon cards — "🎯 Pain Point Detection", "💰 Revenue Analysis", "✅ Build/Skip Verdict".
- **How It Works** (new section): 3 numbered steps — Search → Analyze → Get Insights.
- **Stats strip** (new section): "10K+ posts analyzed", "<60s to validate", "500+ founders".
- **Footer** (new section): Tagline + copyright.
- Add `animate-fade-in` with staggered delays via inline style on each new section.

**2. `tailwind.config.ts`** — extend animations
- Add `fade-in` keyframe + animation utility (currently only `accordion-*` exist).

**3. `src/index.css`** — minor utilities
- Add `.animate-fade-in` helper if needed; add gradient utility for blob backgrounds.

### Strict Constraints
- ❌ No changes to search logic, `runOneSearch`, `runValidate`, mode state, form validation, navigation, session/history saving.
- ❌ No removal of existing example chips, LivePainFeed, validate/compare toggles.
- ❌ No edits to `Header.tsx`, results pages, or API routes.
- ✅ Existing form inputs reused as-is inside the new card wrapper.
- ✅ Mobile responsive (single column on small screens).
- ✅ Works in both light and dark themes via existing CSS tokens.

### Files Modified
- `src/pages/Index.tsx` (markup wrap + new sections)
- `tailwind.config.ts` (add fade-in animation)
- `src/index.css` (optional utility additions)