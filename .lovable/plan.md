# Sécurisation des accès aux Plans d'action

## Problème identifié

Bug confirmé sur `src/pages/ProjectDetail.tsx` ligne 80 :

```ts
const canEditAll = isAdmin || isResponsable || (myCollabLevel === "write") || (!isPrivate && baseCanEdit);
```

Sur un projet **public**, dès qu'un utilisateur a la permission module `actions.can_edit` (cas de Consultant, Responsable processus, RMQ, Auditeur…), il obtient l'édition complète **même s'il est inscrit comme collaborateur en `restricted_write**` (ex. Salim Alak). Le niveau collaborateur est totalement ignoré.

De plus, les politiques RLS PostgreSQL sur `projects`, `project_actions`, `project_tasks`, `project_collaborators`, `project_action_comments` sont toutes `**USING (true) WITH CHECK (true)**` : aucune protection serveur. Tout repose sur les gardes UI, donc contournable via appel API direct.

## Nouvelle règle d'accès (validée)

> **La permission module ne donne que l'accès au menu "Plans d'action" et à la liste.**
> **Les droits réels sur un projet viennent uniquement du statut sur ce projet.**

### Matrice résultante (par projet)


| Statut sur le projet                  | Lire | Détail | Commenter | Modifier                                  | Archiver | Supprimer  |
| ------------------------------------- | ---- | ------ | --------- | ----------------------------------------- | -------- | ---------- |
| Super Admin / Admin                   | ✓    | ✓      | ✓         | ✓ (tout)                                  | ✓        | ✓ (si <7j) |
| Responsable du projet                 | ✓    | ✓      | ✓         | ✓ (tout)                                  | ✓        | ✗          |
| Collaborateur "write"                 | ✓    | ✓      | ✓         | ✓ (tout)                                  | ✗        | ✗          |
| Collaborateur "restricted_write"      | ✓    | ✓      | ✓         | ✓ (uniquement ses propres actions/tâches) | ✗        | ✗          |
| Collaborateur "read"                  | ✓    | ✓      | ✓         | ✗                                         | ✗        | ✗          |
| Projet public, autre user authentifié | ✓    | ✓      | ✓         | ✗                                         | ✗        | ✗          |
| Projet privé, non collaborateur       | ✗    | ✗      | ✗         | ✗                                         | ✗        | ✗          |


La permission module `actions.can_edit` ne sert plus qu'à : voir le menu, créer un nouveau projet, et accéder à la liste des projets sur lesquels l'utilisateur a un statut.

## Changements UI

### `src/pages/ProjectDetail.tsx`

Réécriture de la section permissions effectives (lignes 65-90) :

```ts
const isAdmin = hasRole("admin") ||  hasRole("super_admin");
const isResponsable = project?.responsable_user_id === user?.id 
                   || (!project?.responsable_user_id && project?.created_by === user?.id);
const myCollabLevel = collaborators.find(c => c.user_id === user?.id)?.access_level;
const isPrivate = project?.visibility === "private";

// Lecture : admin, responsable, collaborateur, ou projet public
const canRead       = isAdmin || isResponsable || !!myCollabLevel || !isPrivate;
const canReadDetail = canRead;

// Édition complète : admin, responsable, ou collaborateur "write"
const canEditAll = isAdmin || isResponsable || myCollabLevel === "write";
// Édition restreinte : ses propres actions/tâches
const canEditOwn = canEditAll || myCollabLevel === "restricted_write";

const canArchive = isAdmin || isResponsable;
const canDelete  = isAdmin && (Date.now() - new Date(project.created_at).getTime() < 7*864e5);
const canComment = canRead && !!user;
```

La référence à `baseCanEdit / baseCanRead / baseCanReadDetail` sur le module `actions` est supprimée (sauf pour le bouton "Nouveau projet" sur la page liste).

### `src/pages/Actions.tsx` (liste projets)

Filtrage strict de la liste : un utilisateur sans rôle admin/RMQ ne voit QUE les projets où il est responsable, créateur, collaborateur, ou les projets publics. Le bouton "Nouveau" reste lié à `actions.can_edit`.

### `src/components/projects/ProjectActionsList.tsx`

Aucun changement de logique — `canEditAction`/`canEditTask` (ligne 149-150) appliquent déjà correctement `restricted_write` à la ligne. Mais il faut renforcer : aucun bouton "modifier le projet" / "ajouter action" / "ajouter tâche globale" ne doit s'afficher quand `canEdit` (= `canEditAll`) est faux. Audit complet de tous les `canEdit && (...)` du fichier pour confirmer.

### `src/components/projects/ProjectCollaborators.tsx`

Le panneau "Accès & Collaborateurs" n'est éditable que par Admin/RMQ/Responsable (déjà ok via la prop `canEdit`, qui passera maintenant à `isAdmin || isResponsable`).

## Sécurité serveur — RLS strictes (migration)

Création d'une fonction SECURITY DEFINER de référence + remplacement de toutes les policies trivialement permissives.

```sql
-- Helper : niveau d'accès effectif d'un user sur un projet
CREATE OR REPLACE FUNCTION public.project_access_level(_user_id uuid, _project_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'super_admin') THEN 'admin'
    WHEN public.has_role(_user_id, 'admin')       THEN 'admin'
    
    WHEN EXISTS (SELECT 1 FROM projects p WHERE p.id = _project_id 
                 AND (p.responsable_user_id = _user_id 
                   OR (p.responsable_user_id IS NULL AND p.created_by = _user_id)))
      THEN 'responsable'
    ELSE (SELECT access_level FROM project_collaborators 
          WHERE project_id = _project_id AND user_id = _user_id LIMIT 1)
  END
$$;

CREATE OR REPLACE FUNCTION public.can_read_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.project_access_level(_user_id, _project_id) IS NOT NULL
      OR EXISTS (SELECT 1 FROM projects WHERE id = _project_id AND visibility <> 'private')
$$;

CREATE OR REPLACE FUNCTION public.can_write_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.project_access_level(_user_id, _project_id) IN ('admin','responsable','write')
$$;

-- Pour restricted_write : la check d'appartenance se fait sur la ligne
CREATE OR REPLACE FUNCTION public.can_write_project_restricted(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.project_access_level(_user_id, _project_id) 
         IN ('admin','responsable','write','restricted_write')
$$;
```

Policies remplacées (drop + recreate) :

- `**projects**` : SELECT si `can_read_project`; UPDATE si `can_write_project` (responsable_user_id reste protégé par le trigger existant); INSERT par tout authentifié; DELETE bloqué par trigger `guard_project_delete`.
- `**project_collaborators**` : SELECT si `can_read_project`; INSERT/UPDATE/DELETE si `project_access_level IN ('admin','responsable')`.
- `**project_actions**` : SELECT si `can_read_project(project_id)`; INSERT/DELETE si `can_write_project`; UPDATE si `can_write_project` OU (`can_write_project_restricted` ET la ligne appartient à l'utilisateur via `responsable_user_id*` ou via `responsable_id*` lié à son `acteur_id`).
- `**project_tasks**` : idem, en remontant à `project_actions.project_id`.
- `**project_action_comments**` : SELECT si `can_read_project` (via action→project); INSERT si `can_read_project` ET `auth.uid() = user_id`; UPDATE/DELETE conservés (auteur ou admin).
- `**project_action_history**` : SELECT si `can_read_project`; INSERT seulement par les triggers existants (déjà SECURITY DEFINER).

Toutes les fonctions sont `STABLE SECURITY DEFINER` pour éviter récursion RLS.

## Détails techniques

- Migration idempotente (`DROP POLICY IF EXISTS` + `CREATE POLICY`), sans toucher aux triggers existants ni aux schémas réservés.
- Pas de modification du schéma des tables, seulement policies + 4 fonctions helpers.
- L'ancien fallback `(!isPrivate && baseCanEdit)` est totalement supprimé côté UI ET côté DB.
- Aucun rôle ne peut "écraser" un projet via permission module : la seule porte est le statut sur le projet (responsable/admin/collaborateur).
- Salim Alak en `restricted_write` : verra le projet, pourra commenter, mais ne pourra modifier QUE les actions/tâches dont il est responsable. Tentative d'UPDATE sur une autre ligne → bloquée par RLS, pas seulement par l'UI.

## Mémoire à mettre à jour

`mem://features/project-access-management` à réécrire pour refléter la nouvelle règle stricte (module ≠ projet).