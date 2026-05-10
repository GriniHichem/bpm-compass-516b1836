## Diagnostic — pourquoi le module Plan d'actions est lent en self-hosted

Le module `ProjectActionsList` (1795 lignes) charge **toutes les actions + toutes les tâches + toutes les dépendances + tous les profils** d'un projet en une fois, sans pagination. Sur Supabase Cloud, le pooler PgBouncer + les ressources généreuses masquent les coûts. Sur un Postgres self-hosted (Docker, ressources limitées), les mêmes requêtes deviennent visibles. Trois familles de causes :

### A. Côté base de données (impact majeur en self-hosted)
1. **RLS non optimisé** — Les policies appellent `auth.uid()`, `has_role()`, `project_access_level()`, `is_my_project_action()` qui sont ré-évaluées **pour chaque ligne** au lieu d'une fois par requête. Sur 200 actions = 200 appels à `has_role` + sous-requêtes.
2. **Index manquants** sur les chemins chauds : `project_actions.responsable_user_id` (slot 1), `project_action_links(action_id)`, `project_action_dependencies(project_id)`, `audit_logs(entity_type, entity_id)`, `user_roles(user_id, role)` composite, `project_collaborators(project_id, user_id)`.
3. **Trigger `log_audit_event` synchrone** sur toutes les tables CRUD → chaque update d'avancement écrit dans `audit_logs` (full row JSONB) dans la même transaction. Sur self-hosted sans tuning, c'est lent et la table grossit sans cleanup automatique.
4. **Postgres non tuné** : valeurs par défaut Docker (`shared_buffers=128MB`, `work_mem=4MB`, `effective_cache_size=4GB`) inadaptées. Pas d'autovacuum agressif sur audit_logs / project_action_history.
5. **`pg_net` absent ou bloquant** sur self-hosted → trigger `dispatch_notification_email` peut timeouter si Kong est lent.

### B. Côté application React
1. `fetchActions` enchaîne 4 requêtes **séquentielles** (projet → actions → tâches → dépendances) au lieu de les paralléliser.
2. Aucun `useMemo` sur le tri/filtrage/regroupement → recalcul à chaque frappe clavier.
3. `useProfilesById` recalcule la liste d'IDs à chaque render (pas de mémoïsation du tableau).
4. Pas de pagination ni de virtualisation : un projet avec 100+ actions + tâches rend ~1000 nœuds DOM.
5. Updates inline (slider d'avancement, statut) → un `fetchActions()` complet à chaque modif au lieu d'un patch local.

### C. Côté infrastructure self-hosted
1. Kong (gateway) ajoute 50–200 ms par requête si mal dimensionné.
2. Edge Functions Deno : cold start 1–3 s à chaque appel si `min_instances=0`.
3. Pas de CDN devant les assets Vite → bundle 2–3 MB téléchargé à chaque visite.

---

## Plan d'optimisation (par impact / effort)

### Étape 1 — Migration SQL "perf pack" (impact très élevé, risque faible)
Une seule migration idempotente (`IF NOT EXISTS`) qui :
- Ajoute les index manquants listés ci-dessus.
- Réécrit les policies RLS critiques (`project_actions`, `project_tasks`, `project_action_links`, `project_action_history`, `project_action_comments`, `project_action_dependencies`) pour utiliser `(select auth.uid())` → évaluation **une seule fois** par requête (pattern officiel Supabase).
- Convertit le trigger `log_audit_event` en mode "essentiel" : ne logge plus l'INSERT/UPDATE des tables très bavardes (`project_actions`, `project_tasks`, `project_action_history`) — on garde déjà `project_action_history` qui est le journal métier dédié.
- Programme un cleanup mensuel (`pg_cron` si dispo, sinon documentation manuelle) via la fonction existante `cleanup_old_audit_logs(180)`.
- `VACUUM ANALYZE` sur les tables projets.

### Étape 2 — Optimisation `ProjectActionsList.tsx` (impact élevé)
- Paralléliser les 4 requêtes initiales avec `Promise.all`.
- Mémoïser `responsableUserIds` (`useMemo` sur `actions` + `tasksMap`).
- Mémoïser le tri/filtrage de la liste affichée.
- Remplacer les `fetchActions()` post-update par des **patches locaux** (`setActions(prev => prev.map(...))`) — la requête réseau revient déjà avec les données.
- Découper le fichier : extraire `ActionRow`, `TaskRow`, `ActionFilters` en composants `React.memo`.
- Debouncer le slider d'avancement (300 ms) au lieu d'envoyer un UPDATE à chaque pixel.

### Étape 3 — Tuning Postgres self-hosted (impact élevé, hors-Lovable)
Document `diagnostics/SELF_HOSTING_RULES.md` complété avec un bloc `postgresql.conf` recommandé selon la RAM du serveur :

```text
shared_buffers       = 25% RAM
effective_cache_size = 60% RAM
work_mem             = 16MB
maintenance_work_mem = 256MB
random_page_cost     = 1.1   (SSD)
max_connections      = 100
autovacuum_naptime   = 30s
```

Plus : activer `pg_stat_statements`, augmenter le pool PgBouncer si présent, vérifier que `pg_net` est installé (sinon les notifs email bloquent).

### Étape 4 — Frontend / réseau (impact moyen)
- Activer la compression Brotli sur Nginx/Caddy devant Kong.
- Servir les assets Vite avec `Cache-Control: immutable`.
- Optionnel : configurer `min_instances=1` sur les Edge Functions critiques (`send-notification-email`, `check-deadlines`) pour éviter le cold start.

---

## Détails techniques (pour ChatGPT côté serveur)

| Élément | Avant | Après |
|---|---|---|
| RLS `project_actions SELECT` | `auth.uid() = ...` (par ligne) | `(select auth.uid()) = ...` (1 fois) |
| Index `responsable_user_id` (slot 1) | ❌ | ✅ |
| Index `project_action_links(action_id)` | ❌ | ✅ |
| Trigger audit sur `project_actions` | INSERT+UPDATE+DELETE | DELETE seulement |
| `fetchActions` | 4 requêtes séquentielles (~600 ms) | `Promise.all` (~180 ms) |
| Slider avancement | 1 UPDATE / mouvement | 1 UPDATE debounced 300 ms |

---

## Livrables proposés

1. **1 migration SQL** `..._perf_pack_plan_actions.sql` (idempotente, safe à rejouer).
2. **Refactor ciblé** de `ProjectActionsList.tsx` (parallélisation + memo + debounce, sans changer l'UX).
3. **Mise à jour** de `diagnostics/SELF_HOSTING_RULES.md` avec section "Tuning Postgres" + checklist Kong/PgBouncer.
4. **Mise à jour** de `MIGRATION_HORS_LOVABLE.md` avec instructions `VACUUM ANALYZE` + activation `pg_stat_statements`.

Aucune modification fonctionnelle visible utilisateur — uniquement des gains de latence (cible : passer de 2–5 s à 300–600 ms sur le chargement d'un projet de 50 actions sur serveur self-hosted moyen).

Voulez-vous que je lance les **4 étapes d'un coup**, ou préférez-vous commencer uniquement par l'**Étape 1 (migration SQL perf pack)** qui apporte le plus gros gain immédiat sans toucher au code applicatif ?