# 📊 Strava Challenge Extension - État du Projet Complet

**Date:** 2026-04-17 | **Phase:** ✅ Complète (Phase 3)

---

## 🏗️ Arborescence du Projet

```
strava-challenge-exte/
├── packages/
│   ├── api/                              # Backend Vercel Serverless
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── strava.ts             # OAuth initiation
│   │   │   │   ├── callback.ts           # OAuth callback + JWT generation
│   │   │   │   └── refresh.ts            # Token refresh endpoint
│   │   │   ├── challenges/
│   │   │   │   ├── create.ts             # POST - Créer challenge
│   │   │   │   ├── list.ts               # GET - Challenges de l'utilisateur
│   │   │   │   ├── list-public.ts        # GET - Tous les challenges (public)
│   │   │   │   ├── join.ts               # POST - Rejoindre challenge
│   │   │   │   ├── delete.ts             # DELETE - Supprimer challenge
│   │   │   │   ├── leaderboard.ts        # GET - Leaderboard détaillé
│   │   │   │   ├── public.ts             # GET - Challenge + leaderboard public
│   │   │   │   └── backfill.ts           # POST - Backfill historique
│   │   │   ├── user/
│   │   │   │   └── me.ts                 # GET - Profil utilisateur
│   │   │   └── webhook/
│   │   │       └── strava.ts             # GET/POST - Webhook Strava temps réel
│   │   ├── _utils/
│   │   │   ├── supabase.ts               # Client Supabase + types
│   │   │   ├── strava-client.ts          # Client Strava API
│   │   │   ├── crypto.ts                 # Chiffrement AES-256
│   │   │   └── jwt.ts                    # JWT gen/verify
│   │   ├── middleware/
│   │   │   └── auth.ts                   # Vérification JWT
│   │   ├── migrations/
│   │   │   └── fix_segment_distance.sql  # Migration distance (km → m)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vercel.json
│   │
│   ├── extension/                        # Chrome MV3 Extension
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── LoginScreen.tsx       # Écran connexion Strava
│   │   │   │   ├── HomeScreen.tsx        # Accueil + challenges + admin
│   │   │   │   ├── ChallengeCard.tsx     # Carte challenge + leaderboard
│   │   │   │   ├── Button.tsx            # Composant bouton
│   │   │   │   ├── Card.tsx              # Composant card
│   │   │   │   ├── Avatar.tsx            # Avatar utilisateur
│   │   │   │   └── modals/
│   │   │   │       ├── CreateChallengeModal.tsx
│   │   │   │       ├── JoinChallengeModal.tsx
│   │   │   │       └── SuccessModal.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts            # Gestion auth JWT
│   │   │   │   ├── useChallengesList.ts  # Fetch challenges utilisateur
│   │   │   │   ├── useLeaderboard.ts     # Fetch leaderboard
│   │   │   │   └── useUserProfile.ts     # Fetch profil utilisateur
│   │   │   ├── utils/
│   │   │   │   ├── api.ts                # Wrapper fetch avec JWT
│   │   │   │   └── storage.ts            # chrome.storage wrappers
│   │   │   ├── types/
│   │   │   │   └── index.ts              # Types TS (Challenge, User, etc.)
│   │   │   ├── styles/
│   │   │   │   └── globals.css           # Tailwind + dark theme
│   │   │   ├── popup.tsx                 # React entry point
│   │   │   └── popup.html                # HTML de base (MV3)
│   │   ├── public/
│   │   │   ├── manifest.json             # MV3 manifest
│   │   │   └── auth-success.html         # Callback page OAuth
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   ├── dashboard/                        # Next.js 14 Dashboard
│   │   ├── app/
│   │   │   ├── page.tsx                  # Accueil (challenge list)
│   │   │   ├── layout.tsx                # Layout root
│   │   │   ├── components/
│   │   │   │   ├── Navbar.tsx            # Header avec auth
│   │   │   │   ├── ChallengeCard.tsx     # Carte challenge
│   │   │   │   └── CreateChallengeModal/ # Modal création
│   │   │   ├── c/
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx          # Détail challenge + leaderboard
│   │   │   └── auth-callback/
│   │   │       └── page.tsx              # OAuth callback (Suspense)
│   │   ├── hooks/
│   │   │   └── useAuth.ts                # localStorage auth
│   │   ├── utils/
│   │   │   └── api.ts                    # Fetch wrapper
│   │   ├── styles/
│   │   │   └── globals.css               # Tailwind + dark theme
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── next.config.js
│   │
│   └── shared-types/                     # Types partagés (optionnel)
│       └── index.ts
│
├── supabase/
│   └── migrations/
│       └── 001_init.sql                  # Schéma complet + Realtime
│
├── scripts/
│   └── register-webhook.ts               # Script inscription webhook Strava
│
├── CONTEXT.md                            # Documentation détaillée
├── README.md                             # Setup + quickstart
├── PROJECT_STATUS.md                     # Ce fichier
├── .env.example                          # Variables d'environnement
├── tsconfig.json                         # Root TypeScript config
├── package.json                          # Root monorepo
└── vercel.json                           # Config deployments Vercel
```

---

## 🗄️ Schéma Base de Données

### Architecture BDD

```
                    ┌─────────────┐
                    │   USERS     │
                    ├─────────────┤
                    │ id (UUID)   │◄───────────┐
                    │ strava_id   │            │
                    │ name        │            │
                    │ profile_pic │            │
                    │ access_token│(encrypted) │
                    │ refresh_tok │(encrypted) │
                    │ expires_at  │            │
                    └─────────────┘            │
                          ▲                    │
                          │                    │
              ┌───────────┼────────────────┐   │
              │           │                │   │
              │           │                │   │
        ┌─────┴────┐ ┌────┴──────┐ ┌──────┴──┐
        │CHALLENGES│ │CHALLENGE  │ │CHALLENGE│
        ├──────────┤ │ MEMBERS   │ │SEGMENTS │
        │id (UUID) │ ├───────────┤ ├─────────┤
        │slug      │ │challenge_ │ │id (UUID)│
        │name      │ │id → CHALL│ │challenge│
        │type      │ │user_id→US│ │_id→CHAL│
        │owner_id→U│ │joined_at │ │strava_s │
        │starts_at │ │(PK: ch,us)│ │distance │
        │ends_at   │ └───────────┘ │elevation│
        │invite_cod│                └─────────┘
        │is_public │                     │
        │config    │                     ▼
        └──────────┘            ┌──────────────────┐
              │                 │ SEGMENT_EFFORTS  │
              └────────┬────────►├──────────────────┤
                       │        │id (UUID)         │
                       │        │challenge_id      │
                       │        │challenge_segment │
                       │        │user_id           │
                       │        │strava_activity_id│
                       │        │strava_effort_id  │
                       │        │elapsed_time (sec)│
                       │        │moving_time       │
                       │        │start_date        │
                       │        │distance          │
                       │        │elevation_gain    │
                       │        │avg_watts         │
                       │        │avg_cadence       │
                       └────────┤created_at        │
                                └──────────────────┘
```

### Tables Détaillées

#### 1. **users** — Profils athlètes Strava
```sql
┌─────────────────────────────────────────────────────┐
│ Column              │ Type        │ Constraints     │
├─────────────────────────────────────────────────────┤
│ id                  │ UUID        │ PK, auto       │
│ strava_id           │ BIGINT      │ UNIQUE, NOT NULL│
│ name                │ VARCHAR     │ NOT NULL        │
│ profile_pic_url     │ VARCHAR     │ nullable        │
│ access_token        │ TEXT        │ AES-256 chiffré │
│ refresh_token       │ TEXT        │ AES-256 chiffré │
│ token_expires_at    │ TIMESTAMP   │ nullable        │
│ is_admin            │ BOOLEAN     │ default false   │
│ created_at          │ TIMESTAMP   │ default now()   │
│ updated_at          │ TIMESTAMP   │ default now()   │
└─────────────────────────────────────────────────────┘

🔒 Sécurité:
  • Tokens chiffrés AES-256 en DB
  • strava_id unique pour éviter doublons
  • Index: idx_users_strava_id
```

#### 2. **challenges** — Challenges créés
```sql
┌─────────────────────────────────────────────────────┐
│ Column              │ Type        │ Constraints     │
├─────────────────────────────────────────────────────┤
│ id                  │ UUID        │ PK, auto       │
│ slug                │ VARCHAR     │ UNIQUE, NOT NULL│
│ name                │ VARCHAR     │ NOT NULL        │
│ type                │ VARCHAR     │ NOT NULL        │
│                     │             │ (count|time|    │
│                     │             │  elevation|dist)│
│ owner_id            │ UUID        │ FK users, CASCADE
│ starts_at           │ TIMESTAMP   │ NOT NULL        │
│ ends_at             │ TIMESTAMP   │ NOT NULL        │
│ invite_code         │ VARCHAR     │ UNIQUE, 6 chars │
│ is_public           │ BOOLEAN     │ default true    │
│ config              │ JSONB       │ type-specific   │
│ created_at          │ TIMESTAMP   │ default now()   │
│ updated_at          │ TIMESTAMP   │ default now()   │
└─────────────────────────────────────────────────────┘

📊 Types:
  • count: Nombre de passages (tentatives)
  • time: Meilleur temps (secondes)
  • elevation: Total dénivellation (m)
  • distance: Distance totale (m)

🔑 Indexes:
  • idx_challenges_slug
  • idx_challenges_owner_id
  • ✅ Realtime enabled
```

#### 3. **challenge_segments** — Segments Strava par challenge
```sql
┌─────────────────────────────────────────────────────┐
│ Column              │ Type        │ Constraints     │
├─────────────────────────────────────────────────────┤
│ id                  │ UUID        │ PK, auto       │
│ challenge_id        │ UUID        │ FK challenges   │
│ strava_segment_id   │ BIGINT      │ NOT NULL        │
│ segment_name        │ VARCHAR     │ Strava name     │
│ distance            │ FLOAT       │ en mètres       │
│ elevation_gain      │ FLOAT       │ en mètres       │
│ created_at          │ TIMESTAMP   │ default now()   │
└─────────────────────────────────────────────────────┘

💡 Notes:
  • 1 challenge = 1 segment Strava actuellement
  • Distance stockée en mètres (Strava API)
  • Dénivellation en mètres

🔑 Indexes:
  • idx_challenge_segments_challenge_id
  • idx_challenge_segments_strava_id
```

#### 4. **challenge_members** — Roster du challenge
```sql
┌─────────────────────────────────────────────────────┐
│ Column              │ Type        │ Constraints     │
├─────────────────────────────────────────────────────┤
│ challenge_id        │ UUID        │ FK challenges   │
│ user_id             │ UUID        │ FK users        │
│ joined_at           │ TIMESTAMP   │ default now()   │
│ PRIMARY KEY         │             │ (challenge_id,  │
│                     │             │  user_id)       │
└─────────────────────────────────────────────────────┘

📋 Membership:
  • Composite PK = pas de doublon (idempotent)
  • Creator auto-ajouté au create
  • Users peuvent rejoindre via invite_code

🔑 Indexes:
  • idx_challenge_members_user_id
  • ✅ Realtime enabled
```

#### 5. **segment_efforts** — Activités détectées
```sql
┌──────────────────────────────────────────────────────┐
│ Column              │ Type        │ Constraints      │
├──────────────────────────────────────────────────────┤
│ id                  │ UUID        │ PK, auto        │
│ challenge_id        │ UUID        │ FK challenges    │
│ challenge_segment_id│ UUID        │ FK ch_segments   │
│ user_id             │ UUID        │ FK users         │
│ strava_activity_id  │ BIGINT      │ NOT NULL         │
│ strava_effort_id    │ BIGINT      │ UNIQUE NOT NULL  │
│ elapsed_time        │ INT         │ en secondes      │
│ moving_time         │ INT         │ en secondes      │
│ start_date          │ TIMESTAMP   │ NOT NULL         │
│ distance            │ FLOAT       │ en mètres        │
│ elevation_gain      │ FLOAT       │ en mètres        │
│ average_watts       │ FLOAT       │ nullable         │
│ average_cadence     │ FLOAT       │ nullable         │
│ created_at          │ TIMESTAMP   │ default now()    │
└──────────────────────────────────────────────────────┘

⚡ Source des données:
  • Webhook Strava: En temps réel (< 30s) ✅
  • Backfill: Historique challenge < start_date
  • Strava Activity avec segment_efforts

🔑 Indexes:
  • idx_segment_efforts_challenge_id
  • idx_segment_efforts_user_id
  • idx_segment_efforts_strava_effort_id (UNIQUE)
  • ✅ Realtime enabled
```

#### 6. **leaderboard** — VUE SQL (Read-only)
```sql
┌──────────────────────────────────────────────────────┐
│ View: leaderboard                                    │
├──────────────────────────────────────────────────────┤
│ challenge_id                                         │
│ challenge_segment_id                                 │
│ user_id                                              │
│ name             (from users)                        │
│ profile_pic_url  (from users)                        │
│ attempt_count    (COUNT)                             │
│ best_time        (MIN elapsed_time)                  │
│ worst_time       (MAX elapsed_time)                  │
│ avg_time         (AVG elapsed_time, INT)             │
│ median_time      (PERCENTILE_CONT 0.5)               │
│ total_distance   (SUM distance)                      │
│ total_elevation  (SUM elevation_gain)                │
│ last_attempt     (MAX start_date)                    │
└──────────────────────────────────────────────────────┘

📊 Agrégations: Auto-recalculées à chaque query
  • Permet leaderboard en temps réel
  • JOIN users pour enrichissement
  • GROUP BY (challenge, segment, user)
```

### Indexes de Performance

```
┌────────────────────────────────────────────────┐
│ Index Name                          │ Table   │
├────────────────────────────────────────────────┤
│ idx_users_strava_id                 │ users   │
│ idx_challenges_slug                 │ chall.  │
│ idx_challenges_owner_id              │ chall.  │
│ idx_challenge_segments_challenge_id │ ch_seg  │
│ idx_challenge_segments_strava_id    │ ch_seg  │
│ idx_challenge_members_user_id        │ ch_mem  │
│ idx_segment_efforts_challenge_id    │ seg_eff │
│ idx_segment_efforts_user_id          │ seg_eff │
│ idx_segment_efforts_strava_effort_id│ seg_eff │
└────────────────────────────────────────────────┘
```

### Realtime (Supabase)

✅ **Tables activées pour live updates:**
- `challenges` — Nouvelles challenges, updates metadata
- `segment_efforts` — Efforts détectés en temps réel
- `challenge_members` — Nouveaux members

---

## 🚀 État des Fonctionnalités

### ✅ Phase 1: Backend Fondations
- [x] OAuth Strava (callback + token refresh)
- [x] Webhook Strava (vérification + matching)
- [x] Chiffrement tokens AES-256
- [x] JWT generation/verification

### ✅ Phase 2: Extension Chrome
- [x] Chrome MV3 manifest
- [x] Popup React avec dark theme
- [x] Login Strava (oauth flow)
- [x] HomeScreen (profil + challenge list)
- [x] ChallengeCard avec leaderboard preview
- [x] CreateChallengeModal (dark styled)
- [x] JoinChallengeModal (dark styled)
- [x] SuccessModal avec code d'invite
- [x] Admin panel pour delete challenges
- [x] Bouton "Open Dashboard"

### ✅ Phase 3: Leaderboard + Dashboard + Webhooks
- [x] Leaderboard endpoint (7 stats par user)
- [x] Webhook temps réel (< 30s)
- [x] Backfill historique (challenge passés)
- [x] Next.js dashboard (challenge list + detail)
- [x] Public leaderboard page (slug)
- [x] OAuth redirect URLs dynamiques
- [x] Admin token validation
- [x] CORS headers (dashboard access)

### ✨ Features Complètes
- [x] **User Auth** — Strava OAuth + JWT + token refresh
- [x] **Challenge Creation** — Segment Strava + dates + slug + invite code
- [x] **Challenge Deletion** — Owner/admin cascade delete
- [x] **Join Challenge** — Idempotent via invite_code
- [x] **Backfill** — Historique activities < start_date
- [x] **Real-time Webhook** — Détecte new activities < 30s
- [x] **Leaderboard** — Agrégations SQL + enrichissement stats
- [x] **Public Dashboard** — Browse challenges + view leaderboards
- [x] **Type Safety** — Full TypeScript (API + extension + dashboard)
- [x] **Dark Theme** — Extension + dashboard
- [x] **Admin Mode** — Gestion challenges via ?admin=TOKEN

---

## 📈 API Endpoints (14 Handlers)

### Auth (3)
```
GET  /api/auth/strava              — Strava OAuth initiation
GET  /api/auth/callback            — OAuth callback (exchange code)
POST /api/auth/refresh             — JWT validation + token refresh
```

### Challenges (8)
```
POST /api/challenges/create        — Créer challenge (auth)
GET  /api/challenges/list          — Challenges utilisateur (auth)
GET  /api/challenges/list-public   — Tous challenges (public)
POST /api/challenges/join          — Rejoindre via code (auth)
DELETE /api/challenges/delete      — Supprimer (owner/admin)
GET  /api/challenges/leaderboard   — Leaderboard détaillé (auth)
GET  /api/challenges/public        — Challenge detail + LB (public)
POST /api/challenges/backfill      — Backfill historique (async)
```

### User (1)
```
GET  /api/user/me                  — Profil utilisateur (auth)
```

### Webhook (1)
```
GET  /api/webhook/strava           — Verification challenge
POST /api/webhook/strava           — Événements activities temps réel
```

### Admin (1)
```
GET  /api/admin/delete             — Delete challenge via token
```

---

## 🛠️ Tech Stack

### Frontend
- **Extension:** React 18 + TypeScript + Tailwind CSS + Chrome MV3
- **Dashboard:** Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS

### Backend
- **API:** Node.js + Vercel Serverless Functions + TypeScript
- **Database:** Supabase PostgreSQL + Realtime
- **Auth:** Strava OAuth 2.0 + JWT (7j expiry) + AES-256 encryption

### DevOps
- **Monorepo:** npm workspaces (packages/api, packages/extension, packages/dashboard)
- **Deployment:** Vercel (API + Dashboard), Chrome Web Store (Extension)
- **Environment:** .env.local avec secrets

---

## 🔒 Sécurité

✅ **Implémenté:**
- AES-256 encryption pour tokens Strava en DB
- JWT 7 jours expiration
- Strava scopes minimaux (`activity:read_all` only)
- CORS headers pour public endpoints
- Admin token validation (`?admin=TOKEN`)
- Token refresh automatique avant expiry
- Vérification webhook Strava (hub.challenge)

⚠️ **TODO:** Row Level Security (RLS) Supabase

---

## 📦 Déploiement Actuel

### Production URLs
- **API Backend:** https://strava-challenges-extension.vercel.app
- **Dashboard:** https://strava-challenges-dashboard.vercel.app
- **Database:** Supabase (https://..supabase.co)

### Environment Variables (api/)
```
SUPABASE_URL              — DB connection string
SUPABASE_SERVICE_KEY      — Service role key (backend)
STRAVA_CLIENT_ID          — OAuth ID
STRAVA_CLIENT_SECRET      — OAuth secret
JWT_SECRET                — JWT signing key
WEBHOOK_VERIFY_TOKEN      — Webhook validation
ENCRYPTION_KEY            — AES-256 key
API_URL                   — https://strava-challenges-extension.vercel.app
```

---

## 🐛 Bugs Récents (Fixés)

### 1. Distance Unit Bug
- **Symptôme:** Frontend affichait 0.01 km au lieu de 8.5 km
- **Cause:** Distance en km en DB, frontend divisait par 1000 à nouveau
- **Fix:** Stocker en mètres (Strava native), frontend divise par 1000 pour display
- **Migration:** `UPDATE challenge_segments SET distance = distance * 1000`

### 2. Modal Styling
- **Symptôme:** Modales transparentes, texte invisible
- **Cause:** Pas de bg-color sur overlay/content
- **Fix:** Overlay `bg-black/80`, content `bg-slate-900`, inputs `bg-slate-800`

### 3. Next.js Build Error
- **Symptôme:** useSearchParams not in Suspense boundary
- **Cause:** Composant client avec useSearchParams au top level
- **Fix:** Extraire le composant, wrapper avec `<Suspense>`

---

## 📝 Fichiers Clés

| Fichier | Rôle |
|---------|------|
| `supabase/migrations/001_init.sql` | Schéma complet + views + indexes |
| `packages/api/api/webhook/strava.ts` | Webhook temps réel |
| `packages/api/api/challenges/backfill.ts` | Backfill historique |
| `packages/api/api/challenges/leaderboard.ts` | Agrégations leaderboard |
| `packages/api/_utils/strava-client.ts` | Client Strava API |
| `packages/api/_utils/jwt.ts` | JWT generation |
| `packages/api/_utils/crypto.ts` | AES-256 chiffrement |
| `packages/extension/src/hooks/useAuth.ts` | Auth state extension |
| `packages/extension/src/components/HomeScreen.tsx` | UI principale extension |
| `packages/dashboard/app/page.tsx` | Challenge list dashboard |
| `packages/dashboard/app/c/[slug]/page.tsx` | Challenge detail page |

---

## 🚦 Statut Global

| Composant | Status | Notes |
|-----------|--------|-------|
| API Backend | ✅ Complete | 14 handlers, all working |
| Extension UI | ✅ Complete | Dark theme, full features |
| Dashboard | ✅ Complete | Public + authenticated views |
| Database | ✅ Complete | 5 tables + 1 view + indexes |
| Auth Flow | ✅ Complete | OAuth + JWT + refresh |
| Real-time | ✅ Complete | Webhook < 30s |
| Backfill | ✅ Complete | Historical data population |
| Deployment | ✅ Complete | Vercel + Supabase live |

---

## 📅 Prochaines Étapes (Non planifiées)

- **Real-time Updates:** Supabase Realtime subscriptions (frontend)
- **Browser Notifications:** Position changes en temps réel
- **Search & Filters:** Par type, date, participant count
- **Analytics:** Charts effort distribution
- **Social:** Comments, reactions, messages
- **Mobile:** Responsive improvements
- **Chrome Web Store:** Production release

---

**Mis à jour:** 2026-04-17 | **Responsable:** Raphaël | **Branch:** main
