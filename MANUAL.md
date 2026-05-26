# 📘 Manuel Utilisateur — Plateforme SMQ ISO 9001

**Éditeur** : Groupe AMOUR
**Version** : 2026.05
**Norme de référence** : ISO 9001:2015
**Devise** : Dinar Algérien (DA)
**Langue** : Français

---

## Table des matières

1. [Présentation générale](#1-présentation-générale)
2. [Connexion et compte utilisateur](#2-connexion-et-compte-utilisateur)
3. [Modèle de droits (RBAC)](#3-modèle-de-droits-rbac)
4. [Pilotage SMQ](#4-pilotage-smq)
5. [Cartographie & Processus](#5-cartographie--processus)
6. [Acteurs & Responsabilités](#6-acteurs--responsabilités)
7. [Risques & Opportunités](#7-risques--opportunités)
8. [Indicateurs Qualité](#8-indicateurs-qualité)
9. [Audits internes](#9-audits-internes)
10. [Non-conformités & Actions](#10-non-conformités--actions)
11. [Incidents](#11-incidents)
12. [Projets & Gantt](#12-projets--gantt)
13. [Revues de Direction & Processus](#13-revues-de-direction--processus)
14. [Compétences & Formations](#14-compétences--formations)
15. [Documents](#15-documents)
16. [Enjeux & Contexte](#16-enjeux--contexte)
17. [Satisfaction Client](#17-satisfaction-client)
18. [Notifications & Alertes](#18-notifications--alertes)
19. [Recherche globale & Aide contextuelle](#19-recherche-globale--aide-contextuelle)
20. [Journal d'activité](#20-journal-dactivité)
21. [Licence](#21-licence)
22. [Performance & Bonnes pratiques](#22-performance--bonnes-pratiques)
23. [Utilisation sur mobile & responsive](#23-utilisation-sur-mobile--responsive)

---

## 1. Présentation générale

La plateforme est un **Système de Management de la Qualité (SMQ)** conforme à la norme **ISO 9001:2015**. Elle couvre l'intégralité des chapitres 4 à 10 :

- Contexte de l'organisme (§4)
- Leadership (§5)
- Planification (§6)
- Support — ressources, compétences, documents (§7)
- Réalisation opérationnelle (§8)
- Évaluation des performances — audits, indicateurs, revues (§9)
- Amélioration — non-conformités, actions correctives (§10)

L'application est **100 % auto-hébergeable** (architecture Groupe AMOUR), sans dépendance externe.

---

## 2. Connexion et compte utilisateur

### 2.1 Connexion
- L'accès se fait via **email + mot de passe** uniquement.
- ❌ Pas d'inscription libre. Les comptes sont créés par un Administrateur.
- ❌ Pas de récupération automatique du mot de passe sur l'écran de connexion.
- Sur mobile, le clavier s'adapte automatiquement (touche `@` pour l'email, complétion du mot de passe proposée).

### 2.2 Modification du mot de passe
- Une fois connecté, cliquez sur l'**icône clé** dans l'en-tête.
- Minimum **8 caractères**.

### 2.3 Profil utilisateur
- Avatar standardisé en `.jpg`, redimensionné automatiquement côté navigateur.
- Le cache navigateur est purgé après mise à jour.

---

## 3. Modèle de droits (RBAC)

### 3.1 Rôles
- **Super Admin** — Accès total, contourne toutes les règles RLS.
- **Administrateur** — Gestion complète de l'application.
- **RMQ** (Responsable Management Qualité) — Gouvernance SMQ.
- **Rôles personnalisés** — Définis par l'Admin via une matrice de permissions.
- **Acteur** — Accès en lecture seule, filtré par responsabilités.

### 3.2 Logique des permissions
- Granularité **par module** et **par processus**.
- En cas de cumul de rôles, **la permission la plus permissive l'emporte**.
- Les permissions **spécifiques à un processus** prévalent sur la matrice globale (5 niveaux possibles).
- Admin et Super Admin **ignorent** les restrictions.

### 3.3 Gestion des rôles personnalisés
- Interface **maître-détail** : sélection du rôle à gauche, matrice des droits à droite.
- Ajout / suppression dynamiques.

---

## 4. Pilotage SMQ

Modules stratégiques **réservés** à Admin / RMQ :
- **Politique Qualité**
- **Objectifs Qualité**
- **Engagement de la Direction**
- **Revues de Direction**

L'éditeur utilise **TipTap** plein écran, format **A4**, police **Serif** pour les documents stratégiques. Export PDF normalisé avec bloc d'approbation.

---

## 5. Cartographie & Processus

### 5.1 Cycle de vie
| État | Description |
|------|-------------|
| **Brouillon** | Modifiable librement |
| **Validé** | Figé — version incrémentée par décimales (1.0 → 1.1) |
| **Archivé** | Masqué de la liste, accessible via dialogue d'**Historique** |

⚠️ Les états **Validé** et **Archivé** sont **terminaux** : aucune modification possible.

### 5.2 Éléments de processus
- **DE** (Données d'Entrée) et **DS** (Données de Sortie) affichés en badges compacts.
- Acteurs en ligne, texte tronqué pour lisibilité.

### 5.3 Interactions entre processus
- Un **DS source** doit correspondre à un **DE cible** d'un autre processus.
- Mécanisme automatique de couplage.

### 5.4 Import CSV
- Nettoie automatiquement les éléments existants.
- **Ordre des colonnes strict** — voir le modèle téléchargeable.

### 5.5 Export PDF
- A4 portrait, logos en en-tête.
- Annexe : **BPMN** ou **logigramme 3 colonnes**.

### 5.6 Logigramme & BPMN
- Espace de travail **plein écran** avec navigation circulaire, zoom et halo de focus.
- **Sauts manuels** via le champ "Activité suivante".
- Fin du flux : nœud rouge `__end__`.
- Passerelles **AND / OR / XOR** : minimum **2 branches** obligatoires.
- Export PNG / PDF haute résolution, layout orthogonal large pour éviter les chevauchements.
- Sur mobile : le diagramme reste utilisable par **défilement horizontal** ; les panneaux latéraux deviennent des **feuilles plein écran** (Sheet).

---

## 6. Acteurs & Responsabilités

- Organisation **par Fonction** (et non par individu).
- Gestion **réservée** à Admin et RMQ.
- **Fiche d'implication** : centralise toutes les responsabilités d'un utilisateur, filtrées contextuellement.
- Sélecteur `ActeurUserSelect` : filtre d'abord la **Fonction**, puis l'**Utilisateur**.
- Visibilité des données filtrée par responsabilité ; les Acteurs sont **strictement en lecture seule**.

### Parties intéressées
- Logique de **groupement** préfixée par `[Groupe]`.
- Affichage prioritaire de la **Fonction** sur le nom individuel.

---

## 7. Risques & Opportunités

### 7.1 Risques
- Gravité (G) **1–4** × Probabilité (P) **1–5** = Criticité.
- Plan de traitement, responsable, échéance.

### 7.2 Opportunités
- Évaluées par **Impact × Faisabilité**.
- Plan d'exploitation associé.

---

## 8. Indicateurs Qualité

- KPI typés (taux, ratio, délai, montant en **DA**…).
- Mesures **chronologiques**, visualisation cible / seuil d'alerte.
- **Tableau de bord 360°** : KPIs critiques, alertes, **export CSV**.

---

## 9. Audits internes

Cycle ISO 9001 strict :
1. **Planification** — programme annuel, équipe, périmètre.
2. **Réalisation** — constats (conformes / écarts / observations / pistes).
3. **Actions correctives** — progression **0–100 %** par action.
4. **Clôture** — audits, constats et actions sont **interdépendants**.

---

## 10. Non-conformités & Actions

### 10.1 Workflow
- Détection → Analyse → Plan d'action → Vérification efficacité → Clôture.

### 10.2 Analyse de la cause racine (RCA)
6 méthodes structurées disponibles, stockées en **JSONB** :
- 5 Pourquoi
- Ishikawa (5M)
- Arbre des causes
- Pareto
- AMDEC simplifiée
- Méthode libre

⚠️ Le plan d'action est **figé à la clôture**.

---

## 11. Incidents

- Liés aux **risques** et **processus**.
- Suivi par **niveau de gravité**.
- Compteurs en **temps réel**.

---

## 12. Projets & Gantt

### 12.1 Avancement
- **Moyenne pondérée** des actions selon leur poids.
- Le solde non pondéré est réparti **équitablement**.

### 12.2 Tâches
- Une action peut être divisée en plusieurs **tâches**.
- L'avancement de l'action = **moyenne** des tâches.
- Clôture nécessite **≥ 2 tâches**.

### 12.3 Accès aux projets
- Géré par le **Chef de Projet (PM)**.
- Mode public : accordez explicitement les droits d'écriture.

### 12.4 Espace de planification
- **Gantt plein écran** + panneau latéral redimensionnable.
- Sur mobile : le Gantt s'affiche avec une **barre de défilement horizontale** ; les en-têtes de page se compactent automatiquement.

### 12.5 Commentaires privés
- Badge **cadenas** + bordure ambre.
- Visibles uniquement par : PM, propriétaire de l'action, Admin.
- Fenêtre d'édition : **5 minutes**.

### 12.6 Actions correctives héritées
- Préservées dans un onglet dédié.

### 12.7 Audit collaboratif
- Historique différentiel pour PM / Admin.

---

## 13. Revues de Direction & Processus

### 13.1 Infrastructure partagée
Une table commune sert les **revues de processus** et les **revues de direction**.

### 13.2 Revue ISO 9.3 (Direction)
- Génération **automatique** des entrées et sorties obligatoires.
- Différenciation **Point ISO** (obligatoire) vs **Point libre**.

### 13.3 Participants
- **Mixte** : utilisateurs internes + invités externes.

### 13.4 Entrées structurées
- Liaison hiérarchique vers les objets du SMQ (audits, NC, indicateurs…).

### 13.5 Actions décidées
- Structurées avec responsable + échéance.

### 13.6 Export PDF
- A4, blocs d'approbation, nom de fichier normalisé.

---

## 14. Compétences & Formations

- Suivi **nominatif**.
- Mise à jour automatique en niveau **Intermédiaire** dès qu'une formation est marquée *effective*.

---

## 15. Documents

- Visualiseur intégré, statistiques de consultation.
- **Tags personnalisés**, **compteur de vues**.
- Permissions par acteur via **popover + cases à cocher**, messages d'erreur explicites.

---

## 16. Enjeux & Contexte

- Suivi par **10 domaines** (PESTEL+).
- Plan d'impact **interne** et **externe**.

---

## 17. Satisfaction Client

- Modèles **versionnés**.
- Modes **anonyme** ou **ciblé**.
- Calculs : score **absolu** et **relatif**.

---

## 18. Notifications & Alertes

- Notifications **Push + Email** sur **13 entités** SMQ.
- **4 types d'alertes** : information, attention, urgent, critique.
- Contrôles automatiques **quotidiens à 07:00**.
- Le déclenchement email est **non bloquant** (fire-and-forget).

---

## 19. Recherche globale & Aide contextuelle

### 19.1 Recherche
- Raccourci **Cmd / Ctrl + K** (ou icône loupe dans la barre supérieure sur mobile).
- Recherche **multi-entités**, asynchrone, avec debounce et annulation.
- La fenêtre de résultats s'adapte à la largeur de l'écran.

### 19.2 Aide contextuelle
- Composant `HelpTooltip` mappé sur **plus de 60 définitions** issues des **articles 4 à 10** de la norme ISO 9001:2015.

---

## 20. Journal d'activité

- Capture par **triggers DB** sous forme de **diff JSON**.
- Pagination **côté serveur**.
- Filtrage par rôle.

---

## 21. Licence

| État | Effet |
|------|-------|
| **Active** | Accès complet |
| **Bientôt expirée** | Bandeau d'avertissement |
| **Expirée** | Mode **lecture seule** forcé |
| **Invalide** | Accès bloqué |

- Code de licence : **32 caractères**.

---

## 22. Performance & Bonnes pratiques

### 22.1 Optimisations en place
- Politiques RLS encapsulant `auth.uid()` dans un sous-`SELECT` (cache du plan Postgres).
- Index sur les tables sensibles : `user_roles`, `notifications`, `audit_logs`, `project_actions`, `profiles`.
- Triggers de notification **non bloquants**.
- Purge périodique des `audit_logs` > 180 jours via `cleanup_old_audit_logs`.
- Auth en flux **PKCE**, événements Realtime **throttle**.
- Préchargement DNS / preconnect du backend.
- Réduction des animations automatique si l'utilisateur active `préfère réduire les mouvements` dans son appareil.

### 22.2 Suppression sécurisée
- Confirmation par saisie de **« je confirme »**.
- Liens supprimés en `ON DELETE SET NULL` pour préserver l'historique.

### 22.3 États figés
- Les objets en état **Validé** ou **Archivé** ne peuvent plus être modifiés.

### 22.4 Prérequis serveur (auto-hébergement)
- **NTP** actif (`timedatectl status`).
- `GOTRUE_SITE_URL` **sans slash final**.
- Réglage `app_settings.supabase_url` correct.
- Voir `diagnostics/SELF_HOSTING_RULES.md` (section 15.10) pour la liste complète.

---

## 23. Utilisation sur mobile & responsive

L'application est entièrement utilisable sur **smartphone** (≤640 px) et **tablette** (641–1023 px). Les fonctionnalités métier restent identiques ; seule la présentation s'adapte.

### 23.1 Navigation
- La **barre latérale** devient un **menu burger** plein écran (Sheet) sur mobile.
- Les icônes de notification et de recherche conservent une **zone tactile** de 44 × 44 px minimum.
- Le fil d'Ariane est masqué sur petit écran pour gagner de la place.

### 23.2 Listes et tableaux
- Les tableaux denses se transforment en **cartes empilées** avec titre, 2–3 métadonnées, badge de statut et menu d'actions.
- Les onglets longs (détail projet, détail processus, revues de direction, compétences) deviennent **défilables horizontalement**.

### 23.3 Formulaires et saisie
- Les champs de saisie ont une hauteur minimum de **44 px** (`h-11`) pour éviter les erreurs de toucher.
- La taille de police des inputs est fixée à **16 px** : cela évite le **zoom automatique iOS** lors du focus.
- Les dialogues lourds passent en **plein écran** sur mobile avec en-tête fixe et boutons d'action en bas de l'écran.

### 23.4 Vues complexes (Gantt, BPMN, flowchart)
- **Planning Gantt** : défilement horizontal natif sur la zone du diagramme.
- **Logigramme & BPMN** : zoom et panoramique tactiles ; panneau de propriétés en feuille latérale plein écran.

### 23.5 Accessibilité & confort
- Prise en charge du mode **préfère réduire les mouvements** (`prefers-reduced-motion`) : les animations sont désactivées automatiquement.
- Les toasts et alertes se positionnent en **haut de l'écran** sur mobile pour ne pas être masqués par le clavier virtuel.
- Le bouton d'action principal (FAB) flotte en bas à droite sur les pages liste pour un accès rapide au pouce.

---

## 📞 Support

Pour toute assistance, contactez votre **Administrateur SMQ** ou le **Groupe AMOUR**.

---

*Document généré automatiquement — © Groupe AMOUR — Tous droits réservés.*
