## Objectif

Enrichir les commentaires du Plan d'action pour permettre, **par simple clic** (souris ou tactile), d'insérer des **tags interactifs** qui référencent des éléments existants — sans rien retaper.

## Principe

Sous la zone de commentaire, une barre d'outils compacte avec 4 boutons d'insertion. Chaque clic ouvre un mini-popover, l'utilisateur sélectionne, et un **chip cliquable** s'insère dans le texte au curseur. Le commentaire stocke un texte enrichi avec balises markdown-like (`@user:uuid|Salim Alak`, `#action:uuid|Préparer audit`, `#tâche:uuid|...`, `📅 2026-05-15`).

```
[ @ Mentionner ] [ # Action ] [ ✓ Tâche ] [ 📅 Date ]
```

### Boutons et comportements

| Bouton | Popover | Insertion | Effet secondaire |
|--------|---------|-----------|------------------|
| **@ Mentionner** | Liste des utilisateurs du projet (responsable + collaborateurs + responsables d'actions/tâches) avec recherche | `@Salim Alak` (chip bleu) | Notification simple à l'utilisateur tagué (push + email selon prefs) |
| **# Action** | Liste des actions du projet courant | `#Action: Préparer audit` (chip violet, cliquable → scroll vers l'action) | Aucun |
| **✓ Tâche** | Mini-formulaire inline : titre + responsable (ActeurUserSelect) + échéance optionnelle. Crée la tâche dans l'action courante. | `✓ Tâche créée: Vérifier livrables` (chip vert) | Crée réellement la `project_task` rattachée à l'action courante |
| **📅 Date** | Date picker | `📅 15 mai 2026` (chip ambre) | Aucun (purement informatif dans le commentaire) |

### Rendu

- Les chips sont **non éditables** dans le texte (atomiques) : un clic ou tap sur le chip dans le commentaire publié déclenche l'action liée (scroll vers l'action, ouvre la tâche, ouvre le profil utilisateur).
- Suppression : touche Backspace immédiatement à droite d'un chip le retire d'un coup (comportement contenteditable standard).
- Dans la zone d'édition : chips visibles dès l'insertion, le reste du texte reste libre.

## Détails techniques

### Stockage

- Le champ existant `project_action_comments.content` (text) garde le texte avec balises inline format :
  - `[@user:UUID|Display Name]`
  - `[#action:UUID|Titre]`
  - `[#task:UUID|Titre]`
  - `[📅:2026-05-15|15 mai 2026]`
- Pas de migration DB requise pour les commentaires.
- Pour les mentions, ajout d'une table légère `comment_mentions` pour faciliter notifications & requêtes :
  ```sql
  CREATE TABLE IF NOT EXISTS public.comment_mentions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid REFERENCES public.project_action_comments(id) ON DELETE CASCADE,
    mentioned_user_id uuid NOT NULL,
    created_at timestamptz DEFAULT now()
  );
  ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;
  -- RLS lecture : héritée du commentaire (visible si peut voir l'action)
  ```

### Notifications

- À la soumission d'un commentaire : pour chaque `@user` détecté, insertion dans `notifications` (type `mention`) avec lien vers l'action. Géré côté client après l'INSERT du commentaire (pattern fire-and-forget cohérent avec l'existant).
- Channel résolu via `resolve_notification_channel(user_id, 'project_action_comments', 'mention')`.

### Composants à créer/modifier

**Modifier** `src/components/projects/ProjectActionComments.tsx` :
- Remplacer le `<Textarea>` de saisie par un éditeur léger contenteditable + chips React (utiliser un wrapper simple basé sur `contentEditable` div + range API) — pas de dépendance externe lourde.
- Ajouter la barre de boutons sous la zone de saisie.
- Parser le `content` au rendu pour transformer les balises en chips React.
- Au submit : sérialiser HTML/chips en string balisée → INSERT `project_action_comments` → INSERT `comment_mentions` + `notifications` pour chaque mention.

**Créer** :
- `src/components/projects/CommentEditor.tsx` — éditeur contenteditable avec chips
- `src/components/projects/CommentChip.tsx` — rendu chip (variants user/action/task/date)
- `src/components/projects/CommentToolbar.tsx` — la barre des 4 boutons
- `src/components/projects/popovers/MentionPicker.tsx`
- `src/components/projects/popovers/ActionPicker.tsx`
- `src/components/projects/popovers/TaskCreator.tsx`
- `src/components/projects/popovers/DatePicker.tsx` (réutilise `Calendar` shadcn)
- `src/lib/commentTags.ts` — helpers parse/serialize/extractMentions

### Permissions

- Mention d'un utilisateur : autorisé pour quiconque peut commenter (`canComment` déjà calculé).
- Création de tâche depuis commentaire : nécessite `canEdit` (édition complète) sur l'action courante. Sinon le bouton ✓ Tâche est masqué.
- Référence d'action : toujours autorisée.
- Date : toujours autorisée (purement décorative).

### Tactile

- Tous les boutons et popovers utilisent les composants shadcn (`Popover`, `Command`) déjà responsive tactile.
- Cible tactile minimum 36px de hauteur sur les boutons.
- Le picker d'utilisateurs propose une recherche pour éviter le scroll long sur mobile.

## Hors scope

- Pas de syntaxe `@` au clavier (uniquement insertion par bouton, conformément à la demande « juste par cliquer »).
- Pas de modification de la table `project_action_comments` (le format texte balisé suffit).
- Pas de support markdown général (gras, italique, etc.).
- Pas de recherche fuzzy dans les mentions (recherche simple substring).
