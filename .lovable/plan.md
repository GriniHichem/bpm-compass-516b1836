# Lot 2 — Migration des modules vers le moteur de validation

Objectif : brancher le moteur `validation_workflows` (Lot 1) sur les 7 modules restants, dans l'ordre de criticité ISO 9001. Approche **non destructive** : les statuts métier existants restent, le moteur ajoute la couche formelle R/V/A.

---

## Ordre de migration

1. **Politique qualité** (§5.2) — R + A par Direction
2. **Objectifs qualité** (§6.2) — R + A par Direction
3. **Processus** (§4.4) — R + A par RMQ
4. **Revues de direction & processus** (§9.3) — R + A par Pilote/Direction
5. **Plans d'action** (NC, audit, projet) — R + A par RMQ/Pilote
6. **Fournisseurs critiques** (§8.4) — R + V + A par Achats + RMQ
7. **Enquêtes satisfaction** (§9.1.2) — R + A par RMQ

---

## Pattern technique commun (par module)

Chaque migration suit le **même squelette** :

### 1. Migration SQL (idempotente)
```sql
-- Activer le type d'entité (déjà présent dans validation_entity_types)
UPDATE validation_entity_types SET requires_redacteur=true, ...
  WHERE code = '<entity_type>';

-- Trigger métier au passage 'approuve' (action automatique)
CREATE OR REPLACE FUNCTION sync_validation_to_<module>() ...
-- ex: politique → archive ancienne version + active nouvelle
-- ex: processus → incrémente version + passe statut 'Validated'
-- ex: objectif → verrouille cible/échéance
-- ex: revue → verrouille PV
-- ex: fournisseur → fige classement A/B/C
-- ex: enquete → autorise diffusion template
```

### 2. Intégration UI
Injecter `<ValidationPanel entityType="..." entityId={id} onApproved={refetch} />` dans :
- Page de détail du module concerné
- Onglet « Validation » ou bloc en haut/colonne droite (selon page existante)

### 3. Verrouillage en lecture seule
Quand `workflow.statut === 'approuve'`, désactiver les champs d'édition (pattern déjà utilisé pour Documents).

---

## Détail par module

| # | Module | Fichier(s) page | Action métier au "Approuvé" | Étapes |
|---|---|---|---|---|
| 1 | Politique qualité | `PolitiqueQualite.tsx` | Archive N-1, active N, met `published_at` | R+A |
| 2 | Objectifs qualité | `PolitiqueQualite.tsx` (onglet objectifs) | Verrouille cible/échéance, ouvre mesures | R+A |
| 3 | Processus | `ProcessDetail.tsx` | `Draft → Validated`, incrémente version | R+A |
| 4 | Revues | `RevueDirection.tsx`, `RevueDirectionISO.tsx`, `EvaluationProcessus.tsx` | Verrouille PV, génère PDF signé | R+A |
| 5 | Plans d'action | `Actions.tsx`, `NonConformites.tsx` (plan), `Audits.tsx` (plan) | Verrouille plan, démarre suivi % | R+A |
| 6 | Fournisseurs | `Fournisseurs.tsx` (détail) | Fige classement (A/B/C) | R+V+A |
| 7 | Enquêtes satisfaction | `SatisfactionClient.tsx` (template) | Autorise diffusion template | R+A |

---

## Livrables

- **7 migrations SQL** (1 par module) avec triggers métier `sync_validation_to_*`
- **7 pages éditées** pour insérer `<ValidationPanel>` + verrouillage lecture seule
- **Mise à jour `ValidationsDashboard`** : aucune (déjà polymorphe, affiche tous les `entity_type` automatiquement)

---

## Aspects techniques

- Migrations **idempotentes** (`IF NOT EXISTS`, `DO $$ EXCEPTION`)
- **Pas d'edge function nouvelle**
- Statuts métier existants **conservés**, le moteur s'ajoute en parallèle
- Trigger métier déclenché uniquement sur transition vers `approuve` (pas en boucle)
- Permissions : héritées du moteur (approbateur assigné + Admin/RMQ/Super Admin)

---

## Recommandation d'exécution

Vu l'ampleur (7 modules × ~2 fichiers), **je propose de découper Lot 2 en sous-lots livrables** pour valider au fur et à mesure :

- **Lot 2.1** : Politique qualité + Objectifs qualité (même page, 1 migration combinée)
- **Lot 2.2** : Processus + Revues
- **Lot 2.3** : Plans d'action + Fournisseurs + Enquêtes

Chaque sous-lot = ~2-3 fichiers modifiés + 1 migration. Tu valides un sous-lot avant de passer au suivant → zéro régression.

**Confirme : je démarre par Lot 2.1 (Politique + Objectifs) ?**
