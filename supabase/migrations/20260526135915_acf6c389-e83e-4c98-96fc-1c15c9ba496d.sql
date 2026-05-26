-- Lot 2.3 : sync moteur de validation → Actions / Fournisseurs / Enquêtes

-- Colonnes traçabilité approbation
ALTER TABLE public.actions
  ADD COLUMN IF NOT EXISTS date_approbation timestamptz,
  ADD COLUMN IF NOT EXISTS approbateur_user_id uuid;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS date_approbation timestamptz,
  ADD COLUMN IF NOT EXISTS approbateur_user_id uuid;

ALTER TABLE public.survey_templates
  ADD COLUMN IF NOT EXISTS date_approbation timestamptz,
  ADD COLUMN IF NOT EXISTS approbateur_user_id uuid;

-- Trigger métier : sync validation_workflows → actions
CREATE OR REPLACE FUNCTION public.sync_validation_to_plan_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_type <> 'plan_action' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;
  IF NEW.statut = 'approuve' THEN
    UPDATE public.actions
       SET date_approbation = COALESCE(date_approbation, now()),
           approbateur_user_id = COALESCE(approbateur_user_id, NEW.approbateur_user_id)
     WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_validation_to_plan_action ON public.validation_workflows;
CREATE TRIGGER trg_sync_validation_to_plan_action
AFTER INSERT OR UPDATE OF statut ON public.validation_workflows
FOR EACH ROW
WHEN (NEW.entity_type = 'plan_action')
EXECUTE FUNCTION public.sync_validation_to_plan_action();

-- Trigger métier : sync validation_workflows → suppliers
CREATE OR REPLACE FUNCTION public.sync_validation_to_fournisseur()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_type <> 'fournisseur' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;
  IF NEW.statut = 'approuve' THEN
    UPDATE public.suppliers
       SET statut = 'valide',
           date_approbation = COALESCE(date_approbation, now()),
           approbateur_user_id = COALESCE(approbateur_user_id, NEW.approbateur_user_id)
     WHERE id = NEW.entity_id;
  ELSIF NEW.statut = 'obsolete' THEN
    UPDATE public.suppliers
       SET statut = 'inactif'
     WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_validation_to_fournisseur ON public.validation_workflows;
CREATE TRIGGER trg_sync_validation_to_fournisseur
AFTER INSERT OR UPDATE OF statut ON public.validation_workflows
FOR EACH ROW
WHEN (NEW.entity_type = 'fournisseur')
EXECUTE FUNCTION public.sync_validation_to_fournisseur();

-- Trigger métier : sync validation_workflows → survey_templates
CREATE OR REPLACE FUNCTION public.sync_validation_to_enquete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_type <> 'enquete_satisfaction' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;
  IF NEW.statut = 'approuve' THEN
    UPDATE public.survey_templates
       SET status = 'published',
           date_approbation = COALESCE(date_approbation, now()),
           approbateur_user_id = COALESCE(approbateur_user_id, NEW.approbateur_user_id)
     WHERE id = NEW.entity_id;
  ELSIF NEW.statut = 'obsolete' THEN
    UPDATE public.survey_templates
       SET status = 'archived'
     WHERE id = NEW.entity_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_validation_to_enquete ON public.validation_workflows;
CREATE TRIGGER trg_sync_validation_to_enquete
AFTER INSERT OR UPDATE OF statut ON public.validation_workflows
FOR EACH ROW
WHEN (NEW.entity_type = 'enquete_satisfaction')
EXECUTE FUNCTION public.sync_validation_to_enquete();