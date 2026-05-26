
-- Lot 3.1: Add can_verify and can_approve permission levels
-- These columns extend the existing RBAC matrix to drive the validation workflow engine.

-- 1. Add columns to role_permissions (idempotent)
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS can_verify BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS can_approve BOOLEAN NOT NULL DEFAULT false;

-- 2. Add columns to custom_role_permissions (idempotent)
ALTER TABLE public.custom_role_permissions ADD COLUMN IF NOT EXISTS can_verify BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.custom_role_permissions ADD COLUMN IF NOT EXISTS can_approve BOOLEAN NOT NULL DEFAULT false;

-- 3. Seed: for existing override rows of rmq role on workflow modules, grant verify+approve to preserve current behaviour
UPDATE public.role_permissions
   SET can_verify = true, can_approve = true
 WHERE role = 'rmq'
   AND module IN ('politique_qualite','revue_direction','revue_direction_iso','processus','actions','fournisseurs','satisfaction_client','documents');

-- 4. Mapping function: entity_type -> module
CREATE OR REPLACE FUNCTION public.validation_module_for_entity(_entity_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _entity_type
    WHEN 'politique_qualite'     THEN 'politique_qualite'
    WHEN 'objectif_qualite'      THEN 'politique_qualite'
    WHEN 'processus'             THEN 'processus'
    WHEN 'revue'                 THEN 'revue_direction'
    WHEN 'plan_action'           THEN 'actions'
    WHEN 'fournisseur'           THEN 'fournisseurs'
    WHEN 'enquete_satisfaction'  THEN 'satisfaction_client'
    WHEN 'document'              THEN 'documents'
    ELSE NULL
  END
$$;

-- 5. Right-check function (admin/super_admin/rmq bypass; otherwise read matrix)
CREATE OR REPLACE FUNCTION public.has_validation_right(_user_id uuid, _entity_type text, _level text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _module text;
  _col text;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF _level NOT IN ('can_verify','can_approve') THEN RETURN false; END IF;

  -- Bypass for top-level admin roles + RMQ (preserves current hardcoded behaviour)
  IF public.has_role(_user_id, 'super_admin')
     OR public.has_role(_user_id, 'admin')
     OR public.has_role(_user_id, 'rmq') THEN
    RETURN true;
  END IF;

  _module := public.validation_module_for_entity(_entity_type);
  IF _module IS NULL THEN RETURN false; END IF;

  -- Standard role permissions
  IF _level = 'can_verify' THEN
    IF EXISTS (
      SELECT 1
      FROM public.role_permissions rp
      JOIN public.user_roles ur ON ur.role = rp.role
      WHERE ur.user_id = _user_id AND rp.module = _module AND rp.can_verify = true
    ) THEN RETURN true; END IF;
    -- Custom role permissions
    IF EXISTS (
      SELECT 1
      FROM public.custom_role_permissions crp
      JOIN public.user_custom_roles ucr ON ucr.custom_role_id = crp.custom_role_id
      WHERE ucr.user_id = _user_id AND crp.module = _module AND crp.can_verify = true
    ) THEN RETURN true; END IF;
  ELSE -- can_approve
    IF EXISTS (
      SELECT 1
      FROM public.role_permissions rp
      JOIN public.user_roles ur ON ur.role = rp.role
      WHERE ur.user_id = _user_id AND rp.module = _module AND rp.can_approve = true
    ) THEN RETURN true; END IF;
    IF EXISTS (
      SELECT 1
      FROM public.custom_role_permissions crp
      JOIN public.user_custom_roles ucr ON ucr.custom_role_id = crp.custom_role_id
      WHERE ucr.user_id = _user_id AND crp.module = _module AND crp.can_approve = true
    ) THEN RETURN true; END IF;
  END IF;

  RETURN false;
END;
$$;

-- 6. Replace validation_verify to use has_validation_right
CREATE OR REPLACE FUNCTION public.validation_verify(_workflow_id uuid, _commentaire text DEFAULT NULL::text)
 RETURNS validation_workflows
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wf public.validation_workflows;
BEGIN
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF _wf.statut <> 'en_revue' THEN
    RAISE EXCEPTION 'Vérification impossible depuis le statut %', _wf.statut;
  END IF;
  IF auth.uid() <> _wf.verificateur_user_id
     AND NOT public.has_validation_right(auth.uid(), _wf.entity_type, 'can_verify') THEN
    RAISE EXCEPTION 'Droit de vérification requis';
  END IF;
  UPDATE public.validation_workflows
     SET statut = 'en_approbation', date_verification = now()
   WHERE id = _workflow_id
   RETURNING * INTO _wf;
  RETURN _wf;
END;
$function$;

-- 7. Replace validation_approve
CREATE OR REPLACE FUNCTION public.validation_approve(_workflow_id uuid, _commentaire text DEFAULT NULL::text)
 RETURNS validation_workflows
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wf public.validation_workflows;
BEGIN
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF _wf.statut <> 'en_approbation' THEN
    RAISE EXCEPTION 'Approbation impossible depuis le statut %', _wf.statut;
  END IF;
  IF auth.uid() <> _wf.approbateur_user_id
     AND NOT public.has_validation_right(auth.uid(), _wf.entity_type, 'can_approve') THEN
    RAISE EXCEPTION 'Droit d''approbation requis';
  END IF;
  UPDATE public.validation_workflows
     SET statut = 'approuve', date_approbation = now()
   WHERE id = _workflow_id
   RETURNING * INTO _wf;
  RETURN _wf;
END;
$function$;

-- 8. Replace validation_reject
CREATE OR REPLACE FUNCTION public.validation_reject(_workflow_id uuid, _motif text)
 RETURNS validation_workflows
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wf public.validation_workflows;
BEGIN
  IF _motif IS NULL OR length(trim(_motif)) = 0 THEN
    RAISE EXCEPTION 'Un motif de refus est requis';
  END IF;
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF _wf.statut NOT IN ('en_revue','en_approbation') THEN
    RAISE EXCEPTION 'Refus impossible depuis le statut %', _wf.statut;
  END IF;
  IF auth.uid() NOT IN (_wf.verificateur_user_id, _wf.approbateur_user_id)
     AND NOT public.has_validation_right(auth.uid(), _wf.entity_type, 'can_verify')
     AND NOT public.has_validation_right(auth.uid(), _wf.entity_type, 'can_approve') THEN
    RAISE EXCEPTION 'Droit de vérification ou d''approbation requis pour refuser';
  END IF;
  UPDATE public.validation_workflows
     SET statut = 'refuse', commentaire_refus = _motif
   WHERE id = _workflow_id
   RETURNING * INTO _wf;
  RETURN _wf;
END;
$function$;

-- 9. Replace validation_obsolete
CREATE OR REPLACE FUNCTION public.validation_obsolete(_workflow_id uuid, _motif text)
 RETURNS validation_workflows
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _wf public.validation_workflows;
BEGIN
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF auth.uid() <> _wf.approbateur_user_id
     AND NOT public.has_validation_right(auth.uid(), _wf.entity_type, 'can_approve') THEN
    RAISE EXCEPTION 'Droit d''approbation requis pour rendre obsolète';
  END IF;
  UPDATE public.validation_workflows
     SET statut = 'obsolete', commentaire_obsolescence = _motif, date_obsolescence = now()
   WHERE id = _workflow_id
   RETURNING * INTO _wf;
  RETURN _wf;
END;
$function$;
