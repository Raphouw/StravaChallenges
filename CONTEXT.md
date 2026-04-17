# Strava Challenge Extension - Project Context

## Project Overview

A full-stack Strava segment challenge platform with a Chrome MV3 extension, Next.js dashboard with authentication, and Vercel serverless API. Users can create challenges on specific Strava segments, invite friends to compete, track leaderboard rankings, and manage challenges from both extension and web dashboard.

**Tech Stack:** React 18, TypeScript, Next.js 14 (App Router), Supabase PostgreSQL, Vercel Functions, Chrome MV3, Tailwind CSS

**Deployment:**
- **API:** https://strava-challenges-extension.vercel.app (Vercel)
- **Dashboard:** https://strava-challenges-dashboard.vercel.app (Vercel)
- **Database:** Supabase PostgreSQL

---

## Architecture

```
packages/
├── api/                    → Vercel serverless functions (11 individual handlers)
├── extension/              → Chrome MV3 extension (React popup)
├── dashboard/              → Next.js 14 dashboard with auth + create/join
└── shared-types/           → Shared TypeScript interfaces
```

---

## API Layer (`packages/api/`)

**Status:** ✅ Complete - 11 individual serverless functions

### API Functions

Vercel project structure with individual handler files:

#### 1. **auth/strava.ts** - Strava OAuth Initiation
- `GET /api/auth/strava?redirect_url=<url>` → Initiates OAuth flow
  - Supports dynamic `redirect_url` parameter for dashboard or extension
  - Passes redirect_url in state for callback to use

#### 2. **auth/callback.ts** - OAuth Callback Handler
- `GET /api/auth/callback?code=...&state=...` → OAuth callback
  - Creates/updates user in Supabase
  - Generates JWT token
  - Encrypts Strava tokens
  - Redirects to extension or dashboard based on state's redirect_url
  - Falls back to `/auth-success?token=...&name=...&profileUrl=...` for extension

#### 3. **auth/refresh.ts** - Token Refresh
- `POST /api/auth/refresh` → Validates JWT, refreshes expired tokens

**Key Features:**
- Strava OAuth 2.0 with support for multiple redirect destinations
- Token encryption/decryption with AES-256
- Automatic token refresh before expiry
- JWT generation + verification
- User creation on first login

---

#### 4-12. **challenges/*.ts** - Challenge Management (8 endpoints)

**4. create.ts** - Create Challenge
- `POST /api/challenges/create` → Creates new challenge
  - Stores distance in **meters** (NOT km) from Strava API
  - Fetches segment details: name, distance, elevation_gain
  - Adds creator as member
  - Triggers historical backfill if starts_at < now
  - Returns invite_code for sharing

**5. list.ts** - List User's Challenges
- `GET /api/challenges/list` → Lists challenges user owns/participates in (auth required)
- Returns member_count and is_owner metadata

**6. list-public.ts** - List All Challenges
- `GET /api/challenges/list-public` → Lists all challenges without auth
- Enriched with: participant_count, effort_count, segment data
- CORS-enabled for dashboard access

**7. join.ts** - Join Challenge
- `POST /api/challenges/join` → Joins challenge by invite code
- Prevents joining own challenge
- Deduplicates membership (idempotent)

**8. delete.ts** - Delete Challenge
- `DELETE /api/challenges/delete` → Deletes challenge (owner or admin token only)
- Cascade deletes: members, segments, efforts
- Admin token check: `?admin=465786453sd4fsdfsdfsdf456`

**9. leaderboard.ts** - Get Leaderboard
- `GET /api/challenges/leaderboard?id=<challengeId>` → Fetches leaderboard with enriched stats
  - Per-user: `best_time`, `avg_time`, `last_attempt`, `streak`, `delta_from_leader`
  - Group totals: `total_attempts`, `total_distance` (sum from efforts), `total_elevation`, `active_participants`
  - Segment info with Strava metadata
  - Requires JWT auth

**10. public.ts** - Get Challenge Detail (Public)
- `GET /api/challenges/public?slug=<slug>` → Fetches challenge + leaderboard for dashboard
- No auth required, CORS-enabled
- Returns same leaderboard structure as leaderboard.ts

**11. backfill.ts** - Trigger Historical Backfill
- `POST /api/challenges/backfill` → Fire-and-forget backfill for challenge members
- Fetches Strava activities from challenge start_date to now
- Checks segment efforts against challenge segments
- Inserts efforts into DB (deduplicates by strava_effort_id)
- Handles automatic token refresh for expired Strava tokens

---

#### 13. **user/me.ts** - Get User Profile
- `GET /api/user/me` → Returns current user (auth required)
- Fields: `id`, `name`, `strava_id`, `profile_pic_url`, `is_admin`

---

#### 14. **webhook/strava.ts** - Strava Webhook Handler
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

**Status:** ✅ Complete - Functional Chrome MV3 extension with dark theme, login, profile, and challenge management

### Architecture

```
src/
├── components/
│   ├── LoginScreen.tsx              → "Connect with Strava" button, dark theme
│   ├── HomeScreen.tsx               → User profile, challenge list, admin panel, dashboard button
│   ├── ChallengeCard.tsx            → Challenge card with leaderboard preview
│   └── modals/
│       ├── CreateChallengeModal.tsx → Create challenge form (dark styled)
│       ├── JoinChallengeModal.tsx   → Join challenge by code (dark styled)
│       └── SuccessModal.tsx         → Challenge created confirmation (opaque dark bg)
├── hooks/
│   ├── useAuth.ts                  → JWT + user data from chrome.storage
│   ├── useChallengesList.ts        → Fetch user's challenges
│   ├── useLeaderboard.ts           → Fetch leaderboard with enriched stats
│   └── useUserProfile.ts           → Fetch user profile
├── utils/
│   ├── api.ts                      → fetch() wrapper with JWT Authorization header
│   │                               → API_BASE = https://strava-challenges-extension.vercel.app
│   └── storage.ts                  → chrome.storage.local wrappers
├── types/
│   └── index.ts                    → Challenge, User, LeaderboardEntry interfaces
└── popup.tsx                       → Main React entry point
```

### Key Features

**Authentication Flow**
1. User clicks "Connect with Strava" button in LoginScreen
2. Opens new tab to `https://strava-challenges-extension.vercel.app/api/auth/strava`
3. Strava OAuth flow
4. Backend redirects to `/auth-success?token=...&userId=...&name=...&profileUrl=...&stravaId=...`
5. auth-success.html (extension page) sends message to popup: `{ action: 'AUTH_SUCCESS', token, user }`
6. Popup stores token + user data in chrome.storage → transitions to HomeScreen

**Challenge Management**
- HomeScreen displays active challenges (user's challenges + those they joined)
- Create Challenge modal: Form to create new challenge with segment ID, dates, type
- Join Challenge modal: Enter 6-letter invite code
- Each ChallengeCard shows:
  - Challenge name, type badge, dates remaining, segment info
  - Leaderboard preview with user's position
  - "Delete" button (owner or admin only)

**Dashboard Integration**
- "Open Dashboard" button in HomeScreen footer
- Directs to: `https://strava-challenges-dashboard.vercel.app/?admin=465786453sd4fsdfsdfsdf456` (if admin)
- Or: `https://strava-challenges-dashboard.vercel.app/` (if regular user)

**Admin Mode**
- If user.is_admin === true, HomeScreen shows admin panel toggle
- Admin panel lists all challenges with delete option
- Can delete any challenge via admin token

**Dark Theme**
- Background: slate-900/black gradient
- Inputs: `bg-slate-800 text-white border-slate-600`
- Labels: `text-slate-200`
- Modals: `bg-black/80 overlay` with `bg-slate-900 content`
- SuccessModal: opaque dark styling with orange code display

### UI Components
- **Button, Card, Avatar** → Reusable Tailwind dark-themed components
- **Modal system** → Overlays with proper z-index management
- **Responsive grid** → Challenge list adapts to extension width

---

## Dashboard Layer (`packages/dashboard/`)

**Status:** ✅ Complete - Next.js 14 public/authenticated dashboard with full CMS + leaderboard viewing

### Pages

**`app/page.tsx`** - Challenge List
- Public view (no auth required) + authenticated view with create/join
- Fetches challenges via `GET /api/challenges/list-public`
- Displays challenge cards with:
  - Name, type badge, days remaining, progress bar
  - Participant count, effort count
  - Segment info (distance km, elevation m)
  - Invite code display
  - "View →" button
  - "Join" button (if authenticated)
- Create Challenge button (if authenticated) → opens modal
- Navbar shows "Connect with Strava" (guest) or Profile + "Disconnect" (authenticated)

**`app/c/[slug]/page.tsx`** - Challenge Detail Page
- Public leaderboard view
- Fetches challenge + leaderboard via `GET /api/challenges/public?slug=...`
- Displays:
  - Challenge hero section (name, status, dates remaining)
  - Stats grid: participants, total efforts, total km, total elevation
  - Segment card with Strava link
  - Invite code with copy button
  - Full leaderboard (top 3 podium + ranked list)
  - Breadcrumb navigation back to home
  - Admin delete button (if ?admin=token matches)

**`app/auth-callback`** - OAuth Callback Handler
- Wrapped in Suspense boundary (Next.js 14 requirement)
- Captures OAuth params from URL: token, userId, name, profileUrl, stravaId
- Calls useAuth.login() to store in localStorage
- Redirects to home page
- Shows loading spinner while processing

### Authentication
- **useAuth hook** → Manages JWT + user in localStorage
- **localStorage keys:**
  - `strava_jwt` → JWT token
  - `strava_user` → User object (JSON)
- **Session persistence** → User stays logged in across page reloads
- **Logout** → Clears localStorage, hides auth buttons

### Create Challenge Modal
- Form identical to extension modal
- Inputs: challenge name, type (count/time/elevation), segment ID, start/end dates
- Dark styling matching dashboard theme
- Success modal shows invite code with copy button

### Caching
- Both pages use `'use client'` (client-side rendering)
- No ISR caching - ensures real-time leaderboard updates
- Challenge data fetched on every page load

### Styling
- Tailwind CSS dark theme (slate-900, black backgrounds)
- Orange accent (#fc6702) for Strava branding
- Responsive grid layouts (1 col mobile, 2 col tablet, 3 col desktop)
- Dark inputs with white text + slate borders
- Modal overlays: `bg-black/80` with opaque content cards

---

## Deployment

### Multiple Vercel Projects

**1. API Backend** (`packages/api/`)
- **URL:** https://strava-challenges-extension.vercel.app
- **Type:** Node.js serverless functions
- **Functions:** 11 individual handlers in `/api/` directory
- **Environment:** Supabase credentials, JWT secret, Strava OAuth

**2. Dashboard Frontend** (`packages/dashboard/`)
- **URL:** https://strava-challenges-dashboard.vercel.app
- **Type:** Next.js 14 App Router
- **Features:** Client-side auth via localStorage, OAuth redirect
- **Environment:** None (API URLs hardcoded)

### URL Mapping

**Extension** → Always points to API backend:
- API base: https://strava-challenges-extension.vercel.app
- OAuth: /api/auth/strava (redirects back to extension auth-success.html)
- Dashboard button: https://strava-challenges-dashboard.vercel.app/?admin=TOKEN

**Dashboard** → Points to API backend for data:
- API base: https://strava-challenges-extension.vercel.app
- OAuth: /api/auth/strava?redirect_url=https://strava-challenges-dashboard.vercel.app/auth-callback
- Admin delete: ?admin=TOKEN parameter in URL for dashboard pages

---

## Environment Variables

**API Backend** (`packages/api/.env.local`)
```
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_KEY=...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
JWT_SECRET=...
WEBHOOK_VERIFY_TOKEN=...
API_URL=https://strava-challenges-extension.vercel.app  (for backfill endpoint)
```

**Dashboard Frontend** (`packages/dashboard/.env.local`)
```
# No environment variables needed
# API URLs hardcoded in source pointing to strava-challenges-extension.vercel.app
```

**Extension**
```
# API_BASE hardcoded in src/utils/api.ts:
# https://strava-challenges-extension.vercel.app
```

---

## Key Bug Fixes & Recent Changes

### Distance Unit Bug (Fixed)
- **Problem:** Distance stored as km in DB, frontend dividing by 1000 again → showed 0.01km
- **Solution:** Store distance in **meters** (Strava native unit), frontend divides by 1000 for display
- **Migration:** `UPDATE challenge_segments SET distance = distance * 1000 WHERE distance < 1000`

### Modal Styling (Fixed)
- **Problem:** Modals transparent, text invisible on dark background
- **Solution:** 
  - Overlay: `bg-black/80` (opaque)
  - Modal content: `bg-slate-900` with `border-slate-700`
  - Inputs: `bg-slate-800 text-white placeholder:text-slate-400`
  - Labels: `text-slate-200`

### Suspense Boundary (Fixed)
- **Problem:** Next.js 14 build failing - useSearchParams not wrapped in Suspense
- **Solution:** Extract useSearchParams component, wrap with `<Suspense>` fallback

### Dark Theme (Completed)
- Extension: Full dark theme (slate-900/black backgrounds, white text)
- Dashboard: Dark mode with orange accents
- All inputs, buttons, cards styled for dark theme visibility

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
