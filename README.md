# RedditLens 🔍

**AI-powered Reddit research for startup validation.**

Validate your startup idea in 30 seconds. Get pain points, revenue models, competitor gaps, and a build-or-skip verdict from real Reddit discussions.

🌐 **Live**: [redditlens.cc](https://redditlens.cc)

## Features

- 🎯 **Pain Point Detection** — Surface real frustrations from authentic Reddit threads
- 💰 **Revenue Models** — Pricing benchmarks, MRR potential, and monetization strategies
- ✅ **Build or Skip Verdict** — AI-powered go/no-go decision
- ⚔️ **Compare Mode** — Head-to-head keyword analysis (Pro)
- 🛡️ **Idea Validation** — 6-dimension scoring for your app concept
- 📊 **Competitor Intelligence** — Auto-discovered competitors with gap analysis
- 🧬 **MVP Blueprint** — AI-generated technical roadmap

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS + shadcn/ui |
| Backend | Supabase Edge Functions (Deno) |
| AI | Fireworks AI (DeepSeek v4 Pro) |
| Search | Serper API (Google-powered Reddit search) |
| Auth | Supabase Auth (Email + Google OAuth) |
| Payments | LemonSqueezy (Merchant of Record) |
| Hosting | Vercel |
| Database | Supabase PostgreSQL |

## Getting Started

```bash
# Clone
git clone https://github.com/Shakib2002/reddit-insights-hub.git
cd reddit-insights-hub

# Install
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Run dev server
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |

### Edge Function Secrets (set via Supabase CLI)

| Secret | Description |
|--------|-------------|
| `FIREWORKS_API_KEY` | Fireworks AI API key |
| `SERPER_API_KEY` | Serper.dev API key |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | LemonSqueezy webhook signing secret |

## Pricing

| Plan | Price | Features |
|------|-------|----------|
| Free | $0 | 3 searches/day, basic AI report |
| Founder | $2.99/mo | Unlimited searches, history sync, email digest |
| Pro | $9.99/mo | Compare mode, competitor intel, CSV/PDF export |
| Agency | $49/mo | 3 team seats, API access, white-label reports |

## Architecture

```
src/
├── components/        # Reusable UI components
│   ├── home/          # Landing page sections
│   ├── results/       # Results page sections
│   └── ui/            # shadcn/ui primitives
├── hooks/             # React hooks (auth, toast)
├── integrations/      # Supabase client
├── lib/               # Utilities (pricing, usage, types, errors)
└── pages/             # Route pages

supabase/
├── functions/         # 8 Edge Functions
│   ├── _shared/       # Shared CORS + AI utils
│   ├── analyze/       # AI analysis
│   ├── blueprint/     # MVP blueprint generator
│   ├── competitor/    # Competitor intelligence
│   ├── feed/          # Live pain feed
│   ├── fit/           # Founder-market fit
│   ├── lemonsqueezy-webhook/  # Payment webhook
│   ├── reddit-fetch/  # Reddit data fetcher
│   └── validate/      # Idea validation
└── migrations/        # PostgreSQL migrations
```

## License

Proprietary © 2026 Sanzox. All rights reserved.
