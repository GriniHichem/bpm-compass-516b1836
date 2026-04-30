# Plan d'optimisation Self-Hosting — Login & App rapides

## Diagnostic des causes de lenteur

Après audit du code et de la base, j'ai identifié 9 causes concrètes qui ralentissent fortement le login et la navigation en self-hosting (Docker/Ubuntu) :

| # | Problème | Impact |
|---|----------|--------|
| 1 | `AuthContext` exécute 5 requêtes au login dont 1 séquentielle (`custom_role_permissions`) | +400 à 1500 ms avant affichage |
| 2 | `AppLayout` rappelle `supabase.auth.getUser()` **2 fois** au boot (round-trip GoTrue inutile) | +200 ms |
| 3 | Table `audit_logs` = 9 318 lignes / 10 Mo, aucun nettoyage | Triggers + INSERT lents partout |
| 4 | 434 policies RLS — beaucoup utilisent `has_role(auth.uid(), …)` sans `(SELECT auth.uid())` | Postgres ré-évalue par ligne |
| 5 | Index manquants sur clés chaudes : `user_roles.user_id`, `user_custom_roles.user_id`, `notifications.user_id`, `audit_logs(created_at, entity_type)` composite | Scans séquentiels |
| 6 | Trigger `dispatch_notification_email` boucle sur 4 URLs `pg_net` de façon **synchrone** | Bloque chaque INSERT notification |
| 7 | Client Supabase : Realtime activé par défaut + pas de PKCE explicite | WebSocket inutile + tokens fragiles |
| 8 | `select("*")` sur `profiles` et `role_permissions` (toutes colonnes / toutes lignes) | Charge utile inutile |
| 9 | "Invalid Refresh Token" récurrent → souvent `GOTRUE_SITE_URL` mal configuré ou horloge serveur décalée en self-host | Logout silencieux + login forcé |

---

## Stratégie

Trois lots indépendants, jouables séparément, **chacun idempotent et sans rupture fonctionnelle**.

### Lot A — Frontend (gain immédiat, zéro risque)

**A1. Refonte `AuthContext.tsx`**
- Lire la session UNE seule fois (supprimer `getSession()` redondant — utiliser `onAuthStateChange` avec `INITIAL_SESSION` au lieu de l'ignorer).
- Paralléliser `custom_role_permissions` avec les autres requêtes (un seul `Promise.all`).
- Rendre l'app utilisable dès que `profile + roles` sont chargés ; `permOverrides` et `customRolePerms` se chargent en arrière-plan (l'UI affiche un fallback "lecture seule" pendant ≤ 200 ms au lieu d'un écran blanc).
- Remplacer `select("*")` par les colonnes réellement utilisées sur `profiles` et `role_permissions`.

**A2. Nettoyer `AppLayout.tsx`**
- Supprimer les 2 appels `supabase.auth.getUser()` et lire `user.id` depuis `useAuth()`.

**A3. Optimiser le client Supabase (`client.ts`)**
- Ajouter `realtime: { params: { eventsPerSecond: 2 } }` et `global: { headers: { 'X-Client-Info': 'q-process' } }`.
- Activer `flowType: 'pkce'` (refresh tokens plus robustes en self-host).
- Désactiver `detectSessionInUrl` sur les pages qui n'en ont pas besoin (Login uniquement le garde).

**A4. Précharger les modules critiques**
- `<link rel="modulepreload">` dans `index.html` pour les chunks Login + AppLayout.

### Lot B — Base de données (gros gain serveur, migration unique idempotente)

**B1. Index manquants** (CREATE INDEX IF NOT EXISTS)
```
user_roles(user_id)
user_custom_roles(user_id)
notifications(user_id, created_at DESC)
notifications(entity_type, entity_id)
audit_logs(entity_type, created_at DESC)
project_actions(project_id, ordre)
project_tasks(action_id)
profiles(acteur_id) WHERE actif = true
```

**B2. Optimiser les policies RLS chaudes**
Réécrire les policies des tables les plus lues pour qu'elles invoquent `auth.uid()` une seule fois par requête au lieu d'une fois par ligne :
```
USING ( has_role((SELECT auth.uid()), 'admin') OR ... )
```
Cibles : `profiles`, `user_roles`, `notifications`, `project_actions`, `processes`, `audit_logs`.

**B3. Rendre `dispatch_notification_email` non bloquant**
- Ajouter `IF NOT pg_extension_exists('pg_net') THEN RETURN NEW; END IF;`
- Utiliser une seule URL (lue depuis `app_settings.supabase_url`) avec fallback unique `kong:8000`.
- Wrapper dans `EXCEPTION WHEN OTHERS THEN RETURN NEW` pour qu'un échec SMTP ne fasse jamais échouer la création de la notification.

**B4. Purge automatique `audit_logs`**
- Migration : `DELETE FROM audit_logs WHERE created_at < now() - INTERVAL '180 days'`
- Fonction `cleanup_old_audit_logs()` planifiable (cron via `check-deadlines` ou pg_cron si dispo).

**B5. VACUUM ANALYZE** sur les tables touchées (en fin de migration).

### Lot C — Self-Hosting / Infra (documentation actionnable)

Mise à jour de `diagnostics/SELF_HOSTING_RULES.md` avec une nouvelle section **"Performance & Login"** :

1. **Variables GoTrue critiques** à valider dans `.env` du conteneur :
   - `GOTRUE_SITE_URL` = URL exacte du frontend (sans slash final)
   - `GOTRUE_URI_ALLOW_LIST` inclut l'URL du frontend
   - `GOTRUE_JWT_EXP=3600` (1h, défaut OK)
   - `GOTRUE_REFRESH_TOKEN_ROTATION_ENABLED=true`
2. **Synchronisation horloge serveur** (`timedatectl` / `chrony`) — la cause #1 des "Invalid Refresh Token" est un décalage > 30 s.
3. **Postgres tuning minimal** : `shared_buffers=256MB`, `effective_cache_size=1GB`, `work_mem=8MB` dans `postgresql.conf`.
4. **Kong / Nginx** : activer gzip + cache statique sur `/assets/`.
5. **Limites Docker** : assigner ≥ 2 CPU et 2 Go RAM au conteneur `db`, ≥ 1 CPU au conteneur `kong`.

---

## Détails techniques (section pour développeur)

### Réécriture `AuthContext` — modèle cible

```text
useEffect:
  onAuthStateChange:
    INITIAL_SESSION → setSession + setUser + lance fetchCore()
    SIGNED_IN même userId → ignore (anti-loop focus)
    SIGNED_OUT → reset
    TOKEN_REFRESHED → setSession seul

fetchCore (Promise.all 5 requêtes parallèles — pas de séquentiel):
  profile (colonnes ciblées)
  roles
  role_permissions (colonnes ciblées)
  user_custom_roles + JOIN custom_roles
  custom_role_permissions WHERE custom_role_id IN (sous-requête)
  → setLoading(false) dès profile+roles disponibles
```

### Migration B (extrait représentatif)

```sql
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_roles_user ON public.user_custom_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created ON public.audit_logs(entity_type, created_at DESC);

-- Policies "(SELECT auth.uid())" pour cache plan
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'));

-- Purge initiale
DELETE FROM public.audit_logs WHERE created_at < now() - INTERVAL '180 days';
```

Toutes les commandes utilisent `IF NOT EXISTS` / `DROP IF EXISTS` → rejouables sans erreur (conformité aux règles self-hosting du projet).

---

## Garanties de non-régression

- **Aucune suppression de fonctionnalité** : seules les couches techniques sont modifiées.
- **RLS conservées à l'identique sémantiquement** : seul l'opérateur change pour les rendre cacheables.
- **Triggers conservés** : `dispatch_notification_email` reste actif mais devient non bloquant.
- **Compatible Lovable Cloud + self-hosted** : la migration utilise `IF NOT EXISTS` partout.
- Avant d'écraser une policy je conserve l'ancienne via `DROP IF EXISTS` puis recréation immédiate dans la même transaction.

---

## Gain attendu

| Métrique | Avant | Après |
|----------|-------|-------|
| Login (1ʳᵉ requête → app interactive) | 2 – 4 s | 400 – 800 ms |
| Refresh page authentifiée | 1.5 – 3 s | 300 – 600 ms |
| INSERT notification (UI bloquée) | 200 – 800 ms | < 50 ms |
| Listing actions / processus | 400 – 1200 ms | 100 – 300 ms |

---

## Ordre d'exécution proposé après approbation

1. Lot A (frontend) — visible immédiatement, déployable seul.
2. Lot B (migration unique) — déployée dès l'approbation, idempotente.
3. Lot C — mise à jour de `SELF_HOSTING_RULES.md` que vous appliquez sur votre serveur (variables GoTrue + horloge + tuning Postgres).

Confirmez si je lance les 3 lots, ou si vous préférez que je commence par A seul pour valider le gain avant de toucher la base.
