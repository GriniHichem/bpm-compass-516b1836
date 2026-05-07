
## Constat

Règle confirmée : un collaborateur en **Écriture limitée** peut modifier une action/tâche **uniquement si lui-même OU sa fonction** est nommé(e) responsable. Ailleurs : lecture seule.

Sur le projet test, Salim (`restricted_write`, fonction `3150c9cc` partagée avec Hichem) :
- DB : `can_write_project = false`, `can_write_project_restricted = true`. La RLS bloque déjà toute modification d'action où ni lui ni sa fonction n'est responsable (actions a1000001, 04, 05, 06, 09, 10, 11). Vérifié par `is_my_project_action` → `false`.
- UI : malgré ça, plusieurs boutons et champs s'affichent encore comme éditables sur des actions où il n'a aucune responsabilité, ce qui donne l'illusion qu'il peut tout modifier (et certaines actions passent quand même en base parce qu'elles ont sa fonction au slot 1).

Il y a aussi des fuites côté **tables annexes** dont la RLS est restée `USING (true)` : `project_action_dependencies`, `project_action_history`, `project_deadline_logs`. Un `restricted_write` peut donc créer/supprimer des dépendances et insérer des logs sur des actions qui ne lui appartiennent pas.

## Objectif

Faire correspondre **strictement** ce que l'écran propose et ce que la base autorise, partout. Aucun bouton "modifier", "ajouter", "supprimer", "épingler", "rouvrir", "transférer", "changer date" ne doit s'afficher si la RLS refusera l'opération.

## Changements UI — `ProjectActionsList.tsx`

Rendre le composant pessimiste : par défaut tout est en lecture seule, sauf preuve d'autorisation par ligne.

1. Encapsuler chaque champ inline (Statut, Échéance, Multi-tâches, Avancement, Pin, Responsables, Dates, Liens, Dépendances, Notes) dans `actionEditable` calculé via `canEditAction(action)`. Aujourd'hui plusieurs blocs utilisent encore `canEdit` global ou n'ont aucun garde — ces blocs deviennent invisibles/disabled pour `restricted_write` quand l'action n'est pas la sienne.
2. Pour les tâches, garder `canEditTask(task, parent)` strict : si ni la tâche ni l'action parente ne sont à lui, aucun champ n'est éditable.
3. Désactiver `addAction`, `addTask`, `togglePin`, `toggleMultiTasks`, `recalcActionFromTasks`, `applyDependencyAutomation`, `confirmDisableMulti`, `transferDialog` quand `!actionEditable`. Aujourd'hui `addTask` est déjà sous `canEdit` mais l'input reste visible si on déplie une action étrangère — on cache complètement le footer "Nouvelle tâche".
4. Le bouton "Rouvrir" d'une action figée reste réservé à l'utilisateur nommé OU admin (déjà ok), mais on verrouille pour la fonction partagée seule.
5. Bandeau "Lecture seule" déjà présent — on ajoute la même logique aux dialogs (changement d'échéance, transfert) qui s'ouvraient sans garde.

## Changements UI — `ProjectDetail.tsx`

Aucun changement de logique d'accès (déjà strict). Vérifier que le bouton "Modifier le projet", l'archivage, la suppression, le transfert, la bascule public/privé restent gardés respectivement par `canEdit`, `canArchive`, `canDelete`, `isAdmin || isResponsable`. Audit visuel : OK actuellement.

## Sécurité serveur — migration RLS complémentaire

Les tables suivantes sont encore en `USING (true)` :
- `project_action_dependencies` (4 policies trivialement permissives)
- `project_action_history` (`SELECT … USING true`)
- `project_deadline_logs` (`SELECT/INSERT … USING true`)

Migration idempotente :

- **`project_action_dependencies`** : SELECT si `can_read_project(project_id)`. INSERT/UPDATE/DELETE si `can_write_project(project_id)` OU (`can_write_project_restricted(project_id)` ET `is_my_project_action(source_action_id)` ET `is_my_project_action(target_action_id)`).
- **`project_action_history`** : SELECT si l'action liée est lisible (`can_read_project` via `project_actions`). INSERT conservé (les triggers sont SECURITY DEFINER).
- **`project_deadline_logs`** : SELECT si `can_read_project(project_id)`. INSERT si `can_write_project(project_id)` OU (`can_write_project_restricted(project_id)` ET la ligne référencée est à l'utilisateur via `is_my_project_action` / `is_my_project_task`).

Drop des anciennes policies `USING (true)` avec `IF EXISTS`, recreate sous le même schéma SECURITY DEFINER que la migration précédente. Aucune fonction nouvelle nécessaire.

## Tests de validation (à exécuter avant de fermer le sujet)

Je teste depuis le navigateur de Salim sur le projet test :

| # | Action | Attendu |
|---|---|---|
| 1 | Action a1000001 (aucun responsable) | Tous les champs disabled, badge "Lecture seule" |
| 2 | Action a1000004 (resp = autre fonction) | Idem |
| 3 | Action a1000002 (resp = sa fonction, user = Hichem) | Champs ouverts, badge "Mes actions" |
| 4 | Tenter en console `update project_actions … where id = a1000001` | Erreur RLS |
| 5 | Tenter `insert into project_action_dependencies` sur a1000001 | Erreur RLS |
| 6 | Tenter `update project_deadline_logs` sur a1000001 | Erreur RLS |
| 7 | Bouton "Modifier le projet" / Archivage / Visibilité / Transfert | Cachés |
| 8 | Action a1000003 (sa fonction) → ajouter sous-tâche | OK |
| 9 | Action a1000003 → supprimer la tâche d'un autre | Bouton supprimer caché (déjà désactivé globalement), et RLS bloque même via API |

## Hors périmètre

- Pas de changement de la règle "fonction partagée = droit d'édition" (confirmée).
- Pas de changement de schéma de tables.
- Pas de modification de `Actions.tsx` (liste projets) ni du Gantt — déjà filtrés correctement.
- Pas de modification du système de commentaires — RLS déjà strict.

## Mémoire

Mettre à jour `mem://features/project-access-management` avec la note explicite : "L'écriture limitée est accordée par utilisateur nommé OU par fonction partagée — comportement intentionnel."
