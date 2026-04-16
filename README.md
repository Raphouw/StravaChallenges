# Strava Challenge Tracker

Extension Chrome permettant de créer des challenges entre amis sur des segments Strava avec mise à jour quasi-instantanée (< 30s) grâce aux webhooks Strava.

## 🏗️ Architecture

- **Extension Chrome** (MV3 + React + Tailwind) — UI principale
- **API Vercel** (Serverless Functions) — Webhooks Strava + OAuth + CRUD
- **Dashboard Next.js** — Vue publique des classements
- **Supabase** — PostgreSQL + Realtime + Auth

## 📚 Phase 1 — Backend Fondations

Cette phase couvre:

1. ✅ Structure monorepo avec package.json + workspaces
2. ✅ Migration SQL Supabase (schema complet)
3. ✅ Webhook Strava (réception + matching des segments)
4. ✅ OAuth Strava (callback + token refresh)

### Fichiers créés

- `packages/api/webhook/strava.ts` — Handler webhook avec validation & matching logic
- `packages/api/auth/callback.ts` — OAuth callback (exchange code for tokens)
- `packages/api/auth/refresh.ts` — Token refresh endpoint
- `packages/api/lib/` — Utilitaires (crypto, Supabase, Strava API, JWT)
- `supabase/migrations/001_init.sql` — Schema complet avec indexes + Realtime

## 🚀 Setup

### 1. Supabase

1. Créer un projet sur https://supabase.com
2. Obtenir `SUPABASE_URL` et `SUPABASE_ANON_KEY` depuis Project Settings
3. Générer une `SUPABASE_SERVICE_ROLE_KEY`
4. Appliquer la migration:

```bash
# Copier la migration SQL dans Supabase SQL Editor et exécuter
cat supabase/migrations/001_init.sql
```

### 2. Strava API

1. Créer une app sur https://www.strava.com/settings/api
2. Obtenir `STRAVA_CLIENT_ID` et `STRAVA_CLIENT_SECRET`
3. Ajouter les redirect URIs:
   - Dev: `http://localhost:3000/api/auth/callback`
   - Prod: `https://your-domain.vercel.app/api/auth/callback`

### 3. Variables d'environnement

```bash
cp .env.example .env.local
```

Remplir tous les secrets (voir `.env.example`).

### 4. Installation

```bash
npm install
```

### 5. Déployer sur Vercel

```bash
npm install -g vercel
vercel link
vercel env pull
vercel deploy
```

## 🔑 Variables d'environnement requises

- `STRAVA_CLIENT_ID` — ID de l'app Strava
- `STRAVA_CLIENT_SECRET` — Secret Strava
- `WEBHOOK_VERIFY_TOKEN` — Token aléatoire pour valider webhooks
- `SUPABASE_URL` — URL du projet Supabase
- `SUPABASE_ANON_KEY` — Clé publique Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Clé service role (backend only)
- `JWT_SECRET` — Secret pour signer les JWT (7 jours expiration)
- `ENCRYPTION_KEY` — Clé AES-256 pour chiffrer tokens Strava
- `APP_URL` — URL de l'app (http://localhost:3000 en dev)

## 📝 API Endpoints (Phase 1)

### Webhook Strava

```
GET  /api/webhook/strava  — Validation (handshake)
POST /api/webhook/strava  — Réception des événements
```

### Authentication

```
GET  /api/auth/callback   — OAuth callback (Strava → app)
POST /api/auth/refresh    — Refresh access token
```

## 🗄️ Schema Database

- `users` — Athlètes (stockage sécurisé des tokens)
- `challenges` — Les challenges créés
- `challenge_segments` — Segments surveillés par challenge
- `challenge_members` — Membres d'un challenge
- `segment_efforts` — Activités détectées (via webhook)
- `leaderboard` — Vue pour les stats + classements

Tous les tokens Strava sont **chiffrés en AES-256** en DB.

## 🔐 Sécurité

- Access tokens **chiffrés AES-256** en DB
- JWT expiration 7 jours
- Scopes Strava minimaux (`activity:read_all` seulement)
- Row Level Security Supabase (recommended — à configurer en Phase 2)

## 📝 Prochaine étape

Phase 2: Extension Chrome (Manifest V3 + popup React + login Strava)
