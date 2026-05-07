-- ===== project_action_dependencies =====
DROP POLICY IF EXISTS "Authenticated users can read dependencies" ON public.project_action_dependencies;
DROP POLICY IF EXISTS "Authenticated users can insert dependencies" ON public.project_action_dependencies;
DROP POLICY IF EXISTS "Authenticated users can update dependencies" ON public.project_action_dependencies;
DROP POLICY IF EXISTS "Authenticated users can delete dependencies" ON public.project_action_dependencies;
DROP POLICY IF EXISTS "project_action_dependencies_select" ON public.project_action_dependencies;
DROP POLICY IF EXISTS "project_action_dependencies_insert" ON public.project_action_dependencies;
DROP POLICY IF EXISTS "project_action_dependencies_update" ON public.project_action_dependencies;
DROP POLICY IF EXISTS "project_action_dependencies_delete" ON public.project_action_dependencies;

CREATE POLICY "project_action_dependencies_select" ON public.project_action_dependencies FOR SELECT TO authenticated
USING (public.can_read_project(auth.uid(), project_id));

CREATE POLICY "project_action_dependencies_insert" ON public.project_action_dependencies FOR INSERT TO authenticated
WITH CHECK (
  public.can_write_project(auth.uid(), project_id)
  OR (
    public.can_write_project_restricted(auth.uid(), project_id)
    AND public.is_my_project_action(auth.uid(), source_action_id)
    AND public.is_my_project_action(auth.uid(), target_action_id)
  )
);

CREATE POLICY "project_action_dependencies_update" ON public.project_action_dependencies FOR UPDATE TO authenticated
USING (
  public.can_write_project(auth.uid(), project_id)
  OR (
    public.can_write_project_restricted(auth.uid(), project_id)
    AND public.is_my_project_action(auth.uid(), source_action_id)
    AND public.is_my_project_action(auth.uid(), target_action_id)
  )
)
WITH CHECK (
  public.can_write_project(auth.uid(), project_id)
  OR (
    public.can_write_project_restricted(auth.uid(), project_id)
    AND public.is_my_project_action(auth.uid(), source_action_id)
    AND public.is_my_project_action(auth.uid(), target_action_id)
  )
);

CREATE POLICY "project_action_dependencies_delete" ON public.project_action_dependencies FOR DELETE TO authenticated
USING (
  public.can_write_project(auth.uid(), project_id)
  OR (
    public.can_write_project_restricted(auth.uid(), project_id)
    AND public.is_my_project_action(auth.uid(), source_action_id)
    AND public.is_my_project_action(auth.uid(), target_action_id)
  )
);

-- ===== project_action_history =====
DROP POLICY IF EXISTS "Authenticated users can read history" ON public.project_action_history;
DROP POLICY IF EXISTS "System can insert history" ON public.project_action_history;
DROP POLICY IF EXISTS "project_action_history_select" ON public.project_action_history;
DROP POLICY IF EXISTS "project_action_history_insert" ON public.project_action_history;

CREATE POLICY "project_action_history_select" ON public.project_action_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_actions a
    WHERE a.id = project_action_history.action_id
      AND public.can_read_project(auth.uid(), a.project_id)
  )
);

-- INSERT reste large : alimenté par les triggers SECURITY DEFINER + insertion manuelle
-- pour la traçabilité de réouverture (déjà gardée côté UI par actionEditable).
CREATE POLICY "project_action_history_insert" ON public.project_action_history FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_actions a
    WHERE a.id = project_action_history.action_id
      AND (
        public.can_write_project(auth.uid(), a.project_id)
        OR (public.can_write_project_restricted(auth.uid(), a.project_id)
            AND public.is_my_project_action(auth.uid(), a.id))
      )
  )
);

-- ===== project_deadline_logs =====
DROP POLICY IF EXISTS "Authenticated users can view deadline logs" ON public.project_deadline_logs;
DROP POLICY IF EXISTS "Authenticated users can insert deadline logs" ON public.project_deadline_logs;
DROP POLICY IF EXISTS "project_deadline_logs_select" ON public.project_deadline_logs;
DROP POLICY IF EXISTS "project_deadline_logs_insert" ON public.project_deadline_logs;

CREATE POLICY "project_deadline_logs_select" ON public.project_deadline_logs FOR SELECT TO authenticated
USING (public.can_read_project(auth.uid(), project_id));

CREATE POLICY "project_deadline_logs_insert" ON public.project_deadline_logs FOR INSERT TO authenticated
WITH CHECK (
  public.can_write_project(auth.uid(), project_id)
  OR (
    public.can_write_project_restricted(auth.uid(), project_id)
    AND (
      (entity_type = 'action' AND public.is_my_project_action(auth.uid(), entity_id))
      OR (entity_type = 'task' AND public.is_my_project_task(auth.uid(), entity_id))
    )
  )
);