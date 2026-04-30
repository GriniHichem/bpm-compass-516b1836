import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, FolderKanban, Zap, ChevronDown, ChevronRight, StickyNote, User, Trash2, Pencil, CalendarRange, Search, AlertTriangle, TrendingUp, Clock, LayoutGrid, List as ListIcon } from "lucide-react";
import { FilterDrawer } from "@/components/ui/filter-drawer";
import { Fab } from "@/components/ui/fab";
import { differenceInDays, parseISO } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { HelpTooltip } from "@/components/HelpTooltip";
import { ProjectCard, type ProjectSummary } from "@/components/projects/ProjectCard";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { computeProjectProgress } from "@/lib/projectProgress";
import { ProjectGanttChart } from "@/components/projects/ProjectGanttChart";
import { useActeurs } from "@/hooks/useActeurs";
import { ActeurUserSelect } from "@/components/ActeurUserSelect";
import { useProfilesById } from "@/hooks/useProfilesById";

// --- Legacy corrective actions types ---
type Acteur = { id: string; fonction: string | null };
type ActionNote = { id: string; action_id: string; contenu: string; avancement: number; date_note: string; created_at: string };
type LegacyAction = { id: string; description: string; type_action: string; statut: string; echeance: string | null; responsable_id: string | null; responsable_user_id: string | null; source_type: string };

const statusColors: Record<string, string> = {
  planifiee: "bg-muted text-muted-foreground",
  en_cours: "bg-primary/20 text-primary",
  realisee: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  verifiee: "bg-accent/20 text-accent-foreground",
  cloturee: "bg-secondary text-secondary-foreground",
  en_retard: "bg-destructive/20 text-destructive",
};

const statusLabels: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  verifiee: "Vérifiée",
  cloturee: "Clôturée",
  en_retard: "En retard",
};

export default function Actions() {
  const { hasPermission, user } = useAuth();
  const { acteurs: acteursList, getActeurLabel } = useActeurs();
  const canEdit = hasPermission("actions", "can_edit");
  const canDelete = hasPermission("actions", "can_delete");

  // Projects state
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [ganttItems, setGanttItems] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "deadline" | "progress" | "alpha">("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Legacy actions state
  const [legacyActions, setLegacyActions] = useState<LegacyAction[]>([]);
  const [loadingLegacy, setLoadingLegacy] = useState(true);
  const [legacyDialogOpen, setLegacyDialogOpen] = useState(false);
  const [newLegacyAction, setNewLegacyAction] = useState({ description: "", type_action: "corrective", echeance: "", source_type: "manuelle", responsable_id: "", responsable_user_id: "" });
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, ActionNote[]>>({});
  const [newNote, setNewNote] = useState<Record<string, { contenu: string; avancement: string }>>({});

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (!data) { setLoadingProjects(false); return; }

    // Fetch collaborators for private project filtering
    const projectIds = data.map((p: any) => p.id);
    let collabMap: Record<string, string[]> = {};
    if (projectIds.length > 0) {
      const { data: collabs } = await supabase.from("project_collaborators").select("project_id, user_id").in("project_id", projectIds);
      (collabs ?? []).forEach((c: any) => {
        if (!collabMap[c.project_id]) collabMap[c.project_id] = [];
        collabMap[c.project_id].push(c.user_id);
      });
    }

    // Filter private projects: only show if user is responsable, collaborator, or admin
    const filtered = data.filter((p: any) => {
      if ((p as any).visibility !== "private") return true;
      if ((p as any).responsable_user_id === user?.id) return true;
      if (collabMap[p.id]?.includes(user?.id ?? "")) return true;
      // Admin check via role
      return false; // RLS should also filter, but double-check client-side
    });

    // Fetch action counts and weighted avancements (consistent with ProjectActionsList & Planning)
    const filteredIds = filtered.map((p: any) => p.id);
    let actionCounts: Record<string, { count: number; avg: number }> = {};
    if (filteredIds.length > 0) {
      const { data: actions } = await supabase
        .from("project_actions")
        .select("id, project_id, statut, avancement, multi_tasks, poids")
        .in("project_id", filteredIds);
      const allActions = actions ?? [];
      // Fetch tasks for multi-task actions to normalize their progress
      const multiActionIds = allActions.filter((a: any) => a.multi_tasks).map((a: any) => a.id);
      let tasksByAction: Record<string, any[]> = {};
      if (multiActionIds.length > 0) {
        const { data: tasks } = await supabase
          .from("project_tasks")
          .select("action_id, statut, avancement")
          .in("action_id", multiActionIds);
        (tasks ?? []).forEach((t: any) => {
          if (!tasksByAction[t.action_id]) tasksByAction[t.action_id] = [];
          tasksByAction[t.action_id].push(t);
        });
      }
      // Group actions by project, count and compute weighted progress
      const byProject: Record<string, any[]> = {};
      allActions.forEach((a: any) => {
        if (!byProject[a.project_id]) byProject[a.project_id] = [];
        byProject[a.project_id].push(a);
      });
      Object.entries(byProject).forEach(([pid, acts]) => {
        actionCounts[pid] = {
          count: acts.length,
          avg: computeProjectProgress(acts as any, tasksByAction),
        };
      });
    }

    const summaries: ProjectSummary[] = filtered.map((p: any) => ({
      id: p.id,
      title: p.title,
      slogan: p.slogan,
      image_url: p.image_url,
      statut: p.statut,
      date_debut: p.date_debut,
      date_fin: p.date_fin,
      action_count: actionCounts[p.id]?.count ?? 0,
      avancement: actionCounts[p.id]?.avg ?? 0,
      visibility: p.visibility ?? "public",
    }));

    setProjects(summaries);
    setLoadingProjects(false);

    // Build gantt items
    const gantt = summaries.map((p) => ({
      id: p.id,
      title: p.title,
      date_debut: p.date_debut,
      echeance: p.date_fin,
      statut: p.statut,
      avancement: p.avancement,
      level: "project" as const,
      children: [] as any[],
    }));
    setGanttItems(gantt);
  };

  // Legacy actions
  const fetchLegacyActions = async () => {
    const { data } = await supabase.from("actions").select("*").order("echeance", { ascending: true });
    setLegacyActions((data ?? []) as LegacyAction[]);
    setLoadingLegacy(false);
  };

  const fetchNotes = async (actionId: string) => {
    const { data } = await supabase.from("action_notes").select("*").eq("action_id", actionId).order("date_note", { ascending: false });
    setNotesMap((prev) => ({ ...prev, [actionId]: (data ?? []) as ActionNote[] }));
  };

  useEffect(() => { fetchProjects(); fetchLegacyActions(); }, []);

  const handleCreateLegacy = async () => {
    if (!newLegacyAction.description) { toast.error("Description requise"); return; }
    const { error } = await supabase.from("actions").insert({
      description: newLegacyAction.description,
      type_action: newLegacyAction.type_action as any,
      echeance: newLegacyAction.echeance || null,
      source_type: newLegacyAction.source_type,
      responsable_id: newLegacyAction.responsable_id || null,
      responsable_user_id: newLegacyAction.responsable_user_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Action créée");
    setLegacyDialogOpen(false);
    setNewLegacyAction({ description: "", type_action: "corrective", echeance: "", source_type: "manuelle", responsable_id: "", responsable_user_id: "" });
    fetchLegacyActions();
  };

  const handleDeleteLegacy = async (id: string) => {
    await supabase.from("actions").delete().eq("id", id);
    toast.success("Action supprimée");
    fetchLegacyActions();
  };

  const handleUpdateLegacyStatus = async (id: string, statut: string) => {
    await supabase.from("actions").update({ statut: statut as any }).eq("id", id);
    fetchLegacyActions();
  };

  const toggleExpand = (actionId: string) => {
    if (expandedAction === actionId) { setExpandedAction(null); } else {
      setExpandedAction(actionId);
      if (!notesMap[actionId]) fetchNotes(actionId);
    }
  };

  const handleAddNote = async (actionId: string) => {
    const note = newNote[actionId];
    if (!note?.contenu) { toast.error("Contenu requis"); return; }
    const avancement = Math.min(100, Math.max(0, parseInt(note.avancement) || 0));
    await supabase.from("action_notes").insert({ action_id: actionId, contenu: note.contenu, avancement, created_by: user?.id ?? null });
    toast.success("Note ajoutée");
    setNewNote((prev) => ({ ...prev, [actionId]: { contenu: "", avancement: "" } }));
    fetchNotes(actionId);
  };

  const isOverdue = (a: LegacyAction) => a.echeance && new Date(a.echeance) < new Date() && !["cloturee", "verifiee"].includes(a.statut);

  // Resolve real user names for actions that have a responsable_user_id set
  const responsableUserIds = legacyActions.map((a) => a.responsable_user_id).filter(Boolean) as string[];
  const { formatName } = useProfilesById(responsableUserIds);

  // KPI computations
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const kpiTotal = projects.length;
  const kpiInProgress = projects.filter((p) => p.statut === "en_cours").length;
  const kpiDone = projects.filter((p) => p.statut === "termine").length;
  const kpiOverdue = projects.filter((p) => p.date_fin && parseISO(p.date_fin) < today && p.statut !== "termine" && p.statut !== "archive").length;
  const kpiAvgProgress = projects.length > 0 ? Math.round(projects.reduce((s, p) => s + (p.avancement || 0), 0) / projects.length) : 0;

  // Filter + search + sort
  const filteredProjects = projects
    .filter((p) => statusFilter === "all" || p.statut === statusFilter)
    .filter((p) => !searchQuery.trim() || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || (p.slogan ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "alpha") return a.title.localeCompare(b.title);
      if (sortBy === "progress") return b.avancement - a.avancement;
      if (sortBy === "deadline") {
        if (!a.date_fin && !b.date_fin) return 0;
        if (!a.date_fin) return 1;
        if (!b.date_fin) return -1;
        return parseISO(a.date_fin).getTime() - parseISO(b.date_fin).getTime();
      }
      return 0; // recent — already sorted by created_at desc from query
    });

  return (
    <div className="max-w-7xl mx-auto space-y-6 page-enter">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            Plans d'action
            <HelpTooltip term="action_amelioration" />
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gestion de projets, actions et tâches</p>
        </div>
      </div>

      {/* KPI strip */}
      {!loadingProjects && projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/50 bg-card p-3 flex items-center gap-3" style={{ boxShadow: "var(--shadow-xs)" }}>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><FolderKanban className="h-4 w-4 text-primary" /></div>
            <div>
              <div className="text-xl font-bold leading-none">{kpiTotal}</div>
              <div className="text-[11px] text-muted-foreground mt-1">Total projets</div>
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3 flex items-center gap-3" style={{ boxShadow: "var(--shadow-xs)" }}>
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Clock className="h-4 w-4 text-primary" /></div>
            <div>
              <div className="text-xl font-bold leading-none">{kpiInProgress}</div>
              <div className="text-[11px] text-muted-foreground mt-1">En cours</div>
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3 flex items-center gap-3" style={{ boxShadow: "var(--shadow-xs)" }}>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
            <div>
              <div className="text-xl font-bold leading-none">{kpiAvgProgress}%</div>
              <div className="text-[11px] text-muted-foreground mt-1">Avancement moyen</div>
            </div>
          </div>
          <div className={`rounded-xl border p-3 flex items-center gap-3 ${kpiOverdue > 0 ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-card"}`} style={{ boxShadow: "var(--shadow-xs)" }}>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${kpiOverdue > 0 ? "bg-destructive/15" : "bg-muted"}`}>
              <AlertTriangle className={`h-4 w-4 ${kpiOverdue > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <div>
              <div className={`text-xl font-bold leading-none ${kpiOverdue > 0 ? "text-destructive" : ""}`}>{kpiOverdue}</div>
              <div className="text-[11px] text-muted-foreground mt-1">En retard</div>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">Projets</TabsTrigger>
          <TabsTrigger value="planning">
            <CalendarRange className="h-3.5 w-3.5 mr-1.5" />Planning
          </TabsTrigger>
          <TabsTrigger value="corrective">Actions correctives</TabsTrigger>
        </TabsList>

        {/* Projects tab */}
        <TabsContent value="projects" className="space-y-4">
          {/* Toolbar — desktop ≥ sm */}
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher un projet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="brouillon">Brouillon</SelectItem>
                <SelectItem value="en_cours">En cours</SelectItem>
                <SelectItem value="termine">Terminé</SelectItem>
                <SelectItem value="archive">Archivé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Plus récents</SelectItem>
                <SelectItem value="deadline">Échéance</SelectItem>
                <SelectItem value="progress">Avancement</SelectItem>
                <SelectItem value="alpha">Alphabétique</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-md border border-border bg-card p-0.5">
              <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("grid")} title="Grille">
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setViewMode("list")} title="Liste">
                <ListIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">{filteredProjects.length} résultat{filteredProjects.length > 1 ? "s" : ""}</span>
            {canEdit && (
              <Button onClick={() => setProjectFormOpen(true)} className="gap-1.5" style={{ boxShadow: "var(--shadow-sm)" }}>
                <Plus className="h-4 w-4" /> Nouveau projet
              </Button>
            )}
          </div>

          {/* Toolbar — mobile < sm */}
          <div className="sm:hidden space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un projet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <FilterDrawer
                activeCount={(statusFilter !== "all" ? 1 : 0) + (sortBy !== "recent" ? 1 : 0)}
                onReset={() => { setStatusFilter("all"); setSortBy("recent"); }}
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Statut</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      <SelectItem value="brouillon">Brouillon</SelectItem>
                      <SelectItem value="en_cours">En cours</SelectItem>
                      <SelectItem value="termine">Terminé</SelectItem>
                      <SelectItem value="archive">Archivé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Trier par</label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Plus récents</SelectItem>
                      <SelectItem value="deadline">Échéance</SelectItem>
                      <SelectItem value="progress">Avancement</SelectItem>
                      <SelectItem value="alpha">Alphabétique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Affichage</label>
                  <div className="flex gap-2">
                    <Button variant={viewMode === "grid" ? "default" : "outline"} className="flex-1 h-11" onClick={() => setViewMode("grid")}>
                      <LayoutGrid className="h-4 w-4 mr-2" /> Grille
                    </Button>
                    <Button variant={viewMode === "list" ? "default" : "outline"} className="flex-1 h-11" onClick={() => setViewMode("list")}>
                      <ListIcon className="h-4 w-4 mr-2" /> Liste
                    </Button>
                  </div>
                </div>
              </FilterDrawer>
              <span className="text-xs text-muted-foreground ml-auto">
                {filteredProjects.length} résultat{filteredProjects.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {loadingProjects ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="py-16 flex flex-col items-center text-center gap-3">
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <FolderKanban className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Aucun projet trouvé</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchQuery || statusFilter !== "all" ? "Modifiez vos filtres ou créez un nouveau projet" : "Commencez par créer votre premier plan d'action"}
                  </p>
                </div>
                {canEdit && (
                  <Button onClick={() => setProjectFormOpen(true)} variant="outline" size="sm" className="mt-1">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Nouveau projet
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProjects.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          )}
        </TabsContent>

        {/* Planning tab */}
        <TabsContent value="planning">
          <ProjectGanttChart items={ganttItems} />
        </TabsContent>

        {/* Legacy corrective actions tab */}
        <TabsContent value="corrective" className="space-y-4">
          <div className="flex justify-end">
            {canEdit && (
              <Dialog open={legacyDialogOpen} onOpenChange={setLegacyDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Nouvelle action</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Créer une action corrective</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Description</Label><Textarea value={newLegacyAction.description} onChange={(e) => setNewLegacyAction({ ...newLegacyAction, description: e.target.value })} /></div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={newLegacyAction.type_action} onValueChange={(v) => setNewLegacyAction({ ...newLegacyAction, type_action: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corrective">Corrective</SelectItem>
                          <SelectItem value="preventive">Préventive</SelectItem>
                          <SelectItem value="amelioration">Amélioration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Responsable</Label>
                      <ActeurUserSelect
                        acteurValue={newLegacyAction.responsable_id}
                        userValue={newLegacyAction.responsable_user_id}
                        onActeurChange={(v) => setNewLegacyAction({ ...newLegacyAction, responsable_id: v, responsable_user_id: "" })}
                        onUserChange={(v) => setNewLegacyAction({ ...newLegacyAction, responsable_user_id: v })}
                        acteurs={acteursList}
                      />
                    </div>
                    <div className="space-y-2"><Label>Échéance</Label><Input type="date" value={newLegacyAction.echeance} onChange={(e) => setNewLegacyAction({ ...newLegacyAction, echeance: e.target.value })} /></div>
                    <Button onClick={handleCreateLegacy} className="w-full">Créer</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {loadingLegacy ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : legacyActions.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune action corrective</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {legacyActions.map((a) => {
                const isOpen = expandedAction === a.id;
                const notes = notesMap[a.id] ?? [];
                const noteInput = newNote[a.id] ?? { contenu: "", avancement: "" };

                return (
                  <Collapsible key={a.id} open={isOpen} onOpenChange={() => toggleExpand(a.id)}>
                    <Card className={isOverdue(a) ? "border-destructive/50" : ""}>
                      <CollapsibleTrigger asChild>
                        <CardContent className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                            <Zap className={`h-4 w-4 shrink-0 ${isOverdue(a) ? "text-destructive" : "text-primary"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm line-clamp-1">{a.description}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{a.type_action}</span>
                                <span>•</span>
                                <span>{a.echeance ?? "Sans échéance"}</span>
                                {a.responsable_id && <><span>•</span><span>{getActeurLabel(a.responsable_id)}{a.responsable_user_id && formatName(a.responsable_user_id) ? ` — ${formatName(a.responsable_user_id)}` : ""}</span></>}
                              </div>
                            </div>
                          </div>
                          <Badge className={statusColors[a.statut] ?? ""}>{statusLabels[a.statut] ?? a.statut}</Badge>
                        </CardContent>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t px-6 py-4 space-y-3 bg-muted/10">
                          {canEdit && (
                            <div className="flex flex-wrap gap-3 items-end">
                              <div className="space-y-1">
                                <Label className="text-xs">Statut</Label>
                                <Select value={a.statut} onValueChange={(v) => handleUpdateLegacyStatus(a.id, v)}>
                                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              {canDelete && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-destructive border-destructive/30 ml-auto"><Trash2 className="h-3 w-3 mr-1" />Supprimer</Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Supprimer cette action ?</AlertDialogTitle><AlertDialogDescription>Suppression définitive.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteLegacy(a.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          )}
                          {/* Notes */}
                          <div className="space-y-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2"><StickyNote className="h-4 w-4" /> Notes ({notes.length})</h4>
                            {notes.map((n) => (
                              <div key={n.id} className="rounded-lg border bg-background p-3 space-y-1">
                                <div className="flex justify-between"><span className="text-xs text-muted-foreground">{n.date_note}</span><Badge variant="outline" className="text-[10px]">{n.avancement}%</Badge></div>
                                <p className="text-sm">{n.contenu}</p>
                              </div>
                            ))}
                          </div>
                          {canEdit && (
                            <div className="flex gap-2 items-end">
                              <div className="flex-1 space-y-1"><Label className="text-xs">Note</Label><Input value={noteInput.contenu} onChange={(e) => setNewNote((p) => ({ ...p, [a.id]: { ...noteInput, contenu: e.target.value } }))} placeholder="Ajouter une note..." className="h-8 text-xs" /></div>
                              <div className="w-16 space-y-1"><Label className="text-xs">%</Label><Input value={noteInput.avancement} onChange={(e) => setNewNote((p) => ({ ...p, [a.id]: { ...noteInput, avancement: e.target.value } }))} placeholder="0" className="h-8 text-xs" /></div>
                              <Button size="sm" className="h-8" onClick={() => handleAddNote(a.id)}>Ajouter</Button>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ProjectForm open={projectFormOpen} onOpenChange={setProjectFormOpen} onSaved={fetchProjects} />
    </div>
  );
}
