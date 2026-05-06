CREATE OR REPLACE FUNCTION public.guard_project_responsable_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.responsable_user_id IS DISTINCT FROM OLD.responsable_user_id THEN
    IF current_setting('app.project_responsable_transfer', true) IS DISTINCT FROM 'enabled' THEN
      RAISE EXCEPTION 'Le responsable du projet ne peut être modifié que via le transfert dédié';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_guard_project_responsable_changes'
      AND tgrelid = 'public.projects'::regclass
  ) THEN
    CREATE TRIGGER trg_guard_project_responsable_changes
    BEFORE UPDATE OF responsable_user_id ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_project_responsable_changes();
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.transfer_project_responsibility(
  _project_id uuid,
  _new_responsable_user_id uuid,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project record;
  _actor uuid := auth.uid();
  _clean_reason text := NULLIF(trim(COALESCE(_reason, '')), '');
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  SELECT id, title, created_by, responsable_user_id
  INTO _project
  FROM public.projects
  WHERE id = _project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projet introuvable';
  END IF;

  IF _new_responsable_user_id IS NULL THEN
    RAISE EXCEPTION 'Le nouveau responsable est requis';
  END IF;

  IF _project.responsable_user_id IS NOT NULL
     AND _project.responsable_user_id = _new_responsable_user_id THEN
    RETURN;
  END IF;

  IF NOT (
    public.has_role(_actor, 'admin')
    OR public.has_role(_actor, 'rmq')
    OR public.has_role(_actor, 'super_admin')
    OR _project.responsable_user_id = _actor
    OR (_project.responsable_user_id IS NULL AND _project.created_by = _actor)
  ) THEN
    RAISE EXCEPTION 'Seul le responsable du projet ou un administrateur peut transférer la responsabilité';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _new_responsable_user_id
      AND actif = true
  ) THEN
    RAISE EXCEPTION 'Le nouveau responsable doit être un utilisateur actif';
  END IF;

  PERFORM set_config('app.project_responsable_transfer', 'enabled', true);

  UPDATE public.projects
  SET responsable_user_id = _new_responsable_user_id
  WHERE id = _project_id;

  INSERT INTO public.audit_logs (user_id, entity_type, entity_id, action, old_value, new_value)
  VALUES (
    _actor,
    'projects',
    _project_id,
    CASE
      WHEN _project.responsable_user_id IS NULL THEN 'set_responsable'
      ELSE 'transfer_responsable'
    END,
    jsonb_build_object(
      'responsable_user_id', _project.responsable_user_id,
      'reason', _clean_reason,
      'project_title', _project.title
    ),
    jsonb_build_object(
      'responsable_user_id', _new_responsable_user_id,
      'reason', _clean_reason,
      'project_title', _project.title
    )
  );
END;
$$;