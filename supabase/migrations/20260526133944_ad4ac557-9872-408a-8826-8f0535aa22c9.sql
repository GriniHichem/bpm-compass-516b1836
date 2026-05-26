
-- =========================================================================
-- LOT 1 : Moteur de validation transversal
-- =========================================================================

-- 1. CATALOGUE DES TYPES D'ENTITÉS VALIDABLES
CREATE TABLE IF NOT EXISTS public.validation_entity_types (
  code text PRIMARY KEY,
  label_fr text NOT NULL,
  requires_redacteur boolean NOT NULL DEFAULT true,
  requires_verificateur boolean NOT NULL DEFAULT false,
  requires_approbateur boolean NOT NULL DEFAULT true,
  allowed_approver_roles text[] NOT NULL DEFAULT ARRAY['admin','rmq']::text[],
  auto_action_on_approve text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.validation_entity_types TO authenticated;
GRANT ALL ON public.validation_entity_types TO service_role;

ALTER TABLE public.validation_entity_types ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "vet_read_all_auth" ON public.validation_entity_types
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vet_admin_write" ON public.validation_entity_types
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'rmq'))
    WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'rmq'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed catalogue
INSERT INTO public.validation_entity_types (code, label_fr, requires_redacteur, requires_verificateur, requires_approbateur, allowed_approver_roles, auto_action_on_approve) VALUES
  ('document',             'Document',                 true, true,  true, ARRAY['admin','rmq'],            'document.publish'),
  ('processus',            'Processus',                true, false, true, ARRAY['admin','rmq'],            'processus.validate'),
  ('politique_qualite',    'Politique qualité',        true, false, true, ARRAY['admin','direction'],      'politique.publish'),
  ('objectif_qualite',     'Objectif qualité',         true, false, true, ARRAY['admin','rmq','direction'],'objectif.lock'),
  ('plan_action',          'Plan d''action',           true, false, true, ARRAY['admin','rmq'],            'plan.lock'),
  ('revue',                'Revue (PV)',               true, false, true, ARRAY['admin','rmq','direction'],'revue.lock'),
  ('fournisseur',          'Fournisseur critique',     true, true,  true, ARRAY['admin','rmq'],            'fournisseur.classify'),
  ('enquete_satisfaction', 'Enquête satisfaction',     true, false, true, ARRAY['admin','rmq'],            'enquete.publish')
ON CONFLICT (code) DO NOTHING;

-- 2. WORKFLOWS
CREATE TABLE IF NOT EXISTS public.validation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL REFERENCES public.validation_entity_types(code),
  entity_id uuid NOT NULL,
  statut text NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','en_revue','en_approbation','approuve','refuse','obsolete')),
  redacteur_user_id uuid,
  verificateur_user_id uuid,
  approbateur_user_id uuid,
  date_soumission timestamptz,
  date_verification timestamptz,
  date_approbation timestamptz,
  date_obsolescence timestamptz,
  commentaire_refus text,
  commentaire_obsolescence text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_validation_workflows_entity ON public.validation_workflows(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_statut ON public.validation_workflows(statut);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_approbateur ON public.validation_workflows(approbateur_user_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_verificateur ON public.validation_workflows(verificateur_user_id);
CREATE INDEX IF NOT EXISTS idx_validation_workflows_redacteur ON public.validation_workflows(redacteur_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.validation_workflows TO authenticated;
GRANT ALL ON public.validation_workflows TO service_role;

ALTER TABLE public.validation_workflows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "vw_read_auth" ON public.validation_workflows
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vw_insert_auth" ON public.validation_workflows
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vw_update_assigned_or_admin" ON public.validation_workflows
    FOR UPDATE TO authenticated
    USING (
      public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'rmq')
      OR auth.uid() = redacteur_user_id
      OR auth.uid() = verificateur_user_id
      OR auth.uid() = approbateur_user_id
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vw_delete_admin" ON public.validation_workflows
    FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. HISTORIQUE
CREATE TABLE IF NOT EXISTS public.validation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.validation_workflows(id) ON DELETE CASCADE,
  from_statut text,
  to_statut text NOT NULL,
  actor_user_id uuid,
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_history_workflow ON public.validation_history(workflow_id);

GRANT SELECT, INSERT ON public.validation_history TO authenticated;
GRANT ALL ON public.validation_history TO service_role;

ALTER TABLE public.validation_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "vh_read_auth" ON public.validation_history
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "vh_insert_auth" ON public.validation_history
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. TRIGGERS
CREATE OR REPLACE FUNCTION public.log_validation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.validation_history (workflow_id, from_statut, to_statut, actor_user_id, commentaire)
    VALUES (NEW.id, NULL, NEW.statut, auth.uid(), 'Création workflow');
    RETURN NEW;
  END IF;
  IF NEW.statut IS DISTINCT FROM OLD.statut THEN
    INSERT INTO public.validation_history (workflow_id, from_statut, to_statut, actor_user_id, commentaire)
    VALUES (NEW.id, OLD.statut, NEW.statut, auth.uid(),
      CASE
        WHEN NEW.statut = 'refuse' THEN NEW.commentaire_refus
        WHEN NEW.statut = 'obsolete' THEN NEW.commentaire_obsolescence
        ELSE NULL
      END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_validation_change ON public.validation_workflows;
CREATE TRIGGER trg_log_validation_change
AFTER INSERT OR UPDATE ON public.validation_workflows
FOR EACH ROW EXECUTE FUNCTION public.log_validation_change();

CREATE OR REPLACE FUNCTION public.touch_validation_workflow()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_validation_workflow ON public.validation_workflows;
CREATE TRIGGER trg_touch_validation_workflow
BEFORE UPDATE ON public.validation_workflows
FOR EACH ROW EXECUTE FUNCTION public.touch_validation_workflow();

-- 5. RPC HELPERS (transitions sécurisées)
CREATE OR REPLACE FUNCTION public.validation_get_or_create(_entity_type text, _entity_id uuid)
RETURNS public.validation_workflows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wf public.validation_workflows;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  SELECT * INTO _wf FROM public.validation_workflows
    WHERE entity_type = _entity_type AND entity_id = _entity_id;
  IF NOT FOUND THEN
    INSERT INTO public.validation_workflows (entity_type, entity_id, statut, redacteur_user_id, created_by)
    VALUES (_entity_type, _entity_id, 'brouillon', auth.uid(), auth.uid())
    RETURNING * INTO _wf;
  END IF;
  RETURN _wf;
END;
$$;

CREATE OR REPLACE FUNCTION public.validation_submit(_workflow_id uuid, _verificateur uuid, _approbateur uuid)
RETURNS public.validation_workflows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wf public.validation_workflows;
  _cfg public.validation_entity_types;
  _next_statut text;
BEGIN
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  SELECT * INTO _cfg FROM public.validation_entity_types WHERE code = _wf.entity_type;
  IF _wf.statut NOT IN ('brouillon','refuse') THEN
    RAISE EXCEPTION 'Soumission impossible depuis le statut %', _wf.statut;
  END IF;
  _next_statut := CASE WHEN _cfg.requires_verificateur THEN 'en_revue' ELSE 'en_approbation' END;

  UPDATE public.validation_workflows
     SET statut = _next_statut,
         redacteur_user_id = COALESCE(redacteur_user_id, auth.uid()),
         verificateur_user_id = COALESCE(_verificateur, verificateur_user_id),
         approbateur_user_id = COALESCE(_approbateur, approbateur_user_id),
         date_soumission = now(),
         commentaire_refus = NULL
   WHERE id = _workflow_id
   RETURNING * INTO _wf;
  RETURN _wf;
END;
$$;

CREATE OR REPLACE FUNCTION public.validation_verify(_workflow_id uuid, _commentaire text DEFAULT NULL)
RETURNS public.validation_workflows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wf public.validation_workflows;
BEGIN
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF _wf.statut <> 'en_revue' THEN
    RAISE EXCEPTION 'Vérification impossible depuis le statut %', _wf.statut;
  END IF;
  IF auth.uid() <> _wf.verificateur_user_id
     AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'rmq')) THEN
    RAISE EXCEPTION 'Seul le vérificateur ou un administrateur peut vérifier';
  END IF;
  UPDATE public.validation_workflows
     SET statut = 'en_approbation', date_verification = now()
   WHERE id = _workflow_id
   RETURNING * INTO _wf;
  RETURN _wf;
END;
$$;

CREATE OR REPLACE FUNCTION public.validation_approve(_workflow_id uuid, _commentaire text DEFAULT NULL)
RETURNS public.validation_workflows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wf public.validation_workflows;
BEGIN
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF _wf.statut <> 'en_approbation' THEN
    RAISE EXCEPTION 'Approbation impossible depuis le statut %', _wf.statut;
  END IF;
  IF auth.uid() <> _wf.approbateur_user_id
     AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'rmq')) THEN
    RAISE EXCEPTION 'Seul l''approbateur ou un administrateur peut approuver';
  END IF;
  UPDATE public.validation_workflows
     SET statut = 'approuve', date_approbation = now()
   WHERE id = _workflow_id
   RETURNING * INTO _wf;
  RETURN _wf;
END;
$$;

CREATE OR REPLACE FUNCTION public.validation_reject(_workflow_id uuid, _motif text)
RETURNS public.validation_workflows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wf public.validation_workflows;
BEGIN
  IF _motif IS NULL OR length(trim(_motif)) = 0 THEN
    RAISE EXCEPTION 'Un motif de refus est requis';
  END IF;
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF _wf.statut NOT IN ('en_revue','en_approbation') THEN
    RAISE EXCEPTION 'Refus impossible depuis le statut %', _wf.statut;
  END IF;
  IF auth.uid() NOT IN (_wf.verificateur_user_id, _wf.approbateur_user_id)
     AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'rmq')) THEN
    RAISE EXCEPTION 'Seul un vérificateur, approbateur ou administrateur peut refuser';
  END IF;
  UPDATE public.validation_workflows
     SET statut = 'refuse', commentaire_refus = _motif
   WHERE id = _workflow_id
   RETURNING * INTO _wf;
  RETURN _wf;
END;
$$;

CREATE OR REPLACE FUNCTION public.validation_obsolete(_workflow_id uuid, _motif text)
RETURNS public.validation_workflows
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wf public.validation_workflows;
BEGIN
  SELECT * INTO _wf FROM public.validation_workflows WHERE id = _workflow_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workflow introuvable'; END IF;
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'rmq')
          OR auth.uid() = _wf.approbateur_user_id) THEN
    RAISE EXCEPTION 'Seul l''approbateur ou un administrateur peut rendre obsolète';
  END IF;
  UPDATE public.validation_workflows
     SET statut = 'obsolete', commentaire_obsolescence = _motif, date_obsolescence = now()
   WHERE id = _workflow_id
   RETURNING * INTO _wf;
  RETURN _wf;
END;
$$;

-- 6. SYNCHRONISATION RÉTROCOMPATIBLE AVEC documents.statut_workflow
-- Quand le moteur central change le statut d'un document, on propage vers documents.statut_workflow
CREATE OR REPLACE FUNCTION public.sync_validation_to_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.entity_type <> 'document' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    RETURN NEW;
  END IF;
  UPDATE public.documents
     SET statut_workflow = NEW.statut,
         redacteur_user_id = COALESCE(NEW.redacteur_user_id, redacteur_user_id),
         verificateur_user_id = COALESCE(NEW.verificateur_user_id, verificateur_user_id),
         approbateur_user_id = COALESCE(NEW.approbateur_user_id, approbateur_user_id),
         date_approbation = CASE WHEN NEW.statut='approuve' THEN COALESCE(NEW.date_approbation, now()) ELSE date_approbation END
   WHERE id = NEW.entity_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_validation_to_document ON public.validation_workflows;
CREATE TRIGGER trg_sync_validation_to_document
AFTER INSERT OR UPDATE ON public.validation_workflows
FOR EACH ROW EXECUTE FUNCTION public.sync_validation_to_document();
