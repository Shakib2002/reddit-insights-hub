## RedditLens — Reddit Research Platform

A free web app where users enter a keyword, app idea, and subreddit, and get an AI-powered structured analysis of Reddit discussions.

### Stack adaptations
- **React + Vite + Tailwind + shadcn/ui** (Lovable's stack, replacing Next.js)
- **Supabase Edge Functions** for server-side Reddit fetching + AI analysis (replacing `/api` routes, keeps everything off the client to avoid CORS and key exposure)
- **Lovable AI Gateway with Google Gemini 3 Flash** for the analysis (replacing Claude — zero setup)
- **Unauthenticated Reddit JSON endpoints** (`reddit.com/r/{sub}/search.json`) — no credentials needed
- **Light + dark mode** with a theme toggle

### Pages

**Homepage (`/`)**
- Minimal hero: "RedditLens" title + "Discover what Reddit really wants" subtitle
- Centered card form with three inputs: Keyword, Your app idea, Subreddit
- Prominent orange (#FF4500) "Analyze Reddit" button
- 6 clickable example chips that auto-fill the keyword field: mental health apps, productivity tools, food delivery, habit tracker, AI tools, journaling apps
- On submit: animated loading state cycling through "Fetching Reddit posts…", "Analyzing with AI…", "Building your report…"
- Theme toggle in the top-right header

**Results Page (`/results`)**
- Header: shows the keyword, idea, subreddit searched, plus a large circular orange "Idea Match Score" badge (0–100)
- **Section 1 — Summary:** 2–3 sentence overview card
- **Section 2 — Pain Points:** 4–5 cards with red left border, each showing title, source subreddit, and High/Medium/Low signal badge
- **Section 3 — Idea Validation:** match percentage + 3 bullet reasons
- **Section 4 — Competitor Gaps:** 3 cards with green left border
- **Section 5 — Potential First Users:** 3–4 persona cards with pain description
- **Section 6 — Recommended Subreddits:** clickable tag row that opens reddit.com in a new tab
- "Search Again" and "Copy Report" buttons at the bottom (Copy Report copies the full analysis as formatted text)

### Backend (Edge Functions on Lovable Cloud)

**`reddit-fetch`**
- Input: `{ keyword, subreddit }`
- Calls `https://www.reddit.com/r/{subreddit}/search.json?q={keyword}&restrict_sr=1&sort=top&limit=25` plus a broader `r/all` search for context
- Sets a proper User-Agent header
- Returns `[{ title, body, score, num_comments, subreddit }]`
- Graceful fallback if Reddit returns nothing or rate-limits

**`analyze`**
- Input: `{ posts, keyword, appIdea }`
- Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) using **tool calling** for guaranteed structured JSON output matching the spec schema (summary, ideaMatchScore, painPoints, ideaValidation, competitorGaps, firstUserPersonas, recommendedSubreddits)
- System prompt: "You are a Reddit research expert and startup advisor."
- If posts array is empty, the prompt tells the model to rely on its training knowledge of Reddit discussions about the topic
- Handles 402 (out of credits) and 429 (rate limited) errors and surfaces them to the UI as toast messages

### Design
- Clean white background (dark gray in dark mode)
- Reddit orange (#FF4500) as primary accent — wired into the design system as an HSL token
- Subtle gray-100 borders on cards, generous whitespace
- Mobile responsive layout
- Smooth fade transitions between loading states
- Clear error states with a "Try again" button

### Data flow
1. User submits form on `/` → results stored in `sessionStorage` and React Router navigates to `/results`
2. `/results` reads the inputs, calls `reddit-fetch`, then `analyze`, then renders sections
3. No login, no database — fully stateless and free

### What you'll need to provide after approval
Nothing — Lovable Cloud + Lovable AI are auto-configured. Reddit uses public endpoints, so no keys required.