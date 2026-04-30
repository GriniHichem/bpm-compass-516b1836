-- ============================================================
-- LOT B — Optimisation Self-Hosting : index, RLS, triggers, purge
-- Idempotente : peut être rejouée sans erreur
-- ============================================================

-- B1. Index manquants sur clés chaudes ----------------------------------
CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON public.user_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_user_custom_roles_user
  ON public.user_custom_roles(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_entity
  ON public.notifications(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created
  ON public.audit_logs(entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_actions_project_ordre
  ON public.project_actions(project_id, ordre);

CREATE INDEX IF NOT EXISTS idx_project_tasks_action
  ON public.project_tasks(action_id);

CREATE INDEX IF NOT EXISTS idx_profiles_acteur_actif
  ON public.profiles(acteur_id) WHERE actif = true;

-- B2. RLS optimisées : (SELECT auth.uid()) pour cache plan Postgres ------
-- Sémantique strictement identique. Seul le wrapping change pour permettre
-- à Postgres de mettre auth.uid() en cache une fois par requête.

-- profiles
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS profiles_update_rmq ON public.profiles;
CREATE POLICY profiles_update_rmq ON public.profiles FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'rmq'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS user_roles_delete_admin ON public.user_roles;
CREATE POLICY user_roles_delete_admin ON public.user_roles FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS user_roles_delete_rmq ON public.user_roles;
CREATE POLICY user_roles_delete_rmq ON public.user_roles FOR DELETE
  USING (has_role((SELECT auth.uid()), 'rmq'::app_role));

-- notifications (très chaude au login : NotificationBell)
DROP POLICY IF EXISTS notif_select_own ON public.notifications;
CREATE POLICY notif_select_own ON public.notifications FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notif_update_own ON public.notifications;
CREATE POLICY notif_update_own ON public.notifications FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notif_delete_own ON public.notifications;
CREATE POLICY notif_delete_own ON public.notifications FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- processes
DROP POLICY IF EXISTS processes_update ON public.processes;
CREATE POLICY processes_update ON public.processes FOR UPDATE
  USING (
    has_role((SELECT auth.uid()), 'rmq'::app_role)
    OR (has_role((SELECT auth.uid()), 'responsable_processus'::app_role) AND responsable_id = (SELECT auth.uid()))
    OR has_role((SELECT auth.uid()), 'consultant'::app_role)
  );

DROP POLICY IF EXISTS processes_update_admin ON public.processes;
CREATE POLICY processes_update_admin ON public.processes FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS processes_delete ON public.processes;
CREATE POLICY processes_delete ON public.processes FOR DELETE
  USING (has_role((SELECT auth.uid()), 'rmq'::app_role));

DROP POLICY IF EXISTS processes_delete_admin ON public.processes;
CREATE POLICY processes_delete_admin ON public.processes FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

-- audit_logs (table de 9k lignes — gain massif avec auth.uid() caché)
DROP POLICY IF EXISTS audit_logs_select_admin_rmq ON public.audit_logs;
CREATE POLICY audit_logs_select_admin_rmq ON public.audit_logs FOR SELECT
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR has_role((SELECT auth.uid()), 'rmq'::app_role)
  );

DROP POLICY IF EXISTS audit_logs_select_acteur ON public.audit_logs;
CREATE POLICY audit_logs_select_acteur ON public.audit_logs FOR SELECT
  USING (has_role((SELECT auth.uid()), 'acteur'::app_role) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS audit_logs_select_responsable ON public.audit_logs;
CREATE POLICY audit_logs_select_responsable ON public.audit_logs FOR SELECT
  USING (has_role((SELECT auth.uid()), 'responsable_processus'::app_role) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS audit_logs_select_auditeur ON public.audit_logs;
CREATE POLICY audit_logs_select_auditeur ON public.audit_logs FOR SELECT
  USING (
    has_role((SELECT auth.uid()), 'auditeur'::app_role)
    AND entity_type = ANY (ARRAY['audit'::text, 'audit_finding'::text, 'nonconformity'::text])
  );

-- role_permissions / user_custom_roles / custom_role_permissions / app_settings
DROP POLICY IF EXISTS role_permissions_update_admin ON public.role_permissions;
CREATE POLICY role_permissions_update_admin ON public.role_permissions FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS role_permissions_delete_admin ON public.role_permissions;
CREATE POLICY role_permissions_delete_admin ON public.role_permissions FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS ucr_update_admin ON public.user_custom_roles;
CREATE POLICY ucr_update_admin ON public.user_custom_roles FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS ucr_delete_admin ON public.user_custom_roles;
CREATE POLICY ucr_delete_admin ON public.user_custom_roles FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS crp_update_admin ON public.custom_role_permissions;
CREATE POLICY crp_update_admin ON public.custom_role_permissions FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS crp_delete_admin ON public.custom_role_permissions;
CREATE POLICY crp_delete_admin ON public.custom_role_permissions FOR DELETE
  USING (has_role((SELECT auth.uid()), 'admin'::app_role) OR has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS app_settings_update_sa ON public.app_settings;
CREATE POLICY app_settings_update_sa ON public.app_settings FOR UPDATE
  USING (has_role((SELECT auth.uid()), 'super_admin'::app_role));

DROP POLICY IF EXISTS app_settings_delete_sa ON public.app_settings;
CREATE POLICY app_settings_delete_sa ON public.app_settings FOR DELETE
  USING (has_role((SELECT auth.uid()), 'super_admin'::app_role));

-- B3. dispatch_notification_email : non bloquant, un seul candidat fallback
CREATE OR REPLACE FUNCTION public.dispatch_notification_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _configured_url text;
  _payload jsonb;
  _headers jsonb := jsonb_build_object('Content-Type', 'application/json');
  _has_pgnet boolean;
BEGIN
  IF NEW.channel NOT IN ('email', 'both') THEN
    RETURN NEW;
  END IF;

  -- Skip silently if pg_net is unavailable (push notif still works)
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) INTO _has_pgnet;
  IF NOT _has_pgnet THEN
    RETURN NEW;
  END IF;

  _payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'title', NEW.title,
    'message', COALESCE(NEW.message, ''),
    'entity_url', COALESCE(NEW.entity_url, ''),
    'notif_type', COALESCE(NEW.type, ''),
    'entity_type', COALESCE(NEW.entity_type, ''),
    'entity_id', COALESCE(NEW.entity_id::text, '')
  );

  SELECT NULLIF(trim(value), '')
    INTO _configured_url
  FROM public.app_settings
  WHERE key = 'supabase_url';

  IF _configured_url IS NULL OR _configured_url LIKE '__%PLACEHOLDER__%' THEN
    _configured_url := 'http://kong:8000';
  END IF;

  -- Fire-and-forget : ignore errors so the notification INSERT always succeeds
  BEGIN
    PERFORM net.http_post(
      url := _configured_url || '/functions/v1/send-notification-email',
      headers := _headers,
      body := _payload
    );
  EXCEPTION WHEN OTHERS THEN
    -- swallow : email is best-effort, never block the trigger
    NULL;
  END;

  RETURN NEW;
END;
$function$;

-- B4. Purge initiale audit_logs (>180 jours) + fonction réutilisable
DELETE FROM public.audit_logs WHERE created_at < now() - INTERVAL '180 days';

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs(_days int DEFAULT 180)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _deleted bigint;
BEGIN
  WITH d AS (
    DELETE FROM public.audit_logs
    WHERE created_at < now() - (_days || ' days')::interval
    RETURNING 1
  )
  SELECT count(*) INTO _deleted FROM d;
  RETURN _deleted;
END;
$function$;

-- B5. ANALYZE (rapide, met à jour les stats du planner après les nouveaux index)
ANALYZE public.user_roles;
ANALYZE public.user_custom_roles;
ANALYZE public.notifications;
ANALYZE public.audit_logs;
ANALYZE public.project_actions;
ANALYZE public.project_tasks;
ANALYZE public.profiles;