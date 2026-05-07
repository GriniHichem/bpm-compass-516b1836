## Objectif

Ajouter un troisième niveau d'accès aux **Plans d'action** d'un projet, à mi-chemin entre lecture seule et écriture complète :

> **Écriture limitée** — l'utilisateur peut modifier **uniquement les actions (et leurs tâches)** dans lesquelles il est désigné comme **responsable** (responsable_id / responsable_user_id sur les 3 slots, ou responsable d'une tâche enfant).

## Logique fonctionnelle

### Nouveau niveau d'accès `restricted_write`

Trois niveaux sur `project_collaborators.access_level` :


| Niveau                         | Lecture détail | Édition actions                 | Édition tâches                                                     | Création/suppression |
| ------------------------------ | -------------- | ------------------------------- | ------------------------------------------------------------------ | -------------------- |
| `read`                         | ✅ toutes       | ❌                               | ❌                                                                  | ❌                    |
| `restricted_write` *(nouveau)* | ✅ toutes       | ✅ **uniquement si responsable** | ✅ **uniquement si responsable de la tâche ou de l'action parente** | ❌ (jamais)           |
| `write`                        | ✅ toutes       | ✅ toutes                        | ✅ toutes                                                           | ❌                    |


Le **responsable du projet** et les **Admin/RMQ** gardent l'accès complet (inchangé).

### Règle "responsable d'une action"

Un utilisateur est considéré responsable d'une action si **au moins une** de ces conditions est vraie :

- `responsable_user_id`, `responsable_user_id_2` ou `responsable_user_id_3` = son `user_id`
- son `acteur_id` (lien profil → acteur) correspond à `responsable_id`, `responsable_id_2` ou `responsable_id_3`

Idem pour les tâches (`responsable_user_id` ou `responsable_id`).

### Effets visibles dans l'UI

Pour un utilisateur en `restricted_write` :

1. **Liste des actions** : badge discret "Mes actions" sur les lignes éditables ; cadenas grisé sur les autres.
2. **Boutons d'édition** (statut, avancement, échéance, responsables, description) : actifs seulement sur les actions/tâches assignées ; désactivés ailleurs avec un tooltip *"Vous ne pouvez modifier que les actions dont vous êtes responsable"*.
3. **Boutons "Ajouter action / tâche / supprimer"** : masqués.
4. **Filtre rapide** "Mes actions uniquement" pré-coché (optionnel).
5. **Gestion des collaborateurs** (`ProjectCollaborators`) : nouveau choix dans le `Select` d'access level avec libellé **"Écriture limitée — uniquement ses actions"**.

### Sécurité (back-end)

Mise à jour des **policies RLS** sur `project_actions` et `project_tasks` :

- `UPDATE` autorisé si :
  - admin / rmq / super_admin **OU**
  - responsable du projet **OU**
  - collaborateur `write` **OU**
  - collaborateur `restricted_write` **ET** utilisateur listé comme responsable de la ligne (ou de l'action parente pour une tâche)
- `INSERT` / `DELETE` : inchangés (jamais autorisés en `restricted_write`).

Création d'une fonction SECURITY DEFINER `is_action_responsible(_action_id, _user_id)` et `is_task_responsible(_task_id, _user_id)` pour éviter la récursion RLS.

## Détails techniques

### 1. Migration SQL

```text
- Pas de changement de schéma : la colonne access_level reste TEXT.
- Ajout (idempotent) d'un CHECK : access_level IN ('read','restricted_write','write')
- Création des fonctions :
    public.is_action_responsible(_action_id uuid, _user_id uuid) RETURNS bool
    public.is_task_responsible(_task_id uuid, _user_id uuid) RETURNS bool
  Elles vérifient les 3 slots responsable_user_id + jointure profiles.acteur_id
  vs responsable_id sur project_actions / project_tasks.
- Remplacement des policies UPDATE existantes sur project_actions et project_tasks
  pour intégrer la branche restricted_write.
```

### 2. Front-end

`**ProjectDetail.tsx**` — calcul `canEdit` enrichi :

```text
const myCollabLevel = myCollab?.access_level;  // 'read' | 'restricted_write' | 'write'
const canEditAll = isAdmin || isResponsable || myCollabLevel === 'write' || (!isPrivate && baseCanEdit);
const canEditOwn = canEditAll || myCollabLevel === 'restricted_write';
```

Passage de deux props à `ProjectActionsList` : `canEditAll`, `canEditOwn` + `currentUserId`, `currentActeurId`.

`**ProjectActionsList.tsx**` — helper :

```text
const isMine = (a) =>
  [a.responsable_user_id, a.responsable_user_id_2, a.responsable_user_id_3].includes(userId)
  || [a.responsable_id, a.responsable_id_2, a.responsable_id_3].includes(myActeurId);

const canEditAction = (a) => canEditAll || (canEditOwn && isMine(a));
const canEditTask   = (t, parent) => canEditAll || (canEditOwn && (isTaskMine(t) || isMine(parent)));
```

Tous les `disabled` / rendu conditionnel des boutons utilisent `canEditAction(a)` au lieu de `canEdit`.

`**ProjectCollaborators.tsx**` — ajouter l'option dans le Select avec description en sous-texte.

### 3. Cohérence existante

- `canDelete` reste basé sur Admin/RMQ + Responsable projet (inchangé).
- Les commentaires : `canComment` reste lié à la lecture (inchangé).
- L'historique d'audit (`log_project_action_changes`) continue de tracer toute modification.

## Hors-scope

- Pas de migration des données existantes : tous les collaborateurs `read`/`write` actuels gardent leur niveau.
- Pas de modification du module Projets en dehors de l'onglet Actions/Tâches.
- Pas de changement sur le Gantt (lecture seule pour tous, déjà le cas).

## Livrables

1. Migration SQL (fonctions + policies + check constraint).
2. `ProjectDetail.tsx` : calcul des deux niveaux + props.
3. `ProjectActionsList.tsx` : helpers `isMine`, `canEditAction`, `canEditTask` + application sur tous les contrôles d'édition.
4. `ProjectCollaborators.tsx` : option "Écriture limitée" dans le Select.
5. Badge UI "Mes actions" et tooltip de blocage.