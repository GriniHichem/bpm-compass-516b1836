import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link2, X, Plus, BarChart3, AlertTriangle, Lightbulb, XCircle, Globe } from "lucide-react";

interface ActionLink {
  id: string;
  action_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

const ENTITY_TYPES = [
  { value: "indicator", label: "Indicateur", icon: BarChart3, color: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700" },
  { value: "risk", label: "Risque", icon: AlertTriangle, color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700" },
  { value: "opportunity", label: "Opportunité", icon: Lightbulb, color: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700" },
  { value: "context_issue", label: "Enjeu", icon: Globe, color: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700" },
  { value: "nonconformity", label: "Non-conformité", icon: XCircle, color: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700" },
] as const;

function getTypeConfig(entityType: string) {
  // Map "risk" stored in DB to either risk or opportunity display
  return ENTITY_TYPES.find(t => t.value === entityType) ?? ENTITY_TYPES[0];
}

interface Props {
  actionId: string;
  canEdit: boolean;
}

export function ProjectActionLinks({ actionId, canEdit }: Props) {
  const [links, setLinks] = useState<ActionLink[]>([]);
  const [entityLabels, setEntityLabels] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [entityOptions, setEntityOptions] = useState<{ id: string; label: string; subType?: string }[]>([]);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);

  const fetchLinks = async () => {
    const { data } = await supabase
      .from("project_action_links")
      .select("*")
      .eq("action_id", actionId);
    const items = (data ?? []) as ActionLink[];
    setLinks(items);
    // Resolve labels
    await resolveLabels(items);
  };

  const resolveLabels = async (items: ActionLink[]) => {
    const labels: Record<string, string> = {};
    const byType: Record<string, string[]> = {};
    items.forEach(l => {
      const t = l.entity_type;
      if (!byType[t]) byType[t] = [];
      byType[t].push(l.entity_id);
    });

    for (const [type, ids] of Object.entries(byType)) {
      if (type === "indicator") {
        const { data } = await supabase.from("indicators").select("id, nom").in("id", ids);
        (data ?? []).forEach((d: any) => { labels[d.id] = d.nom; });
      } else if (type === "risk") {
        const { data } = await supabase.from("risks_opportunities").select("id, description, type").in("id", ids);
        (data ?? []).forEach((d: any) => { labels[d.id] = `${d.type === "opportunite" ? "🟢" : "🔴"} ${(d.description ?? "").substring(0, 60)}`; });
      } else if (type === "context_issue") {
        const { data } = await supabase.from("context_issues").select("id, intitule").in("id", ids);
        (data ?? []).forEach((d: any) => { labels[d.id] = d.intitule; });
      } else if (type === "nonconformity") {
        const { data } = await supabase.from("nonconformities").select("id, reference, description").in("id", ids);
        (data ?? []).forEach((d: any) => { labels[d.id] = `${d.reference} — ${(d.description ?? "").substring(0, 50)}`; });
      }
    }
    setEntityLabels(prev => ({ ...prev, ...labels }));
  };

  useEffect(() => { fetchLinks(); }, [actionId]);

  const loadEntityOptions = async (type: string) => {
    setLoadingOptions(true);
    setEntityOptions([]);
    setSelectedEntity("");

    const existingIds = links.filter(l => l.entity_type === (type === "opportunity" ? "risk" : type)).map(l => l.entity_id);

    if (type === "indicator") {
      const { data } = await supabase.from("indicators").select("id, nom");
      setEntityOptions((data ?? []).filter((d: any) => !existingIds.includes(d.id)).map((d: any) => ({ id: d.id, label: d.nom })));
    } else if (type === "risk") {
      const { data } = await supabase.from("risks_opportunities").select("id, description, type").eq("type", "risque");
      setEntityOptions((data ?? []).filter((d: any) => !existingIds.includes(d.id)).map((d: any) => ({ id: d.id, label: (d.description ?? "").substring(0, 80) })));
    } else if (type === "opportunity") {
      const { data } = await supabase.from("risks_opportunities").select("id, description, type").eq("type", "opportunite");
      setEntityOptions((data ?? []).filter((d: any) => !existingIds.includes(d.id)).map((d: any) => ({ id: d.id, label: (d.description ?? "").substring(0, 80) })));
    } else if (type === "context_issue") {
      const { data } = await supabase.from("context_issues").select("id, intitule");
      setEntityOptions((data ?? []).filter((d: any) => !existingIds.includes(d.id)).map((d: any) => ({ id: d.id, label: d.intitule })));
    } else if (type === "nonconformity") {
      const { data } = await supabase.from("nonconformities").select("id, reference, description");
      setEntityOptions((data ?? []).filter((d: any) => !existingIds.includes(d.id)).map((d: any) => ({ id: d.id, label: `${d.reference} — ${(d.description ?? "").substring(0, 50)}` })));
    }
    setLoadingOptions(false);
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    loadEntityOptions(type);
  };

  const addLink = async () => {
    if (!canEdit) {
      toast.error("Lecture seule sur cette action");
      return;
    }
    if (!selectedEntity || !selectedType) return;
    // Store "opportunity" as "risk" in DB (same table)
    const dbType = selectedType === "opportunity" ? "risk" : selectedType;
    const { error } = await supabase.from("project_action_links").insert({
      action_id: actionId,
      entity_type: dbType,
      entity_id: selectedEntity,
    });
    if (error) {
      if (error.code === "23505") toast.error("Ce lien existe déjà");
      else toast.error(error.message);
      return;
    }
    toast.success("Lien ajouté");
    setDialogOpen(false);
    setSelectedType("");
    setSelectedEntity("");
    fetchLinks();
  };

  const removeLink = async (linkId: string) => {
    if (!canEdit) {
      toast.error("Lecture seule sur cette action");
      return;
    }
    await supabase.from("project_action_links").delete().eq("id", linkId);
    toast.success("Lien supprimé");
    fetchLinks();
  };

  // Determine display type for a link (risk in DB could be risk or opportunity)
  const getDisplayType = (link: ActionLink): string => {
    if (link.entity_type === "risk") {
      const label = entityLabels[link.entity_id] ?? "";
      if (label.startsWith("🟢")) return "opportunity";
    }
    return link.entity_type;
  };

  if (links.length === 0 && !canEdit) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" /> Liaisons ({links.length})
        </h5>
        {canEdit && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Lier
          </Button>
        )}
      </div>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {links.map(link => {
            const displayType = getDisplayType(link);
            const config = getTypeConfig(displayType);
            const Icon = config.icon;
            return (
              <Badge key={link.id} variant="outline" className={`${config.color} text-[11px] gap-1 pr-1`}>
                <Icon className="h-3 w-3" />
                <span className="max-w-[200px] truncate">{entityLabels[link.entity_id] ?? "..."}</span>
                {canEdit && (
                  <button onClick={() => removeLink(link.id)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Lier à une entité</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type d'entité</Label>
              <Select value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue placeholder="Choisir le type" /></SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2"><t.icon className="h-3.5 w-3.5" />{t.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedType && (
              <div className="space-y-2">
                <Label>Entité</Label>
                {loadingOptions ? (
                  <div className="text-sm text-muted-foreground py-2">Chargement...</div>
                ) : entityOptions.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-2">Aucune entité disponible</div>
                ) : (
                  <Select value={selectedEntity} onValueChange={setSelectedEntity}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {entityOptions.map(opt => (
                        <SelectItem key={opt.id} value={opt.id}>
                          <span className="truncate max-w-[300px]">{opt.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <Button onClick={addLink} disabled={!selectedEntity} className="w-full">Confirmer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
