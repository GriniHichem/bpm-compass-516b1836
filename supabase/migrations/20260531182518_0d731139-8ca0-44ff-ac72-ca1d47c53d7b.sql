
-- Lot 4: Intersection (whitelist) logic for per-process overrides
-- Rule: if at least one override row exists for (role, any process) at a given level,
-- the role enters whitelist mode → only processes with override=true are allowed.
-- Without any override row → global module matrix applies as before.
-- Multi-role: evaluated independently per role, OR between roles (most permissive wins).

CREATE OR REPLACE FUNCTION public.has_validation_right(_user_id uuid, _entity_type text, _level text, _entity_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _module text;
  _r record;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF _level NOT IN ('can_verify','can_approve') THEN RETURN false; END IF;

  -- Bypass for top-level admin roles + RMQ (unchanged)
  IF public.has_role(_user_id, 'super_admin')
     OR public.has_role(_user_id, 'admin')
     OR public.has_role(_user_id, 'rmq') THEN
    RETURN true;
  END IF;

  _module := public.validation_module_for_entity(_entity_type);
  IF _module IS NULL THEN RETURN false; END IF;

  -- Per-role evaluation: each role must individually grant access.
  -- A role grants access iff:
  --   global(role, module, level) = true
  --   AND (no override exists for (role, any process, level) OR override(role, entity_id, level) = true)

  -- Standard roles held by the user
  FOR _r IN SELECT role FROM public.user_roles WHERE user_id = _user_id LOOP
    -- 1) Global right for this role on this module
    IF EXISTS (
      SELECT 1 FROM public.role_permissions rp
      WHERE rp.role = _r.role AND rp.module = _module
        AND ((_level = 'can_verify' AND rp.can_verify = true)
          OR (_level = 'can_approve' AND rp.can_approve = true))
    ) THEN
      -- 2) Check intersection for processus
      IF _entity_type = 'processus' AND _entity_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.process_role_permissions prp
          WHERE prp.role = _r.role
            AND ((_level = 'can_verify' AND prp.can_verify = true)
              OR (_level = 'can_approve' AND prp.can_approve = true))
        ) THEN
          -- whitelist mode → require override on this specific process
          IF EXISTS (
            SELECT 1 FROM public.process_role_permissions prp
            WHERE prp.role = _r.role AND prp.process_id = _entity_id
              AND ((_level = 'can_verify' AND prp.can_verify = true)
                OR (_level = 'can_approve' AND prp.can_approve = true))
          ) THEN
            RETURN true;
          END IF;
          -- else: this role excluded by whitelist → try next role
        ELSE
          RETURN true; -- no overrides for this role → global applies
        END IF;
      ELSE
        RETURN true; -- non-process entity → global applies
      END IF;
    END IF;
  END LOOP;

  -- Custom roles held by the user
  FOR _r IN SELECT custom_role_id AS role FROM public.user_custom_roles WHERE user_id = _user_id LOOP
    IF EXISTS (
      SELECT 1 FROM public.custom_role_permissions crp
      WHERE crp.custom_role_id = _r.role AND crp.module = _module
        AND ((_level = 'can_verify' AND crp.can_verify = true)
          OR (_level = 'can_approve' AND crp.can_approve = true))
    ) THEN
      IF _entity_type = 'processus' AND _entity_id IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.process_role_permissions prp
          WHERE prp.custom_role_id = _r.role
            AND ((_level = 'can_verify' AND prp.can_verify = true)
              OR (_level = 'can_approve' AND prp.can_approve = true))
        ) THEN
          IF EXISTS (
            SELECT 1 FROM public.process_role_permissions prp
            WHERE prp.custom_role_id = _r.role AND prp.process_id = _entity_id
              AND ((_level = 'can_verify' AND prp.can_verify = true)
                OR (_level = 'can_approve' AND prp.can_approve = true))
          ) THEN
            RETURN true;
          END IF;
        ELSE
          RETURN true;
        END IF;
      ELSE
        RETURN true;
      END IF;
    END IF;
  END LOOP;

  RETURN false;
END;
$function$;

-- Helper for front-end / RLS use on read/edit/comment/detail/version levels
CREATE OR REPLACE FUNCTION public.process_access_allowed(_user_id uuid, _process_id uuid, _level text, _global_fallback boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _r record;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF _level NOT IN ('can_read','can_detail','can_comment','can_edit','can_version') THEN RETURN false; END IF;

  IF public.has_role(_user_id, 'super_admin')
     OR public.has_role(_user_id, 'admin')
     OR public.has_role(_user_id, 'rmq') THEN
    RETURN true;
  END IF;

  IF _global_fallback = false THEN
    RETURN false;
  END IF;

  -- For each role of the user, check intersection on this process
  FOR _r IN SELECT role::text AS role FROM public.user_roles WHERE user_id = _user_id LOOP
    IF EXISTS (
      SELECT 1 FROM public.process_role_permissions prp
      WHERE prp.role = _r.role::app_role
        AND ((_level = 'can_read' AND prp.can_read = true)
          OR (_level = 'can_detail' AND prp.can_detail = true)
          OR (_level = 'can_comment' AND prp.can_comment = true)
          OR (_level = 'can_edit' AND prp.can_edit = true)
          OR (_level = 'can_version' AND prp.can_version = true))
    ) THEN
      IF EXISTS (
        SELECT 1 FROM public.process_role_permissions prp
        WHERE prp.role = _r.role::app_role AND prp.process_id = _process_id
          AND ((_level = 'can_read' AND prp.can_read = true)
            OR (_level = 'can_detail' AND prp.can_detail = true)
            OR (_level = 'can_comment' AND prp.can_comment = true)
            OR (_level = 'can_edit' AND prp.can_edit = true)
            OR (_level = 'can_version' AND prp.can_version = true))
      ) THEN
        RETURN true;
      END IF;
      -- else: whitelist mode active for this role, this process excluded → next role
    ELSE
      RETURN true; -- no overrides for this role → global applies
    END IF;
  END LOOP;

  FOR _r IN SELECT custom_role_id::text AS role FROM public.user_custom_roles WHERE user_id = _user_id LOOP
    IF EXISTS (
      SELECT 1 FROM public.process_role_permissions prp
      WHERE prp.custom_role_id = _r.role::uuid
        AND ((_level = 'can_read' AND prp.can_read = true)
          OR (_level = 'can_detail' AND prp.can_detail = true)
          OR (_level = 'can_comment' AND prp.can_comment = true)
          OR (_level = 'can_edit' AND prp.can_edit = true)
          OR (_level = 'can_version' AND prp.can_version = true))
    ) THEN
      IF EXISTS (
        SELECT 1 FROM public.process_role_permissions prp
        WHERE prp.custom_role_id = _r.role::uuid AND prp.process_id = _process_id
          AND ((_level = 'can_read' AND prp.can_read = true)
            OR (_level = 'can_detail' AND prp.can_detail = true)
            OR (_level = 'can_comment' AND prp.can_comment = true)
            OR (_level = 'can_edit' AND prp.can_edit = true)
            OR (_level = 'can_version' AND prp.can_version = true))
      ) THEN
        RETURN true;
      END IF;
    ELSE
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$function$;
