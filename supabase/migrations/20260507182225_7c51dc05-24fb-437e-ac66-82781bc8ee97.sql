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
    WHERE a.id = _action_id
      AND _user_id IS NOT NULL
      AND (
        a.responsable_user_id = _user_id
        OR a.responsable_user_id_2 = _user_id
        OR a.responsable_user_id_3 = _user_id
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
    JOIN public.project_actions a ON a.id = t.action_id
    WHERE t.id = _task_id
      AND _user_id IS NOT NULL
      AND (
        t.responsable_user_id = _user_id
        OR a.responsable_user_id = _user_id
        OR a.responsable_user_id_2 = _user_id
        OR a.responsable_user_id_3 = _user_id
      )
  )
$function$;

ALTER POLICY "Authenticated users can manage project_action_links"
ON public.project_action_links
USING (
  EXISTS (
    SELECT 1
    FROM public.project_actions a
    WHERE a.id = project_action_links.action_id
      AND (
        public.can_write_project(auth.uid(), a.project_id)
        OR (
          public.can_write_project_restricted(auth.uid(), a.project_id)
          AND public.is_my_project_action(auth.uid(), a.id)
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.project_actions a
    WHERE a.id = project_action_links.action_id
      AND (
        public.can_write_project(auth.uid(), a.project_id)
        OR (
          public.can_write_project_restricted(auth.uid(), a.project_id)
          AND public.is_my_project_action(auth.uid(), a.id)
        )
      )
  )
);