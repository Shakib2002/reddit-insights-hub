## Problem
Google sign-in fail hocche. Auth logs e error: `400: Unsupported provider: provider is not enabled`. Mane backend e Google OAuth provider enable kora nai.

Code thik ache (`src/pages/Auth.tsx` e `signInWithOAuth({ provider: "google" })` properly call hocche) — shudhu backend config missing.

## Fix (1 step)

**Enable Google provider via Lovable Cloud managed OAuth**
- `supabase--configure_social_auth` tool call kore `providers: ["google"]` enable korbo
- Eta Lovable Cloud er managed Google credentials use korbe — apnar own Google Cloud Console setup lagbe na, instantly kaj korbe

## Code changes
Kono code change lagbe na. Existing `Auth.tsx` already correct — shudhu provider toggle on hobe backend e.

## Verification
Enable hoyar por `/auth` page e "Continue with Google" button click korle Google consent screen ashbe and sign-in complete hobe.
