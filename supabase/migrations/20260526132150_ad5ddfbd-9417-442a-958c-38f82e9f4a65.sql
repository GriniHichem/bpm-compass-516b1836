-- ============================================================
-- LOT 1 : Maîtrise documentaire avancée — Cycle de vie
-- ============================================================

-- 1) Colonnes additionnelles sur public.documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS statut_workflow TEXT NOT NULL DEFAULT 'brouillon',
  ADD COLUMN IF NOT EXISTS redacteur_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verificateur_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approbateur_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS date_soumission TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_verification TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_approbation TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_prochaine_revue DATE,
  ADD COLUMN IF NOT EXISTS frequence_revue_mois INTEGER,
  ADD COLUMN IF NOT EXISTS motif_refus TEXT,
  ADD COLUMN IF NOT EXISTS obsolete_motif TEXT;

-- Contrainte de validité du statut workflow
DO $$ BEGIN
  ALTER TABLE public.documents
    ADD CONSTRAINT documents_statut_workflow_check
    CHECK (statut_workflow IN ('brouillon','en_revue','en_approbation','approuve','refuse','obsolete'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migrer les documents existants vers "approuve" pour ne pas masquer le contenu actuel
UPDATE public.documents
SET statut_workflow = 'approuve',
    date_approbation = COALESCE(date_approbation, created_at)
WHERE statut_workflow = 'brouillon' AND created_at < now() - interval '1 minute';

CREATE INDEX IF NOT EXISTS idx_documents_statut_workflow ON public.documents(statut_workflow);
CREATE INDEX IF NOT EXISTS idx_documents_prochaine_revue ON public.documents(date_prochaine_revue) WHERE date_prochaine_revue IS NOT NULL;

-- ============================================================
-- 2) Table : document_code_rules (codification automatique)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_code_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_document TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  padding INTEGER NOT NULL DEFAULT 3,
  next_seq INTEGER NOT NULL DEFAULT 1,
  include_process BOOLEAN NOT NULL DEFAULT false,
  separator TEXT NOT NULL DEFAULT '-',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.document_code_rules TO authenticated;
GRANT ALL ON public.document_code_rules TO service_role;
ALTER TABLE public.document_code_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Lecture règles codification authentifiés"
    ON public.document_code_rules FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admin/RMQ gèrent règles codification"
    ON public.document_code_rules FOR ALL TO authenticated
    USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rmq') OR public.has_role(auth.uid(),'super_admin'))
    WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'rmq') OR public.has_role(auth.uid(),'super_admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_document_code_rules_updated_at
    BEFORE UPDATE ON public.document_code_rules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Règles par défaut pour les types ISO usuels
INSERT INTO public.document_code_rules (type_document, prefix) VALUES
  ('manuel_qualite','MQ'),
  ('procedure','PR'),
  ('mode_operatoire','MO'),
  ('enregistrement','EN'),
  ('formulaire','FT'),
  ('autre','DOC')
ON CONFLICT (type_document) DO NOTHING;

-- ============================================================
-- 3) Fonction : génération automatique du code document
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_document_code(_type_document TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rule RECORD;
  _seq INTEGER;
  _code TEXT;
BEGIN
  SELECT * INTO _rule FROM public.document_code_rules
   WHERE type_document = _type_document AND active = true
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  _seq := _rule.next_seq;

  UPDATE public.document_code_rules
     SET next_seq = next_seq + 1
   WHERE id = _rule.id;

  _code := _rule.prefix || _rule.separator || lpad(_seq::text, _rule.padding, '0');
  RETURN _code;
END;
$$;

-- Trigger : génère le code à l'insertion si absent
CREATE OR REPLACE FUNCTION public.set_document_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR trim(NEW.code) = '' THEN
    NEW.code := public.generate_document_code(NEW.type_document::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_document_code ON public.documents;
CREATE TRIGGER trg_set_document_code
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_document_code();

-- ============================================================
-- 4) Trigger : calcul automatique de date_prochaine_revue
--    et date_approbation lors du passage à "approuve"
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_document_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut_workflow = 'approuve' AND (OLD.statut_workflow IS DISTINCT FROM 'approuve') THEN
    IF NEW.date_approbation IS NULL THEN
      NEW.date_approbation := now();
    END IF;
    IF NEW.approbateur_user_id IS NULL THEN
      NEW.approbateur_user_id := auth.uid();
    END IF;
    IF NEW.frequence_revue_mois IS NOT NULL AND NEW.date_prochaine_revue IS NULL THEN
      NEW.date_prochaine_revue := (COALESCE(NEW.date_approbation, now()) + (NEW.frequence_revue_mois || ' months')::interval)::date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_document_approval ON public.documents;
CREATE TRIGGER trg_handle_document_approval
  BEFORE UPDATE OF statut_workflow ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_document_approval();

-- ============================================================
-- 5) Table : document_workflow_history (traçabilité)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_workflow_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  from_statut TEXT,
  to_statut TEXT,
  commentaire TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.document_workflow_history TO authenticated;
GRANT ALL ON public.document_workflow_history TO service_role;
ALTER TABLE public.document_workflow_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_doc_workflow_history_doc ON public.document_workflow_history(document_id, created_at DESC);

DO $$ BEGIN
  CREATE POLICY "Lecture historique workflow authentifiés"
    ON public.document_workflow_history FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Insertion historique workflow par utilisateur"
    ON public.document_workflow_history FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger : enregistre automatiquement chaque changement de statut_workflow
CREATE OR REPLACE FUNCTION public.log_document_workflow_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut_workflow IS DISTINCT FROM OLD.statut_workflow THEN
    INSERT INTO public.document_workflow_history (document_id, user_id, action, from_statut, to_statut, commentaire)
    VALUES (NEW.id, auth.uid(), 'changement_statut', OLD.statut_workflow, NEW.statut_workflow,
            CASE WHEN NEW.statut_workflow = 'refuse' THEN NEW.motif_refus
                 WHEN NEW.statut_workflow = 'obsolete' THEN NEW.obsolete_motif
                 ELSE NULL END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_document_workflow_change ON public.documents;
CREATE TRIGGER trg_log_document_workflow_change
  AFTER UPDATE OF statut_workflow ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.log_document_workflow_change();
