DROP POLICY IF EXISTS "Authenticated users can manage project_action_links" ON public.project_action_links;
DROP POLICY IF EXISTS project_action_links_select ON public.project_action_links;
DROP POLICY IF EXISTS project_action_links_insert ON public.project_action_links;
DROP POLICY IF EXISTS project_action_links_update ON public.project_action_links;
DROP POLICY IF EXISTS project_action_links_delete ON public.project_action_links;

CREATE POLICY project_action_links_select
  ON public.project_action_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_actions a
      WHERE a.id = project_action_links.action_id
        AND public.can_read_project((select auth.uid()), a.project_id)
    )
  );

CREATE POLICY project_action_links_insert
  ON public.project_action_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.project_actions a
      WHERE a.id = project_action_links.action_id
        AND (
          public.can_write_project((select auth.uid()), a.project_id)
          OR (
            public.can_write_project_restricted((select auth.uid()), a.project_id)
            AND public.is_my_project_action((select auth.uid()), a.id)
          )
        )
    )
  );

CREATE POLICY project_action_links_update
  ON public.project_action_links
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_actions a
      WHERE a.id = project_action_links.action_id
        AND (
          public.can_write_project((select auth.uid()), a.project_id)
          OR (
            public.can_write_project_restricted((select auth.uid()), a.project_id)
            AND public.is_my_project_action((select auth.uid()), a.id)
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
          public.can_write_project((select auth.uid()), a.project_id)
          OR (
            public.can_write_project_restricted((select auth.uid()), a.project_id)
            AND public.is_my_project_action((select auth.uid()), a.id)
          )
        )
    )
  );

CREATE POLICY project_action_links_delete
  ON public.project_action_links
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_actions a
      WHERE a.id = project_action_links.action_id
        AND (
          public.can_write_project((select auth.uid()), a.project_id)
          OR (
            public.can_write_project_restricted((select auth.uid()), a.project_id)
            AND public.is_my_project_action((select auth.uid()), a.id)
          )
        )
    )
  );