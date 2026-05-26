# Lot 3 — Workflows pilotés par le RBAC existant (2 niveaux)

Objectif : **supprimer les règles figées** (`OR admin OR rmq`) du moteur de validation et les remplacer par **deux nouveaux niveaux de permission** intégrés à la matrice RBAC existante. Aucun nouvel écran d'administration des workflows — tout passe par les écrans de permissions déjà en place.

---

## Principe

Aujourd'hui, dans `validation_approve()` :
```
auth.uid() = approbateur_user_id OR has_role(admin/rmq/super_admin)
```

Demain :
```
auth.uid() = approbateur_user_id OR can_approve(user, entity_type → module)
```

Les colonnes `can_verify` et `can_approve` s'ajoutent à la matrice existante, gérées dans **Admin → Permissions**, **Rôles personnalisés** et **Permissions par processus**.

---

## Mapping entity_type → module

| entity_type | Module RBAC ciblé |
|---|---|
| `politique_qualite` | `politique_qualite` |
| `objectif_qualite` | `objectifs_qualite` |
| `processus` | `processus` |
| `revue` | `revue_direction` |
| `plan_action` | `plans_action` |
| `fournisseur` | `fournisseurs` |
| `enquete_satisfaction` | `satisfaction` |
| `document` | `documents` |

Fait via une fonction SQL `validation_module_for_entity(entity_type) → module`.

---

## Livrables

### 1. Migration SQL (idempotente)

- **Ajout colonnes** sur 3 tables existantes (toutes `DEFAULT false`) :
  - `role_permissions.can_verify`, `role_permissions.can_approve`
  - `custom_role_permissions.can_verify`, `custom_role_permissions.can_approve`
  - `process_permissions.can_verify`, `process_permissions.can_approve`
- **Initialisation** : `can_verify = true` et `can_approve = true` pour les rôles `admin`, `super_admin`, `rmq` sur tous les 8 modules workflow (préserve le comportement actuel — zéro régression).
- **Nouvelle fonction SQL** `public.has_validation_right(_user, _entity_type, _level text)` qui :
  1. retourne `true` si user a `super_admin` / `admin` (bypass)
  2. mappe `entity_type → module`
  3. consulte `role_permissions` + `custom_role_permissions` (+ `process_permissions` si entity_type='processus')
  4. retourne `true` si au moins un rôle accorde le niveau demandé
- **Remplacement** des contrôles figés dans `validation_verify`, `validation_approve`, `validation_reject`, `validation_obsolete` → utilisent `has_validation_right()`.

### 2. Frontend — extension du modèle de permissions

- **`src/lib/defaultPermissions.ts`** : étendre `PermissionLevel` de `"can_read" | "can_read_detail" | "can_edit" | "can_delete"` vers `+ "can_verify" | "can_approve"`. Mettre à jour `ModulePermissions`, `getEffectivePermission`, et les défauts pour `admin/super_admin/rmq`.
- **`src/contexts/AuthContext.tsx`** : étendre les `SELECT` sur `role_permissions` + `custom_role_permissions` pour inclure les 2 nouvelles colonnes (déjà polymorphe via `ROLE_PERM_COLS`).

### 3. Frontend — UI d'administration (3 écrans existants)

- **`src/pages/AdminPermissions.tsx`** : ajouter 2 colonnes "Vérifier" et "Approuver" dans la matrice rôle × module, avec checkboxes. Disponibles seulement pour les **8 modules workflow** (les autres modules grisés).
- **Gestionnaire de rôles custom** (probablement dans `AdminPermissions` ou écran dédié) : mêmes 2 colonnes.
- **`src/pages/AdminProcessPermissions.tsx`** : ajouter "Vérifier" / "Approuver" pour overrides par processus.

### 4. Frontend — adaptation des écrans de validation

- **`src/components/validation/ValidationPanel.tsx`** : masquer le bouton "Vérifier" si pas `can_verify`, masquer "Approuver" si pas `can_approve` (en plus du contrôle nominatif).
- **`src/pages/ValidationsDashboard.tsx`** : filtrer les workflows visibles → afficher seulement ceux où l'utilisateur a un rôle (désigné OU `can_verify`/`can_approve` sur le module concerné).

---

## Aspects techniques

- **Idempotence** : `ADD COLUMN IF NOT EXISTS`, `DO $$ … EXCEPTION …` pour le seed initial.
- **Sécurité** : `has_validation_right` en `SECURITY DEFINER SET search_path = public`, identique au pattern `has_role`.
- **Compatibilité** : l'**approbateur désigné nominatif** reste prioritaire (un user désigné peut toujours agir même sans le droit matriciel). Cela couvre les cas ad-hoc.
- **Zéro régression** : le seed initial donne aux rôles `admin/rmq/super_admin` les droits sur les 8 modules → comportement identique à aujourd'hui dès la migration.
- **Évolutif** : nouveau rôle custom "Pilote senior" peut désormais valider sans modification de code ni de trigger.

---

## Ce que ce lot N'inclut PAS

- Pas d'écran "configuration des types de workflow" (les 8 types restent figés en base — ajouter un type nécessite toujours un trigger métier `sync_validation_to_*`).
- Pas de modification des triggers métier `sync_validation_to_*` (ils restent identiques).
- Pas de notification supplémentaire (le système actuel suffit).

---

## Découpage proposé

- **Lot 3.1** : Migration SQL + extension `defaultPermissions.ts` + `AuthContext.tsx` (backend + plomberie front)
- **Lot 3.2** : UI Admin (matrice principale + rôles custom + permissions par processus)
- **Lot 3.3** : Adaptation `ValidationPanel` + `ValidationsDashboard`

Chaque sous-lot livrable et testable indépendamment. Le 3.1 seul ne casse rien (les anciens contrôles figés sont remplacés par des nouveaux qui retournent les mêmes résultats grâce au seed).

---

**Question avant d'implémenter** : pour le seed initial, je donne `can_verify + can_approve = true` aux rôles **admin, super_admin, rmq** sur les **8 modules workflow**. Tu veux ajouter d'autres rôles par défaut (ex: `responsable_processus` → `can_verify` sur le module `processus`) ?
