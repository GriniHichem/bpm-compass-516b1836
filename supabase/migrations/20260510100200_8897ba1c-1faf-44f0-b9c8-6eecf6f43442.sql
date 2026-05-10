-- Perf pack Plan d'actions (self-hosted optimization)
-- Idempotent / safe to replay

-- ============================================
-- 1. INDEX MANQUANTS (chemins chauds)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_project_actions_resp_user
  ON public.project_actions(responsable_user_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_resp_user
  ON public.project_tasks(responsable_user_id);

CREATE INDEX IF NOT EXISTS idx_project_action_links_action
  ON public.project_action_links(action_id);

CREATE INDEX IF NOT EXISTS idx_project_action_dependencies_project
  ON public.project_action_dependencies(project_id);

CREATE INDEX IF NOT EXISTS idx_project_action_dependencies_source
  ON public.project_action_dependencies(source_action_id);

CREATE INDEX IF NOT EXISTS idx_project_action_dependencies_target
  ON public.project_action_dependencies(target_action_id);

CREATE INDEX IF NOT EXISTS idx_project_action_comments_action
  ON public.project_action_comments(action_id);

CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_user
  ON public.project_collaborators(project_id, user_id);

-- ============================================
-- 2. RLS optimisé : (select auth.uid()) au lieu de auth.uid()
--    Postgres évalue alors la fonction UNE fois par requête au lieu de par ligne.
-- ============================================

-- project_actions
DROP POLICY IF EXISTS project_actions_select ON public.project_actions;
CREATE POLICY project_actions_select ON public.project_actions
  FOR SELECT USING (public.can_read_project((select auth.uid()), project_id));

DROP POLICY IF EXISTS project_actions_update ON public.project_actions;
CREATE POLICY project_actions_update ON public.project_actions
  FOR UPDATE USING (
    public.can_write_project((select auth.uid()), project_id)
    OR (public.can_write_project_restricted((select auth.uid()), project_id)
        AND public.is_my_project_action((select auth.uid()), id))
  );

DROP POLICY IF EXISTS project_actions_delete ON public.project_actions;
CREATE POLICY project_actions_delete ON public.project_actions
  FOR DELETE USING (public.can_write_project((select auth.uid()), project_id));

-- project_tasks
DROP POLICY IF EXISTS project_tasks_select ON public.project_tasks;
CREATE POLICY project_tasks_select ON public.project_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_actions a
      WHERE a.id = project_tasks.action_id
        AND public.can_read_project((select auth.uid()), a.project_id)
    )
  );

DROP POLICY IF EXISTS project_tasks_update ON public.project_tasks;
CREATE POLICY project_tasks_update ON public.project_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.project_actions a
      WHERE a.id = project_tasks.action_id
        AND (public.can_write_project((select auth.uid()), a.project_id)
          OR (public.can_write_project_restricted((select auth.uid()), a.project_id)
              AND public.is_my_project_task((select auth.uid()), project_tasks.id)))
    )
  );

DROP POLICY IF EXISTS project_tasks_delete ON public.project_tasks;
CREATE POLICY project_tasks_delete ON public.project_tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.project_actions a
      WHERE a.id = project_tasks.action_id
        AND public.can_write_project((select auth.uid()), a.project_id)
    )
  );

-- project_action_links
DROP POLICY IF EXISTS "Authenticated users can manage project_action_links" ON public.project_action_links;
CREATE POLICY "Authenticated users can manage project_action_links"
  ON public.project_action_links FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.project_actions a
      WHERE a.id = project_action_links.action_id
        AND (public.can_write_project((select auth.uid()), a.project_id)
          OR (public.can_write_project_restricted((select auth.uid()), a.project_id)
              AND public.is_my_project_action((select auth.uid()), a.id)))
    )
  );

-- project_action_dependencies
DROP POLICY IF EXISTS project_action_dependencies_select ON public.project_action_dependencies;
CREATE POLICY project_action_dependencies_select ON public.project_action_dependencies
  FOR SELECT USING (public.can_read_project((select auth.uid()), project_id));

DROP POLICY IF EXISTS project_action_dependencies_update ON public.project_action_dependencies;
CREATE POLICY project_action_dependencies_update ON public.project_action_dependencies
  FOR UPDATE USING (
    public.can_write_project((select auth.uid()), project_id)
    OR (public.can_write_project_restricted((select auth.uid()), project_id)
        AND public.is_my_project_action((select auth.uid()), source_action_id)
        AND public.is_my_project_action((select auth.uid()), target_action_id))
  );

DROP POLICY IF EXISTS project_action_dependencies_delete ON public.project_action_dependencies;
CREATE POLICY project_action_dependencies_delete ON public.project_action_dependencies
  FOR DELETE USING (
    public.can_write_project((select auth.uid()), project_id)
    OR (public.can_write_project_restricted((select auth.uid()), project_id)
        AND public.is_my_project_action((select auth.uid()), source_action_id)
        AND public.is_my_project_action((select auth.uid()), target_action_id))
  );

-- project_action_history
DROP POLICY IF EXISTS project_action_history_select ON public.project_action_history;
CREATE POLICY project_action_history_select ON public.project_action_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_actions a
      WHERE a.id = project_action_history.action_id
        AND public.can_read_project((select auth.uid()), a.project_id)
    )
  );

-- project_action_comments
DROP POLICY IF EXISTS project_action_comments_select ON public.project_action_comments;
CREATE POLICY project_action_comments_select ON public.project_action_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_actions a
      WHERE a.id = project_action_comments.action_id
        AND public.can_read_project((select auth.uid()), a.project_id)
    )
  );

DROP POLICY IF EXISTS project_action_comments_update ON public.project_action_comments;
CREATE POLICY project_action_comments_update ON public.project_action_comments
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS project_action_comments_delete ON public.project_action_comments;
CREATE POLICY project_action_comments_delete ON public.project_action_comments
  FOR DELETE USING (
    (select auth.uid()) = user_id
    OR public.has_role((select auth.uid()), 'admin'::app_role)
    OR public.has_role((select auth.uid()), 'super_admin'::app_role)
    OR public.has_role((select auth.uid()), 'rmq'::app_role)
  );

-- project_deadline_logs
DROP POLICY IF EXISTS project_deadline_logs_select ON public.project_deadline_logs;
CREATE POLICY project_deadline_logs_select ON public.project_deadline_logs
  FOR SELECT USING (public.can_read_project((select auth.uid()), project_id));

-- ============================================
-- 3. Réduire le bruit du trigger audit générique
--    project_actions et project_tasks ont déjà leur propre journal métier
--    (project_action_history via trg_log_project_action_changes/_task_changes).
--    On supprime le doublon audit_logs sur ces tables très actives.
-- ============================================
DROP TRIGGER IF EXISTS audit_project_actions ON public.project_actions;
DROP TRIGGER IF EXISTS audit_project_tasks   ON public.project_tasks;

-- ============================================
-- 4. ANALYZE pour rafraîchir les stats du planner
-- ============================================
ANALYZE public.project_actions;
ANALYZE public.project_tasks;
ANALYZE public.project_action_links;
ANALYZE public.project_action_dependencies;
ANALYZE public.project_action_history;
ANALYZE public.project_action_comments;
ANALYZE public.project_collaborators;
ANALYZE public.user_roles;