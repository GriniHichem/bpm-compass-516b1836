import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SearchEntityType =
  | "all"
  | "processus"
  | "actions"
  | "audits"
  | "nonconformites"
  | "documents"
  | "indicateurs"
  | "risques"
  | "acteurs"
  | "projets";

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: SearchEntityType;
  typeLabel: string;
  url: string;
  status?: string;
}

const TYPE_LABELS: Record<Exclude<SearchEntityType, "all">, string> = {
  processus: "Processus",
  actions: "Action",
  audits: "Audit",
  nonconformites: "Non-conformité",
  documents: "Document",
  indicateurs: "Indicateur",
  risques: "Risque / Enjeu",
  acteurs: "Acteur",
  projets: "Plan d'action",
};

async function searchProcessus(term: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("processes")
    .select("id, nom, code, type_processus, statut")
    .or(`nom.ilike.${term},code.ilike.${term},description.ilike.${term},finalite.ilike.${term}`)
    .limit(10);
  return (data ?? []).map((p) => ({
    id: p.id, title: `${p.code} — ${p.nom}`, subtitle: p.type_processus,
    type: "processus" as const, typeLabel: TYPE_LABELS.processus, url: `/processus/${p.id}`, status: p.statut,
  }));
}

async function searchActions(term: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("actions")
    .select("id, description, type_action, statut, source_type")
    .or(`description.ilike.${term}`)
    .limit(10);
  return (data ?? []).map((a) => ({
    id: a.id, title: a.description?.slice(0, 80) || "Action", subtitle: `${a.type_action} · ${a.source_type}`,
    type: "actions" as const, typeLabel: TYPE_LABELS.actions, url: "/actions", status: a.statut,
  }));
}

async function searchAudits(term: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("audits")
    .select("id, reference, type_audit, statut, perimetre")
    .or(`reference.ilike.${term},perimetre.ilike.${term},programme.ilike.${term}`)
    .limit(10);
  return (data ?? []).map((a) => ({
    id: a.id, title: a.reference, subtitle: `${a.type_audit} · ${a.perimetre ?? ""}`,
    type: "audits" as const, typeLabel: TYPE_LABELS.audits, url: "/audits", status: a.statut,
  }));
}

async function searchNC(term: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("nonconformities")
    .select("id, reference, description, statut, gravite")
    .or(`reference.ilike.${term},description.ilike.${term},cause_racine.ilike.${term}`)
    .limit(10);
  return (data ?? []).map((nc) => ({
    id: nc.id, title: nc.reference, subtitle: nc.description?.slice(0, 60),
    type: "nonconformites" as const, typeLabel: TYPE_LABELS.nonconformites, url: "/non-conformites", status: nc.statut,
  }));
}

async function searchDocuments(term: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("documents")
    .select("id, titre, type_document, description")
    .or(`titre.ilike.${term},description.ilike.${term}`)
    .eq("archive", false)
    .limit(10);
  return (data ?? []).map((d) => ({
    id: d.id, title: d.titre, subtitle: d.type_document,
    type: "documents" as const, typeLabel: TYPE_LABELS.documents, url: "/documents",
  }));
}

async function searchIndicateurs(term: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("indicators")
    .select("id, nom, type_indicateur, unite, formule")
    .or(`nom.ilike.${term},formule.ilike.${term}`)
    .limit(10);
  return (data ?? []).map((i) => ({
    id: i.id, title: i.nom, subtitle: `${i.type_indicateur} · ${i.unite ?? ""}`,
    type: "indicateurs" as const, typeLabel: TYPE_LABELS.indicateurs, url: "/indicateurs",
  }));
}

async function searchRisques(term: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("context_issues")
    .select("id, reference, intitule, type_enjeu, impact")
    .or(`intitule.ilike.${term},reference.ilike.${term},description.ilike.${term}`)
    .limit(10);
  return (data ?? []).map((r) => ({
    id: r.id, title: `${r.reference} — ${r.intitule}`, subtitle: `${r.type_enjeu} · Impact ${r.impact}`,
    type: "risques" as const, typeLabel: TYPE_LABELS.risques, url: "/enjeux-contexte",
  }));
}

async function searchActeurs(term: string): Promise<SearchResult[]> {
  const { data } = await supabase
    .from("acteurs")
    .select("id, fonction, organisation, type_acteur")
    .eq("actif", true)
    .or(`fonction.ilike.${term},organisation.ilike.${term}`)
    .limit(10);
  return (data ?? []).map((a) => ({
    id: a.id, title: a.fonction || a.organisation || "Acteur", subtitle: `${a.type_acteur} · ${a.organisation ?? ""}`,
    type: "acteurs" as const, typeLabel: TYPE_LABELS.acteurs, url: "/acteurs",
  }));
}

const SEARCH_FNS: Record<Exclude<SearchEntityType, "all">, (term: string) => Promise<SearchResult[]>> = {
  processus: searchProcessus,
  actions: searchActions,
  audits: searchAudits,
  nonconformites: searchNC,
  documents: searchDocuments,
  indicateurs: searchIndicateurs,
  risques: searchRisques,
  acteurs: searchActeurs,
};

export function useGlobalSearch() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchEntityType>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(0);

  const search = useCallback(async (q: string, f: SearchEntityType) => {
    if (q.length < 2) { setResults([]); return; }

    const id = ++abortRef.current;
    setLoading(true);
    const term = `%${q}%`;

    try {
      const fns = f === "all" ? Object.values(SEARCH_FNS) : [SEARCH_FNS[f]];
      const arrays = await Promise.all(fns.map((fn) => fn(term)));
      if (abortRef.current === id) {
        setResults(arrays.flat());
      }
    } finally {
      if (abortRef.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query, filter), 250);
    return () => clearTimeout(timeout);
  }, [query, filter, search]);

  return { query, setQuery, filter, setFilter, results, loading, typeLabels: TYPE_LABELS };
}
