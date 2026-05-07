CREATE OR REPLACE FUNCTION public.is_my_project_action(_user_id uuid, _action_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_actions a
    LEFT JOIN public.profiles pr ON pr.id = _user_id
    WHERE a.id = _action_id
      AND (
        a.responsable_user_id = _user_id
        OR a.responsable_user_id_2 = _user_id
        OR a.responsable_user_id_3 = _user_id
        OR (
          pr.acteur_id IS NOT NULL
          AND (
            (a.responsable_user_id IS NULL AND a.responsable_id = pr.acteur_id)
            OR (a.responsable_user_id_2 IS NULL AND a.responsable_id_2 = pr.acteur_id)
            OR (a.responsable_user_id_3 IS NULL AND a.responsable_id_3 = pr.acteur_id)
          )
        )
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_my_project_task(_user_id uuid, _task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_tasks t
    LEFT JOIN public.profiles pr ON pr.id = _user_id
    WHERE t.id = _task_id
      AND (
        t.responsable_user_id = _user_id
        OR (pr.acteur_id IS NOT NULL AND t.responsable_user_id IS NULL AND t.responsable_id = pr.acteur_id)
        OR public.is_my_project_action(_user_id, t.action_id)
      )
  )
$function$;