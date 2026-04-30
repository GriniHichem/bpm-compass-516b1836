# Migration 100 % hors Lovable — Procédure complète

Ce document décrit la procédure pour faire fonctionner Q-Process **entièrement en dehors de Lovable**, sans aucune dépendance runtime à la plateforme. Le code source est standard (React + Vite + Supabase) et ne contient **aucun verrou propriétaire**.

> Durée estimée : **30 à 90 minutes** selon votre infrastructure cible.

---

## 1. Vue d'ensemble

| Composant | Source actuelle | Destination après migration |
|---|---|---|
| Code source frontend | Lovable / GitHub sync | GitHub (votre org) ou GitLab/Bitbucket |
| Hébergement frontend | `*.lovable.app` (preview) | Vercel, Netlify, Nginx, Caddy, S3+CloudFront, OVH, VPS… |
| Backend (DB, Auth, Storage, Edge Functions) | Lovable Cloud (Supabase managé) | **Supabase Cloud** (compte propre) **ou Supabase self-hosted** (Docker) |
| Secrets / SMTP / IA | Configurés via Lovable | Variables d'environnement standard + table `app_settings` |
| Domaine | `*.lovable.app` ou custom | Votre domaine, DNS chez votre registrar |

**Aucun composant runtime ne reste sur Lovable après la migration.**

---

## 2. Étape 1 — Récupérer le code source

### 2.1 Si GitHub est déjà connecté
Le dépôt GitHub contient déjà l'intégralité du code (sync bidirectionnel temps réel).
```bash
git clone git@github.com:<votre-org>/<votre-repo>.git q-process
cd q-process
```

### 2.2 Si GitHub n'est pas encore connecté
Dans Lovable : **Connectors → GitHub → Connect project → Create Repository**, puis cloner comme ci-dessus.

### 2.3 Vérifier qu'aucune dépendance Lovable ne subsiste
```bash
# 1. Aucune URL lovable dans le code applicatif (hors README/docs)
grep -rE "lovable\.(app|dev)" src/ supabase/ index.html

# 2. Le plugin lovable-tagger est conditionnel au mode dev (ne casse pas le build prod)
grep -A2 "lovable-tagger" vite.config.ts
```
Le plugin `lovable-tagger` est listé dans `package.json` mais **n'est utilisé qu'en mode développement**. Il peut être supprimé sans impact :
```bash
npm uninstall lovable-tagger
# puis retirer son import dans vite.config.ts
```

---

## 3. Étape 2 — Provisionner le backend Supabase

Deux options au choix. Le code et les migrations sont **identiques** dans les deux cas.

### Option A — Supabase Cloud (compte personnel/société, le plus rapide)

1. Créer un compte sur https://supabase.com
2. **New project** → choisir région et mot de passe DB
3. Récupérer dans **Project Settings → API** :
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role key` (secret, jamais côté client)
4. Installer le CLI Supabase :
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <votre-ref>
   ```

### Option B — Supabase self-hosted (Docker, contrôle total)

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# éditer .env : POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY,
# SITE_URL, SMTP_*, etc.
docker compose up -d
```
Suivre obligatoirement la section **15** de [`diagnostics/SELF_HOSTING_RULES.md`](./diagnostics/SELF_HOSTING_RULES.md) (variables GoTrue, NTP, tuning Postgres, limites Docker).

---

## 4. Étape 3 — Appliquer les migrations SQL

Toutes les migrations dans `supabase/migrations/` sont **idempotentes** (rejouables sans erreur).

```bash
supabase db push           # Cloud ou self-hosted lié via supabase link
# ou en self-hosted direct :
psql "postgresql://postgres:<pwd>@<host>:5432/postgres" -f supabase/migrations/<chaque_fichier>.sql
```

### Activer Realtime pour les tables nécessaires
Inclus déjà dans les migrations (`ALTER PUBLICATION supabase_realtime ADD TABLE …`). Vérifier :
```sql
SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';
```

### Extension `pg_net` (optionnelle mais recommandée)
```sql
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

### Configurer l'URL backend pour les triggers email
```sql
INSERT INTO public.app_settings(key, value)
VALUES ('supabase_url', 'http://kong:8000')   -- self-host : kong:8000 ; Cloud : votre URL Supabase
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

---

## 5. Étape 4 — Déployer les Edge Functions

```bash
supabase functions deploy admin-create-user --no-verify-jwt
supabase functions deploy admin-reset-password --no-verify-jwt
supabase functions deploy admin-save-smtp-password --no-verify-jwt
supabase functions deploy send-test-email --no-verify-jwt
supabase functions deploy send-notification-email --no-verify-jwt
supabase functions deploy send-survey-copy --no-verify-jwt
supabase functions deploy check-deadlines --no-verify-jwt
```
Ou en bloc : `supabase functions deploy --no-verify-jwt`.

### Secrets requis côté Edge Functions
Configurer (déjà standard sur Supabase) :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

> Le secret `LOVABLE_API_KEY` (passerelle IA Lovable) **n'est pas requis** pour le fonctionnement de Q-Process. Aucune fonctionnalité critique ne dépend exclusivement de l'IA Lovable. Si vous voulez les fonctions IA, configurez une clé OpenAI/Gemini dans `app_settings`.

---

## 6. Étape 5 — Déployer le frontend

### 6.1 Configurer `.env` local de production
```bash
VITE_SUPABASE_URL=https://<projet>.supabase.co     # ou https://api.votre-domaine.com pour self-host
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
VITE_SUPABASE_PROJECT_ID=<ref>
```

### 6.2 Build
```bash
npm install
npm run build
# → produit dist/ (HTML+JS+CSS statiques, prêt à servir n'importe où)
```

### 6.3 Hébergement — exemples

**Vercel / Netlify** : import du repo GitHub, variables d'environnement dans le dashboard, build command = `npm run build`, output dir = `dist`.

**Nginx (VPS / Ubuntu)** :
```nginx
server {
  listen 443 ssl http2;
  server_name app.votre-domaine.com;
  root /var/www/q-process/dist;
  index index.html;
  # SPA fallback obligatoire
  location / { try_files $uri $uri/ /index.html; }
  # Cache des assets
  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
  gzip on; gzip_types text/css application/javascript application/json;
}
```

**Caddy** :
```
app.votre-domaine.com {
  root * /var/www/q-process/dist
  try_files {path} /index.html
  file_server
  encode gzip
}
```

**S3 + CloudFront** : sync `dist/` sur le bucket, configurer CloudFront avec **default root object = `index.html`** et **error pages 403/404 → /index.html (200)** pour le SPA fallback.

---

## 7. Étape 6 — Configuration finale

### 7.1 Auth (GoTrue)
- **Cloud** : Authentication → URL Configuration → `Site URL` = URL exacte du frontend, `Redirect URLs` = idem.
- **Self-host** : voir [`SELF_HOSTING_RULES.md`](./diagnostics/SELF_HOSTING_RULES.md) §15.1.

### 7.2 SMTP
Connexion en Super Admin → page **SMTP** → renseigner serveur, port, user, password, email de support, nom d'application. Test via le bouton intégré.

### 7.3 Premier utilisateur RMQ
Le trigger `handle_new_user` attribue automatiquement le rôle **RMQ** au premier utilisateur inscrit. Inscrire votre administrateur en premier.

---

## 8. Étape 7 — Couper le cordon Lovable

Une fois l'application validée sur votre infrastructure :

1. **Tester intégralement** sur le nouvel environnement (login, CRUD, exports PDF, BPMN, notifications email).
2. **DNS** : pointer le domaine de production vers la nouvelle infra.
3. **Optionnel — désactiver Lovable Cloud** : Connectors → Lovable Cloud → Disable. Note : cette action est **irréversible** pour les futurs projets.
4. **Optionnel — déconnecter GitHub** : si vous ne voulez plus de sync, déconnecter dans Connectors. Le repo GitHub continue d'exister normalement.
5. **Continuer le développement** :
   - Soit en local + `git push` (CI/CD propre)
   - Soit en gardant Lovable comme éditeur visuel sync GitHub (le meilleur des deux mondes)

---

## 9. Garanties de portabilité

| Aspect | État |
|---|---|
| Code frontend | ✅ React 18 + Vite standard, aucune lib propriétaire Lovable en runtime |
| Plugin `lovable-tagger` | ✅ Dev-only, supprimable sans impact |
| Backend | ✅ 100 % Supabase open source — Cloud ou Docker |
| Migrations SQL | ✅ Idempotentes, ordonnées, rejouables |
| Edge Functions | ✅ Deno standard, déployables sur Supabase Cloud / self-hosted / Deno Deploy |
| Stockage fichiers | ✅ Buckets Supabase (`avatars`, `documents`, `branding`, `survey-images`) |
| Authentification | ✅ GoTrue standard, PKCE, refresh token rotation |
| Domaines & URLs | ✅ Aucune URL `lovable.*` hardcodée dans le code applicatif |
| Données | ✅ Export complet via `pg_dump` ou export CSV par table |

---

## 10. Export complet des données (sauvegarde / migration de DB)

```bash
# Dump complet (schéma + données)
pg_dump "postgresql://postgres:<pwd>@<host>:5432/postgres" \
  --schema=public --no-owner --no-acl \
  --file=q-process-backup-$(date +%F).sql

# Restauration sur nouvelle instance
psql "postgresql://postgres:<pwd>@<new-host>:5432/postgres" \
  -f q-process-backup-2026-04-30.sql
```

Pour une migration **Lovable Cloud → Supabase self-host**, contacter le support Lovable pour récupérer un dump complet du projet, puis restaurer comme ci-dessus.

---

## 11. Checklist finale

```
[ ] Repo GitHub cloné en local
[ ] npm install + npm run build OK (aucune erreur)
[ ] Backend Supabase provisionné (Cloud ou Docker)
[ ] Migrations appliquées sans erreur
[ ] Edge Functions déployées
[ ] .env de production configuré
[ ] Frontend hébergé et accessible HTTPS
[ ] SPA fallback configuré (try_files / CloudFront error pages)
[ ] Auth Site URL + Redirect URLs configurés
[ ] SMTP configuré et test email reçu
[ ] Premier utilisateur RMQ créé
[ ] Login + navigation testés < 1 s
[ ] Sauvegarde pg_dump planifiée (cron quotidien)
```

---

**Q-Process est conçu dès l'origine pour une portabilité totale. Aucune étape de cette procédure ne nécessite l'autorisation ou l'intervention de Lovable.**
