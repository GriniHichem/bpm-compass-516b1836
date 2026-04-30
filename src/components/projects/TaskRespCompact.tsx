import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ActeurOption } from "@/hooks/useActeurs";
import { User as UserIcon, UserPlus, X } from "lucide-react";

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
 * Optimized inline responsible selector for project tasks.
 * Display: a single tiny chip with the USER name (or the function fallback).
 * Click → opens a popover with the 2-step selector (function → person).
 * Auto-selects the unique user when a function maps to exactly one profile.
 */
export function TaskRespCompact({ acteurId, userId, acteurs, onChange }: Props) {
  const [linked, setLinked] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);

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

  const acteur = acteurId ? acteurs.find((a) => a.id === acteurId) : null;
  const fonctionLabel = acteur ? (acteur.fonction || acteur.organisation || "Acteur") : null;
  const currentUser = userId ? linked.find((p) => p.id === userId) : null;
  const userName = currentUser ? `${currentUser.prenom} ${currentUser.nom}`.trim() : null;

  // Compact label: prefer USER name; fallback to function; else "+ Resp."
  const label = userName || fonctionLabel || "Assigner";
  const hasAssignment = !!acteurId;

  const handleActeur = (v: string) => {
    const newId = v === "none" ? null : v;
    onChange(newId, null);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 h-6 px-1.5 rounded-md border text-[10px] max-w-[140px] transition-colors ${
            hasAssignment
              ? "border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10"
              : "border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
          }`}
          title={
            userName && fonctionLabel
              ? `${userName} — ${fonctionLabel}`
              : (userName || fonctionLabel || "Assigner un responsable")
          }
        >
          {hasAssignment ? <UserIcon className="h-3 w-3 shrink-0" /> : <UserPlus className="h-3 w-3 shrink-0" />}
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" align="end">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Responsable</p>
          {hasAssignment && (
            <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px] text-muted-foreground hover:text-destructive" onClick={clearAll}>
              <X className="h-3 w-3 mr-0.5" /> Retirer
            </Button>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Fonction</label>
          <Select value={acteurId ?? "none"} onValueChange={handleActeur}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choisir une fonction…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Non assigné</SelectItem>
              {acteurs.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.fonction || a.organisation || "Acteur"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {acteurId && linked.length > 1 && (
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Personne ({linked.length} disponibles)</label>
            <Select value={userId ?? "none"} onValueChange={(v) => onChange(acteurId, v === "none" ? null : v)}>
              <SelectTrigger className="h-8 text-xs border-primary/30 bg-primary/5"><SelectValue placeholder="Choisir la personne…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucune —</SelectItem>
                {linked.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {acteurId && linked.length === 1 && currentUser && (
          <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[11px]">
            <UserIcon className="h-3 w-3 text-primary" />
            <span className="font-medium">{currentUser.prenom} {currentUser.nom}</span>
            <span className="text-muted-foreground">— assigné automatiquement</span>
          </div>
        )}

        {acteurId && linked.length === 0 && (
          <p className="text-[10px] text-amber-600 dark:text-amber-500">⚠ Aucun utilisateur lié à cette fonction.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
