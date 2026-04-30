import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ActeurOption } from "@/hooks/useActeurs";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

interface Profile {
  id: string;
  nom: string;
  prenom: string;
  fonction: string | null;
  acteur_id: string | null;
}

interface ActeurUserSelectProps {
  acteurValue: string;
  userValue: string;
  onActeurChange: (acteurId: string) => void;
  onUserChange: (userId: string) => void;
  acteurs: ActeurOption[];
  placeholder?: string;
}

export function ActeurUserSelect({
  acteurValue,
  userValue,
  onActeurChange,
  onUserChange,
  acteurs,
  placeholder = "Sélectionner un acteur",
}: ActeurUserSelectProps) {
  const [linkedProfiles, setLinkedProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  // When acteur changes, fetch linked profiles
  useEffect(() => {
    if (!acteurValue) {
      setLinkedProfiles([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, nom, prenom, fonction, acteur_id")
      .eq("acteur_id", acteurValue)
      .eq("actif", true)
      .order("nom")
      .then(({ data }) => {
        if (cancelled) return;
        const profiles = (data ?? []) as Profile[];
        setLinkedProfiles(profiles);
        // Auto-select / reconcile userValue without triggering loops
        if (profiles.length === 1 && userValue !== profiles[0].id) {
          onUserChange(profiles[0].id);
        } else if (profiles.length === 0) {
          if (userValue) onUserChange("");
        } else if (userValue && !profiles.find((p) => p.id === userValue)) {
          onUserChange("");
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acteurValue]);

  const handleActeurChange = (v: string) => {
    const newActeurId = v === "none" ? "" : v;
    onActeurChange(newActeurId);
    if (!newActeurId) {
      onUserChange("");
    }
  };

  const showUserSelect = acteurValue && linkedProfiles.length > 1;
  const singleProfile = acteurValue && linkedProfiles.length === 1 ? linkedProfiles[0] : null;

  return (
    <div className="space-y-2">
      {/* Step 1: Select acteur (function) */}
      <Select value={acteurValue || "none"} onValueChange={handleActeurChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Non assigné</SelectItem>
          {acteurs.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.fonction || a.organisation || "Acteur"} {a.organisation ? `(${a.organisation})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Step 2: If multiple users share this function, select the specific user */}
      {showUserSelect && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{linkedProfiles.length} utilisateurs partagent cette fonction</span>
          </div>
          <Select value={userValue || "none"} onValueChange={(v) => onUserChange(v === "none" ? "" : v)}>
            <SelectTrigger className="border-primary/30 bg-primary/5">
              <SelectValue placeholder="Sélectionner l'utilisateur..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sélectionner l'utilisateur...</SelectItem>
              {linkedProfiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.prenom} {p.nom} {p.fonction ? `— ${p.fonction}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Show auto-selected single user info */}
      {singleProfile && (
        <Badge variant="secondary" className="text-xs font-normal">
          👤 {singleProfile.prenom} {singleProfile.nom}
        </Badge>
      )}

      {acteurValue && !loading && linkedProfiles.length === 0 && (
        <p className="text-xs text-amber-600">⚠ Aucun utilisateur lié à cette fonction</p>
      )}
    </div>
  );
}
