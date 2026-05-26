
-- 1) Add can_verify / can_approve to per-process overrides
ALTER TABLE public.process_role_permissions
  ADD COLUMN IF NOT EXISTS can_verify  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve BOOLEAN NOT NULL DEFAULT false;

-- 2) Extend has_validation_right with an optional _entity_id
--    When entity_type = 'processus' and an entity_id is provided, also check
--    process_role_permissions (per-process override).
CREATE OR REPLACE FUNCTION public.has_validation_right(
  _user_id uuid,
  _entity_type text,
  _level text,
  _entity_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _module text;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF _level NOT IN ('can_verify','can_approve') THEN RETURN false; END IF;

  -- Bypass for top-level admin roles + RMQ
  IF public.has_role(_user_id, 'super_admin')
     OR public.has_role(_user_id, 'admin')
     OR public.has_role(_user_id, 'rmq') THEN
    RETURN true;
  END IF;

  _module := public.validation_module_for_entity(_entity_type);
  IF _module IS NULL THEN RETURN false; END IF;

  -- Per-process override (only when entity is a processus)
  IF _entity_type = 'processus' AND _entity_id IS NOT NULL THEN
    IF _level = 'can_verify' THEN
      IF EXISTS (
        SELECT 1
        FROM public.process_role_permissions prp
        JOIN public.user_roles ur ON ur.role = prp.role
        WHERE ur.user_id = _user_id
          AND prp.process_id = _entity_id
          AND prp.can_verify = true
      ) THEN RETURN true; END IF;
      IF EXISTS (
        SELECT 1
        FROM public.process_role_permissions prp
        JOIN public.user_custom_roles ucr ON ucr.custom_role_id = prp.custom_role_id
        WHERE ucr.user_id = _user_id
          AND prp.process_id = _entity_id
          AND prp.can_verify = true
      ) THEN RETURN true; END IF;
    ELSE
      IF EXISTS (
        SELECT 1
        FROM public.process_role_permissions prp
        JOIN public.user_roles ur ON ur.role = prp.role
        WHERE ur.user_id = _user_id
          AND prp.process_id = _entity_id
          AND prp.can_approve = true
      ) THEN RETURN true; END IF;
      IF EXISTS (
        SELECT 1
        FROM public.process_role_permissions prp
        JOIN public.user_custom_roles ucr ON ucr.custom_role_id = prp.custom_role_id
        WHERE ucr.user_id = _user_id
          AND prp.process_id = _entity_id
          AND prp.can_approve = true
      ) THEN RETURN true; END IF;
    END IF;
  END IF;

  -- Standard role permissions (global matrix)
  IF _level = 'can_verify' THEN
    IF EXISTS (
      SELECT 1
      FROM public.role_permissions rp
      JOIN public.user_roles ur ON ur.role = rp.role
      WHERE ur.user_id = _user_id AND rp.module = _module AND rp.can_verify = true
    ) THEN RETURN true; END IF;
    IF EXISTS (
      SELECT 1
      FROM public.custom_role_permissions crp
      JOIN public.user_custom_roles ucr ON ucr.custom_role_id = crp.custom_role_id
      WHERE ucr.user_id = _user_id AND crp.module = _module AND crp.can_verify = true
    ) THEN RETURN true; END IF;
  ELSE
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
$function$;

-- 3) Update validation_* RPCs to pass entity_id when checking rights
CREATE OR REPLACE FUNCTION public.validation_verify(_workflow_id uuid, _commentaire text DEFAULT NULL)
RETURNS validation_workflows
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _wf public.validation_workflows;
BEGIN
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF _wf.statut <> 'en_revue' THEN RAISE EXCEPTION 'Vérification impossible depuis le statut %', _wf.statut; END IF;
  IF auth.uid() <> _wf.verificateur_user_id
     AND NOT public.has_validation_right(auth.uid(), _wf.entity_type, 'can_verify', _wf.entity_id) THEN
    RAISE EXCEPTION 'Droit de vérification requis';
  END IF;
  UPDATE public.validation_workflows SET statut='en_approbation', date_verification=now()
   WHERE id=_workflow_id RETURNING * INTO _wf;
  RETURN _wf;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validation_approve(_workflow_id uuid, _commentaire text DEFAULT NULL)
RETURNS validation_workflows
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _wf public.validation_workflows;
BEGIN
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF _wf.statut <> 'en_approbation' THEN RAISE EXCEPTION 'Approbation impossible depuis le statut %', _wf.statut; END IF;
  IF auth.uid() <> _wf.approbateur_user_id
     AND NOT public.has_validation_right(auth.uid(), _wf.entity_type, 'can_approve', _wf.entity_id) THEN
    RAISE EXCEPTION 'Droit d''approbation requis';
  END IF;
  UPDATE public.validation_workflows SET statut='approuve', date_approbation=now()
   WHERE id=_workflow_id RETURNING * INTO _wf;
  RETURN _wf;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validation_reject(_workflow_id uuid, _motif text)
RETURNS validation_workflows
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _wf public.validation_workflows;
BEGIN
  IF _motif IS NULL OR length(trim(_motif))=0 THEN RAISE EXCEPTION 'Un motif de refus est requis'; END IF;
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF _wf.statut NOT IN ('en_revue','en_approbation') THEN
    RAISE EXCEPTION 'Refus impossible depuis le statut %', _wf.statut;
  END IF;
  IF auth.uid() NOT IN (_wf.verificateur_user_id, _wf.approbateur_user_id)
     AND NOT public.has_validation_right(auth.uid(), _wf.entity_type, 'can_verify', _wf.entity_id)
     AND NOT public.has_validation_right(auth.uid(), _wf.entity_type, 'can_approve', _wf.entity_id) THEN
    RAISE EXCEPTION 'Droit de vérification ou d''approbation requis pour refuser';
  END IF;
  UPDATE public.validation_workflows SET statut='refuse', commentaire_refus=_motif
   WHERE id=_workflow_id RETURNING * INTO _wf;
  RETURN _wf;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validation_obsolete(_workflow_id uuid, _motif text)
RETURNS validation_workflows
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _wf public.validation_workflows;
BEGIN
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF auth.uid() <> _wf.approbateur_user_id
     AND NOT public.has_validation_right(auth.uid(), _wf.entity_type, 'can_approve', _wf.entity_id) THEN
    RAISE EXCEPTION 'Droit d''approbation requis pour rendre obsolète';
  END IF;
  UPDATE public.validation_workflows
     SET statut='obsolete', commentaire_obsolescence=_motif, date_obsolescence=now()
   WHERE id=_workflow_id RETURNING * INTO _wf;
  RETURN _wf;
END;
$function$;
