# Strava Challenge Extension — Plan complet

## 🎯 Résumé du projet

Extension Chrome permettant de créer des **challenges entre amis sur des segments Strava** avec mise à jour **quasi-instantanée (< 30s)** après chaque sortie, classement en temps réel, et lien public de suivi.

---

## ⚡ La clé: Webhooks Strava

Le mécanisme central permettant les 30 secondes, c'est le **Webhook Strava** :

1. Athlète publie une activité sur Strava
2. **Strava envoie automatiquement un événement** à notre endpoint Vercel
3. Notre API récupère le détail de l'activité (segments emprunts)
4. Si un segment correspond à un challenge actif → mise à jour stats
5. Supabase Realtime notifie l'extension + dashboard public

**Sans webhook = polling toutes les X minutes → jamais < 30s**

---

## 🏗️ Stack technique (tout gratuit)

| Composant | Technologie | Hébergement |
|-----------|-------------|-------------|
| Extension | Chrome Manifest V3 + React + Tailwind | Chrome Web Store / manual |
| Backend | Node.js + Vercel Serverless Functions | Vercel (free) |
| Base de données | PostgreSQL + Realtime | Supabase (free) |
| Dashboard public | Next.js ou SvelteKit | Vercel (free) |
| CI/CD | GitHub Actions | GitHub (free) |
| Auth | Strava OAuth 2.0 | - |

---

## 📁 Structure du projet (monorepo)

```
strava-challenge/
├── packages/
│   ├── extension/          # Extension Chrome
│   │   ├── manifest.json
│   │   ├── src/
│   │   │   ├── popup/      # UI principale (React)
│   │   │   ├── background/ # Service worker
│   │   │   └── utils/
│   │   └── vite.config.ts
│   │
│   ├── api/                # Vercel Functions
│   │   ├── auth/
│   │   │   ├── callback.ts     # OAuth Strava return
│   │   │   └── refresh.ts      # Refresh token
│   │   ├── webhook/
│   │   │   └── strava.ts       # ⚡ Réception événements Strava
│   │   ├── challenges/
│   │   │   ├── [id].ts         # GET/PATCH/DELETE challenge
│   │   │   ├── create.ts       # POST nouveau challenge
│   │   │   └── join.ts         # Rejoindre un challenge
│   │   └── leaderboard/
│   │       └── [challengeId].ts
│   │
│   └── dashboard/          # App web publique (Next.js)
│       ├── app/
│       │   ├── c/[slug]/   # Page challenge publique
│       │   └── join/[code] # Page d'invitation
│       └── components/
│
├── supabase/
│   └── migrations/         # Schema DB versionné
│
└── package.json (workspaces)
```

---

## 🗄️ Schema base de données (Supabase)

```sql
-- Utilisateurs (liés à Strava OAuth)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strava_id BIGINT UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  profile_pic_url VARCHAR,
  access_token TEXT,        -- chiffré
  refresh_token TEXT,       -- chiffré
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Challenges
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR UNIQUE NOT NULL,   -- pour l'URL publique
  name VARCHAR NOT NULL,
  type VARCHAR NOT NULL,          -- 'count' | 'time' | 'elevation' | 'distance'
  owner_id UUID REFERENCES users(id),
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  invite_code VARCHAR UNIQUE,     -- code court pour rejoindre
  is_public BOOLEAN DEFAULT true,
  config JSONB,                   -- config type-spécifique
  created_at TIMESTAMP DEFAULT now()
);

-- Segments suivis dans un challenge (N segments par challenge possible)
CREATE TABLE challenge_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  strava_segment_id BIGINT NOT NULL,
  segment_name VARCHAR,
  distance FLOAT,
  elevation_gain FLOAT
);

-- Membres d'un challenge
CREATE TABLE challenge_members (
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

-- Activités détectées (chaque passage sur un segment de challenge)
CREATE TABLE segment_efforts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id),
  challenge_segment_id UUID REFERENCES challenge_segments(id),
  user_id UUID REFERENCES users(id),
  strava_activity_id BIGINT NOT NULL,
  strava_effort_id BIGINT UNIQUE NOT NULL,
  elapsed_time INT NOT NULL,          -- secondes
  moving_time INT,
  start_date TIMESTAMP NOT NULL,
  distance FLOAT,
  elevation_gain FLOAT,
  average_watts FLOAT,
  average_cadence FLOAT,
  created_at TIMESTAMP DEFAULT now()
);

-- Vue matérialisée pour le leaderboard (recalcul auto)
CREATE VIEW leaderboard AS
SELECT
  se.challenge_id,
  se.challenge_segment_id,
  se.user_id,
  u.name,
  u.profile_pic_url,
  COUNT(*) as attempt_count,
  MIN(se.elapsed_time) as best_time,
  MAX(se.elapsed_time) as worst_time,
  AVG(se.elapsed_time) as avg_time,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY se.elapsed_time) as median_time,
  SUM(se.distance) as total_distance,
  SUM(se.elevation_gain) as total_elevation
FROM segment_efforts se
JOIN users u ON u.id = se.user_id
GROUP BY se.challenge_id, se.challenge_segment_id, se.user_id, u.name, u.profile_pic_url;
```

---

## ⚡ Flow Webhook Strava (le cœur du système)

### 1. Setup webhook (une seule fois au déploiement)

```typescript
// api/webhook/setup.ts (script à lancer une fois)
await fetch('https://www.strava.com/api/v3/push_subscriptions', {
  method: 'POST',
  body: JSON.stringify({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    callback_url: 'https://ton-app.vercel.app/api/webhook/strava',
    verify_token: process.env.WEBHOOK_VERIFY_TOKEN
  })
});
```

### 2. Reception webhook (appelé par Strava < 30s après upload)

```typescript
// api/webhook/strava.ts
export default async function handler(req, res) {
  // Validation Strava
  if (req.method === 'GET') {
    // Handshake de validation
    const { 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;
    if (token !== process.env.WEBHOOK_VERIFY_TOKEN) return res.status(403).end();
    return res.json({ 'hub.challenge': challenge });
  }

  if (req.method === 'POST') {
    const { object_type, aspect_type, object_id, owner_id } = req.body;
    
    // On ne traite que les nouvelles activités
    if (object_type !== 'activity' || aspect_type !== 'create') {
      return res.status(200).end();
    }
    
    // 1. Chercher l'utilisateur dans notre DB
    const user = await db.users.findByStravaId(owner_id);
    if (!user) return res.status(200).end(); // pas notre user
    
    // 2. Récupérer le détail de l'activité avec les segment_efforts
    const activity = await stravaClient.getActivity(object_id, user.access_token);
    
    // 3. Vérifier quels challenges actifs concernent cet utilisateur
    const activeSegmentIds = await db.getChallengeSegmentsForUser(user.id);
    
    // 4. Matcher les segments de l'activité avec nos challenges
    const matches = activity.segment_efforts.filter(effort =>
      activeSegmentIds.includes(effort.segment.id)
    );
    
    // 5. Sauvegarder les efforts matchés
    for (const effort of matches) {
      await db.segment_efforts.insert({
        challenge_id: activeSegmentIds[effort.segment.id].challengeId,
        user_id: user.id,
        strava_effort_id: effort.id,
        elapsed_time: effort.elapsed_time,
        start_date: effort.start_date,
        // ...
      });
    }
    
    // Supabase Realtime notifie automatiquement les clients connectés
    return res.status(200).end();
  }
}
```

---

## 📊 Stats calculées par challenge

### Par personne (par segment)
- `attempt_count` — nombre de passages
- `best_time` — meilleur temps
- `worst_time` — pire temps
- `avg_time` — moyenne des temps
- `median_time` — médiane
- `total_distance` — km cumulés
- `total_elevation` — dénivelé cumulé
- `trend` — progression vs période précédente (%)
- `streak` — jours consécutifs avec au moins 1 passage
- `last_attempt` — date du dernier passage

### Globales (challenge entier)
- `total_attempts` — tous passages confondus
- `unique_athletes` — nb de participants actifs
- `overall_best` — meilleur temps absolu (+ qui)
- `global_avg` — moyenne de tous les temps
- `most_active` — qui a le plus de passages
- `most_consistent` — meilleure régularité (faible variance)
- `cumulative_distance` — distance totale groupe
- `cumulative_elevation` — dénivelé total groupe

---

## 🏆 Types de challenges

### 1. Count challenge (défaut)
Classement par **nombre de passages** sur la période.
```json
{ "type": "count", "period_days": 30 }
```

### 2. Time challenge
Classement par **meilleur temps** sur le segment.
```json
{ "type": "time", "metric": "best" }  // ou "avg"
```

### 3. Elevation challenge
Classement par **dénivelé positif cumulé** (sur 1 ou plusieurs segments).
```json
{ "type": "elevation", "period_days": 30 }
```

### 4. Distance challenge
Classement par **distance cumulée** sur les segments du challenge.
```json
{ "type": "distance", "period_days": 30 }
```

### 5. Consistency challenge (futur)
Classement par **régularité** (variance des temps, ou streak de jours).
```json
{ "type": "consistency", "metric": "streak" }
```

---

## 🔐 Authentification

### Flow OAuth Strava
1. User clique "Connect with Strava" dans l'extension
2. Extension ouvre `https://ton-app.vercel.app/auth/strava`
3. Redirect vers Strava OAuth avec `scope=activity:read_all`
4. Callback sur `/api/auth/callback` → save tokens → génère JWT
5. Extension reçoit le JWT via `chrome.runtime.sendMessage`
6. JWT stocké dans `chrome.storage.local` (sécurisé)

### Sécurité
- Access tokens chiffrés en DB (AES-256)
- JWT expiration 7 jours + refresh automatique
- Row Level Security Supabase (chaque user voit seulement ses données)
- Scopes Strava minimaux (`activity:read_all` uniquement)

---

## 🌐 Dashboard public

URL: `https://ton-app.vercel.app/c/[slug]`

Pages:
- `/c/[slug]` — Vue publique du classement (pas besoin de login pour voir)
- `/c/[slug]/join` — Rejoindre le challenge (nécessite login Strava)
- `/c/[slug]/admin` — Config du challenge (owner seulement)

Le dashboard utilise **Supabase Realtime** pour les mises à jour live sans refresh.

---

## 🚀 Plan d'implémentation (ordre recommandé)

### Phase 1 — Backend fondations (2-3 jours)
- [ ] Setup Supabase (project + migrations)
- [ ] Setup Vercel (repo GitHub connecté)
- [ ] OAuth Strava (callback, tokens)
- [ ] Webhook Strava setup + réception
- [ ] CRUD challenges + membres

### Phase 2 — Extension Chrome (3-4 jours)
- [ ] Manifest V3 + popup React basique
- [ ] Login Strava depuis l'extension
- [ ] Créer / rejoindre un challenge (par code)
- [ ] Afficher leaderboard simple
- [ ] Badge sur icon = nb nouvelles activités

### Phase 3 — Stats & polish (2-3 jours)
- [ ] Calcul stats avancées (streak, trend, median)
- [ ] Multi-segments dans un challenge
- [ ] Dashboard public Next.js
- [ ] Lien d'invitation (invite_code court)
- [ ] Filtres période (7j / 30j / tout)

### Phase 4 — Extras (optionnel)
- [ ] Notifs browser (Chrome Notifications API)
- [ ] Export CSV du leaderboard
- [ ] Graphiques progression (Recharts)
- [ ] Badges / achievements

---

## 📦 Variables d'environnement

```bash
# Strava
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
WEBHOOK_VERIFY_TOKEN=   # token aléatoire pour valider webhook

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # pour backend uniquement

# Auth
JWT_SECRET=             # token aléatoire fort
ENCRYPTION_KEY=         # pour chiffrer les tokens Strava en DB

# URLs
APP_URL=https://ton-app.vercel.app
```

---

## ⚠️ Limites Strava API à connaître

| Limite | Valeur | Impact |
|--------|--------|--------|
| Rate limit | 600 req/15min, 30000/jour | Suffisant pour petit groupe |
| Webhook | 1 seul endpoint | OK pour nous |
| Activité detail | 1 req/activité | Seulement si webhook match |
| Token scope | `activity:read_all` | Voit activités privées aussi |

**Pour un petit groupe d'amis, le free tier Strava est largement suffisant.**

---

## 💡 Pour commencer avec Claude Code

```bash
# 1. Initialiser le monorepo
mkdir strava-challenge && cd strava-challenge
git init
npm init -y

# 2. Créer le projet Supabase
# → https://supabase.com/dashboard/new/project

# 3. Créer l'app Strava
# → https://www.strava.com/settings/api
# → callback URL: http://localhost:3000/api/auth/callback (dev)

# 4. Démarrer Claude Code dans VS Code
# → Et attaquer par Phase 1 !
```