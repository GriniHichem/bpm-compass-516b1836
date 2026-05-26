# 📘 Manuel Utilisateur — Plateforme SMQ ISO 9001

**Éditeur** : Groupe AMOUR
**Version** : 2026.06
**Norme de référence** : ISO 9001:2015
**Devise** : Dinar Algérien (DA)
**Langue d'interface** : Français
**Architecture** : 100 % auto-hébergeable

---

## Table des matières

1. [Présentation générale](#1-présentation-générale)
2. [Accès à l'application](#2-accès-à-lapplication)
3. [Modèle de droits (RBAC)](#3-modèle-de-droits-rbac)
4. [Tableau de bord & Modules](#4-tableau-de-bord--modules)
5. [Pilotage SMQ stratégique](#5-pilotage-smq-stratégique)
6. [Cartographie & Processus](#6-cartographie--processus)
7. [Logigramme & BPMN](#7-logigramme--bpmn)
8. [Acteurs, Groupes & Responsabilités](#8-acteurs-groupes--responsabilités)
9. [Enjeux & Contexte (§4)](#9-enjeux--contexte-4)
10. [Risques & Opportunités (§6.1)](#10-risques--opportunités-61)
11. [Indicateurs Qualité (§9.1)](#11-indicateurs-qualité-91)
12. [Audits internes (§9.2)](#12-audits-internes-92)
13. [Non-conformités & Analyse de causes (§10.2)](#13-non-conformités--analyse-de-causes-102)
14. [Actions d'amélioration (§10.3)](#14-actions-damélioration-103)
15. [Incidents](#15-incidents)
16. [Plans d'action & Gantt (Projets)](#16-plans-daction--gantt-projets)
17. [Revues de Processus & Revue de Direction (§9.3)](#17-revues-de-processus--revue-de-direction-93)
18. [Compétences & Formations (§7.2)](#18-compétences--formations-72)
19. [Documents (§7.5)](#19-documents-75)
20. [Fournisseurs (§8.4)](#20-fournisseurs-84)
21. [Satisfaction Client (§9.1.2)](#21-satisfaction-client-912)
22. [Évaluation des processus](#22-évaluation-des-processus)
23. [Notifications & Alertes](#23-notifications--alertes)
24. [Recherche globale & Aide contextuelle](#24-recherche-globale--aide-contextuelle)
25. [Journal d'activité & Logs Email](#25-journal-dactivité--logs-email)
26. [Administration & Super Admin](#26-administration--super-admin)
27. [Licence](#27-licence)
28. [Utilisation sur mobile & responsive](#28-utilisation-sur-mobile--responsive)
29. [Performance, Sécurité & Bonnes pratiques](#29-performance-sécurité--bonnes-pratiques)
30. [Auto-hébergement & Prérequis serveur](#30-auto-hébergement--prérequis-serveur)
31. [Glossaire ISO 9001](#31-glossaire-iso-9001)

---

## 1. Présentation générale

La plateforme est un **Système de Management de la Qualité (SMQ)** complet, couvrant l'intégralité des chapitres **4 à 10 de la norme ISO 9001:2015** :

| Chapitre ISO | Couverture applicative |
|---|---|
| §4 — Contexte | Enjeux internes/externes, parties intéressées, cartographie des processus |
| §5 — Leadership | Politique qualité, engagement de la direction, responsabilités |
| §6 — Planification | Risques & opportunités, objectifs qualité |
| §7 — Support | Documents, compétences, formations, communication, ressources |
| §8 — Réalisation | Processus opérationnels, fournisseurs, exigences clients |
| §9 — Évaluation | Indicateurs, audits internes, satisfaction client, revue de direction |
| §10 — Amélioration | Non-conformités, actions correctives, plans d'action |

### Principes fondateurs
- **Traçabilité ISO complète** sur chaque objet (création, validation, archivage).
- **États terminaux figés** (Validé, Archivé) : aucune modification après clôture.
- **Sécurité RLS Postgres** : chaque utilisateur ne voit que ce qui le concerne.
- **Multi-rôles** : un utilisateur peut cumuler plusieurs rôles ; la permission la plus permissive l'emporte.
- **Interface 100 % en français**, devise par défaut **Dinar Algérien (DA)**.

---

## 2. Accès à l'application

### 2.1 Connexion
- Accès via **email + mot de passe** uniquement (page `/login`).
- ❌ **Pas d'inscription libre** : les comptes sont créés par un Administrateur.
- ❌ **Pas de récupération automatique** du mot de passe sur l'écran de connexion (réinitialisation par l'Admin uniquement).
- Sur mobile, le clavier s'adapte automatiquement (touche `@`, autocomplétion).

### 2.2 Modification du mot de passe (self-service)
- Une fois connecté, cliquez sur l'**icône clé** dans l'en-tête.
- Minimum **8 caractères**.

### 2.3 Réinitialisation du mot de passe (Admin)
- L'Administrateur réinitialise depuis l'écran **Utilisateurs**.
- Page `/reset-password` accessible via un lien sécurisé envoyé par email.

### 2.4 Profil utilisateur
- Avatar standardisé `.jpg`, **redimensionné côté navigateur** avant upload.
- Le cache du navigateur est **purgé automatiquement** après mise à jour pour refléter le nouvel avatar.

### 2.5 Déconnexion
- Bouton dans le menu utilisateur (en haut à droite).

---

## 3. Modèle de droits (RBAC)

### 3.1 Rôles natifs
| Rôle | Description |
|---|---|
| **Super Admin** | Accès total, contourne toutes les règles RLS, peut gérer les licences |
| **Administrateur** | Gestion complète : utilisateurs, droits, configuration, modules SMQ |
| **RMQ** (Responsable Management Qualité) | Gouvernance SMQ : politique, revues, validation |
| **Rôle personnalisé** | Défini par l'Admin via la **matrice de permissions** |
| **Acteur** | Lecture seule, filtrée par responsabilités |

### 3.2 Logique des permissions
- Granularité **par module** ET **par processus**.
- Cumul des rôles : **OR logique** (le plus permissif gagne).
- Permissions **spécifiques à un processus** > matrice globale (5 niveaux : aucun, lecture, écriture, validation, administration).
- **Admin** et **Super Admin** ignorent toutes les restrictions.

### 3.3 Matrice de permissions (page `/admin/permissions`)
- Interface **maître-détail** : sélection du rôle à gauche, matrice à droite.
- Création / suppression dynamiques de rôles.
- Modification immédiate, appliquée à la prochaine connexion de l'utilisateur.

### 3.4 Permissions processus (page `/admin/permissions-processus`)
- Surcharge de la matrice globale par processus.
- 5 niveaux possibles, prévalents sur le rôle global.

---

## 4. Tableau de bord & Modules

### 4.1 Page d'accueil (`/`)
- Cartes synthétiques : nombre de processus actifs, audits planifiés, NC ouvertes, actions en retard, indicateurs en alerte.
- Raccourcis vers les modules les plus consultés.

### 4.2 Page Modules (`/modules`)
- Vue d'ensemble visuelle de **tous les modules disponibles**.
- Filtrage par catégorie ISO (Pilotage, Réalisation, Évaluation, Amélioration, Support).

### 4.3 Tableaux de bord spécialisés
- **Dashboard Audits & NC** (`/dashboard-audit`) : KPIs, tendances, top constats, top NC.
- **Dashboard Indicateurs 360°** (`/dashboard-indicateurs`) : vue consolidée, alertes critiques, export CSV.

---

## 5. Pilotage SMQ stratégique

Modules **réservés** à Admin / RMQ :
- **Politique Qualité** (`/politique-qualite`)
- **Objectifs Qualité** (intégré à la Politique)
- **Engagement de la Direction**
- **Revues de Direction** (§9.3)

Tous utilisent un éditeur **TipTap** plein écran, format **A4**, police **Serif** pour les documents stratégiques. Export PDF normalisé avec **bloc d'approbation** (nom, fonction, date, signature).

---

## 6. Cartographie & Processus

### 6.1 Cartographie (`/cartographie`)
- Vue globale des processus regroupés par **type** : Pilotage, Réalisation, Support.
- Visualisation des **interactions** entre processus (DS source ↔ DE cible).

### 6.2 Liste des processus (`/processus`)
- Filtres par type, statut, responsable.
- Actions en lot, export CSV.

### 6.3 Cycle de vie d'un processus
| État | Description |
|---|---|
| **Brouillon** | Modifiable librement par le pilote du processus |
| **Validé** | Figé — version incrémentée par décimales (1.0 → 1.1) |
| **Archivé** | Masqué de la liste, accessible via le dialogue **Historique** |

⚠️ Les états **Validé** et **Archivé** sont **terminaux** : aucune modification possible.

### 6.4 Fiche processus (`/processus/:id`)
- **Identification** : code, nom, type, pilote, finalité.
- **Éléments DE/DS** : Données d'Entrée / Données de Sortie en badges compacts.
- **Acteurs** en ligne, texte tronqué pour lisibilité.
- **Attentes** des parties intéressées par élément.
- **Notes de suivi** chronologiques.
- **Objets liés archivés** : visibles tels qu'à la date d'archivage (traçabilité).

### 6.5 Interactions entre processus
- Un **DS source** est automatiquement couplé au **DE cible** d'un autre processus correspondant.
- Gestion centralisée via `ProcessInteractionManager`.

### 6.6 Import CSV
- Nettoie **automatiquement** les éléments existants avant import.
- **Ordre des colonnes strict** — voir le modèle téléchargeable depuis l'interface.

### 6.7 Export PDF
- **A4 portrait**, logos en en-tête (logo organisation + Groupe AMOUR).
- Annexe au choix : **BPMN** ou **logigramme 3 colonnes**.
- Bloc d'approbation en fin de document.

### 6.8 Historique
- Les processus archivés sont **masqués** de la liste principale.
- Accessibles via le bouton **Historique** : consultation en lecture seule de toutes les versions précédentes.

---

## 7. Logigramme & BPMN

### 7.1 Espace de travail logigramme (`/processus/:id/logigramme`)
- **Plein écran** avec navigation circulaire, zoom et **halo de focus** sur le nœud actif.
- Édition inline des tâches (libellé, acteur, durée).
- **Sauts manuels** via le champ "Activité suivante" → permet de tracer des cycles, boucles ou parallèles.
- Fin du flux : nœud rouge `__end__`.
- Calcul de largeur de sous-arbre **récursif** : empêche les chevauchements visuels.

### 7.2 BPMN (`/bpmn`)
- Modélisation BPMN 2.0 simplifiée : tâches, événements, passerelles.
- Passerelles **AND / OR / XOR** : minimum **2 branches** obligatoires (validation bloquante).
- Auto-génération du BPMN depuis les tâches du processus (`generateBpmnFromTasks`).

### 7.3 Export visuel
- **PNG haute résolution** et **PDF** large layout orthogonal pour éviter les chevauchements.
- Le PDF inclut le titre du processus, le code, la date et le bloc d'approbation.

### 7.4 Utilisation mobile
- Diagramme utilisable par **défilement horizontal et tactile**.
- Le panneau de propriétés devient une **feuille plein écran** (Sheet).

---

## 8. Acteurs, Groupes & Responsabilités

### 8.1 Acteurs (`/acteurs`)
- Organisation **par Fonction** (et non par individu).
- Permet de modéliser le rôle dans le SMQ indépendamment de la personne qui l'occupe.
- Gestion **réservée** à Admin et RMQ.

### 8.2 Groupes d'acteurs (`/groupes-acteurs`)
- Regroupement de plusieurs fonctions sous un même libellé `[Groupe]`.
- Utile pour les communications collectives, attributions partagées.
- Affichage prioritaire de la **Fonction** sur le nom individuel dans les listes.

### 8.3 Fiche d'implication
- Bouton **Mes responsabilités** dans le menu utilisateur.
- Centralise **toutes les responsabilités** de l'utilisateur connecté, filtrées contextuellement :
  - Processus pilotés
  - Actions à mener
  - NC en charge
  - Audits à conduire
  - Indicateurs à mesurer

### 8.4 Sélecteur `ActeurUserSelect`
- Composant générique de sélection de responsable.
- Filtre d'abord la **Fonction**, puis l'**Utilisateur** rattaché à cette fonction.
- Garantit la cohérence rôle ↔ personne.

### 8.5 Visibilité des données
- Filtrage par **responsabilité** : un Acteur ne voit que ce qui le concerne.
- **Strictement en lecture seule** pour les Acteurs (aucune écriture).

---

## 9. Enjeux & Contexte (§4)

### 9.1 Liste des enjeux (`/enjeux-contexte`)
- Suivi par **10 domaines** type PESTEL+ : Politique, Économique, Social, Technologique, Environnemental, Légal, Concurrentiel, Organisationnel, Humain, Financier.
- Classification **interne / externe**.
- Référence auto-incrémentée.

### 9.2 Plan d'impact
- **Impact interne** et **impact externe** documentés séparément.
- Lien possible vers les risques, opportunités et processus impactés.

---

## 10. Risques & Opportunités (§6.1)

### 10.1 Risques (`/risques`)
- Évaluation : **Gravité (G) 1–4** × **Probabilité (P) 1–5** = Criticité.
- Plan de traitement, responsable, échéance.
- Réévaluation après mise en œuvre du plan.

### 10.2 Opportunités (`/risques`, onglet Opportunités)
- Évaluation : **Impact × Faisabilité**.
- Plan d'exploitation avec responsable et échéance.

### 10.3 Incidents liés
- Chaque risque peut être lié à des incidents survenus (cf. §15).
- Compteurs en temps réel par criticité.

---

## 11. Indicateurs Qualité (§9.1)

### 11.1 Définition (`/indicateurs`)
- KPI typés : taux, ratio, délai, **montant en DA**, score.
- Formule de calcul libre, unité, cible, seuils d'alerte (vert/orange/rouge).
- Fréquence de mesure (mensuelle, trimestrielle, annuelle).
- Responsable de la mesure.

### 11.2 Mesures chronologiques
- Saisie périodique des valeurs.
- Graphique d'évolution avec ligne de **cible** et zone d'**alerte**.

### 11.3 Tableau de bord 360° (`/dashboard-indicateurs`)
- Vue consolidée tous indicateurs.
- KPIs critiques en haut.
- Alertes en temps réel.
- **Export CSV** pour analyse externe.

### 11.4 Moyens & Actions
- Composant `IndicatorMoyensActions` : associer à chaque indicateur les moyens mis en œuvre et les actions associées.

---

## 12. Audits internes (§9.2)

Cycle ISO 9001 strict en **4 étapes** :

### 12.1 Programme annuel
- Création du programme d'audit pour l'année.
- Affectation des **auditeurs** (avec contrôle d'indépendance).

### 12.2 Planification (`/audits`)
- Référence, type (interne, fournisseur, suivi), périmètre, équipe, date.
- Statut : Planifié.

### 12.3 Réalisation
- Saisie des **constats** :
  - Conforme
  - Écart (non-conformité)
  - Observation
  - Piste de progrès
- Chaque écart peut être converti en NC (cf. §13).

### 12.4 Actions correctives
- Progression **0–100 %** par action.
- Suivi de l'efficacité.

### 12.5 Clôture
- Audits, constats et actions sont **interdépendants** : la clôture vérifie que toutes les actions sont soldées.

### 12.6 Dashboard Audit & NC (`/dashboard-audit`)
- KPIs, tendances mensuelles.
- Top constats récurrents.
- Top NC par criticité.

---

## 13. Non-conformités & Analyse de causes (§10.2)

### 13.1 Workflow (`/non-conformites`)
1. **Détection** — source : audit, client, interne, fournisseur, processus.
2. **Analyse** — RCA structurée.
3. **Plan d'action** — actions correctives + curatives.
4. **Vérification d'efficacité** — délai paramétrable.
5. **Clôture** — plan figé.

### 13.2 Analyse de la cause racine (RCA)
**6 méthodes structurées** disponibles, stockées en **JSONB** :

| Méthode | Usage |
|---|---|
| **5 Pourquoi** | Analyse rapide en cascade |
| **Ishikawa (5M)** | Diagramme arête de poisson : Main d'œuvre, Méthode, Matière, Matériel, Milieu |
| **Arbre des causes** | Décomposition hiérarchique |
| **Pareto** | Identification des 20 % de causes responsables de 80 % des effets |
| **AMDEC simplifiée** | Mode de défaillance, effet, criticité |
| **Méthode libre** | Texte enrichi |

⚠️ Le plan d'action est **figé à la clôture** de la NC : aucune modification a posteriori, garantie de traçabilité ISO.

### 13.3 Liaisons
- NC → Processus impacté, Audit source, Action de correction, Action corrective, Action préventive.

---

## 14. Actions d'amélioration (§10.3)

### 14.1 Page Actions (`/actions`)
- Vue consolidée de **toutes les actions** de l'application, quelle que soit leur source :
  - NC (correctives / curatives)
  - Audits
  - Revues de direction
  - Risques (traitement)
  - Indicateurs (en alerte)
  - Incidents
- Filtres par : type, source, statut, responsable, processus, date.

### 14.2 Cycle de vie
- **À faire** → **En cours** (0–100 %) → **Terminée** → **Vérifiée**.
- Champ **efficacité** à renseigner après vérification.

### 14.3 Lien vers Plans d'action
- Une action peut être rattachée à un **Plan d'action (projet)** (cf. §16).
- Permet de planifier les actions complexes en Gantt.

---

## 15. Incidents

### 15.1 Liste (`/incidents`)
- Liés aux **risques** et **processus**.
- Suivi par **niveau de gravité** : faible, modéré, élevé, critique.
- Compteurs en **temps réel** sur le tableau de bord.

### 15.2 Workflow
- Déclaration → Investigation → Actions correctives → Clôture.
- Lien automatique vers la NC si applicable.

---

## 16. Plans d'action & Gantt (Projets)

Le module Projets matérialise les **Plans d'action ISO** complexes nécessitant planification multi-tâches.

### 16.1 Liste des projets (`/actions`, onglet Projets)
- Cartes projet avec image, slogan, avancement global.
- Filtres par statut (en cours, terminé, archivé) et responsable.

### 16.2 Détail projet (`/actions/:projectId`)
- Onglets : Vue d'ensemble, Actions, Tâches, Collaborateurs, Commentaires, Historique, Actions correctives héritées.

### 16.3 Avancement
- **Moyenne pondérée** des actions selon leur poids.
- Le solde non pondéré est réparti **équitablement** entre les actions restantes.

### 16.4 Tâches
- Une action peut être divisée en plusieurs **tâches**.
- L'avancement de l'action = **moyenne** des tâches.
- Clôture d'une action nécessite **≥ 2 tâches** définies.
- Import CSV de tâches en lot (`CsvTaskImporter`).

### 16.5 Accès aux projets
- Géré par le **Chef de Projet (PM)**.
- **Mode privé** : seul le PM et les collaborateurs invités voient le projet.
- **Mode public** : visible par tous les utilisateurs autorisés au module Actions ; les droits d'écriture restent à accorder **explicitement**.

### 16.6 Espace de planification Gantt (`/actions/:projectId/planning`)
- **Gantt plein écran** + panneau latéral redimensionnable pour le détail d'une tâche.
- Dépendances entre actions (`ProjectActionDependencies`).
- Sur mobile : défilement horizontal natif + en-têtes compacts.

### 16.7 Commentaires
- **Toolbar Markdown** light : gras, italique, lien, mention `@utilisateur`.
- **Commentaires privés** : badge **cadenas** + bordure ambre.
  - Visibles uniquement par : PM, propriétaire de l'action, Admin.
  - Fenêtre d'édition : **5 minutes**.

### 16.8 Historique collaboratif
- Diff JSON détaillé des modifications.
- Accessible par PM et Admin.
- Délai d'alerte sur dépassement d'échéance.

### 16.9 Actions correctives héritées
- Préservées dans un onglet dédié pour la traçabilité historique.

### 16.10 Notifications projet
- Notifications automatiques sur : assignation, dépassement d'échéance, mention dans un commentaire, changement de statut.

---

## 17. Revues de Processus & Revue de Direction (§9.3)

### 17.1 Infrastructure partagée
Une **table commune** sert les revues de processus (`/revue-direction`) et la revue de direction ISO 9.3 (`/revue-direction-iso`).

### 17.2 Revue ISO 9.3 (Direction)
- **Génération automatique** des entrées et sorties obligatoires selon ISO 9001:2015 §9.3.2 et §9.3.3.
- Différenciation **Point ISO** (obligatoire, non supprimable) vs **Point libre**.

### 17.3 Revues de processus
- Cycle plus léger, focalisé sur un processus.
- Reprend les indicateurs, NC, actions et audits du processus.

### 17.4 Participants
- Mixte : **utilisateurs internes** + **invités externes** (email + fonction).
- Émargement géré.

### 17.5 Entrées structurées (`ReviewInputItems`)
- Liaison hiérarchique vers les objets du SMQ : audits, NC, indicateurs, risques, satisfaction client, fournisseurs.
- Synthèse automatique des données récentes.

### 17.6 Actions décidées (`ReviewDecisions`)
- Structurées avec responsable + échéance.
- Génèrent automatiquement des **actions** dans la base centrale (§14).

### 17.7 Export PDF
- A4, blocs d'approbation, nom de fichier normalisé `RDD-AAAA-MM-JJ.pdf`.

---

## 18. Compétences & Formations (§7.2)

### 18.1 Compétences (`/competences`, onglet Compétences)
- Référentiel des compétences requises par fonction.
- Niveau : Débutant / Intermédiaire / Confirmé / Expert.
- **Suivi nominatif** par utilisateur.

### 18.2 Formations (`/competences`, onglet Formations)
- Planification, organisation, suivi des sessions.
- Évaluation à chaud (satisfaction) et à froid (efficacité).
- Mise à jour **automatique** du niveau de compétence en **Intermédiaire** dès qu'une formation est marquée *effective*.

### 18.3 Dashboard Compétences
- Matrice compétences × utilisateurs.
- Taux de couverture par fonction.
- Plan de formation prévisionnel.

---

## 19. Documents (§7.5)

### 19.1 Liste (`/documents`)
- Visualiseur intégré pour PDF et images.
- **Tags personnalisés**, gérés par l'Admin via `/admin/documents-config`.
- **Compteur de vues** par document.
- Statistiques de consultation par utilisateur.

### 19.2 Versionnement
- Chaque mise à jour incrémente la version.
- Anciennes versions accessibles via l'historique.

### 19.3 Permissions par acteur
- Interface **popover + cases à cocher** par document.
- Messages d'erreur **explicites** en cas de tentative non autorisée.

### 19.4 Configuration Admin (`/admin/documents-config`)
- Création / suppression de tags.
- Paramétrage des types de documents.

---

## 20. Fournisseurs (§8.4)

### 20.1 Liste (`/fournisseurs`)
- Référentiel des fournisseurs.
- Catégorisation, criticité.

### 20.2 Évaluation
- Critères paramétrables, notation périodique.
- Historique des évaluations.
- Plan d'amélioration fournisseur (génère des actions §14).

---

## 21. Satisfaction Client (§9.1.2)

### 21.1 Modèles d'enquête (`/satisfaction-client`)
- Modèles **versionnés** (création, modification, archivage).
- Types de questions : choix unique, choix multiple, échelle, texte libre.

### 21.2 Lancement
- Mode **anonyme** : lien public générique.
- Mode **ciblé** : envoi nominatif par email avec token unique.
- Page publique de réponse : `/survey/:token` (accessible sans authentification).

### 21.3 Calcul des scores
- **Score absolu** : moyenne brute.
- **Score relatif** : pondéré par l'importance des questions.

### 21.4 Résultats
- Visualisation par question, par segment de répondant.
- Export CSV.
- Envoi automatique d'une **copie au répondant** (paramétrable).

---

## 22. Évaluation des processus

### 22.1 Page (`/evaluation-processus`)
- Évaluation périodique de la maturité des processus.
- Grille de critères paramétrable.
- Génère des actions d'amélioration automatiquement.

---

## 23. Notifications & Alertes

### 23.1 Notifications applicatives (cloche `/notifications`)
- Notifications **Push** (in-app) + **Email** sur **13 entités** SMQ.
- Cloche en en-tête avec compteur non lus.

### 23.2 Types d'alertes
| Type | Usage |
|---|---|
| 🔵 **Information** | Création, assignation |
| 🟡 **Attention** | Échéance proche |
| 🟠 **Urgent** | Échéance dépassée |
| 🔴 **Critique** | NC majeure, indicateur en zone rouge |

### 23.3 Préférences utilisateur
- Composant `NotificationPreferences` : choisir, par entité, le canal (Push / Email / les deux / aucun).

### 23.4 Configuration Admin (`/admin/notifications`)
- Matrice `NotificationConfigMatrix` : activer / désactiver par rôle et par type.
- Contrôles automatiques **quotidiens à 07:00** (cron edge function `check-deadlines`).

### 23.5 Architecture
- Le déclenchement email est **non bloquant** (fire-and-forget) pour ne pas pénaliser les écritures DB.
- Edge function `send-notification-email` avec SMTP configurable.
- Logs email accessibles via `/admin/email-logs`.

---

## 24. Recherche globale & Aide contextuelle

### 24.1 Recherche globale (Cmd/Ctrl + K)
- Raccourci **Cmd / Ctrl + K** (ou icône loupe dans la barre supérieure sur mobile).
- Recherche **multi-entités** asynchrone, avec debounce 250 ms et annulation des requêtes obsolètes.
- **Filtres rapides** par type :
  - Tout
  - Processus
  - **Plans d'action**
  - Actions
  - Audits
  - NC
  - Documents
  - Indicateurs
  - Enjeux
  - Acteurs
- Résultats groupés : **Pages** (navigation) + **Données** (objets métier).
- Badges de **type** colorés + badges de **statut**.
- Navigation directe vers la fiche en un clic.

### 24.2 Aide contextuelle
- Composant `HelpTooltip` mappé sur **plus de 60 définitions** issues des **articles 4 à 10** de la norme ISO 9001:2015.
- Mode aide global activable depuis le menu utilisateur (`HelpModeContext`) : surligne tous les éléments documentés.

---

## 25. Journal d'activité & Logs Email

### 25.1 Journal d'activité (`/journal`)
- Capture par **triggers DB** sous forme de **diff JSON** détaillé.
- Pagination **côté serveur** pour rester rapide même avec des millions d'événements.
- Filtrage par : utilisateur, entité, action, période.
- Purge automatique au-delà de **180 jours** (fonction `cleanup_old_audit_logs`).

### 25.2 Logs email (`/admin/email-logs`)
- Réservé Admin.
- Traçabilité de chaque envoi : destinataire, sujet, statut SMTP, horodatage, message d'erreur le cas échéant.

---

## 26. Administration & Super Admin

### 26.1 Utilisateurs (`/utilisateurs`)
- Création de comptes (réservé Admin).
- Affectation des rôles.
- Réinitialisation de mot de passe.
- Désactivation / réactivation.

### 26.2 Permissions globales (`/admin/permissions`)
- Voir §3.3.

### 26.3 Permissions processus (`/admin/permissions-processus`)
- Voir §3.4.

### 26.4 Configuration documents (`/admin/documents-config`)
- Voir §19.4.

### 26.5 Configuration notifications (`/admin/notifications`)
- Voir §23.4.

### 26.6 Logs email (`/admin/email-logs`)
- Voir §25.2.

### 26.7 Super Admin (`/super-admin`)
- **Réservé Super Admin** uniquement.
- Gestion : licence, paramètres SMTP, configuration backend, audit complet de la plateforme.
- Bypass total des RLS pour interventions de maintenance.

---

## 27. Licence

| État | Effet |
|---|---|
| **Active** | Accès complet à toutes les fonctionnalités |
| **Bientôt expirée** | Bandeau d'avertissement en haut de toutes les pages |
| **Expirée** | Mode **lecture seule** forcé pour tous les utilisateurs (sauf Super Admin pour rétablir) |
| **Invalide** | Accès bloqué, écran de blocage |

- Code de licence : **32 caractères**.
- Activation via edge function `activate-license`.
- Bandeau d'alerte : composant `LicenseBanner`.

---

## 28. Utilisation sur mobile & responsive

L'application est entièrement utilisable sur **smartphone** (≤ 640 px) et **tablette** (641–1023 px). Les fonctionnalités métier restent **identiques** sur tous les supports ; seule la **présentation** s'adapte.

### 28.1 Navigation
- La **barre latérale** devient un **menu burger** plein écran (Sheet) sur mobile.
- Icônes de notification et de recherche : **zone tactile 44 × 44 px** minimum.
- Fil d'Ariane masqué sur petit écran pour gagner de la place.

### 28.2 Listes et tableaux
- Les tableaux denses se transforment en **cartes empilées** (titre, 2–3 métadonnées, badge de statut, menu d'actions).
- Les onglets longs (Détail projet, Détail processus, Revues, Compétences) deviennent **défilables horizontalement**.

### 28.3 Formulaires et saisie
- Hauteur minimum des champs : **44 px** (`h-11`) pour fiabilité tactile.
- Taille de police des inputs : **16 px** → évite le **zoom automatique iOS** au focus.
- Les dialogues lourds passent en **plein écran** sur mobile avec en-tête fixe et boutons d'action en bas.

### 28.4 Vues complexes
- **Gantt** : défilement horizontal natif.
- **Logigramme & BPMN** : zoom et panoramique tactiles ; panneau de propriétés en feuille latérale plein écran.

### 28.5 Accessibilité & confort
- Support du mode **prefers-reduced-motion** : animations désactivées automatiquement.
- Toasts et alertes en **haut de l'écran** sur mobile (évite le clavier virtuel).
- **FAB** (Floating Action Button) en bas à droite sur les pages liste pour accès rapide au pouce.

---

## 29. Performance, Sécurité & Bonnes pratiques

### 29.1 Optimisations en place
- Politiques RLS encapsulant `auth.uid()` dans un sous-`SELECT` (cache du plan Postgres).
- Index sur les tables sensibles : `user_roles`, `notifications`, `audit_logs`, `project_actions`, `profiles`.
- **Triggers de notification non bloquants** (fire-and-forget) pour ne pas pénaliser les écritures.
- Purge périodique des `audit_logs` > 180 jours.
- Auth en flux **PKCE**, événements Realtime **throttle**.
- Préchargement DNS / preconnect du backend.
- Réduction des animations selon `prefers-reduced-motion`.

### 29.2 Sécurité
- **RLS Postgres** activée sur toutes les tables métier.
- Edge functions configurées avec `verify_jwt = false` mais validation **manuelle** du JWT côté Deno + appel service-role + contrôle granulaire en base.
- Aucun secret en clair côté client.
- Mots de passe : politique min 8 caractères, hash bcrypt côté Supabase Auth.

### 29.3 Suppression sécurisée
- Confirmation par saisie de **« je confirme »** avant suppression définitive.
- Liens supprimés en `ON DELETE SET NULL` pour préserver l'historique.

### 29.4 États figés
- Les objets en état **Validé** ou **Archivé** ne peuvent plus être modifiés (contrainte BD + UI).

### 29.5 Sauvegardes
- Sauvegardes automatiques quotidiennes côté backend (Postgres).
- Rétention : 30 jours minimum recommandé.

---

## 30. Auto-hébergement & Prérequis serveur

### 30.1 Prérequis
- **NTP** actif (`timedatectl status`) — sinon les JWT échouent.
- `GOTRUE_SITE_URL` **sans slash final**.
- Réglage `app_settings.supabase_url` correct (utilisé par les edge functions).
- SMTP configuré dans `app_settings` (upsert idempotent).

### 30.2 Migrations
- Toutes les migrations sont **idempotentes** (`IF NOT EXISTS`, blocs `DO $$` avec exception handling).
- Re-exécutables sans risque sur une base existante.

### 30.3 Documentation interne
- `diagnostics/SELF_HOSTING_RULES.md` — règles de déploiement centralisées.
- `diagnostics/ARCHITECTURE_AUDIT.md` — audit d'architecture.
- `diagnostics/EDGE_FUNCTIONS_AUDIT.md` — inventaire des edge functions.
- `diagnostics/MIGRATIONS_AUDIT.md` — état des migrations.
- `diagnostics/SMTP_AUDIT.md` — diagnostic SMTP.
- `diagnostics/ENV_REQUIREMENTS.md` — variables d'environnement requises.
- `MIGRATION_HORS_LOVABLE.md` — guide pour exporter le projet vers une infrastructure indépendante.

### 30.4 Scripts de diagnostic
- `diagnostics/scripts/check_edge_functions_usage.sh`
- `diagnostics/scripts/check_project_structure.sh`
- `diagnostics/scripts/check_supabase_runtime.sh`
- `diagnostics/sql/security_diagnostics.sql`

---

## 31. Glossaire ISO 9001

| Terme | Définition |
|---|---|
| **SMQ** | Système de Management de la Qualité |
| **RMQ** | Responsable Management Qualité |
| **PM** | Project Manager / Chef de projet |
| **NC** | Non-conformité |
| **RCA** | Root Cause Analysis — Analyse de cause racine |
| **DE / DS** | Données d'Entrée / Données de Sortie d'un processus |
| **AMDEC** | Analyse des Modes de Défaillance, de leurs Effets et de leur Criticité |
| **KPI** | Key Performance Indicator — Indicateur clé de performance |
| **PESTEL** | Politique, Économique, Sociétal, Technologique, Environnemental, Légal |
| **BPMN** | Business Process Model and Notation |
| **RLS** | Row Level Security (sécurité au niveau de la ligne PostgreSQL) |
| **FAB** | Floating Action Button |

---

## 📞 Support

Pour toute assistance, contactez votre **Administrateur SMQ** ou le **Groupe AMOUR**.

---

*Document généré et maintenu par l'équipe Qualité — © Groupe AMOUR — Tous droits réservés.*
