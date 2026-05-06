ALTER TABLE public.project_action_history
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.project_tasks(id) ON DELETE CASCADE;

ALTER TABLE public.project_action_history
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'action';

CREATE INDEX IF NOT EXISTS idx_pah_action_created ON public.project_action_history (action_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pah_user_created ON public.project_action_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pah_task ON public.project_action_history (task_id);

CREATE OR REPLACE FUNCTION public.log_project_action_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
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
      INSERT INTO public.project_action_history (action_id, user_id, field_name, old_value, new_value, entity_type)
      VALUES (NEW.id, auth.uid(), _field, _old_val, _new_val, 'action');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.log_project_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  _fields text[] := ARRAY['title','description','statut','avancement','echeance','date_debut','responsable_id','responsable_user_id','ordre'];
  _field text;
  _old_val text;
  _new_val text;
BEGIN
  FOREACH _field IN ARRAY _fields LOOP
    _old_val := (to_jsonb(OLD) ->> _field);
    _new_val := (to_jsonb(NEW) ->> _field);
    IF _old_val IS DISTINCT FROM _new_val THEN
      INSERT INTO public.project_action_history (action_id, task_id, user_id, field_name, old_value, new_value, entity_type)
      VALUES (NEW.action_id, NEW.id, auth.uid(), _field, _old_val, _new_val, 'task');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_log_project_task_changes ON public.project_tasks;
CREATE TRIGGER trg_log_project_task_changes
AFTER UPDATE ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_project_task_changes();