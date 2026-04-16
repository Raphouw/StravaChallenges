# Strava Challenge Extension - Project Context

## Project Overview

A full-stack Strava segment challenge platform with a Chrome MV3 extension, Next.js public dashboard, and Vercel serverless API. Users can create challenges on specific Strava segments, invite friends to compete, and track leaderboard rankings with enriched statistics.

**Tech Stack:** React, TypeScript, Next.js, Supabase PostgreSQL, Vercel Functions, Chrome MV3, Tailwind CSS

---

## Architecture

```
packages/
├── api/                    → Vercel serverless functions (4 consolidated handlers)
├── extension/              → Chrome MV3 extension
├── dashboard/              → Next.js public dashboard
└── shared-types/           → Shared TypeScript interfaces (if used)
```

---

## API Layer (`packages/api/`)

**Status:** ✅ Complete - 4 consolidated serverless functions (under Vercel Hobby plan limit of 12)

### Consolidated Handlers

Each function routes multiple endpoints via path-based dispatch:

#### 1. **auth.ts** - Authentication & Token Management
- `GET /api/auth/strava` → Initiates Strava OAuth flow
- `GET /api/auth/callback` → OAuth callback handler (creates/updates user, generates JWT)
- `POST /api/auth/refresh` → Validates JWT, refreshes expired Strava tokens

**Key Features:**
- Strava OAuth 2.0 integration with token encryption/decryption
- Automatic token refresh before expiry
- JWT generation for session management
- User creation on first login

---

#### 2. **challenges.ts** - Challenge Management (9 endpoints consolidated)

**Create Challenge**
- `POST /api/challenges/create` → Creates new challenge, fetches segment details from Strava, adds creator as member, triggers historical backfill if starts_at < now

**List Challenges**
- `GET /api/challenges/list` → Lists challenges user owns/participates in (auth required)
- `GET /api/challenges/list-public` → Lists all challenges without auth (for dashboard)

**Challenge Interaction**
- `POST /api/challenges/join` → Joins challenge by invite code (prevents joining own challenge)
- `DELETE /api/challenges/delete` → Deletes challenge (owner or admin only)

**Leaderboard & Stats**
- `GET /api/challenges/leaderboard?id=<challengeId>` → Fetches leaderboard with enriched per-user stats:
  - `best_time`, `avg_time`, `last_attempt`, `streak`, `delta_from_leader`
  - Group totals: `total_attempts`, `total_distance`, `total_elevation`, `active_participants`
  - Segment info with Strava metadata

- `GET /api/challenges/public?slug=<slug>` → Public endpoint for dashboard to fetch challenge details + leaderboard

**Backfill (Historical Activity Capture)**
- `POST /api/challenges/backfill` → Fire-and-forget backfill for all members (called after challenge creation if starts_at < now)
- `POST /api/challenges/manual-backfill` → Manual trigger endpoint for challenge owner

**Backfill Implementation Details:**
- For each challenge member, fetches their Strava activities from challenge start date to now
- Checks each activity's segment efforts against challenge segments
- Inserts matching efforts into database (deduplicates by `strava_effort_id`)
- Handles automatic token refresh for expired Strava tokens
- Runs as background job (fire-and-forget) for performance

---

#### 3. **user.ts** - User Profile
- `GET /api/user/me` → Returns current user profile (auth required)
  - Fields: `id`, `name`, `strava_id`, `profile_pic_url`, `is_admin`

---

#### 4. **webhook.ts** - Strava Webhook Handler
- `GET /api/webhook/strava?hub.challenge=...` → Webhook verification challenge
- `POST /api/webhook/strava` → Processes activity creation events in real-time
  - Extracts segment efforts from new activities
  - Matches against challenge segments
  - Inserts into database with proper date validation
  - Handles automatic token refresh

**Webhook Flow:**
1. Strava publishes activity creation event
2. Webhook handler receives POST with `object_type: "activity"`, `aspect_type: "create"`, `object_id`
3. Finds user by Strava ID, verifies token is fresh
4. Fetches full activity details from Strava API
5. Iterates through activity's segment efforts
6. For each segment in an active challenge:
   - Creates `segment_efforts` record with effort metadata
   - Stores elapsed_time, moving_time, distance, elevation, watts, cadence

---

## Database Layer (`supabase`)

### Tables
- **users** → Strava athlete profiles with encrypted tokens
- **challenges** → Challenge metadata (name, type, date range, owner, invite code, slug)
- **challenge_segments** → Segments (Strava IDs) associated with challenges
- **challenge_members** → Challenge roster (user-challenge participation)
- **segment_efforts** → Captured segment efforts from activities (populated by webhook + backfill)

### Key Relationships
- `challenges.owner_id` → `users.id`
- `challenge_members.challenge_id` → `challenges.id`
- `challenge_members.user_id` → `users.id`
- `challenge_segments.challenge_id` → `challenges.id`
- `segment_efforts.challenge_id`, `challenge_segment_id`, `user_id` (all foreign keys)

---

## Extension Layer (`packages/extension/`)

**Status:** ✅ Complete - Functional Chrome MV3 extension with login, profile, and challenge management

### Architecture

```
src/
├── components/
│   ├── LoginScreen.tsx         → "Connect with Strava" button, OAuth flow
│   ├── HomeScreen.tsx          → User profile, challenge list, admin panel
│   └── ChallengeCard.tsx       → Individual challenge card with leaderboard preview
├── hooks/
│   ├── useAuth.ts             → JWT + user data from chrome.storage
│   ├── useChallenges.ts       → Fetch challenges from API
│   └── useLeaderboard.ts      → Fetch leaderboard with enriched stats + segment info
├── utils/
│   ├── api.ts                 → fetch() wrapper with JWT Authorization header
│   └── storage.ts             → chrome.storage.local wrappers
├── types/
│   └── index.ts               → Challenge, User, LeaderboardEntry interfaces
├── background.ts              → (future) Service worker for OAuth token interception
└── popup.tsx                  → Main React entry point
```

### Key Features

**Authentication Flow**
1. User clicks "Connect with Strava" button in LoginScreen
2. Opens new tab to `https://api.../api/auth/strava`
3. Strava OAuth → redirects to `https://api.../api/auth/callback?code=...`
4. Backend generates JWT, redirects to `/auth-success?token=...&userId=...&name=...`
5. auth-success.html sends message to popup: `{ action: 'AUTH_SUCCESS', token, user }`
6. Popup stores JWT in chrome.storage.local → transitions to HomeScreen

**Challenge Management**
- HomeScreen displays active challenges (fetched via `GET /api/challenges/list`)
- Each ChallengeCard shows:
  - Challenge name, type (count/time/elevation), dates, segment info
  - Leaderboard preview with 🏆 position, delta_from_leader
  - "Join" button (disabled if owner or already member)
  - "Delete" button (visible for owner and admin)
  - 🔧 Admin panel (for is_admin === true users)

**Admin Mode**
- If user.is_admin === true, HomeScreen shows admin panel
- Lists all challenges with bulk delete option
- Allows deletion of any challenge (cascade deletes members, efforts, segments)

### UI Components
- **Button, Card, Avatar, Modal** → Reusable Tailwind components
- **CORS-enabled API** → All extensions requests include Authorization header with Bearer JWT

---

## Dashboard Layer (`packages/dashboard/`)

**Status:** ✅ Complete - Public Next.js site for viewing challenge leaderboards

### Pages

**`app/page.tsx`** - Challenge List
- Fetches all challenges via `GET /api/challenges/list-public` (no auth required)
- Displays challenge cards with:
  - Name, type badge, days remaining
  - Participant count
  - Segment info (Strava link)
  - "View →" button

**`app/c/[slug]/page.tsx`** - Challenge Detail Page
- Fetches challenge by slug via `GET /api/challenges/public?slug=...`
- Displays:
  - Challenge details (name, dates, participants, invite code)
  - Segment info with Strava link
  - Full leaderboard table with rankings and scores
  - "Delete" button (visible for test challenges or admin users)

### Caching
- Both pages use `export const revalidate = 0` (disabled ISR caching)
- Ensures real-time leaderboard updates

### Styling
- Tailwind CSS with orange accent (#FC4C02) for Strava branding
- Responsive grid layouts for challenge cards
- Monospace font for invite codes

---

## Deployment

### Vercel Configuration (`vercel.json`)

```json
{
  "version": 2,
  "rewrites": [
    { "source": "/api/auth/:path*", "destination": "/api/auth" },
    { "source": "/api/challenges/:path*", "destination": "/api/challenges" },
    { "source": "/api/user/:path*", "destination": "/api/user" },
    { "source": "/api/webhook/:path*", "destination": "/api/webhook" }
  ]
}
```

Maps all sub-paths of each endpoint to its handler function, enabling path-based routing with a single function file.

### Serverless Function Consolidation

**Before:** 14 individual files (exceeded Hobby plan limit of 12)
```
/api/auth/strava.ts, /api/auth/callback.ts, /api/auth/refresh.ts
/api/challenges/create.ts, /api/challenges/list.ts, /api/challenges/list-public.ts
/api/challenges/join.ts, /api/challenges/leaderboard.ts, /api/challenges/public.ts
/api/challenges/backfill.ts, /api/challenges/delete.ts, /api/challenges/manual-backfill.ts
/api/user/me.ts, /api/webhook/strava.ts
```

**After:** 4 consolidated handlers (within Hobby plan limit)
```
/api/auth.ts                (handles 3 routes)
/api/challenges.ts          (handles 9 routes)
/api/user.ts                (handles 1 route)
/api/webhook.ts             (handles 2 routes)
```

---

## Environment Variables

**API (.env.local)**
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
JWT_SECRET=
WEBHOOK_VERIFY_TOKEN=
```

**Dashboard (.env.local)**
```
# Uses public API at https://strava-challenges-extension.vercel.app
```

**Extension**
```
# Hardcoded API URL in source: https://strava-challenges-extension.vercel.app
```

---

## What Works ✅

- **User Authentication:** Strava OAuth, JWT generation, token refresh
- **Challenge Creation:** Name, type, date range, segment selection, slug generation
- **Automatic Backfill:** Fetches historical activities when challenge starts in past
- **Real-time Webhook:** Captures segment efforts on activity creation
- **Leaderboard:** Aggregates stats, calculates scores, enriches with best_time/streak
- **Public Dashboard:** Browse challenges, view leaderboards without login
- **Challenge Deletion:** Owner/admin can delete challenges with cascade cleanup
- **Admin Mode:** Designated users can manage all challenges
- **Chrome Extension:** Login, view profile, manage challenge participation
- **Type Safety:** Full TypeScript across API, extension, dashboard
- **CORS Support:** Public endpoints accessible from browser

---

## What's In Progress 🔄

None - Phase 3 (leaderboard + dashboard + webhooks) is complete.

---

## Testing Checklist

- [x] Extension loads without errors in Chrome
- [x] Strava OAuth flow completes successfully
- [x] JWT token stored and retrieved from chrome.storage
- [x] Challenge creation generates slug and invite code
- [x] Segment details fetched from Strava API
- [x] Creator auto-added as member
- [x] Historical backfill triggered for past-start challenges
- [x] Webhook verification challenges pass
- [x] Real-time segment efforts captured on activity POST
- [x] Leaderboard aggregation and scoring correct
- [x] Enriched stats (best_time, avg_time, streak) calculated
- [x] Public dashboard loads challenges without auth
- [x] Challenge detail page shows leaderboard by slug
- [x] Dashboard caching disabled (revalidate = 0)
- [x] Type checking passes
- [x] 4 consolidated API functions fit within Vercel Hobby limit

---

## Future Enhancements

- **Real-time Updates:** Supabase Realtime subscriptions for live leaderboard
- **Notifications:** Browser notifications on leaderboard position changes
- **Search & Filters:** Filter challenges by type, date, participant count
- **Challenge Analytics:** Charts for effort distribution, average times by segment
- **Social Features:** Comments, emoji reactions, challenge messages
- **Mobile:** Responsive dashboard improvements
- **Chrome Web Store Deployment:** Production release with signed manifest

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/api/api/auth.ts` | OAuth, JWT, token refresh |
| `packages/api/api/challenges.ts` | Challenge CRUD, leaderboard, backfill (9 endpoints) |
| `packages/api/api/user.ts` | User profile endpoint |
| `packages/api/api/webhook.ts` | Strava webhook handler |
| `packages/api/api/_utils/supabase.ts` | Supabase client, type definitions |
| `packages/api/api/_utils/strava-client.ts` | Strava API client (getStravaActivity, refreshToken) |
| `packages/api/api/_utils/crypto.ts` | Token encryption/decryption |
| `packages/api/api/_utils/jwt.ts` | JWT generation/verification |
| `packages/extension/src/popup.tsx` | Extension entry point |
| `packages/extension/src/components/HomeScreen.tsx` | Main extension UI |
| `packages/extension/src/hooks/useAuth.ts` | Authentication state |
| `packages/extension/src/hooks/useChallenges.ts` | Challenge list |
| `packages/extension/src/hooks/useLeaderboard.ts` | Leaderboard data |
| `packages/dashboard/app/page.tsx` | Challenge list page |
| `packages/dashboard/app/c/[slug]/page.tsx` | Challenge detail page |
| `vercel.json` | API route rewrite rules |
| `scripts/register-webhook.ts` | Strava webhook registration script |

---

**Last Updated:** 2026-04-16  
**Phase:** Complete (Phase 3 - Leaderboard + Dashboard + Webhooks)
