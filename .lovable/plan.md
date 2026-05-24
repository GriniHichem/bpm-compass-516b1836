## Objectif
Dans le module Plan d'action, mode planning plein écran (Gantt), afficher l'intégralité du libellé de l'action (et tâche/projet) au lieu de tronquer.

## Constat
Dans `src/components/projects/ProjectGanttChart.tsx`, la colonne label du Gantt :
- a une largeur fixe `w-72` (ligne 176)
- applique `truncate` sur le `<span>` du titre (ligne 194)

Résultat : les phrases longues sont coupées par `…` dans la vue plein écran.

## Changements (frontend uniquement, fichier unique)

`src/components/projects/ProjectGanttChart.tsx`

1. Ligne 176 — élargir la colonne label en mode plein écran :
   ```tsx
   className={`${fullscreen ? "w-[28rem]" : "w-72"} shrink-0 flex items-start gap-1.5 px-3 py-2 border-r border-border/20`}
   ```
   (et `items-start` pour bien aligner quand le texte passe sur 2-3 lignes)

2. Ligne 194 — autoriser le retour à la ligne en mode plein écran :
   ```tsx
   <span className={`text-xs ${fullscreen ? "whitespace-normal break-words leading-snug" : "truncate"} ${item.level === "project" ? "font-semibold" : "font-medium"} text-foreground ${item.statut === "annulee" ? "line-through opacity-50" : ""}`}>
   ```

3. Ajuster la hauteur de ligne : la rangée a actuellement une hauteur fixe `h-9` (à vérifier autour du conteneur `onClick={handleRowClick}`). En mode `fullscreen`, passer à `min-h-9` pour laisser grandir la ligne sans casser l'alignement des barres Gantt à droite (la barre reste centrée verticalement via `items-center` sur la zone timeline).

## Hors scope
- Pas de modification de la timeline/barres Gantt.
- Pas de modification du mode inline (non plein écran).
- Aucun changement DB/RLS.
