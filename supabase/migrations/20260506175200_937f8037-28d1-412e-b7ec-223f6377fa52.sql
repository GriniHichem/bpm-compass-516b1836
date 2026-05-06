-- Skip history logging when the modifier is the project responsible (it's their project)
CREATE OR REPLACE FUNCTION public.log_project_action_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _fields text[] := ARRAY['title','description','statut','avancement','echeance','date_debut','responsable_id','responsable_id_2','responsable_id_3','responsable_user_id','responsable_user_id_2','responsable_user_id_3','multi_tasks','pinned','poids','ordre'];
  _field text;
  _old_val text;
  _new_val text;
  _actor uuid := auth.uid();
  _resp uuid;
BEGIN
  SELECT responsable_user_id INTO _resp FROM public.projects WHERE id = NEW.project_id;
  -- Do not log changes made by the project responsible on their own project
  IF _actor IS NOT NULL AND _resp IS NOT NULL AND _actor = _resp THEN
    RETURN NEW;
  END IF;

  FOREACH _field IN ARRAY _fields LOOP
    _old_val := (to_jsonb(OLD) ->> _field);
    _new_val := (to_jsonb(NEW) ->> _field);
    IF _old_val IS DISTINCT FROM _new_val THEN
      INSERT INTO public.project_action_history (action_id, user_id, field_name, old_value, new_value, entity_type)
      VALUES (NEW.id, _actor, _field, _old_val, _new_val, 'action');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_project_task_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _fields text[] := ARRAY['title','description','statut','avancement','echeance','date_debut','responsable_id','responsable_user_id','ordre'];
  _field text;
  _old_val text;
  _new_val text;
  _actor uuid := auth.uid();
  _resp uuid;
BEGIN
  SELECT p.responsable_user_id INTO _resp
  FROM public.project_actions pa
  JOIN public.projects p ON p.id = pa.project_id
  WHERE pa.id = NEW.action_id;

  IF _actor IS NOT NULL AND _resp IS NOT NULL AND _actor = _resp THEN
    RETURN NEW;
  END IF;

  FOREACH _field IN ARRAY _fields LOOP
    _old_val := (to_jsonb(OLD) ->> _field);
    _new_val := (to_jsonb(NEW) ->> _field);
    IF _old_val IS DISTINCT FROM _new_val THEN
      INSERT INTO public.project_action_history (action_id, task_id, user_id, field_name, old_value, new_value, entity_type)
      VALUES (NEW.action_id, NEW.id, _actor, _field, _old_val, _new_val, 'task');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;