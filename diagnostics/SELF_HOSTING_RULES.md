##  **Prompt Universel — Développement Compatible Self-Hosting**

*Copiez-collez ce texte en début de conversation pour chaque nouveau projet.*

---

\# RÈGLES DE DÉVELOPPEMENT OBLIGATOIRES — Compatibilité Self-Hosting (Ubuntu/Docker \+ Supabase)

Ce projet DOIT pouvoir fonctionner en environnement self-hosted (Supabase local ou Docker).  
Toutes les règles ci-dessous sont IMPÉRATIVES et s'appliquent à CHAQUE fonctionnalité développée.

\---

\#\# 1\. Edge Functions

\- TOUJOURS configurer \`verify\_jwt \= false\` dans \`supabase/config.toml\` pour chaque fonction  
\- L'authentification est gérée MANUELLEMENT dans le code Deno :  
  \- Lire le header \`Authorization\`  
  \- Créer un client Supabase avec ce header  
  \- Appeler \`getUser()\` ou \`getClaims()\` pour vérifier l'identité  
  \- Vérifier les rôles via une fonction \`has\_role()\` RPC avec un client \`service\_role\`  
\- CORS obligatoire sur TOUTES les réponses (succès, erreurs, OPTIONS) :  
  \`\`\`typescript  
  const corsHeaders \= {  
    "Access-Control-Allow-Origin": "\*",  
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",  
  };  
  // Traiter OPTIONS en premier  
  if (req.method \=== "OPTIONS") {  
    return new Response(null, { headers: corsHeaders });  
  }

* JAMAIS de verify\_jwt \= true (bloque les appels en self-hosted)

---

## **2\. Appels Frontend → Edge Functions**

* TOUJOURS utiliser supabase.functions.invoke('nom-fonction', { body: {...} })  
* JAMAIS de fetch() direct vers /functions/v1/... (perd le JWT, cause 401\)  
* Le client Supabase gère automatiquement le JWT et les headers

---

## **3\. Migrations SQL**

* TOUJOURS CREATE TABLE IF NOT EXISTS  
* TOUJOURS CREATE INDEX IF NOT EXISTS  
* TOUJOURS CREATE TYPE IF NOT EXISTS ou bloc DO $$ BEGIN ... EXCEPTION WHEN duplicate\_object THEN NULL; END $$; pour les enums  
* TOUJOURS INSERT INTO ... ON CONFLICT DO NOTHING pour les données seed (buckets, settings, rôles)  
* Chaque migration DOIT être idempotente (rejouable sans erreur)  
* JAMAIS de ALTER DATABASE postgres (interdit par Supabase)  
* JAMAIS de modification des schémas réservés : auth, storage, realtime, supabase\_functions, vault  
* Utiliser des triggers de validation au lieu de CHECK constraints pour les validations temporelles (expire\_at \> now())

---

## **4\. Storage Buckets**

* Création TOUJOURS avec INSERT INTO storage.buckets (...) ON CONFLICT (id) DO NOTHING  
* JAMAIS de INSERT INTO storage.buckets sans ON CONFLICT

---

## **5\. Realtime**

* Pour chaque table utilisant postgres\_changes, inclure dans la migration : ALTER PUBLICATION supabase\_realtime ADD TABLE public.nom\_table;  
* JAMAIS supposer que la publication Realtime est activée automatiquement

---

## **6\. SMTP & Emails**

* Configuration SMTP exclusivement via une table app\_settings (clés : smtp\_host, smtp\_port, smtp\_user, smtp\_password, support\_email, app\_name)  
* Les Edge Functions d'envoi email utilisent denomailer avec config lue depuis app\_settings  
* Les triggers DB qui envoient des emails doivent inclure un fallback multi-URL pour self-hosted :  
  * kong:8000 (réseau Docker interne)  
  * host.docker.internal:54321 (Docker Desktop)  
  * 127.0.0.1:54321 (accès local direct)  
*   
* JAMAIS de SMTP hardcodé dans le code

---

## **7\. Fonctionnalités IA**

* Le secret LOVABLE\_API\_KEY et l'URL ai.gateway.lovable.dev sont EXCLUSIFS à Lovable Cloud  
* Toute fonctionnalité IA DOIT prévoir un fallback configurable :  
  1. Si LOVABLE\_API\_KEY est disponible → utiliser le gateway Lovable  
  2. Sinon → lire une clé API custom (OpenAI, Gemini, etc.) depuis app\_settings  
*   
* JAMAIS de dépendance exclusive au gateway Lovable sans fallback

---

## **8\. Plugin lovable-tagger**

* Garder STRICTEMENT conditionnel : mode \=== "development" && componentTagger()  
* Filtrer avec .filter(Boolean) pour éviter les erreurs si le package n'est pas installé  
* JAMAIS inclure en mode production

---

## **9\. Extension pg\_net**

* Si des triggers DB appellent des Edge Functions via net.http\_post(), inclure : CREATE EXTENSION IF NOT EXISTS pg\_net WITH SCHEMA extensions;  
* Encapsuler dans EXCEPTION WHEN OTHERS THEN NULL pour les environnements sans pg\_net  
* Documenter que sans pg\_net, les notifications email depuis les triggers seront ignorées (le push in-app fonctionne toujours)

---

## **10\. Configuration Auth (GoTrue)**

* En Lovable Cloud : utiliser l'outil configure\_auth  
* En self-hosted : configurer dans docker-compose.yml ou .env de GoTrue :  
  * GOTRUE\_MAILER\_AUTOCONFIRM (si auto-confirm souhaité)  
  * GOTRUE\_SMTP\_HOST, GOTRUE\_SMTP\_PORT, GOTRUE\_SMTP\_USER, GOTRUE\_SMTP\_PASS  
  * GOTRUE\_SITE\_URL (URL du frontend)  
*   
* NE JAMAIS activer l'auto-confirm email sauf demande explicite de l'utilisateur  
* TOUJOURS implémenter l'authentification (signup/login) si des tables ont des RLS policies  
* JAMAIS d'inscription anonyme

---

## **11\. Variables d'Environnement**

* Frontend (VITE\_\*) : VITE\_SUPABASE\_URL, VITE\_SUPABASE\_PUBLISHABLE\_KEY  
* Vérifier leur présence avant usage critique  
* JAMAIS de secrets privés dans les variables VITE\_\* (exposées dans le bundle)  
* Edge Functions : utiliser Deno.env.get('SUPABASE\_URL') et Deno.env.get('SUPABASE\_SERVICE\_ROLE\_KEY')

---

## **12\. URLs et Domaines**

* JAMAIS hardcoder d'URLs .supabase.co dans le code applicatif  
* JAMAIS hardcoder d'URLs .lovable.app dans le code applicatif  
* Frontend : import.meta.env.VITE\_SUPABASE\_URL  
* Edge Functions : Deno.env.get('SUPABASE\_URL')  
* Triggers DB : lire depuis la table app\_settings (clé supabase\_url)

---

## **13\. Rôles Utilisateurs & Sécurité**

* Les rôles DOIVENT être stockés dans une table user\_roles séparée (JAMAIS sur profiles)  
* Utiliser une fonction has\_role(user\_id, role) en SECURITY DEFINER pour les vérifications RLS  
* JAMAIS vérifier le statut admin via localStorage ou credentials hardcodés  
* Les opérations admin (création utilisateur, reset password) passent par des Edge Functions dédiées

---

## **14\. Checklist Pré-Développement**

Avant chaque nouvelle fonctionnalité, vérifier :

*  Edge Functions avec verify\_jwt \= false \+ auth manuelle  
*  Appels via supabase.functions.invoke() uniquement  
*  Migrations idempotentes (IF NOT EXISTS, ON CONFLICT)  
*  Pas de dépendance exclusive à Lovable Cloud  
*  Realtime activé pour les tables concernées  
*  Storage buckets avec ON CONFLICT DO NOTHING  
*  Variables d'environnement documentées et vérifiées  
*  Aucune URL hardcodée  
*  RLS policies \+ authentification implémentée  
*  CORS complet sur toutes les Edge Functions

\---

Ce prompt est \*\*générique et réutilisable\*\* pour tout projet de gestion (ISO 9001, ERP, CRM, etc.) développé sur Lovable avec objectif de déploiement self-hosted.  

---

## **15\. Performance & Login (CRITIQUE pour Self-Hosted)**

Section ajoutée suite à l'audit de performance d'avril 2026.

### **15.1 Variables GoTrue (auth) à vérifier impérativement**

Dans le `.env` du conteneur **gotrue / supabase-auth** :

```
GOTRUE_SITE_URL=https://votre-frontend.example.com         # SANS slash final
GOTRUE_URI_ALLOW_LIST=https://votre-frontend.example.com   # virgule pour plusieurs
GOTRUE_JWT_EXP=3600                                         # 1h, défaut
GOTRUE_REFRESH_TOKEN_ROTATION_ENABLED=true
GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL=10            # secondes
GOTRUE_DISABLE_SIGNUP=true                                  # sécurité (login admin uniquement)
```

**Symptôme typique d'une mauvaise config** : erreur `Invalid Refresh Token: Refresh Token Not Found` au reload, ou login qui se déconnecte au bout de quelques minutes.

### **15.2 Synchronisation horloge serveur (cause #1 des bugs auth)**

```bash
sudo timedatectl set-ntp true
sudo systemctl enable --now systemd-timesyncd
timedatectl status   # vérifier "System clock synchronized: yes"
```

Un décalage > 30 secondes entre le serveur et le navigateur invalide silencieusement TOUS les JWT.

### **15.3 Tuning Postgres minimal**

Dans `postgresql.conf` du conteneur DB (ou variables Docker `POSTGRES_*`) :

```
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 8MB
maintenance_work_mem = 64MB
random_page_cost = 1.1            # SSD
max_connections = 100
```

Redémarrer le conteneur après modification. Pour vérifier :
```sql
SHOW shared_buffers; SHOW work_mem;
```

### **15.4 Index obligatoires sur tables chaudes**

La migration d'optimisation crée automatiquement les index ci-dessous. Si vous repartez d'une base fraîche, vérifiez leur présence :

```sql
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN (
  'idx_user_roles_user',
  'idx_user_custom_roles_user',
  'idx_notifications_user_created',
  'idx_notifications_entity',
  'idx_audit_logs_entity_created',
  'idx_project_actions_project_ordre',
  'idx_project_tasks_action',
  'idx_profiles_acteur_actif'
);
```

Tous doivent être listés. Sinon, rejouer la dernière migration de performance.

### **15.5 Politiques RLS — pattern obligatoire**

Toutes les nouvelles policies DOIVENT envelopper `auth.uid()` dans un `(SELECT …)` pour permettre à Postgres de cacher la valeur sur toute la requête :

```sql
-- ✅ BON — auth.uid() évalué une fois par requête
CREATE POLICY my_policy ON public.ma_table FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR has_role((SELECT auth.uid()), 'admin'::app_role));

-- ❌ MAUVAIS — auth.uid() évalué à chaque ligne
CREATE POLICY my_policy ON public.ma_table FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
```

Sur des tables de plusieurs milliers de lignes, le gain est 5x à 50x.

### **15.6 Purge périodique du journal d'activité**

La table `audit_logs` peut atteindre des millions de lignes. Planifier la fonction de purge (180 jours par défaut) :

**Option A — pg_cron (si extension disponible)** :
```sql
SELECT cron.schedule('cleanup-audit-logs', '0 3 * * 0',
  $$SELECT public.cleanup_old_audit_logs(180);$$);
```

**Option B — cron système hebdomadaire** :
```bash
0 3 * * 0 docker exec supabase-db psql -U postgres -c "SELECT public.cleanup_old_audit_logs(180);"
```

### **15.7 Triggers d'envoi email — non bloquants**

Le trigger `dispatch_notification_email` est désormais **fire-and-forget** :
- Si `pg_net` n'est pas installé, le trigger retourne sans erreur (notif push reste créée).
- Si SMTP échoue, l'erreur est avalée — aucune notification n'est jamais perdue dans la base.
- Une seule URL est utilisée (lue depuis `app_settings.supabase_url`, fallback `http://kong:8000`).

**À configurer en self-host** : insérer/mettre à jour
```sql
INSERT INTO public.app_settings(key, value)
VALUES('supabase_url', 'http://kong:8000')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### **15.8 Limites Docker recommandées**

Dans `docker-compose.yml` self-hosted :

```yaml
services:
  db:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
  kong:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
  auth:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

### **15.9 Frontend — préférer `useAuth()` aux appels directs**

NE JAMAIS appeler `supabase.auth.getUser()` ou `getSession()` dans des composants applicatifs :
- Source de vérité unique : `const { user, session, profile, loading } = useAuth();`
- Évite les round-trips réseau inutiles vers GoTrue à chaque montage de composant.

### **15.10 Checklist post-déploiement**

```
[ ] timedatectl status confirme la synchro NTP
[ ] GOTRUE_SITE_URL pointe vers le frontend (sans slash final)
[ ] GOTRUE_URI_ALLOW_LIST inclut le frontend
[ ] app_settings.supabase_url = http://kong:8000 (ou URL externe)
[ ] Index de performance présents (cf 15.4)
[ ] Purge audit_logs planifiée
[ ] Limites Docker appliquées (cf 15.8)
[ ] Test login < 1 seconde après saisie
[ ] Test refresh page authentifiée < 1 seconde
```


---

## **16. Tuning Postgres pour Self-Hosting (perf pack Plan d'actions)**

### 16.1 — `postgresql.conf` recommandé

Adapter selon la RAM totale du serveur (valeurs pour 8 GB ; ajuster proportionnellement) :

```conf
shared_buffers       = 2GB        # ~25% RAM
effective_cache_size = 5GB        # ~60% RAM
work_mem             = 16MB       # par opération de tri
maintenance_work_mem = 256MB      # VACUUM, CREATE INDEX
random_page_cost     = 1.1        # SSD (4.0 par défaut = HDD)
max_connections      = 100        # cohérent avec PgBouncer
autovacuum           = on
autovacuum_naptime   = 30s
checkpoint_completion_target = 0.9
wal_buffers          = 16MB
```

Redémarrer le conteneur Postgres après modification :
```bash
docker compose restart db
```

### 16.2 — Activer pg_stat_statements (pour profiler les requêtes lentes)

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- Top 20 requêtes les plus lentes
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 20;
```

### 16.3 — Maintenance hebdomadaire

```sql
-- À exécuter chaque semaine (cron ou pg_cron)
VACUUM ANALYZE public.project_actions;
VACUUM ANALYZE public.project_tasks;
VACUUM ANALYZE public.project_action_history;
VACUUM ANALYZE public.audit_logs;
SELECT public.cleanup_old_audit_logs(180);  -- purge >180 jours
```

### 16.4 — Index de performance Plan d'actions (déjà appliqués via migration)

Les index suivants sont créés automatiquement par la migration `_perf_pack_plan_actions.sql` :
- `idx_project_actions_resp_user`, `idx_project_actions_resp_user_2/3`
- `idx_project_tasks_resp_user`, `idx_project_tasks_action`
- `idx_project_action_links_action`
- `idx_project_action_dependencies_project/source/target`
- `idx_project_action_comments_action`
- `idx_project_collaborators_project_user`

### 16.5 — RLS optimisé `(select auth.uid())`

Toutes les policies critiques du module Plan d'actions utilisent désormais
`(select auth.uid())` au lieu de `auth.uid()`. Postgres évalue alors la
fonction **une seule fois par requête** (et non par ligne), ce qui peut
diviser par 5 à 10 le temps d'une requête sur une table contenant 100+ lignes.

**Règle pour toute nouvelle policy RLS** : toujours envelopper `auth.uid()` :

```sql
-- ❌ Lent (évalué par ligne)
CREATE POLICY foo ON ma_table FOR SELECT USING (auth.uid() = user_id);

-- ✅ Rapide (évalué une fois)
CREATE POLICY foo ON ma_table FOR SELECT USING ((select auth.uid()) = user_id);
```

### 16.6 — Réduire le bruit du trigger `log_audit_event`

Pour les tables très actives (UPDATE fréquents : avancement, statut, slider),
ne pas attacher le trigger générique `log_audit_event` si un journal métier
dédié existe déjà (ex. `project_action_history`). Sinon double écriture
synchrone à chaque UPDATE → ralentit l'UI sur self-hosted.

### 16.7 — Kong / PgBouncer

- Kong : augmenter `KONG_NGINX_WORKER_PROCESSES=auto` et `KONG_MEM_CACHE_SIZE=256m`
- PgBouncer : `pool_mode=transaction`, `default_pool_size=20`, `max_client_conn=200`
- Activer la compression Brotli sur Nginx/Caddy devant Kong

### 16.8 — Edge Functions cold start

Pour éviter les cold starts de 1-3 s sur les fonctions critiques
(`send-notification-email`, `check-deadlines`), configurer un keep-alive
externe (uptime-kuma, cron `curl`) toutes les 5 minutes.
