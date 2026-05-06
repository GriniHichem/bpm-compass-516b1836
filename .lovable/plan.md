Historique complet des modifications — Plan d'action

## Objectif

Tracer automatiquement **toutes** les modifications (dates, statuts, avancement, responsables, titres…) faites par les collaborateurs avec droit d'écriture, sur **les actions ET les tâches**, et offrir un historique global du projet avec filtres puissants.

---

## 1. Extension du modèle de données

La table `project_action_history` ne trace aujourd'hui que les actions. On l'étend pour couvrir aussi les tâches, dans une table unifiée pour faciliter les filtres globaux.

Modifications sur `project_action_history` :

- Ajout colonne `task_id uuid NULL` (référence `project_tasks` ON DELETE CASCADE)
- Ajout colonne `entity_type text NOT NULL DEFAULT 'action'` (`'action'` | `'task'`)
- `action_id` reste obligatoire (pour une tâche on stocke l'action parente → permet le filtre "par numéro d'action")
- Index sur `(action_id, created_at DESC)` et `(user_id, created_at DESC)`

Nouveau trigger `trg_log_project_task_changes` sur `project_tasks` (AFTER UPDATE) qui journalise les champs : `title, description, statut, avancement, echeance, date_debut, responsable_id, responsable_user_id, ordre`. Il insère dans `project_action_history` avec `entity_type='task'`, `task_id=NEW.id`, `action_id=NEW.action_id`.

Le trigger existant `trg_log_project_action_changes` reste, on ajoute juste `entity_type='action'` dans son INSERT.

Aucune perte d'historique existant (rétro-compatible).

## 2. Numéro d'action visible

Chaque action reçoit un numéro stable basé sur son champ `ordre` (déjà existant) → affiché comme `#A1`, `#A2`… dans la liste d'actions, dans le Gantt, et dans l'historique. Les tâches deviennent `#A2.T1`, `#A2.T2`… (ordre de la tâche dans son action).

Pas de migration nécessaire — calculé côté front à partir de `ordre`.

## 3. Nouveau composant : Historique global du projet

Remplace l'actuel `ProjectActionHistory` (limité à 1 action) par un composant enrichi `ProjectHistoryDialog` ouvert depuis :

- un bouton **"Historique du projet"** dans le header du Plan d'action
- l'icône horloge existante sur chaque action (pré-filtrée sur cette action)

### UI

Dialog plein écran (max-w-5xl), structure :

```text
┌─ Historique — [Nom projet] ─────────────────────[X]┐
│ Filtres (sticky en haut)                            │
│  [Recherche action #N° ou titre]  [User ▼]          │
│  [Type: Action/Tâche/Tous ▼]  [Champ ▼]             │
│  [Période: 7j / 30j / 90j / Tout]   [Export CSV]    │
├─────────────────────────────────────────────────────┤
│ Timeline groupée par jour                           │
│  ── 6 mai 2026 ──                                   │
│   ⏱ 14:32  Marie D.  #A2 "Audit fournisseur"        │
│            Statut: En cours → Terminée              │
│   ⏱ 11:08  Karim B.  #A2.T3 "Vérifier livraison"    │
│            Échéance: 12/05 → 15/05                  │
│  ── 5 mai 2026 ──                                   │
│   …                                                 │
└─────────────────────────────────────────────────────┘
```

### Filtres

- **Recherche libre** : numéro (`A2`, `2.3`) ou titre d'action/tâche
- **Utilisateur** : dropdown des collaborateurs ayant modifié quelque chose sur ce projet
- **Type** : Toutes / Actions seules / Tâches seules
- **Champ modifié** : Statut / Échéance / Avancement / Responsable / Tous
- **Période** : 7j / 30j / 90j / Tout

Filtres combinables, état persisté en URL (`?user=...&q=A2`).

### Améliorations UX

- Regroupement par jour avec séparateurs date relative (« Aujourd'hui », « Hier », « il y a 3 j »)
- Avatar + nom de l'auteur (jointure `profiles`)
- Badge couleur par type de champ (statut=primary, échéance=amber, responsable=violet…)
- Affichage humain des valeurs (statuts traduits, dates `dd MMM`, responsables = nom et non UUID)
- Numéro d'action cliquable → scroll/ouverture de l'action correspondante
- Pagination serveur (50 lignes, bouton "Charger plus")
- Export CSV de l'historique filtré (nom du projet, période)
- Compteurs en tête : « 128 modifications · 6 contributeurs · 14 actions impactées »

## 4. Sécurité / écriture

- Les triggers sont `SECURITY DEFINER` — la journalisation reste fiable même si l'utilisateur n'a pas de droit direct sur `project_action_history`.
- La policy SELECT existante (`Authenticated users can read history`) est conservée — la visibilité côté UI est filtrée par projet (jointure sur `project_actions.project_id`).
- Aucun changement de logique métier d'écriture : les collaborateurs en mode écriture continuent d'utiliser les UI existantes ; leurs modifications sont automatiquement tracées par les triggers.

## 5. Détails techniques

**Migration** (`supabase/migrations/...`) idempotente :

- `ALTER TABLE project_action_history ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE`
- `ALTER TABLE project_action_history ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'action'`
- Index `idx_pah_action_created`, `idx_pah_user_created`, `idx_pah_task`
- `CREATE OR REPLACE FUNCTION log_project_task_changes()` + `DROP TRIGGER IF EXISTS … / CREATE TRIGGER trg_log_project_task_changes`
- Mise à jour de `log_project_action_changes()` pour positionner `entity_type='action'`

**Fichiers à modifier**

- `src/components/projects/ProjectActionHistory.tsx` → renommé/étendu en `ProjectHistoryDialog.tsx` (mode `actionId` ou `projectId`)
- `src/components/projects/ProjectActionsList.tsx` → bouton "Historique du projet" + numérotation `#A{ordre}` affichée
- `src/components/projects/ProjectGanttChart.tsx` → ajoute aussi le `#A{n}` (déjà partiellement fait)
- `src/integrations/supabase/types.ts` régénéré automatiquement après migration

**Sans casse** : aucun composant existant ne dépend de la signature actuelle au-delà de `ProjectActionHistory` (utilisé uniquement dans `ProjectActionsList`).

---

Confirmez et j'implémente.