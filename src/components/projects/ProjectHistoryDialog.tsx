import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Download, Search, Filter, Users, ListTodo, X } from "lucide-react";
import { format, parseISO, isAfter, subDays, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { useActeurs } from "@/hooks/useActeurs";

interface HistoryEntry {
  id: string;
  action_id: string;
  task_id: string | null;
  entity_type: string;
  user_id: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface ActionLite { id: string; title: string; ordre: number; }
interface TaskLite { id: string; action_id: string; title: string; ordre: number; }

const FIELD_LABELS: Record<string, string> = {
  title: "Titre", description: "Description", statut: "Statut", avancement: "Avancement",
  echeance: "Échéance", date_debut: "Date début",
  responsable_id: "Responsable", responsable_id_2: "Responsable 2", responsable_id_3: "Responsable 3",
  responsable_user_id: "Utilisateur", responsable_user_id_2: "Utilisateur 2", responsable_user_id_3: "Utilisateur 3",
  multi_tasks: "Multi-tâches", pinned: "Épinglé", poids: "Poids", ordre: "Ordre",
};

const FIELD_GROUP: Record<string, "statut" | "date" | "avancement" | "responsable" | "autre"> = {
  statut: "statut", avancement: "avancement", echeance: "date", date_debut: "date",
  responsable_id: "responsable", responsable_id_2: "responsable", responsable_id_3: "responsable",
  responsable_user_id: "responsable", responsable_user_id_2: "responsable", responsable_user_id_3: "responsable",
};

const FIELD_BADGE_CLASS: Record<string, string> = {
  statut: "bg-primary/15 text-primary border-primary/30",
  date: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  avancement: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  responsable: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30",
  autre: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABELS: Record<string, string> = {
  planifiee: "Planifiée", en_cours: "En cours", terminee: "Terminée",
  en_retard: "En retard", bloquee: "Bloquée", annulee: "Annulée",
  a_faire: "À faire", termine: "Terminé", cloturee: "Clôturée",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  /** If set, dialog is pre-filtered on this action only */
  initialActionId?: string | null;
}

export function ProjectHistoryDialog({ open, onOpenChange, projectId, projectTitle, initialActionId }: Props) {
  const { getActeurLabel } = useActeurs();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [actions, setActions] = useState<ActionLite[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; email: string }>>({});
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all"); // all | action | task
  const [filterField, setFilterField] = useState<string>("all"); // all | statut | date | avancement | responsable
  const [filterPeriod, setFilterPeriod] = useState<string>("all"); // 7 | 30 | 90 | all
  const [filterActionId, setFilterActionId] = useState<string>(initialActionId || "all");

  useEffect(() => {
    if (!open) return;
    setFilterActionId(initialActionId || "all");
    setSearch(""); setFilterUser("all"); setFilterType("all"); setFilterField("all"); setFilterPeriod("all");
  }, [open, initialActionId]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: actionsData } = await supabase
        .from("project_actions")
        .select("id, title, ordre")
        .eq("project_id", projectId)
        .order("ordre");
      const acts = (actionsData ?? []) as ActionLite[];
      setActions(acts);

      const actionIds = acts.map(a => a.id);
      let tks: TaskLite[] = [];
      if (actionIds.length > 0) {
        const { data: tasksData } = await supabase
          .from("project_tasks")
          .select("id, action_id, title, ordre")
          .in("action_id", actionIds)
          .order("ordre");
        tks = (tasksData ?? []) as TaskLite[];
      }
      setTasks(tks);

      let hist: HistoryEntry[] = [];
      if (actionIds.length > 0) {
        const { data: histData } = await supabase
          .from("project_action_history")
          .select("*")
          .in("action_id", actionIds)
          .order("created_at", { ascending: false })
          .limit(1000);
        hist = (histData ?? []) as HistoryEntry[];
      }
      setEntries(hist);

      const userIds = [...new Set(hist.map(h => h.user_id).filter(Boolean))] as string[];
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, nom, prenom, email").in("id", userIds);
        const map: Record<string, { name: string; email: string }> = {};
        (profs ?? []).forEach((p: any) => {
          map[p.id] = {
            name: `${p.prenom || ""} ${p.nom || ""}`.trim() || p.email || "Utilisateur",
            email: p.email || "",
          };
        });
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, [open, projectId]);

  // Numbering maps
  const actionNumberMap = useMemo(() => {
    const m: Record<string, { num: number; title: string }> = {};
    actions.forEach((a, i) => { m[a.id] = { num: i + 1, title: a.title }; });
    return m;
  }, [actions]);

  const taskNumberMap = useMemo(() => {
    const m: Record<string, { actionNum: number; taskNum: number; title: string }> = {};
    const counters: Record<string, number> = {};
    tasks.forEach(t => {
      counters[t.action_id] = (counters[t.action_id] ?? 0) + 1;
      const a = actionNumberMap[t.action_id];
      m[t.id] = { actionNum: a?.num ?? 0, taskNum: counters[t.action_id], title: t.title };
    });
    return m;
  }, [tasks, actionNumberMap]);

  const refLabel = (e: HistoryEntry): { tag: string; title: string } => {
    if (e.entity_type === "task" && e.task_id) {
      const t = taskNumberMap[e.task_id];
      if (t) return { tag: `#A${t.actionNum}.T${t.taskNum}`, title: t.title };
    }
    const a = actionNumberMap[e.action_id];
    return { tag: a ? `#A${a.num}` : "#?", title: a?.title ?? "—" };
  };

  // Format value: humanize statuses, dates, responsables
  const formatValue = (field: string, value: string | null) => {
    if (value === null || value === "") return "—";
    if (field === "statut") return STATUS_LABELS[value] ?? value;
    if (field === "avancement") return `${value}%`;
    if (field === "multi_tasks" || field === "pinned") return value === "true" ? "Oui" : "Non";
    if (field === "poids") return `${value}%`;
    if (field === "echeance" || field === "date_debut") {
      try { return format(parseISO(value), "dd MMM yyyy", { locale: fr }); } catch { return value; }
    }
    if (field.startsWith("responsable_id")) {
      const lbl = getActeurLabel(value);
      return lbl || value.substring(0, 8);
    }
    if (field.startsWith("responsable_user_id")) {
      return profiles[value]?.name ?? value.substring(0, 8);
    }
    if (value.length > 80) return value.substring(0, 80) + "…";
    return value;
  };

  // Apply filters
  const filtered = useMemo(() => {
    const now = new Date();
    return entries.filter(e => {
      if (filterUser !== "all" && e.user_id !== filterUser) return false;
      if (filterType !== "all" && e.entity_type !== filterType) return false;
      if (filterField !== "all") {
        const grp = FIELD_GROUP[e.field_name] ?? "autre";
        if (grp !== filterField) return false;
      }
      if (filterActionId !== "all" && e.action_id !== filterActionId) return false;
      if (filterPeriod !== "all") {
        const days = parseInt(filterPeriod, 10);
        if (!isAfter(parseISO(e.created_at), subDays(now, days))) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const ref = refLabel(e);
        const hay = `${ref.tag} ${ref.title}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, filterUser, filterType, filterField, filterActionId, filterPeriod, search, actionNumberMap, taskNumberMap]);

  // Group by day
  const grouped = useMemo(() => {
    const groups: Record<string, HistoryEntry[]> = {};
    filtered.forEach(e => {
      const day = e.created_at.substring(0, 10);
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const dayLabel = (day: string) => {
    const d = parseISO(day);
    if (isToday(d)) return "Aujourd'hui";
    if (isYesterday(d)) return "Hier";
    return format(d, "EEEE d MMMM yyyy", { locale: fr });
  };

  const userOptions = useMemo(() => {
    const ids = [...new Set(entries.map(e => e.user_id).filter(Boolean))] as string[];
    return ids.map(id => ({ id, name: profiles[id]?.name ?? "Utilisateur" })).sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, profiles]);

  const stats = useMemo(() => ({
    total: filtered.length,
    contributors: new Set(filtered.map(e => e.user_id).filter(Boolean)).size,
    actionsImpacted: new Set(filtered.map(e => e.action_id)).size,
  }), [filtered]);

  const exportCsv = () => {
    const header = ["Date", "Heure", "Utilisateur", "Type", "Numéro", "Titre", "Champ", "Avant", "Après"];
    const rows = filtered.map(e => {
      const ref = refLabel(e);
      const d = parseISO(e.created_at);
      return [
        format(d, "yyyy-MM-dd"),
        format(d, "HH:mm:ss"),
        e.user_id ? (profiles[e.user_id]?.name ?? "") : "",
        e.entity_type === "task" ? "Tâche" : "Action",
        ref.tag,
        ref.title,
        FIELD_LABELS[e.field_name] ?? e.field_name,
        formatValue(e.field_name, e.old_value),
        formatValue(e.field_name, e.new_value),
      ];
    });
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historique-${projectTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasFilters = search || filterUser !== "all" || filterType !== "all" || filterField !== "all" || filterPeriod !== "all" || filterActionId !== "all";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Historique du projet — <span className="text-muted-foreground font-normal truncate">{projectTitle}</span>
          </DialogTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><ListTodo className="h-3.5 w-3.5" /> {stats.total} modification{stats.total > 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {stats.contributors} contributeur{stats.contributors > 1 ? "s" : ""}</span>
            <span>{stats.actionsImpacted} action{stats.actionsImpacted > 1 ? "s" : ""} impactée{stats.actionsImpacted > 1 ? "s" : ""}</span>
          </div>
        </DialogHeader>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-border/40 bg-muted/10 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher #A1, A2.T3 ou titre…"
                className="h-8 pl-8 text-xs"
              />
            </div>

            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Utilisateur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous utilisateurs</SelectItem>
                {userOptions.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="action">Actions</SelectItem>
                <SelectItem value="task">Tâches</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterField} onValueChange={setFilterField}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous champs</SelectItem>
                <SelectItem value="statut">Statut</SelectItem>
                <SelectItem value="date">Dates</SelectItem>
                <SelectItem value="avancement">Avancement</SelectItem>
                <SelectItem value="responsable">Responsable</SelectItem>
                <SelectItem value="autre">Autres</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tout temps</SelectItem>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
                <SelectItem value="90">90 jours</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterActionId} onValueChange={setFilterActionId}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes actions</SelectItem>
                {actions.map((a, i) => (
                  <SelectItem key={a.id} value={a.id}>#A{i + 1} — {a.title.substring(0, 40)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-8 text-xs gap-1 ml-auto" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={() => {
              setSearch(""); setFilterUser("all"); setFilterType("all"); setFilterField("all"); setFilterPeriod("all"); setFilterActionId("all");
            }}>
              <X className="h-3 w-3" /> Réinitialiser les filtres
            </Button>
          )}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-12">Chargement…</div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aucune modification trouvée</p>
              {hasFilters && <p className="text-xs text-muted-foreground/70 mt-1">Essayez d'élargir vos filtres</p>}
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(([day, items]) => (
                <div key={day}>
                  <div className="sticky top-0 bg-background/95 backdrop-blur z-10 py-1.5 mb-2 border-b border-border/30">
                    <span className="text-xs font-semibold text-foreground capitalize">{dayLabel(day)}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground">{items.length} modification{items.length > 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map(e => {
                      const ref = refLabel(e);
                      const grp = FIELD_GROUP[e.field_name] ?? "autre";
                      const author = e.user_id ? profiles[e.user_id]?.name : "Système";
                      return (
                        <div key={e.id} className="flex items-start gap-3 rounded-lg border border-border/30 bg-card hover:bg-muted/20 px-3 py-2.5 transition-colors">
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-0.5 w-12">
                            {format(parseISO(e.created_at), "HH:mm")}
                          </span>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-[10px] font-mono ${e.entity_type === "task" ? "border-violet-400/50 text-violet-700 dark:text-violet-400" : "border-primary/40 text-primary"}`}>
                                {ref.tag}
                              </Badge>
                              <span className="text-xs font-medium text-foreground truncate max-w-[280px]">{ref.title}</span>
                              <Badge className={`text-[9px] uppercase tracking-wide ${FIELD_BADGE_CLASS[grp]}`}>
                                {FIELD_LABELS[e.field_name] ?? e.field_name}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="text-muted-foreground line-through max-w-[200px] truncate">
                                {formatValue(e.field_name, e.old_value)}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium text-foreground max-w-[260px] truncate">
                                {formatValue(e.field_name, e.new_value)}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">par {author ?? "Utilisateur"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
