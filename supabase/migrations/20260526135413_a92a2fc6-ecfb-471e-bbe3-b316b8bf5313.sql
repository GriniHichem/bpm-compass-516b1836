-- Lot 2.1 : sync moteur de validation → Politique qualité & Objectifs qualité

-- Ajouter colonnes manquantes pour le suivi d'approbation des objectifs
ALTER TABLE public.quality_objectives
  ADD COLUMN IF NOT EXISTS date_approbation timestamptz,
  ADD COLUMN IF NOT EXISTS approbateur_user_id uuid;

-- Trigger métier : sync validation_workflows → quality_policy
CREATE OR REPLACE FUNCTION public.sync_validation_to_politique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_type <> 'politique_qualite' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;

  IF NEW.statut = 'approuve' THEN
    -- archiver toutes les autres politiques validées
    UPDATE public.quality_policy
       SET statut = 'archive'
     WHERE id <> NEW.entity_id AND statut = 'valide';
    -- valider la nouvelle politique
    UPDATE public.quality_policy
       SET statut = 'valide',
           date_approbation = COALESCE(date_approbation, current_date),
           approuve_par = COALESCE(approuve_par, NEW.approbateur_user_id)
     WHERE id = NEW.entity_id;
  ELSIF NEW.statut = 'obsolete' THEN
    UPDATE public.quality_policy
       SET statut = 'archive'
     WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_validation_to_politique ON public.validation_workflows;
CREATE TRIGGER trg_sync_validation_to_politique
AFTER INSERT OR UPDATE OF statut ON public.validation_workflows
FOR EACH ROW
WHEN (NEW.entity_type = 'politique_qualite')
EXECUTE FUNCTION public.sync_validation_to_politique();

-- Trigger métier : sync validation_workflows → quality_objectives
CREATE OR REPLACE FUNCTION public.sync_validation_to_objectif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_type <> 'objectif_qualite' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;

  IF NEW.statut = 'approuve' THEN
    UPDATE public.quality_objectives
       SET date_approbation = COALESCE(date_approbation, now()),
           approbateur_user_id = COALESCE(approbateur_user_id, NEW.approbateur_user_id)
     WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_validation_to_objectif ON public.validation_workflows;
CREATE TRIGGER trg_sync_validation_to_objectif
AFTER INSERT OR UPDATE OF statut ON public.validation_workflows
FOR EACH ROW
WHEN (NEW.entity_type = 'objectif_qualite')
EXECUTE FUNCTION public.sync_validation_to_objectif();