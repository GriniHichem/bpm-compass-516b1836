import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ActeurOption {
  id: string;
  fonction: string | null;
  organisation: string | null;
  type_acteur: string;
}

export function useActeurs() {
  const [acteurs, setActeurs] = useState<ActeurOption[]>([]);

  useEffect(() => {
    supabase.from("acteurs").select("id, fonction, organisation, type_acteur").eq("actif", true).order("fonction").then(({ data }) => {
      setActeurs((data ?? []) as ActeurOption[]);
    });
  }, []);

  const getActeurLabel = (id: string | null) => {
    if (!id) return null;
    const a = acteurs.find(a => a.id === id);
    // Never return raw UUID — fallback to a generic label so the UI doesn't display codes
    return a ? (a.fonction || a.organisation || "Acteur") : "Acteur";
  };

  return { acteurs, getActeurLabel };
}
