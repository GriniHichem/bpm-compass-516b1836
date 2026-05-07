
-- ===== Helpers =====
CREATE OR REPLACE FUNCTION public.project_access_level(_user_id uuid, _project_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN NULL
    WHEN public.has_role(_user_id, 'super_admin') THEN 'admin'
    WHEN public.has_role(_user_id, 'admin')       THEN 'admin'
    WHEN public.has_role(_user_id, 'rmq')         THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = _project_id
        AND (p.responsable_user_id = _user_id
          OR (p.responsable_user_id IS NULL AND p.created_by = _user_id))
    ) THEN 'responsable'
    ELSE (
      SELECT access_level FROM public.project_collaborators
      WHERE project_id = _project_id AND user_id = _user_id
      LIMIT 1
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.can_read_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.project_access_level(_user_id, _project_id) IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = _project_id AND COALESCE(visibility, 'public') <> 'private'
    )
$$;

CREATE OR REPLACE FUNCTION public.can_write_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.project_access_level(_user_id, _project_id) IN ('admin','responsable','write')
$$;

CREATE OR REPLACE FUNCTION public.can_write_project_restricted(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.project_access_level(_user_id, _project_id)
         IN ('admin','responsable','write','restricted_write')
$$;

-- Helper : la ligne action appartient-elle à l'utilisateur (pour restricted_write)
CREATE OR REPLACE FUNCTION public.is_my_project_action(_user_id uuid, _action_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_actions a
    LEFT JOIN public.profiles pr ON pr.id = _user_id
    WHERE a.id = _action_id
      AND (
        a.responsable_user_id   = _user_id OR
        a.responsable_user_id_2 = _user_id OR
        a.responsable_user_id_3 = _user_id OR
        (pr.acteur_id IS NOT NULL AND (
          a.responsable_id   = pr.acteur_id OR
          a.responsable_id_2 = pr.acteur_id OR
          a.responsable_id_3 = pr.acteur_id
        ))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_my_project_task(_user_id uuid, _task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_tasks t
    LEFT JOIN public.profiles pr ON pr.id = _user_id
    WHERE t.id = _task_id
      AND (
        t.responsable_user_id = _user_id
        OR (pr.acteur_id IS NOT NULL AND t.responsable_id = pr.acteur_id)
        OR public.is_my_project_action(_user_id, t.action_id)
      )
  )
$$;

-- ===== projects =====
DROP POLICY IF EXISTS auth_full_projects ON public.projects;
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
USING (public.can_read_project(auth.uid(), id));

CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated
USING (public.can_write_project(auth.uid(), id))
WITH CHECK (public.can_write_project(auth.uid(), id));

-- DELETE : ouvert au niveau RLS, le trigger guard_project_delete fait l'enforcement (admin + 7j)
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated
USING (public.project_access_level(auth.uid(), id) = 'admin');

-- ===== project_collaborators =====
DROP POLICY IF EXISTS "Authenticated users can manage project collaborators" ON public.project_collaborators;
DROP POLICY IF EXISTS "project_collaborators_select" ON public.project_collaborators;
DROP POLICY IF EXISTS "project_collaborators_write" ON public.project_collaborators;

CREATE POLICY "project_collaborators_select" ON public.project_collaborators FOR SELECT TO authenticated
USING (public.can_read_project(auth.uid(), project_id));

CREATE POLICY "project_collaborators_write" ON public.project_collaborators FOR ALL TO authenticated
USING (public.project_access_level(auth.uid(), project_id) IN ('admin','responsable'))
WITH CHECK (public.project_access_level(auth.uid(), project_id) IN ('admin','responsable'));

-- ===== project_actions =====
DROP POLICY IF EXISTS auth_full_project_actions ON public.project_actions;
DROP POLICY IF EXISTS "project_actions_select" ON public.project_actions;
DROP POLICY IF EXISTS "project_actions_insert" ON public.project_actions;
DROP POLICY IF EXISTS "project_actions_update" ON public.project_actions;
DROP POLICY IF EXISTS "project_actions_delete" ON public.project_actions;

CREATE POLICY "project_actions_select" ON public.project_actions FOR SELECT TO authenticated
USING (public.can_read_project(auth.uid(), project_id));

CREATE POLICY "project_actions_insert" ON public.project_actions FOR INSERT TO authenticated
WITH CHECK (public.can_write_project(auth.uid(), project_id));

CREATE POLICY "project_actions_update" ON public.project_actions FOR UPDATE TO authenticated
USING (
  public.can_write_project(auth.uid(), project_id)
  OR (public.can_write_project_restricted(auth.uid(), project_id) AND public.is_my_project_action(auth.uid(), id))
)
WITH CHECK (
  public.can_write_project(auth.uid(), project_id)
  OR (public.can_write_project_restricted(auth.uid(), project_id) AND public.is_my_project_action(auth.uid(), id))
);

CREATE POLICY "project_actions_delete" ON public.project_actions FOR DELETE TO authenticated
USING (public.can_write_project(auth.uid(), project_id));

-- ===== project_tasks =====
DROP POLICY IF EXISTS auth_full_project_tasks ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_select" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_insert" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_update" ON public.project_tasks;
DROP POLICY IF EXISTS "project_tasks_delete" ON public.project_tasks;

CREATE POLICY "project_tasks_select" ON public.project_tasks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_actions a
    WHERE a.id = project_tasks.action_id
      AND public.can_read_project(auth.uid(), a.project_id)
  )
);

CREATE POLICY "project_tasks_insert" ON public.project_tasks FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_actions a
    WHERE a.id = project_tasks.action_id
      AND public.can_write_project(auth.uid(), a.project_id)
  )
);

CREATE POLICY "project_tasks_update" ON public.project_tasks FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_actions a
    WHERE a.id = project_tasks.action_id
      AND (
        public.can_write_project(auth.uid(), a.project_id)
        OR (public.can_write_project_restricted(auth.uid(), a.project_id)
            AND public.is_my_project_task(auth.uid(), project_tasks.id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_actions a
    WHERE a.id = project_tasks.action_id
      AND (
        public.can_write_project(auth.uid(), a.project_id)
        OR (public.can_write_project_restricted(auth.uid(), a.project_id)
            AND public.is_my_project_task(auth.uid(), project_tasks.id))
      )
  )
);

CREATE POLICY "project_tasks_delete" ON public.project_tasks FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_actions a
    WHERE a.id = project_tasks.action_id
      AND public.can_write_project(auth.uid(), a.project_id)
  )
);

-- ===== project_action_comments =====
DROP POLICY IF EXISTS "Authenticated users can read comments" ON public.project_action_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.project_action_comments;
DROP POLICY IF EXISTS "Authors can update their own comments" ON public.project_action_comments;
DROP POLICY IF EXISTS "Authors and admins can delete comments" ON public.project_action_comments;
DROP POLICY IF EXISTS "project_action_comments_select" ON public.project_action_comments;
DROP POLICY IF EXISTS "project_action_comments_insert" ON public.project_action_comments;
DROP POLICY IF EXISTS "project_action_comments_update" ON public.project_action_comments;
DROP POLICY IF EXISTS "project_action_comments_delete" ON public.project_action_comments;

CREATE POLICY "project_action_comments_select" ON public.project_action_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_actions a
    WHERE a.id = project_action_comments.action_id
      AND public.can_read_project(auth.uid(), a.project_id)
  )
);

CREATE POLICY "project_action_comments_insert" ON public.project_action_comments FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.project_actions a
    WHERE a.id = project_action_comments.action_id
      AND public.can_read_project(auth.uid(), a.project_id)
  )
);

CREATE POLICY "project_action_comments_update" ON public.project_action_comments FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_action_comments_delete" ON public.project_action_comments FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'rmq')
);
