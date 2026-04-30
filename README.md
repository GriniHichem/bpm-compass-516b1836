# Q-Process — Système de Management Qualité ISO 9001

Application web de gestion qualité conforme à la norme ISO 9001:2015.
Développement initial sur Lovable, **100 % portable hors Lovable** (code open-source standard, aucun lock-in).

## Stack technique

- **Frontend** : React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend** : Supabase (PostgreSQL, Auth, Edge Functions, Storage) — Cloud ou self-hosted
- **Emails** : denomailer (SMTP configurable via base de données)

## Documentation

- [`MANUAL.md`](./MANUAL.md) — Manuel utilisateur fonctionnel (FR)
- [`MIGRATION_HORS_LOVABLE.md`](./MIGRATION_HORS_LOVABLE.md) — **Procédure complète de migration 100 % hors Lovable**
- [`diagnostics/SELF_HOSTING_RULES.md`](./diagnostics/SELF_HOSTING_RULES.md) — Règles obligatoires self-hosting + tuning performance
- [`diagnostics/`](./diagnostics/) — Audits architecture, migrations, edge functions, SMTP

## Synchronisation GitHub (sync bidirectionnel Lovable ↔ GitHub)

Le projet est synchronisé en **temps réel et bidirectionnel** avec GitHub :
- Toute modification faite dans Lovable est **automatiquement poussée** sur le dépôt GitHub.
- Tout commit/push sur GitHub (local, IDE, CI) est **automatiquement répliqué** dans Lovable.
- Aucune commande `git pull` / `git push` manuelle n'est requise depuis Lovable.

### Activer la connexion (une seule fois)
1. Dans l'éditeur Lovable → **Connectors** → **GitHub** → **Connect project**
2. Autoriser l'application GitHub Lovable
3. Sélectionner le compte/organisation cible
4. Cliquer **Create Repository**

### Cloner et travailler en local
```bash
git clone git@github.com:<org>/<repo>.git
cd <repo>
npm install
npm run dev
```
Tout `git push` sur la branche par défaut sera reflété instantanément dans la preview Lovable.

### Récupérer une copie complète sans Lovable
```bash
git clone --mirror git@github.com:<org>/<repo>.git
```
Le code est **100 % autonome** : aucune dépendance ni appel runtime au domaine `lovable.app` / `lovable.dev`. Voir [`MIGRATION_HORS_LOVABLE.md`](./MIGRATION_HORS_LOVABLE.md).

## Déploiement self-hosted (résumé)

### Prérequis
- Docker & Docker Compose
- Supabase self-hosted (`supabase/supabase` officiel)
- Node.js 18+ et npm

### Variables d'environnement frontend (`.env`)
| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | URL de votre instance Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publique (anon key) |
| `VITE_SUPABASE_PROJECT_ID` | Référence du projet Supabase |

### Installation
```bash
npm install
npm run build
# servir dist/ via Nginx, Caddy, Vercel, Netlify, S3+CloudFront, etc.
```

### Migrations SQL
Toutes les migrations de `supabase/migrations/` sont **idempotentes** (`IF NOT EXISTS`, `ON CONFLICT`, blocs `DO $$`). Exécution :
```bash
supabase db push        # applique les migrations dans l'ordre
# ou
supabase db reset       # reconstruit complètement la base locale
```

### Edge Functions
Toutes les fonctions utilisent `verify_jwt = false` + auth manuelle Deno :
```bash
supabase functions deploy --no-verify-jwt
```

### Configuration SMTP
Stockée dans `app_settings` (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `support_email`, `app_name`).
Modifiable via interface **Super Admin** ou directement en SQL.

### Extensions PostgreSQL requises
- `pg_net` (recommandé) — emails depuis triggers DB. Absence = dégradation gracieuse, push in-app conservé.

## Structure du projet

```
src/                       # Code source React (UI, contextes, hooks, pages)
supabase/functions/        # Edge Functions Deno (déployables n'importe où)
supabase/migrations/       # Migrations SQL idempotentes
diagnostics/               # Audits, règles self-hosting, scripts
MANUAL.md                  # Manuel utilisateur FR
MIGRATION_HORS_LOVABLE.md  # Procédure de sortie complète
```

## Performance & sécurité

- RLS activé sur toutes les tables sensibles avec pattern `(SELECT auth.uid())` pour cache plan Postgres.
- Authentification PKCE (refresh tokens robustes en self-host).
- Rôles via table `user_roles` séparée + fonction `has_role()` SECURITY DEFINER.
- Aucun secret privé exposé côté client.

## Licence

Propriétaire — Groupe AMOUR. Tous droits réservés.
