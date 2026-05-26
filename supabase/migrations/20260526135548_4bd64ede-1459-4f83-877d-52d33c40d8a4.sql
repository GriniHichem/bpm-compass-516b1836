-- Lot 2.2 : sync moteur de validation → Processus & Revues

-- Colonnes traçabilité approbation pour management_reviews
ALTER TABLE public.management_reviews
  ADD COLUMN IF NOT EXISTS date_approbation timestamptz,
  ADD COLUMN IF NOT EXISTS approbateur_user_id uuid;

-- Trigger métier : sync validation_workflows → processes
CREATE OR REPLACE FUNCTION public.sync_validation_to_processus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_type <> 'processus' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;

  IF NEW.statut = 'approuve' THEN
    UPDATE public.processes
       SET statut = 'valide'
     WHERE id = NEW.entity_id AND statut <> 'archive';
  ELSIF NEW.statut = 'en_revue' OR NEW.statut = 'en_approbation' THEN
    UPDATE public.processes
       SET statut = 'en_validation'
     WHERE id = NEW.entity_id AND statut = 'brouillon';
  ELSIF NEW.statut = 'obsolete' THEN
    UPDATE public.processes
       SET statut = 'archive'
     WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_validation_to_processus ON public.validation_workflows;
CREATE TRIGGER trg_sync_validation_to_processus
AFTER INSERT OR UPDATE OF statut ON public.validation_workflows
FOR EACH ROW
WHEN (NEW.entity_type = 'processus')
EXECUTE FUNCTION public.sync_validation_to_processus();

-- Trigger métier : sync validation_workflows → management_reviews
CREATE OR REPLACE FUNCTION public.sync_validation_to_revue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_type <> 'revue' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;

  IF NEW.statut = 'approuve' THEN
    UPDATE public.management_reviews
       SET statut = 'validee',
           date_approbation = COALESCE(date_approbation, now()),
           approbateur_user_id = COALESCE(approbateur_user_id, NEW.approbateur_user_id)
     WHERE id = NEW.entity_id;
  ELSIF NEW.statut = 'obsolete' THEN
    UPDATE public.management_reviews
       SET statut = 'archivee'
     WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_validation_to_revue ON public.validation_workflows;
CREATE TRIGGER trg_sync_validation_to_revue
AFTER INSERT OR UPDATE OF statut ON public.validation_workflows
FOR EACH ROW
WHEN (NEW.entity_type = 'revue')
EXECUTE FUNCTION public.sync_validation_to_revue();