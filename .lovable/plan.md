
# Plan : Q-Processus Mobile-Friendly (3 étapes)

Objectif : rendre toute l'application confortable sur mobile (≤640px) et tablette (641–1023px) **sans modifier la logique métier, les requêtes Supabase, les permissions, les workflows ISO, ni les exports**. Travail strictement frontend / présentation.

Principes directeurs (appliqués partout) :
- Mobile-first : tout layout part de `flex-col`, puis `sm:` / `md:` / `lg:` ajoutent les colonnes.
- Cibles tactiles min. 44×44 px (classe `tap-target` déjà existante).
- Tableaux denses → cartes empilées sur mobile (pattern `responsive-table` déjà présent).
- Dialogs lourds → `ResponsiveDialog` (déjà en place) → Sheet plein écran sur mobile.
- Filtres multiples → `FilterDrawer` (déjà en place) → bottom sheet.
- Aucune modification de : migrations SQL, RLS, edge functions, hooks de données, contextes Auth/Permissions, exports PDF/BPMN, logique de calcul (progress, scores, KPI).

---

## Étape 1 — Fondations & navigation mobile

Cible : un utilisateur peut naviguer dans toute l'app au pouce, sans scroll horizontal, sans menu coupé.

1. **Navbar / Sidebar**
   - `AppNavbar` : compactage du header (logo + burger + bell + avatar), masquer le breadcrumb sur `<sm`.
   - `AppSidebar` : sur mobile, forcer `collapsible="offcanvas"` (Sheet) au lieu de `icon` ; auto-close après clic sur un lien.
   - `NotificationBell` + `GlobalSearch` : icône seule sur mobile, Sheet plein écran à l'ouverture.

2. **Layout global**
   - `AppLayout` : padding adaptatif (`px-3 sm:px-6`), respecter `pb-safe` déjà présent (iOS notch).
   - Ajouter une barre d'action flottante (`FAB` déjà dispo dans `ui/fab.tsx`) sur les pages liste pour l'action principale (Nouveau processus, Nouvelle NC, etc.).

3. **Login / Reset password / Onboarding**
   - Vérifier centrage + tailles d'inputs (min `h-11`) + clavier mobile (autocomplete, inputmode).
   - `OnboardingCarousel` : swipe horizontal natif, indicateurs plus gros.

Livrables : `AppNavbar.tsx`, `AppSidebar.tsx`, `AppLayout.tsx`, `Login.tsx`, `ResetPassword.tsx`, `OnboardingCarousel.tsx`, `GlobalSearch.tsx`, `NotificationBell.tsx`.

---

## Étape 2 — Listes, tableaux et formulaires

Cible : toutes les pages de données (≈ 30 pages) sont lisibles et actionnables sur mobile.

1. **Pages liste → vue cartes sur mobile**
   Conversion systématique via le pattern `responsive-table` déjà utilisé :
   - Processus, Acteurs, Risques, Incidents, Audits, Non-conformités, Actions, Indicateurs, Documents, Compétences, Fournisseurs, Satisfaction client, Enjeux, Utilisateurs, Groupes d'acteurs, Journal, Email logs.
   - Chaque carte : titre + 2-3 métadonnées + statut badge + menu actions (`DropdownMenu`).

2. **Filtres & tri**
   - Sur mobile : tous les Selects/Switches regroupés dans `FilterDrawer` (déjà en place sur Actions, à généraliser).
   - Recherche : champ sticky en haut, `inputmode="search"`.

3. **Formulaires & dialogs**
   - Remplacer les `Dialog` lourds restants par `ResponsiveDialog` (audit rapide : `ProjectForm`, `FormationDialog`, `SurveyBuilder`, `ProcessElementList` editors, `RootCauseAnalysis`, `ReviewDecisions`, etc.).
   - Champs en pleine largeur sur mobile, labels au-dessus, boutons d'action en footer sticky.
   - `RichTextEditor` (TipTap) : toolbar scrollable horizontalement, mode plein écran par défaut sur mobile.

4. **Tabs & sous-navigation**
   - Tabs longues (ProjectDetail, ProcessDetail, RevueDirection, Competences) : `overflow-x-auto` + `scroll-snap` + indicateur actif visible.

Livrables : composants liste de chaque page ci-dessus + dialogs/forms listés.

---

## Étape 3 — Modules visuels lourds & polish

Cible : les vues complexes (planning, flowchart, BPMN, dashboards, exports) restent utilisables sur mobile, et l'app gagne un niveau de finition.

1. **Vues visuelles complexes**
   - `ProjectGanttChart` / `ProjectPlanningPage` : sur mobile, vue liste verticale par défaut + bouton "Vue Gantt" qui ouvre plein écran avec pan/zoom tactiles. Pas de modification de la logique de calcul.
   - `ProcessTasksFlowchart` / `ProcessFlowchartPage` / `BpmnCanvas` : gestes pinch-zoom + pan, mini-map repliable, panneau de détails en bottom sheet.
   - `FlowchartDetailPanel` / `BpmnPropertiesPanel` : devient Sheet latéral plein écran sur mobile.

2. **Dashboards & graphiques**
   - `Dashboard`, `DashboardIndicateurs`, `DashboardAuditNC`, `CompetencesDashboard` : grilles `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, charts `ResponsiveContainer` avec hauteur min adaptée, légendes sous le graphique sur mobile.
   - `SurveyResults` : tableaux → accordéons par question sur mobile.

3. **Notifications & feedback**
   - Toasts (`sonner`) repositionnés en haut sur mobile pour éviter le clavier.
   - Confirmations critiques ("je confirme") avec input + boutons empilés et plus grands.

4. **Polish global**
   - Audit dark mode sur mobile (contrastes, surfaces).
   - Audit `prefers-reduced-motion`.
   - Vérification scroll horizontal nulle part (`overflow-x-hidden` sur `<body>` si nécessaire).
   - Tests visuels aux 3 breakpoints (375, 768, 1280) sur les pages principales.

Livrables : `ProjectGanttChart.tsx`, `ProjectPlanningPage.tsx`, `ProcessTasksFlowchart.tsx`, `BpmnCanvas.tsx`, `FlowchartDetailPanel.tsx`, `BpmnPropertiesPanel.tsx`, pages Dashboard*, `SurveyResults.tsx`, `index.css` (ajustements tokens mobiles si besoin).

---

## Hors périmètre (garanti non touché)

- Aucune migration SQL, aucune RLS, aucun edge function.
- Aucun changement dans : `AuthContext`, `useAuth`, permissions, rôles, licences.
- Aucun changement dans la logique de : progression projet, calculs Risques/Opportunités, NC RCA, indicateurs, revues de direction, exports PDF/BPMN, import CSV.
- Aucun renommage de route, aucun changement de schéma de données.

## Stratégie de validation

À chaque étape : QA visuelle aux viewports 375px, 768px, 1280px sur les pages clés ; vérifier qu'aucune régression desktop n'apparaît (les classes `sm:` / `md:` préservent l'existant).

Souhaitez-vous démarrer par l'**Étape 1** dès l'approbation, ou ajuster le périmètre d'une étape ?
