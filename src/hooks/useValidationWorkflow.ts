import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ValidationStatut =
  | "brouillon"
  | "en_revue"
  | "en_approbation"
  | "approuve"
  | "refuse"
  | "obsolete";

export interface ValidationWorkflow {
  id: string;
  entity_type: string;
  entity_id: string;
  statut: ValidationStatut;
  redacteur_user_id: string | null;
  verificateur_user_id: string | null;
  approbateur_user_id: string | null;
  date_soumission: string | null;
  date_verification: string | null;
  date_approbation: string | null;
  date_obsolescence: string | null;
  commentaire_refus: string | null;
  commentaire_obsolescence: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValidationHistoryEntry {
  id: string;
  workflow_id: string;
  from_statut: string | null;
  to_statut: string;
  actor_user_id: string | null;
  commentaire: string | null;
  created_at: string;
}

export interface ValidationEntityTypeConfig {
  code: string;
  label_fr: string;
  requires_redacteur: boolean;
  requires_verificateur: boolean;
  requires_approbateur: boolean;
  allowed_approver_roles: string[];
  auto_action_on_approve: string | null;
}

export function useValidationWorkflow(entityType: string, entityId: string | null) {
  const [workflow, setWorkflow] = useState<ValidationWorkflow | null>(null);
  const [config, setConfig] = useState<ValidationEntityTypeConfig | null>(null);
  const [history, setHistory] = useState<ValidationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: cfg } = await supabase
        .from("validation_entity_types" as any)
        .select("*")
        .eq("code", entityType)
        .maybeSingle();
      setConfig((cfg as any) ?? null);

      const { data: wf } = await supabase
        .from("validation_workflows" as any)
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .maybeSingle();
      setWorkflow((wf as any) ?? null);

      if (wf) {
        const { data: hist } = await supabase
          .from("validation_history" as any)
          .select("*")
          .eq("workflow_id", (wf as any).id)
          .order("created_at", { ascending: false });
        setHistory((hist as any) ?? []);
      } else {
        setHistory([]);
      }
    } catch (e: any) {
      setError(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const ensureWorkflow = useCallback(async (): Promise<ValidationWorkflow | null> => {
    if (!entityId) return null;
    const { data, error: err } = await supabase.rpc("validation_get_or_create" as any, {
      _entity_type: entityType,
      _entity_id: entityId,
    });
    if (err) throw err;
    const wf = data as ValidationWorkflow;
    setWorkflow(wf);
    return wf;
  }, [entityType, entityId]);

  const submit = useCallback(
    async (verificateurId: string | null, approbateurId: string | null) => {
      const wf = workflow ?? (await ensureWorkflow());
      if (!wf) return;
      const { error: err } = await supabase.rpc("validation_submit" as any, {
        _workflow_id: wf.id,
        _verificateur: verificateurId,
        _approbateur: approbateurId,
      });
      if (err) throw err;
      await fetchAll();
    },
    [workflow, ensureWorkflow, fetchAll]
  );

  const verify = useCallback(
    async (commentaire?: string) => {
      if (!workflow) return;
      const { error: err } = await supabase.rpc("validation_verify" as any, {
        _workflow_id: workflow.id,
        _commentaire: commentaire ?? null,
      });
      if (err) throw err;
      await fetchAll();
    },
    [workflow, fetchAll]
  );

  const approve = useCallback(
    async (commentaire?: string) => {
      if (!workflow) return;
      const { error: err } = await supabase.rpc("validation_approve" as any, {
        _workflow_id: workflow.id,
        _commentaire: commentaire ?? null,
      });
      if (err) throw err;
      await fetchAll();
    },
    [workflow, fetchAll]
  );

  const reject = useCallback(
    async (motif: string) => {
      if (!workflow) return;
      const { error: err } = await supabase.rpc("validation_reject" as any, {
        _workflow_id: workflow.id,
        _motif: motif,
      });
      if (err) throw err;
      await fetchAll();
    },
    [workflow, fetchAll]
  );

  const markObsolete = useCallback(
    async (motif: string) => {
      if (!workflow) return;
      const { error: err } = await supabase.rpc("validation_obsolete" as any, {
        _workflow_id: workflow.id,
        _motif: motif,
      });
      if (err) throw err;
      await fetchAll();
    },
    [workflow, fetchAll]
  );

  return {
    workflow,
    config,
    history,
    loading,
    error,
    refresh: fetchAll,
    ensureWorkflow,
    submit,
    verify,
    approve,
    reject,
    markObsolete,
  };
}
