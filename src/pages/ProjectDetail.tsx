import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActeurs } from "@/hooks/useActeurs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Calendar, Users, Network, FileText, Target, History, CalendarClock, Crown, Globe, Lock, CalendarRange, Archive, ArchiveRestore } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProjectCollaborators } from "@/components/projects/ProjectCollaborators";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { ProjectActionsList } from "@/components/projects/ProjectActionsList";
import { ProjectGanttChart } from "@/components/projects/ProjectGanttChart";
import { format, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

interface Project {
  id: string;
  title: string;
  slogan: string | null;
  image_url: string | null;
  description: string | null;
  resources: string | null;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
  created_by: string | null;
  created_at: string;
  objectives: string[];
  resources_list: string[];
  responsable_user_id: string | null;
  visibility: string;
}

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  brouillon: { label: "Brouillon", class: "bg-muted text-muted-foreground" },
  en_cours: { label: "En cours", class: "bg-primary/15 text-primary" },
  termine: { label: "Terminé", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  archive: { label: "Archivé", class: "bg-secondary text-secondary-foreground" },
};

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { hasPermission, user, role, profile } = useAuth();
  const { acteurs, getActeurLabel } = useActeurs();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [avancement, setAvancement] = useState(0);
  const [linkedProcesses, setLinkedProcesses] = useState<{ id: string; nom: string }[]>([]);
  const [linkedActors, setLinkedActors] = useState<{ id: string; fonction: string | null }[]>([]);
  const [ganttItems, setGanttItems] = useState<any[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [deadlineLogs, setDeadlineLogs] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<{ user_id: string; access_level: string }[]>([]);

  const baseCanRead = hasPermission("actions", "can_read");
  const baseCanReadDetail = hasPermission("actions", "can_read_detail");
  const baseCanEdit = hasPermission("actions", "can_edit");
  const baseCanDelete = hasPermission("actions", "can_delete");

  // Compute effective permissions based on project visibility/collaborators
  const isResponsable = project?.responsable_user_id === user?.id || project?.created_by === user?.id;
  const myCollab = collaborators.find(c => c.user_id === user?.id);
  const isAdmin = role === "admin" || role === "rmq";
  const isPrivate = project?.visibility === "private";
  
  const myCollabLevel = myCollab?.access_level;
  const canRead = isAdmin || isResponsable || !isPrivate || !!myCollab || baseCanRead;
  const canReadDetail = isAdmin || isResponsable || (myCollab ? true : (!isPrivate && baseCanReadDetail));
  // Édition complète (tout le plan d'action)
  const canEditAll = isAdmin || isResponsable || (myCollabLevel === "write") || (!isPrivate && baseCanEdit);
  // Édition restreinte : peut modifier uniquement les actions/tâches dont il est responsable
  const canEditOwn = canEditAll || (myCollabLevel === "restricted_write");
  const canEdit = canEditAll; // legacy: utilisé pour les boutons globaux (création)
  // Seul le responsable du projet et l'admin peuvent supprimer
  const canDelete = isAdmin || isResponsable;
  const canComment = canRead && !!user;

  const fetchProject = async () => {
    if (!projectId) return;
    const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (error || !data) { toast.error("Projet introuvable"); navigate("/actions"); return; }
    setProject({
      ...data,
      objectives: Array.isArray(data.objectives) ? data.objectives : [],
      resources_list: Array.isArray(data.resources_list) ? data.resources_list : [],
      responsable_user_id: (data as any).responsable_user_id ?? null,
      visibility: (data as any).visibility ?? "public",
    } as Project);
    setLoading(false);

    // Fetch collaborators
    const { data: collabs } = await supabase.from("project_collaborators").select("user_id, access_level").eq("project_id", projectId);
    setCollaborators((collabs ?? []) as { user_id: string; access_level: string }[]);

    const { data: pp } = await supabase.from("project_processes").select("process_id").eq("project_id", projectId);
    if (pp && pp.length > 0) {
      const { data: procs } = await supabase.from("processes").select("id, nom").in("id", pp.map(p => p.process_id));
      setLinkedProcesses(procs ?? []);
    }

    const { data: pa } = await supabase.from("project_actors").select("acteur_id").eq("project_id", projectId);
    if (pa && pa.length > 0) {
      const { data: acts } = await supabase.from("acteurs").select("id, fonction").in("id", pa.map(a => a.acteur_id));
      setLinkedActors(acts ?? []);
    }
  };

  const fetchGanttData = async () => {
    if (!projectId || !project) return;
    const { data: actions } = await supabase.from("project_actions").select("*").eq("project_id", projectId).order("ordre");
    if (!actions) return;
    const actionIds = actions.map(a => a.id);
    let tasksMap: Record<string, any[]> = {};
    if (actionIds.length > 0) {
      const { data: tasks } = await supabase.from("project_tasks").select("*").in("action_id", actionIds).order("ordre");
      (tasks ?? []).forEach((t: any) => {
        if (!tasksMap[t.action_id]) tasksMap[t.action_id] = [];
        tasksMap[t.action_id].push(t);
      });
    }

    const gantt = [{
      id: project.id,
      title: project.title,
      date_debut: project.date_debut,
      echeance: project.date_fin,
      statut: project.statut,
      avancement,
      level: "project" as const,
      children: actions.map((a: any) => ({
        id: a.id,
        title: a.title,
        date_debut: a.date_debut,
        echeance: a.echeance,
        statut: a.statut,
        avancement: a.avancement,
        responsable: [getActeurLabel(a.responsable_id), getActeurLabel(a.responsable_id_2), getActeurLabel(a.responsable_id_3)].filter(Boolean).join(", "),
        poids: a.poids ?? null,
        created_at: a.created_at ?? null,
        level: "action" as const,
        children: a.multi_tasks ? (tasksMap[a.id] ?? []).map((t: any) => ({
          id: t.id,
          title: t.title,
          date_debut: t.date_debut,
          echeance: t.echeance,
          statut: t.statut,
          avancement: t.avancement,
          responsable: getActeurLabel(t.responsable_id),
          level: "task" as const,
        })) : [],
      })),
    }];
    setGanttItems(gantt);
  };

  useEffect(() => { fetchProject(); }, [projectId]);
  useEffect(() => { if (project) fetchGanttData(); }, [project, avancement]);

  const fetchDeadlineLogs = async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("project_deadline_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    setDeadlineLogs(data ?? []);
    setLogsOpen(true);
  };

  const handleDelete = async () => {
    if (!projectId) return;
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) { toast.error(error.message); return; }
    toast.success("Projet supprimé");
    navigate("/actions");
  };

  if (loading) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!project) return null;

  const st = STATUS_MAP[project.statut] ?? STATUS_MAP.en_cours;

  return (
    <div className="max-w-6xl mx-auto space-y-6 page-enter">
      <Button variant="ghost" size="sm" onClick={() => navigate("/actions")} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux projets
      </Button>

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/30" style={{ boxShadow: "var(--shadow-md)" }}>
        {project.image_url ? (
          <>
            <div className="absolute inset-0">
              <img src={project.image_url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/85 to-card/40" />
            </div>
            <div className="relative h-32 sm:h-40" />
          </>
        ) : (
          <div className="h-2 w-full bg-gradient-to-r from-primary via-primary-glow to-accent" />
        )}

        <div className="relative bg-card/95 backdrop-blur-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{project.title}</h1>
              {project.slogan && <p className="text-muted-foreground italic mt-1">{project.slogan}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge className={`${st.class}`}>{st.label}</Badge>
                {project.visibility === "private" && <Badge variant="outline" className="text-[10px] gap-1"><Lock className="h-3 w-3" /> Privé</Badge>}
                {project.responsable_user_id && (
                  <Badge variant="outline" className="text-[10px] gap-1"><Crown className="h-3 w-3 text-amber-500" /> Responsable défini</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Modifier
                </Button>
              )}
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
                      <AlertDialogDescription>Le projet et toutes ses actions et tâches seront supprimés définitivement.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="rounded-lg border border-border/40 bg-background/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avancement</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xl font-bold tabular-nums">{avancement}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all duration-500 ${avancement >= 80 ? "bg-emerald-500" : avancement >= 40 ? "bg-amber-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, Math.max(0, avancement))}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Date de début</div>
              <div className="mt-1 text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {project.date_debut ?? "—"}
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Échéance</div>
              <div className="mt-1 text-sm font-semibold flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                {project.date_fin ?? "—"}
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-background/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Temps restant</div>
              <div className="mt-1 text-sm font-semibold">
                {project.date_fin ? (() => {
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const dl = parseISO(project.date_fin);
                  const daysLeft = differenceInDays(dl, today);
                  if (daysLeft < 0) return <span className="text-destructive">En retard de {Math.abs(daysLeft)}j</span>;
                  if (daysLeft <= 7) return <span className="text-amber-600 dark:text-amber-400">{daysLeft}j restants</span>;
                  return <span className="text-emerald-600 dark:text-emerald-400">{daysLeft}j restants</span>;
                })() : <span className="text-muted-foreground">—</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={fetchDeadlineLogs}>
              <History className="h-3.5 w-3.5" />
              Historique des échéances
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="actions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          {canReadDetail && <TabsTrigger value="actions">Actions & Tâches</TabsTrigger>}
          {canReadDetail && <TabsTrigger value="planning">Planning</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <Card>
                <CardContent className="p-5 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2"><FileText className="h-4 w-4" /> Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description || "Aucune description"}</p>
                </CardContent>
              </Card>

              {/* Objectifs */}
              {project.objectives.length > 0 && (
                <Card>
                  <CardContent className="p-5 space-y-2">
                    <h3 className="font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Objectifs</h3>
                    <ul className="space-y-1">
                      {project.objectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-primary mt-1">•</span>
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              {/* Ressources */}
              {project.resources_list.length > 0 && (
                <Card>
                  <CardContent className="p-5 space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">📦 Ressources</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {project.resources_list.map((r, i) => <Badge key={i} variant="outline">{r}</Badge>)}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-5 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2"><Network className="h-4 w-4" /> Processus liés</h3>
                  {linkedProcesses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun processus lié</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {linkedProcesses.map((p) => <Badge key={p.id} variant="outline">{p.nom}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 space-y-2">
                  <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Acteurs impliqués</h3>
                  {linkedActors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun acteur lié</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {linkedActors.map((a) => <Badge key={a.id} variant="outline">{a.fonction || "Acteur"}</Badge>)}
                    </div>
                  )}
                </CardContent>
              </Card>
              {/* Accès & Collaborateurs */}
              <ProjectCollaborators
                projectId={projectId!}
                responsableUserId={project.responsable_user_id}
                visibility={project.visibility}
                canEdit={isAdmin || isResponsable}
                onUpdate={fetchProject}
              />
            </div>
          </div>
        </TabsContent>

        {canReadDetail && (
          <TabsContent value="actions">
            <ProjectActionsList
              projectId={projectId!}
              projectDeadline={project.date_fin}
              canEdit={canEditAll}
              restrictedWrite={!canEditAll && canEditOwn}
              currentActeurId={profile?.acteur_id ?? null}
              canDelete={canDelete}
              canReadDetail={canReadDetail}
              canComment={canComment}
              isResponsable={isResponsable}
              isAdmin={isAdmin}
              onProgressChange={setAvancement}
            />
          </TabsContent>
        )}

        {canReadDetail && (
          <TabsContent value="planning">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Visualisez le planning de ce projet en plein écran</p>
                <Button onClick={() => navigate(`/actions/${projectId}/planning`)} className="gap-1.5">
                  <CalendarRange className="h-4 w-4" /> Ouvrir le planning
                </Button>
              </div>
              <ProjectGanttChart items={ganttItems} />
            </div>
          </TabsContent>
        )}
      </Tabs>

      <ProjectForm
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={fetchProject}
        editProject={project}
        canManageImage={isAdmin || isResponsable}
      />

      {/* Deadline logs history dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historique des modifications d'échéances
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {deadlineLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune modification d'échéance enregistrée</p>
            ) : (
              deadlineLogs.map((log: any) => (
                <div key={log.id} className="rounded-lg border border-border/30 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{log.entity_title}</span>
                    <Badge variant="outline" className="text-[10px]">{log.entity_type === "action" ? "Action" : "Tâche"}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-destructive/80 border-destructive/20">{log.old_echeance ?? "—"}</Badge>
                    <span className="text-muted-foreground">→</span>
                    <Badge className="bg-primary/15 text-primary">{log.new_echeance ?? "—"}</Badge>
                  </div>
                  {log.reason && (
                    <p className="text-xs text-muted-foreground italic">💬 {log.reason}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {format(parseISO(log.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
