# Lot 4 — Logique d'intersection pour les overrides par processus

## Changement de règle

Aujourd'hui : `global OR override` → l'override **étend** les droits (le plus permissif gagne).

Demain : `global AND (pas d'override OU override accordé)` → l'override **restreint** les droits.

### Exemples concrets (validation can_approve)

| Cas | Global module | Overrides processus | Résultat |
|---|---|---|---|
| 1 | ✅ Approuver | aucun override pour ce rôle | ✅ approuve tous les processus |
| 2 | ✅ Approuver | overrides sur A et B uniquement (cochés) | ✅ approuve **A et B seulement** ; ❌ C, D, E… |
| 3 | ✅ Approuver | overrides existent sur A, B (décochés) | ❌ approuve **rien** |
| 4 | ❌ pas global | overrides A, B cochés | ❌ aucun droit (sans global, l'override seul ne suffit pas) |
| 5 | Admin / RMQ / Super Admin | n'importe | ✅ bypass total (inchangé) |

**Règle**: dès qu'au moins une ligne d'override existe pour `(rôle, processus_quelconque)`, on bascule en mode liste blanche pour ce rôle → seuls les processus avec override coché passent. Sans aucun override = comportement global appliqué partout.

## Périmètre

Cette logique s'applique uniquement à `entity_type = 'processus'` (seul cas où des overrides par entité existent). Les autres modules (documents, plans d'action…) restent sur la matrice globale pure.

S'applique aux 7 niveaux de `process_role_permissions` : `can_read`, `can_detail`, `can_comment`, `can_edit`, `can_version`, `can_verify`, `can_approve`.

## Livrables

### 1. Migration SQL

**Réécrire `has_validation_right(_user, _entity_type, _level, _entity_id)`** avec la nouvelle logique pour `entity_type='processus'` :

```text
si admin/super_admin/rmq → true
si pas de droit global sur module → false
si entity_id fourni:
   si EXISTS override (role, processus_quelconque) pour ce user+level:
      → retourner override(role, entity_id, level)  -- whitelist
   sinon:
      → true  -- pas d'override = global s'applique
sinon (pas d'entity_id, ex: dashboard):
   → true (le filtrage fin se fera côté ligne)
```

**Nouvelle fonction helper** `process_access_allowed(_user_id, _process_id, _level)` qui applique la même logique d'intersection pour les 5 niveaux de lecture/édition processus. Utilisée par `useProcessPermissions` côté front.

### 2. Frontend — `src/hooks/useProcessPermissions.ts`

Réécrire `checkProcessPermission` :
- Admin/super_admin → true
- `globalFallback === false` → false (pas de droit global = exit)
- Si overrides existent pour ce user (n'importe quel processus, ce niveau) → retourner l'override de ce processus (true/false)
- Sinon → true (global s'applique)

Charger en plus un set `rolesWithOverrides[level]` calculé à partir des permissions chargées, pour détecter le mode whitelist.

### 3. Frontend — `src/pages/AdminProcessPermissions.tsx`

Ajouter un bandeau d'aide en haut : *"Cocher un processus pour un rôle = restriction. Si au moins un processus est coché pour un niveau, le rôle perd l'accès aux processus non cochés (même si la matrice globale l'autorise)."*

Ajouter sur chaque colonne (Lire/Détail/…/Vérifier/Approuver) un badge indiquant le nombre de rôles en mode whitelist sur ce niveau.

### 4. Frontend — `ValidationsDashboard.tsx` et `ValidationPanel.tsx`

Aucun changement de code nécessaire : ces écrans appellent déjà `has_validation_right(entity_id)` côté RPC. Le nouveau comportement s'applique automatiquement.

### 5. Migration de données — non destructive

Pas de modification des lignes existantes. Note dans le bandeau d'admin : les overrides actuels (issus de l'ancienne logique additive) doivent être **revus** car ils deviennent restrictifs.

## Aspects techniques

- Idempotent : `CREATE OR REPLACE FUNCTION`.
- Conservation : signature et nom de `has_validation_right` inchangés (toutes les RPC `validation_*` continuent de fonctionner).
- Performance : un EXISTS supplémentaire par appel (négligeable, index présent sur `process_role_permissions(role, process_id)`).
- Bypass admin/super_admin/rmq préservé partout.

## Hors périmètre

- Pas d'écran de visualisation "qui peut approuver quoi" (pourra venir dans un Lot 5 si besoin).
- Pas de changement sur la combinaison multi-rôles (le plus permissif reste appliqué entre **rôles distincts** du même user, l'intersection s'applique **par rôle**).
- Pas de logique d'intersection sur les modules non-processus.

## Question avant build

Pour un user qui a **deux rôles** (ex: `consultant` + un rôle custom), si l'un est en mode whitelist (overrides existent) et l'autre non, quelle règle ?
- **A** — Chaque rôle évalué indépendamment, OR final entre les rôles (plus permissif wins entre rôles, intersection à l'intérieur d'un rôle). ← recommandé, cohérent avec l'existant.
- **B** — Dès qu'un rôle du user a des overrides, on bascule tout le user en whitelist.
