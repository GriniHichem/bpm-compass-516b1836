## Objectif

Restreindre fortement la suppression dans le module Projets / Plan d'action et introduire l'archivage comme alternative douce.

## Nouvelles règles

### 1. Plan d'action (actions & tâches dans `ProjectActionsList`)
- **Suppression d'une action ou d'une tâche** : retirée pour **tous les acteurs** (y compris Admin, RMQ, Responsable, write, restricted_write).
- Les boutons "Supprimer" sur les lignes d'action et de tâche disparaissent complètement.
- Justification : intégrité du plan ; toute action erronée doit être marquée annulée/clôturée, pas supprimée.

### 2. Projet (entité `projects`)
Deux opérations distinctes :

| Opération | Qui ? | Condition |
|-----------|-------|-----------|
| **Supprimer définitivement** | Admin / RMQ uniquement | Projet créé il y a **moins de 7 jours** (`now() - created_at < 7 days`) |
| **Archiver** (statut → `archive`) | Admin / RMQ **ou** Responsable du projet | Toujours possible, à tout moment |
| **Désarchiver** (statut → `en_cours`) | Admin / RMQ **ou** Responsable | Toujours possible |

- Si un Admin tente de supprimer un projet > 7 jours : bouton désactivé avec tooltip explicatif → propose l'archivage.
- L'archivage **masque** le projet de la liste principale (déjà géré : `statut !== "archive"` côté affichage par défaut).
- Filtre "Archivé" déjà présent dans `Actions.tsx` permet de retrouver les projets archivés.

## Impacts code

### `src/components/projects/ProjectActionsList.tsx`
- Supprimer les boutons "Supprimer" sur actions et tâches (et leurs `AlertDialog` associés).
- Retirer la prop `canDelete` ou l'ignorer pour les lignes d'action/tâche.

### `src/pages/ProjectDetail.tsx`
- Ajouter `canArchive = isAdmin || isResponsable`.
- Ajouter `canHardDelete = isAdmin && (Date.now() - new Date(project.created_at).getTime() < 7*24*3600*1000)`.
- Charger `created_at` du projet (ajouter au `select` et à l'interface `Project`).
- Remplacer le bloc actuel "Supprimer" :
  - Bouton **Archiver / Désarchiver** (visible si `canArchive`) → met à jour `statut`.
  - Bouton **Supprimer** (visible si `isAdmin`) :
    - Activé seulement si `canHardDelete`.
    - Si désactivé : tooltip « Suppression possible uniquement durant les 7 jours suivant la création. Utilisez l'archivage. »
- Ajuster le `AlertDialog` de suppression : message rappelle la règle des 7 jours.
- Continuer de passer `canDelete={false}` (ou retirer) à `ProjectActionsList`.

### `src/pages/Actions.tsx`
- Pour la liste de projets : appliquer les mêmes règles si un bouton supprimer existe sur les cartes (à vérifier dans `ProjectCard`).
- `handleDeleteLegacy` (actions correctives legacy) : non impacté par cette demande, conservé tel quel.

### Base de données
Sécuriser côté backend pour empêcher tout contournement :

```sql
-- Trigger BEFORE DELETE sur projects
CREATE OR REPLACE FUNCTION public.guard_project_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Bypass si super_admin
  IF public.has_role(auth.uid(), 'super_admin') THEN RETURN OLD; END IF;
  -- Doit être admin ou rmq
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'rmq')) THEN
    RAISE EXCEPTION 'Seul un administrateur peut supprimer un projet';
  END IF;
  -- Et créé il y a moins de 7 jours
  IF OLD.created_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'Suppression interdite : projet créé il y a plus de 7 jours. Utilisez l''archivage.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_project_delete_trg ON public.projects;
CREATE TRIGGER guard_project_delete_trg
BEFORE DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.guard_project_delete();
```

Migration idempotente (`CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`) → conforme au standard self-hosting.

## Hors scope
- Pas de modification des règles RLS existantes sur `project_actions` / `project_tasks` (déjà OK pour la lecture/écriture).
- Pas de suppression du bouton supprimer sur les actions correctives legacy (`actions` table).
- Pas de notification automatique lors d'archivage (peut être ajouté plus tard).
