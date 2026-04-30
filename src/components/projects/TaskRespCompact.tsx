import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActeurOption } from "@/hooks/useActeurs";

interface Profile {
  id: string;
  nom: string;
  prenom: string;
  fonction: string | null;
}

interface Props {
  acteurId: string | null;
  userId: string | null;
  acteurs: ActeurOption[];
  onChange: (acteurId: string | null, userId: string | null) => void;
}

/**
 * Compact inline responsible selector for project tasks.
 * Step 1: pick the function (acteur). Step 2: if >1 user shares it, an extra
 * selector appears so the assignment targets a real person (notifications).
 */
export function TaskRespCompact({ acteurId, userId, acteurs, onChange }: Props) {
  const [linked, setLinked] = useState<Profile[]>([]);

  useEffect(() => {
    if (!acteurId) { setLinked([]); return; }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, nom, prenom, fonction")
      .eq("acteur_id", acteurId)
      .eq("actif", true)
      .order("nom")
      .then(({ data }) => {
        if (cancelled) return;
        const list = (data ?? []) as Profile[];
        setLinked(list);
        // Auto-select if exactly one user
        if (list.length === 1 && list[0].id !== userId) {
          onChange(acteurId, list[0].id);
        } else if (list.length === 0) {
          if (userId) onChange(acteurId, null);
        } else if (list.length > 1 && userId && !list.find((p) => p.id === userId)) {
          onChange(acteurId, null);
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acteurId]);

  const handleActeur = (v: string) => {
    const newId = v === "none" ? null : v;
    onChange(newId, null);
  };

  return (
    <div className="flex items-center gap-1">
      <Select value={acteurId ?? "none"} onValueChange={handleActeur}>
        <SelectTrigger className="h-6 w-32 text-[10px] border-dashed"><SelectValue placeholder="Resp." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Non assigné</SelectItem>
          {acteurs.map((a) => <SelectItem key={a.id} value={a.id}>{a.fonction || a.organisation || "Acteur"}</SelectItem>)}
        </SelectContent>
      </Select>
      {acteurId && linked.length > 1 && (
        <Select value={userId ?? "none"} onValueChange={(v) => onChange(acteurId, v === "none" ? null : v)}>
          <SelectTrigger className="h-6 w-32 text-[10px] border-dashed border-primary/40 bg-primary/5"><SelectValue placeholder="Personne…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Personne…</SelectItem>
            {linked.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
