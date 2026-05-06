import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActeurs } from "@/hooks/useActeurs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { ProjectGanttChart } from "@/components/projects/ProjectGanttChart";
import { toast } from "sonner";
import { computeProjectProgress, getActionEffectiveProgress, normalizeTaskProgress } from "@/lib/projectProgress";

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  brouillon: { label: "Brouillon", class: "bg-muted text-muted-foreground" },
  en_cours: { label: "En cours", class: "bg-primary/15 text-primary" },
  termine: { label: "Terminé", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  archive: { label: "Archivé", class: "bg-secondary text-secondary-foreground" },
};

export default function ProjectPlanningPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { acteurs, getActeurLabel } = useActeurs();

  const [project, setProject] = useState<any>(null);
  const [ganttItems, setGanttItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canComment, setCanComment] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (error || !data) { toast.error("Projet introuvable"); navigate("/actions"); return; }
      setProject(data);

      const admin = role === "admin" || role === "rmq";
      setIsAdmin(admin);

      const isResponsable = (data as any).responsable_user_id === user?.id || (data as any).created_by === user?.id;
      setCanComment(admin || isResponsable || (data as any).visibility !== "private");

      // Fetch actions + tasks for gantt
      const { data: actions } = await supabase.from("project_actions").select("*").eq("project_id", projectId).order("ordre");
      if (!actions) { setLoading(false); return; }

      const actionIds = actions.map((a: any) => a.id);
      let tasksMap: Record<string, any[]> = {};
      if (actionIds.length > 0) {
        const { data: tasks } = await supabase.from("project_tasks").select("*").in("action_id", actionIds).order("ordre");
        (tasks ?? []).forEach((t: any) => {
          if (!tasksMap[t.action_id]) tasksMap[t.action_id] = [];
          tasksMap[t.action_id].push(t);
        });
      }

      // Compute project avancement using centralized helper (consistent with list & dashboard)
      const projectAvancement = computeProjectProgress(actions as any, tasksMap);

      const gantt = [{
        id: data.id,
        title: data.title,
        date_debut: data.date_debut,
        echeance: data.date_fin,
        statut: data.statut,
        avancement: projectAvancement,
        level: "project" as const,
        children: actions.map((a: any) => ({
          id: a.id,
          title: a.title,
          date_debut: a.date_debut,
          echeance: a.echeance,
          statut: a.statut,
          avancement: getActionEffectiveProgress(a, tasksMap[a.id]),
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
            avancement: normalizeTaskProgress(t),
            responsable: getActeurLabel(t.responsable_id),
            level: "task" as const,
          })) : [],
        })),
      }];
      setGanttItems(gantt);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!project) return null;
  const st = STATUS_MAP[project.statut] ?? STATUS_MAP.en_cours;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/40 bg-card px-4 py-2.5 flex items-center gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/actions/${projectId}`)} className="text-muted-foreground gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <div className="h-5 w-px bg-border/50" />
        <CalendarRange className="h-4.5 w-4.5 text-primary" />
        <h1 className="text-sm font-semibold text-foreground truncate">{project.title}</h1>
        <Badge className={`${st.class} text-[10px]`}>{st.label}</Badge>

        {/* Status legend */}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" /> À faire</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" /> En cours</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Terminé</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-destructive" /> En retard</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Bloqué</span>
        </div>
      </div>

      {/* Gantt fullscreen */}
      <div className="flex-1 overflow-hidden">
        <ProjectGanttChart
          items={ganttItems}
          fullscreen
          canComment={canComment}
          isAdmin={isAdmin}
          projectId={projectId!}
          projectResponsableUserId={(project as any)?.responsable_user_id}
        />
      </div>
    </div>
  );
}
