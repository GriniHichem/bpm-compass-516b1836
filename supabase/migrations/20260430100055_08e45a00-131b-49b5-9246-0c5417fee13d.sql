ALTER TABLE public.project_actions
  ADD COLUMN IF NOT EXISTS responsable_user_id_2 uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsable_user_id_3 uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_actions_resp_user_2 ON public.project_actions(responsable_user_id_2);
CREATE INDEX IF NOT EXISTS idx_project_actions_resp_user_3 ON public.project_actions(responsable_user_id_3);

-- Track these new columns in the action history trigger
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
BEGIN
  FOREACH _field IN ARRAY _fields LOOP
    _old_val := (to_jsonb(OLD) ->> _field);
    _new_val := (to_jsonb(NEW) ->> _field);
    IF _old_val IS DISTINCT FROM _new_val THEN
      INSERT INTO public.project_action_history (action_id, user_id, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), _field, _old_val, _new_val);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;