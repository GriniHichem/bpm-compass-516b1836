# Plan — Maîtrise documentaire avancée (ISO 9001 §7.5)

Objectif : combler les 9 manques identifiés en transformant le module Documents en véritable système de maîtrise documentaire qualité.

---

## Lot 1 — Cycle de vie documentaire

### 1.1 Codification automatique
- Nouvelle table `document_code_rules` : préfixe par type de document (MQ, PR, MO, EN, FT…) + compteur incrémental + option processus (`{PREFIX}-{PROC}-{SEQ}`).
- UI Admin (`AdminDocumentsConfig`) : section « Codification » pour définir les règles par type.
- À la création d'un document : génération auto du `code` selon la règle, modifiable par Admin/RMQ uniquement.

### 1.2 Workflow revue / approbation
- Ajout colonnes sur `documents` : `statut_workflow` (`brouillon` → `en_revue` → `en_approbation` → `approuve` → `obsolete`), `redacteur_user_id`, `verificateur_user_id`, `approbateur_user_id`, `date_approbation`.
- Nouvelle table `document_workflow_history` (qui, quand, action, commentaire).
- UI : panneau latéral « Cycle d'approbation » avec actions contextuelles (Soumettre / Vérifier / Approuver / Refuser).
- Seuls les documents `approuve` sont visibles aux acteurs en lecture ; brouillons visibles uniquement au rédacteur + Admin/RMQ.

### 1.3 Date de prochaine revue
- Colonnes `date_prochaine_revue` (date) + `frequence_revue_mois` (int) sur `documents`.
- Calcul auto à l'approbation : `date_approbation + frequence_revue_mois`.
- Intégration dans `check-deadlines` (notif J-30, J-7, J-0) au rédacteur + approbateur.
- Badge visuel dans la liste : « Revue due » / « En retard ».

### 1.4 Statut obsolète (finition)
- Action « Rendre obsolète » (Admin/RMQ/Approbateur) : passe `statut_workflow=obsolete`, conserve le fichier pour traçabilité.
- Filtre par défaut masque les obsolètes ; toggle « Inclure obsolètes » dans la liste.
- Watermark « OBSOLÈTE » visible dans le viewer PDF.

---

## Lot 2 — Diffusion & traçabilité

### 2.1 Liste de diffusion nominative
- Nouvelle table `document_diffusion` (document_id, acteur_id OU user_id, obligatoire bool).
- UI : onglet « Diffusion » sur la fiche document → sélection acteurs/utilisateurs ciblés à la publication.
- À l'approbation : notification automatique aux destinataires.

### 2.2 Accusé de lecture
- Nouvelle table `document_acknowledgements` (document_id, user_id, version, acknowledged_at, ip).
- Bouton « J'ai lu et compris » dans le viewer (visible uniquement si l'utilisateur est dans la liste de diffusion ou en lecture).
- Relances automatiques (J+7, J+14) aux utilisateurs n'ayant pas accusé réception.

### 2.3 Historique de lecture
- Nouvelle table `document_reads` (document_id, user_id, read_at, action: `view`/`download`).
- Onglet « Historique » du module : remplace l'écran vide actuel, liste paginée avec filtres (date, utilisateur, document).
- Vue par document : « Qui a lu / qui n'a pas lu » + taux de couverture sur la liste de diffusion.

---

## Lot 3 — Pilotage & export

### 3.1 Matrice documents / processus
- Nouvelle page `/documents/matrice` (ou onglet).
- Tableau croisé : lignes = documents, colonnes = processus (depuis `document_processes`), cases = lien.
- Filtres : type, statut, processus, propriétaire. Export CSV.

### 3.2 Liste maîtresse documentaire
- Bouton « Export liste maîtresse » (CSV + PDF A4 signé) sur la page Documents.
- Colonnes : code, titre, type, version, statut, rédacteur, vérificateur, approbateur, date approbation, prochaine revue, processus liés, taux d'accusé de lecture.
- PDF avec en-tête Groupe AMOUR + bloc signature RMQ (réutilise `exportStrategicPdf`).

### 3.3 Tableau de bord documentaire
- KPIs en haut du module : nb total, % approuvés, nb en revue due, nb obsolètes, taux d'accusé global.

---

## Aspects techniques

- **Migrations** : idempotentes (`IF NOT EXISTS`, `DO $$ ... $$`), `GRANT` sur `authenticated` + `service_role` pour chaque nouvelle table, RLS activé.
- **RLS** :
  - `document_workflow_history`, `document_reads`, `document_acknowledgements` : lecture par concernés + Admin/RMQ/Approbateur.
  - `document_diffusion` : géré par Admin/RMQ + propriétaire du document.
- **Triggers** :
  - `set_document_code` BEFORE INSERT (codification auto).
  - `set_next_review_date` BEFORE UPDATE quand `statut_workflow` passe à `approuve`.
  - `notify_diffusion_on_approval` AFTER UPDATE → insère notifications + emails.
- **Edge function** `check-deadlines` : ajouter scan `date_prochaine_revue` + relances accusés de lecture non signés.
- **Permissions** : nouveau granular `gestion_documentaire.can_approve` distinct de `can_edit` ; rôles Admin/RMQ par défaut.

---

## Livraison suggérée

Chaque lot = 1 message d'implémentation distinct pour validation incrémentale :
1. **Lot 1** d'abord (base ISO critique : workflow + obsolète + revue périodique + codification).
2. **Lot 2** ensuite (traçabilité utilisateur).
3. **Lot 3** en finition (pilotage et exports).

Confirme par quel lot tu veux que je commence (recommandé : **Lot 1**).
