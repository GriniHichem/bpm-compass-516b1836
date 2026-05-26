# Plan — Ajouter "Plans d'action" à la recherche globale

Objectif : permettre de trouver les projets / plans d'action (table `projects`) via le raccourci ⌘K, au même titre que processus, actions, audits, etc.

## Changements

### 1. `src/hooks/useGlobalSearch.ts`
- Ajouter `"projets"` au type `SearchEntityType`.
- Ajouter `projets: "Plan d'action"` dans `TYPE_LABELS`.
- Nouvelle fonction `searchProjets(term)` qui interroge `projects` sur `title`, `slogan`, `description` (limit 10) et retourne :
  - `title`: `p.title`
  - `subtitle`: `p.slogan` ou extrait de description
  - `url`: `/actions/${p.id}`
  - `status`: `p.statut`
- Ajouter l'entrée dans `SEARCH_FNS`.

### 2. `src/components/GlobalSearch.tsx`
- Ajouter le filtre chip `{ value: "projets", label: "Plans d'action", icon: Target }` (ou `Zap`/`FolderKanban` selon cohérence — utiliser `FolderKanban` de lucide).
- Ajouter `projets: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"` dans `TYPE_COLORS`.
- Ajouter dans le statut map les états projet (`en_cours`, `archive`, `termine`) si manquants.

## Aucun impact
- Aucune modification de schéma, de RLS, ou de logique métier.
- Aucune autre page touchée. La RLS existante de `projects` filtre déjà la visibilité par utilisateur.
