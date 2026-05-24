## Objectif

Dans le module Plan d'action, trier les actions et les tâches par **date d'échéance** (et non plus par ordre manuel/date de création), avec un **bouton triangle** permettant de basculer entre tri **croissant** (plus ancienne → plus récente) et **décroissant** (plus récente → plus ancienne).

## Constat

`src/components/projects/ProjectActionsList.tsx` :
- `sortBy` par défaut = `"ordre"` (ligne 219) → ordre manuel
- Le tri par échéance existe mais uniquement en croissant (lignes 675‑679)
- Les tâches d'une action multi‑tâches sont triées en dur par échéance croissante (lignes 1383‑1388)
- Aucun bouton de direction de tri

## Changements (frontend uniquement, fichier unique)

`src/components/projects/ProjectActionsList.tsx`

1. **État du tri** (ligne 219)
   - Changer `useState("ordre")` → `useState("echeance")` (tri par échéance par défaut)
   - Ajouter `const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")`

2. **Logique de tri des actions** (lignes 672‑683)
   - Appliquer `sortDir` au comparateur échéance : multiplier le résultat par `sortDir === "asc" ? 1 : -1`
   - Idem pour `ordre` et `created_at` (cohérence : la direction s'applique à toutes les options)
   - Conserver la règle « échéances nulles à la fin » dans les deux directions

3. **Tri des tâches** (lignes 1383‑1388)
   - Utiliser le même `sortDir` pour les tâches d'une action multi‑tâches

4. **UI bouton triangle** (à côté du Select de tri, lignes 902‑912 desktop et 984‑990 mobile/drawer)
   - Ajouter un petit `<Button variant="ghost" size="icon">` à droite du Select
   - Icône : `ChevronUp` (asc) / `ChevronDown` (desc) depuis `lucide-react` (déjà importé pour d'autres usages — sinon ajouter à l'import)
   - `onClick` : `setSortDir(d => d === "asc" ? "desc" : "asc")`
   - `title` : `"Tri croissant (plus ancienne d'abord)"` / `"Tri décroissant (plus récente d'abord)"`
   - Taille compacte cohérente avec les contrôles voisins (`h-7 w-7`)

5. **Compteur de filtres actifs** (ligne 945)
   - Ne pas compter `sortDir` comme un filtre actif (c'est un paramètre d'affichage, pas un filtre)
   - Adapter le test `sortBy !== "ordre"` → `sortBy !== "echeance"` pour refléter le nouveau défaut

6. **Reset filtres** (ligne 951)
   - `setSortBy("ordre")` → `setSortBy("echeance")`
   - `setSortDir("asc")`

## Hors scope
- Pas de modification de la vue Gantt / planning plein écran
- Pas de changement DB, RLS, requêtes Supabase, ni de l'ordre `.order("ordre")` côté fetch (le tri reste purement côté client comme aujourd'hui)
- Pas de persistance du choix de tri (état local React, comme l'existant)
