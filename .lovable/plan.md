# Plan — UX/UI mobile & tablette pour modules sensibles

## Diagnostic actuel

L'application est techniquement responsive (Tailwind + `useIsMobile`, breakpoint 768 px) mais plusieurs zones critiques restent **inadaptées en dessous de 1024 px** :

| Module / Composant | Problèmes constatés |
|---|---|
| `Actions.tsx` (Plans d'action) | Toolbar `flex-wrap` empile 5 contrôles → +120 px sur mobile. KPI strip bien (`grid-cols-2 sm:grid-cols-4`). Onglet Planning (Gantt) non scrollable correctement sur tablette. |
| `ProjectActionsList.tsx` (1335 lignes) | Filter bar = `Select w-[120px]` × 3 + bouton qui débordent. Cards d'action trop denses : statut + 3 responsables + dates + badges sur la même ligne, illisible < 768 px. Selects dans formulaire édition `grid-cols-3` cassent. |
| `NonConformites.tsx` | Workflow stepper 6 étapes en `flex-wrap` → 3 lignes sur mobile. Card NC : badges (gravité + criticité + statut + chevron) débordent sur petit écran. Dialog détail `grid-cols-2` partout, formulaires illisibles. |
| `Audits.tsx` | Onglet "Constats" utilise `<Table>` HTML → scroll horizontal forcé sur mobile, colonnes Description / Preuve tronquées violemment. Stepper similaire. |
| Dialogs globaux | `max-w-4xl max-h-[90vh]` mais padding interne fixe → contenu coupé sur iPhone SE / iPad portrait. Pas de slide-up natif mobile. |
| Navbar / sidebar | OK : `Sheet` mobile déjà présent (md:hidden). À renforcer avec ergonomie tactile. |
| Cibles tactiles | Beaucoup de boutons en `h-7` / `h-9` (28-36 px) → en dessous des 44 px Apple HIG / 48 dp Material. |

---

## Stratégie globale

Trois axes, chacun **non destructif** (aucune fonctionnalité supprimée) et **progressivement amélioré** par module.

### Axe 1 — Système responsive transverse (1 lot, base partagée)

1. **Hook `useBreakpoint`** étendu (mobile / tablet / desktop) à côté de `useIsMobile` existant — breakpoints 640 / 1024 px.
2. **Composant `ResponsiveDialog`** wrapper qui devient `Sheet` (slide-up bottom) sur mobile, `Dialog` classique sur desktop. Réutilisable partout sans changer l'API.
3. **Composant `ResponsiveTable`** : table HTML standard ≥ 1024 px, **liste de cards verticales empilées** < 1024 px (chaque colonne devient une paire label/valeur).
4. **Tokens CSS tactiles** dans `index.css` : variables `--touch-target: 44px` et utilitaires Tailwind `tap-target` pour boutons critiques (Supprimer, Valider, Clôturer).
5. **Toolbar pattern** : sur mobile, regroupement des filtres dans un **drawer "Filtres" unique** (icône SlidersHorizontal) au lieu d'un wrap horizontal. Compteur de filtres actifs visible.

### Axe 2 — Plans d'action (Actions.tsx + ProjectActionsList.tsx + ProjectDetail)

1. **Toolbar Actions** : sur mobile, recherche pleine largeur, filtres dans drawer, bouton "Nouveau projet" en **FAB** (Floating Action Button) bottom-right.
2. **Cards de projet** déjà OK (`sm:grid-cols-2 lg:grid-cols-3`), juste augmenter le padding interne tactile.
3. **Liste d'actions (le gros morceau)** :
   - Mobile : card compacte 2 lignes (titre + statut/échéance), tap pour étendre. Responsables groupés en un seul AvatarStack tappable qui ouvre un popover.
   - Tablet : 2 colonnes responsables max au lieu de 3.
   - Filter bar : devient drawer "Filtres" + chips actifs visibles (statut, échéance, masquer terminées).
4. **Édition action** : passer le formulaire en `Sheet` slide-up plein écran sur mobile. `grid-cols-1` < 640 px, `grid-cols-2` ≥ 640 px.
5. **Gantt (Planning)** : ajouter scroll horizontal natif + indicateur "← glissez →", masquer panneau latéral < 1024 px (overlay drawer à la place).

### Axe 3 — Conformité (NonConformites.tsx + Audits.tsx)

1. **Workflow stepper** : composant `ResponsiveStepper`
   - Desktop : étapes complètes horizontales avec labels.
   - Tablet : icônes + label court.
   - Mobile : barre de progression `Progress` + label "Étape 3/6 — Analyse" cliquable qui ouvre la liste verticale.
2. **Liste NC** : Card empilée verticalement sur mobile (référence + gravité en haut, description full-width, badges en bas en wrap propre, progress full-width).
3. **Dialog détail NC** : devient `Sheet` plein écran sur mobile, onglets verticaux scrollables. `grid-cols-2` → `grid-cols-1` < 640 px.
4. **Onglet Constats audit** : remplacer la table HTML par `ResponsiveTable` (cards sur mobile : Type + Statut en header, Description full, Preuve en footer truncate avec tooltip tap).
5. **Formulaires de saisie** (création NC, édition audit) : tous les `grid-cols-2` deviennent `grid-cols-1 sm:grid-cols-2`. Inputs `h-10` minimum (était `h-9`). Boutons d'action principaux **sticky en bas** du Sheet sur mobile (toujours accessibles).

### Axe 4 — Détails ergonomiques globaux (rapides, gros impact)

- **Tap targets ≥ 44 px** sur tous les boutons d'action critiques (Supprimer, Valider, Clôturer, Modifier).
- **Safe-area iOS** : `pb-[env(safe-area-inset-bottom)]` sur sticky footers et FABs.
- **Scroll smooth** + `overscroll-contain` sur les Sheets pour éviter le scroll de la page derrière.
- **Tabs scrollables** : `overflow-x-auto` + masque dégradé sur les `<TabsList>` qui débordent (NC, Audits, ProjectDetail).
- **Texte lisible** : passer les `text-[10px]` / `text-[11px]` à `text-xs` (12 px) minimum sur mobile.

---

## Détails techniques (section dev)

### Fichiers nouveaux
```
src/hooks/useBreakpoint.ts            # mobile / tablet / desktop
src/components/ui/responsive-dialog.tsx   # Dialog↔Sheet adaptatif
src/components/ui/responsive-table.tsx    # Table↔Cards adaptatif
src/components/ui/responsive-stepper.tsx  # Stepper progressif
src/components/ui/filter-drawer.tsx       # Drawer filtres mobile + chips actifs
src/components/ui/fab.tsx                 # Floating Action Button
```

### Fichiers modifiés (chirurgical, sans toucher à la logique métier)
```
src/index.css                          # tokens --touch-target, safe-area, tap-target util
src/pages/Actions.tsx                  # Toolbar drawer + FAB mobile
src/pages/NonConformites.tsx           # Sheet détail + ResponsiveStepper + cards mobiles
src/pages/Audits.tsx                   # ResponsiveTable constats + Sheet détail
src/pages/ProjectDetail.tsx            # Sheet édition + tabs scrollables
src/components/projects/ProjectActionsList.tsx  # FilterDrawer + cards compactes mobile
src/components/projects/ProjectGanttChart.tsx   # Scroll horizontal + drawer panneau
src/components/AppLayout.tsx           # safe-area-inset-bottom sur <main>
```

### Pattern type ResponsiveDialog
```text
const isMobile = useIsMobile();
return isMobile
  ? <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl pb-safe">…</SheetContent>
    </Sheet>
  : <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">…</DialogContent>
    </Dialog>
```

### Pattern type ResponsiveTable
```text
≥ lg : <table> classique avec colonnes définies.
< lg : .map() → <Card> empilée { header: colonne 0 + colonne dernière, body: colonnes intermédiaires en pairs label/valeur }.
```

---

## Garanties

- **Aucune fonctionnalité supprimée** : seuls les conteneurs visuels changent, la logique métier (RBAC, validation, RLS, workflows) reste identique.
- **Compatibilité desktop intacte** : à ≥ 1024 px le rendu actuel est préservé pixel-près.
- **Aucune migration DB** : changements 100 % frontend.
- **Aucune régression i18n** : tous les libellés FR conservés.
- **Performance** : composants adaptatifs basés sur CSS + un seul listener `matchMedia` (pas de re-render coûteux).

---

## Lots & ordre d'exécution proposé

| Lot | Contenu | Impact visible |
|---|---|---|
| **1** | Axe 1 complet (hooks + composants partagés + tokens CSS) | Base technique, peu visible seul |
| **2** | Axe 2 — Plans d'action (Actions + ProjectActionsList + ProjectDetail + Gantt) | Très fort sur mobile/tablette |
| **3** | Axe 3 — Conformité (NC + Audits) | Workflow lisible mobile, formulaires utilisables |
| **4** | Axe 4 — polissage tactile global, safe-area, tabs scrollables | Confort général, sensation premium |

Confirmez si je lance les **4 lots d'un coup**, ou si vous préférez un démarrage progressif (Lot 1 + 2 d'abord, puis 3 + 4 après validation visuelle sur votre tablette/téléphone).
