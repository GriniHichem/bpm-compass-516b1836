import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link2, X, ArrowUp, ArrowDown, GitBranch, Zap } from "lucide-react";

interface Dependency {
  id: string;
  project_id: string;
  source_action_id: string;
  target_action_id: string;
  dependency_type: string;
  created_at: string;
}

interface ActionItem {
  id: string;
  title: string;
  statut: string;
  code?: string;
}

const DEP_TYPES: Record<string, { label: string; icon: typeof ArrowUp; desc: string; color: string }> = {
  before: { label: "Avant", icon: ArrowUp, desc: "Doit être terminée avant l'autre", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  after: { label: "Après", icon: ArrowDown, desc: "Ne commence qu'après l'autre", color: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  parallel: { label: "Parallèle", icon: GitBranch, desc: "S'exécutent en même temps", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  exclusive: { label: "Exclusive", icon: Zap, desc: "Une seule suffit (XOR)", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
};

interface Props {
  projectId: string;
  actionId: string;
  actionTitle: string;
  allActions: ActionItem[];
  dependencies: Dependency[];
  onChanged: () => void;
  canEdit: boolean;
}

export function ProjectActionDependencies({ projectId, actionId, actionTitle, allActions, dependencies, onChanged, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedType, setSelectedType] = useState("before");

  const myDeps = dependencies.filter(d => d.source_action_id === actionId || d.target_action_id === actionId);

  const addDependency = async () => {
    if (!selectedTarget) return;
    const { error } = await supabase.from("project_action_dependencies").insert({
      project_id: projectId,
      source_action_id: actionId,
      target_action_id: selectedTarget,
      dependency_type: selectedType,
    } as any);
    if (error) {
      if (error.code === "23505") toast.error("Cette liaison existe déjà");
      else toast.error(error.message);
      return;
    }
    toast.success("Dépendance ajoutée");
    setSelectedTarget("");
    onChanged();
  };

  const removeDependency = async (depId: string) => {
    await supabase.from("project_action_dependencies").delete().eq("id", depId);
    toast.success("Dépendance supprimée");
    onChanged();
  };

  const getActionTitle = (id: string) => {
    const a = allActions.find(x => x.id === id);
    if (!a) return "Action inconnue";
    return a.code ? `${a.code} — ${a.title}` : a.title;
  };

  const availableTargets = allActions.filter(a => a.id !== actionId && !myDeps.some(d =>
    (d.source_action_id === actionId && d.target_action_id === a.id) ||
    (d.target_action_id === actionId && d.source_action_id === a.id)
  ));

  return (
    <>
      {/* Inline badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {myDeps.map(dep => {
          const isSource = dep.source_action_id === actionId;
          const otherId = isSource ? dep.target_action_id : dep.source_action_id;
          const dt = DEP_TYPES[dep.dependency_type] ?? DEP_TYPES.before;
          const Icon = dt.icon;
          return (
            <Badge key={dep.id} variant="outline" className={`text-[10px] gap-1 h-5 ${dt.color} border-current/20`}>
              <Icon className="h-2.5 w-2.5" />
              {dt.label}: {getActionTitle(otherId).substring(0, 25)}
              {canEdit && (
                <button onClick={() => removeDependency(dep.id)} className="ml-0.5 hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          );
        })}
        {canEdit && (
          <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-1 px-1.5 text-muted-foreground" onClick={() => setOpen(true)}>
            <Link2 className="h-2.5 w-2.5" /> Lier
          </Button>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4 text-primary" />
              Dépendances de : {actionTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing */}
            {myDeps.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Liaisons existantes</p>
                {myDeps.map(dep => {
                  const isSource = dep.source_action_id === actionId;
                  const otherId = isSource ? dep.target_action_id : dep.source_action_id;
                  const dt = DEP_TYPES[dep.dependency_type] ?? DEP_TYPES.before;
                  const Icon = dt.icon;
                  return (
                    <div key={dep.id} className="flex items-center gap-2 rounded-lg border border-border/30 p-2">
                      <Icon className={`h-4 w-4 shrink-0 ${dt.color.split(" ").slice(1).join(" ")}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getActionTitle(otherId)}</p>
                        <p className="text-[10px] text-muted-foreground">{dt.desc}</p>
                      </div>
                      <Badge className={`${dt.color} text-[10px]`}>{dt.label}</Badge>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive" onClick={() => removeDependency(dep.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new */}
            {canEdit && availableTargets.length > 0 && (
              <div className="space-y-2 border-t border-border/20 pt-3">
                <p className="text-xs font-medium text-muted-foreground">Ajouter une liaison</p>
                <div className="flex gap-2">
                  <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Choisir une action" /></SelectTrigger>
                    <SelectContent>
                      {availableTargets.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code ? `${a.code} — ${a.title}` : a.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEP_TYPES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-1.5">
                            <v.icon className="h-3 w-3" /> {v.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedType && (
                  <p className="text-[10px] text-muted-foreground italic">{DEP_TYPES[selectedType]?.desc}</p>
                )}
                <Button size="sm" className="w-full h-8 text-xs" onClick={addDependency} disabled={!selectedTarget}>
                  <Link2 className="h-3 w-3 mr-1" /> Ajouter la liaison
                </Button>
              </div>
            )}

            {canEdit && availableTargets.length === 0 && myDeps.length > 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Toutes les actions sont déjà liées</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type { Dependency };
