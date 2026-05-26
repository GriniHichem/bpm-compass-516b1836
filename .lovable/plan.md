# Moteur de validation transversal (ISO 9001)

Objectif : remplacer les workflows ad-hoc par **un seul moteur générique** consommé par processus, documents, politique qualité, objectifs qualité, plans d'action, revues, fournisseurs critiques, enquêtes satisfaction. On capitalise sur ce qui existe déjà dans le Lot 1 Documents.

---

## Principes directeurs

1. **Polymorphisme** : une entité validable est identifiée par `(entity_type, entity_id)`. Le moteur ne connaît pas le métier.
2. **Configurable par type** : chaque `entity_type` déclare ses étapes (R/V/A), ses rôles autorisés, ses transitions permises, ses notifications.
3. **Non destructif** : les modules existants gardent leurs statuts métier (`Planifié`, `Validé`, `Archivé`…). Le moteur ajoute une **couche de validation parallèle** qui peut déclencher des transitions métier au moment de l'approbation.
4. **Rétrocompatible** : le Lot 1 Documents devient le 1er consommateur du moteur, sans casser l'existant.

---

## Lot 1 — Moteur central (socle technique)

### Tables

```text
validation_entity_types          -- catalogue : 'document','processus','politique_qualite',
                                 --             'objectif_qualite','plan_action','revue',
                                 --             'fournisseur','enquete_satisfaction'
  - code (PK)
  - label_fr
  - requires_redacteur boolean
  - requires_verificateur boolean
  - requires_approbateur boolean
  - allowed_approver_roles text[]   -- ex: ['admin','rmq','direction']
  - auto_action_on_approve text     -- hook métier (ex: 'document.publish')

validation_workflows
  - id, entity_type, entity_id
  - statut ('brouillon','en_revue','en_approbation','approuve','refuse','obsolete')
  - redacteur_user_id, verificateur_user_id, approbateur_user_id
  - date_soumission, date_verification, date_approbation
  - commentaire_refus
  - UNIQUE(entity_type, entity_id)

validation_history
  - id, workflow_id, from_statut, to_statut
  - actor_user_id, commentaire, created_at
```

RLS : lecture autorisée à tout authentifié sur entités auxquelles il a déjà accès (delegated via `has_role` + ownership). Écriture restreinte aux acteurs assignés + Admin/RMQ.

### Composant React unique

`<ValidationPanel entityType="..." entityId="..." onApproved={cb} />`
- Affiche statut + acteurs + historique + actions contextuelles (Soumettre / Vérifier / Approuver / Refuser / Rendre obsolète).
- Réutilise le visuel du `DocumentWorkflowDialog` actuel.

### Hooks

`useValidationWorkflow(entityType, entityId)` — fetch, mutations, realtime.

### Trigger générique `on_validation_approve`

Dispatche selon `auto_action_on_approve` :
- `document.publish` → set `documents.statut_workflow = 'approuve'` (compat Lot 1)
- `processus.validate` → incrémente version + statut `Validated`
- `politique.publish` → archive ancienne version + active nouvelle
- etc.

---

## Lot 2 — Migration progressive des modules

Pour chaque module, on ajoute un onglet/panneau "Validation" pointant vers le moteur et on configure le `entity_type` correspondant.

| Module | Étapes requises | Approbateur par défaut | Action métier au "Approuvé" |
|---|---|---|---|
| **Documents** (déjà fait, à brancher) | R + V + A | Admin / RMQ | Publication + calcul prochaine revue |
| **Processus** | R + A | RMQ | Passage `Draft → Validated`, incrémentation version |
| **Politique qualité** | R + A | Direction | Archivage version N-1 + activation version N |
| **Objectifs qualité** | R + A | Direction | Verrouillage cible/échéance, ouverture mesures |
| **Plans d'action** (NC, audit, projet) | R + A | RMQ ou Pilote | Verrouillage du plan, démarrage suivi % |
| **Revues** (processus & direction) | R + A | Pilote / Direction | Verrouillage PV, génération PDF signé |
| **Fournisseurs critiques** | R + V + A | Achats + RMQ | Classement officiel (A/B/C) figé |
| **Enquêtes satisfaction** | R + A | RMQ | Autorisation de diffusion (publication template) |

Chaque migration = ~1 fichier de config + 1 ligne `<ValidationPanel>` injectée dans la page existante. **Les statuts métier actuels restent** ; le moteur ajoute le verrouillage formel.

---

## Lot 3 — Pilotage & traçabilité globale

### Page `/qualite/validations`
- **Tableau de bord transversal** : "À valider par moi" (toutes entités confondues), "En attente de mon approbation", "Refusés à retravailler".
- **Filtres** : type d'entité, statut, acteur, période.
- **Statistiques ISO** : délai moyen R→A par type, taux de refus, top-approbateurs.
- **Export CSV + PDF A4 signé** (réutilise `exportStrategicPdf`).

### Notifications unifiées
Branche le moteur sur le système existant (`check-deadlines`) :
- Push + Email à chaque transition (soumission → vérificateur, vérification → approbateur, approbation → rédacteur).
- Relance auto J+3, J+7 si en attente.

### Audit log
Chaque transition pousse dans `activity_logs` existant via trigger.

---

## Aspects techniques

- **Migrations idempotentes** (`IF NOT EXISTS`, blocs `DO $$ EXCEPTION`).
- **GRANTs explicites** sur `public.*` (authenticated + service_role ; pas d'anon).
- **Permission granulaire ajoutée** : `validation.can_approve` par type d'entité (héritée de la matrice RBAC existante).
- **Compat Lot 1 Documents** : les colonnes `statut_workflow`, `redacteur_user_id`, etc. de `documents` sont conservées et **synchronisées** via trigger avec `validation_workflows` (double écriture le temps de la transition, puis lecture exclusive du moteur).
- **Pas d'edge function nouvelle** : tout en triggers DB + composant React.

---

## Recommandation

Démarrer par le **Lot 1** (moteur + branchement Documents en compat). Une fois validé sur les Documents (zéro régression), enchaîner Lot 2 module par module dans l'ordre de criticité ISO : Politique qualité → Objectifs → Processus → Revues → Plans d'action → Fournisseurs → Enquêtes. Lot 3 en finition.

**Bénéfices** :
- 1 seul code à maintenir au lieu de 8.
- Conformité ISO 9001 §5.2 / 6.2 / 7.5.2 / 8.4 / 9.3 complète.
- Vue globale "À valider" inexistante aujourd'hui.
- Base saine pour signature électronique future.

Confirme si je lance le Lot 1.
