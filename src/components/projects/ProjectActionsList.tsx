import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Plus, ChevronDown, ChevronRight, Trash2, CheckCircle2, Circle, Clock, MessageSquare, AlertTriangle, ShieldAlert, CalendarClock, History, UserPlus, X, ListTodo, Lock, RotateCcw, Pin, PinOff, EyeOff, Eye, Filter, ArrowUpDown, SlidersHorizontal, Ban, FileText, User, Pencil } from "lucide-react";
import { FilterDrawer } from "@/components/ui/filter-drawer";
import { ProjectActionComments } from "@/components/projects/ProjectActionComments";
import { ProjectHistoryDialog } from "@/components/projects/ProjectHistoryDialog";
import { ProjectActionDependencies, type Dependency } from "@/components/projects/ProjectActionDependencies";
import { computeMultiTaskActionProgress, computeProjectProgress } from "@/lib/projectProgress";
import { useActeurs } from "@/hooks/useActeurs";
import { ActeurUserSelect } from "@/components/ActeurUserSelect";
import { useProfilesById } from "@/hooks/useProfilesById";
import { TaskRespCompact } from "@/components/projects/TaskRespCompact";
import { ElementNotes } from "@/components/ElementNotes";
import { ProjectActionLinks } from "@/components/projects/ProjectActionLinks";
import { format, differenceInDays, parseISO, isAfter, isBefore, addDays, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

interface ProjectAction {
  id: string;
  title: string;
  description: string | null;
  responsable_id: string | null;
  responsable_id_2: string | null;
  responsable_id_3: string | null;
  responsable_user_id: string | null;
  responsable_user_id_2: string | null;
  responsable_user_id_3: string | null;
  date_debut: string | null;
  echeance: string | null;
  statut: string;
  avancement: number;
  ordre: number;
  multi_tasks: boolean;
  pinned: boolean;
  poids: number | null;
  created_at?: string | null;
}

interface ProjectTask {
  id: string;
  action_id: string;
  title: string;
  responsable_id: string | null;
  responsable_user_id: string | null;
  date_debut: string | null;
  echeance: string | null;
  statut: string;
  avancement: number;
  ordre: number;
}

interface DeadlineLog {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_title: string;
  old_echeance: string | null;
  new_echeance: string | null;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

const ACTION_STATUS: Record<string, { label: string; class: string; dot: string; bar: string; stripe: string; icon: any }> = {
  planifiee: { label: "Planifiée", class: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30", dot: "bg-slate-400", bar: "[&>div]:bg-slate-400", stripe: "bg-slate-400", icon: Circle },
  en_cours:  { label: "En cours",  class: "bg-primary/15 text-primary border-primary/30",                          dot: "bg-primary",  bar: "[&>div]:bg-primary",  stripe: "bg-primary",  icon: Clock },
  terminee:  { label: "Terminée",  class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500", bar: "[&>div]:bg-emerald-500", stripe: "bg-emerald-500", icon: CheckCircle2 },
  en_retard: { label: "En retard", class: "bg-destructive/15 text-destructive border-destructive/30",              dot: "bg-destructive", bar: "[&>div]:bg-destructive", stripe: "bg-destructive", icon: AlertTriangle },
  bloquee:   { label: "Bloquée",   class: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30", dot: "bg-slate-500", bar: "[&>div]:bg-slate-500", stripe: "bg-slate-500", icon: Ban },
  annulee:   { label: "Annulée",   class: "bg-muted/50 text-muted-foreground line-through border-border",          dot: "bg-muted-foreground/40", bar: "[&>div]:bg-muted-foreground/40", stripe: "bg-muted-foreground/40", icon: X },
};

const TASK_STATUS: Record<string, { label: string; icon: any; class: string }> = {
  a_faire: { label: "À faire", icon: Circle, class: "text-muted-foreground" },
  en_cours: { label: "En cours", icon: Clock, class: "text-primary" },
  termine: { label: "Terminé", icon: CheckCircle2, class: "text-emerald-600" },
};

function getDateStatus(echeance: string | null, projectDeadline: string | null, statut: string) {
  if (!echeance || statut === "terminee" || statut === "termine") return { status: "ok" as const, label: "", color: "" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = parseISO(echeance);
  const daysLeft = differenceInDays(deadline, today);
  if (projectDeadline && isAfter(deadline, parseISO(projectDeadline))) {
    return { status: "exceeds" as const, label: "Dépasse la deadline du projet", color: "text-orange-600 dark:text-orange-400" };
  }
  if (daysLeft < 0) {
    return { status: "overdue" as const, label: `En retard de ${Math.abs(daysLeft)} jour${Math.abs(daysLeft) > 1 ? "s" : ""}`, color: "text-destructive" };
  }
  if (daysLeft <= 3) {
    return { status: "urgent" as const, label: `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`, color: "text-orange-600 dark:text-orange-400" };
  }
  if (daysLeft <= 7) {
    return { status: "warning" as const, label: `${daysLeft} jours restants`, color: "text-amber-600 dark:text-amber-400" };
  }
  return { status: "ok" as const, label: "", color: "" };
}

interface Props {
  projectId: string;
  projectDeadline: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canReadDetail?: boolean;
  canComment?: boolean;
  isResponsable?: boolean;
  isAdmin?: boolean;
  /** Si true, l'utilisateur n'a pas l'édition complète mais peut modifier ses propres actions/tâches uniquement. */
  restrictedWrite?: boolean;
  /** acteur_id du profil courant (pour matcher responsable_id). */
  currentActeurId?: string | null;
  onProgressChange: (avancement: number) => void;
}

export function ProjectActionsList({ projectId, projectDeadline, canEdit, canDelete: _canDelete, canReadDetail = true, canComment = false, isResponsable = false, isAdmin = false, restrictedWrite = false, currentActeurId = null, onProgressChange }: Props) {
  // Suppression d'actions/tâches désactivée pour tous les rôles : intégrité du plan
  const canDelete = false;
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Règle stricte : en écriture limitée, seule une désignation utilisateur explicite
  // sur l'action (responsable 1/2/3) ouvre le droit d'édition de l'action.
  const isMyAction = (a: { responsable_id: string | null; responsable_id_2: string | null; responsable_id_3: string | null; responsable_user_id: string | null; responsable_user_id_2: string | null; responsable_user_id_3: string | null; }) => {
    if (!userId) return false;
    return [a.responsable_user_id, a.responsable_user_id_2, a.responsable_user_id_3].some((v) => v === userId);
  };
  const isMyTask = (t: { responsable_id: string | null; responsable_user_id: string | null; }) => {
    if (!userId) return false;
    return t.responsable_user_id === userId;
  };
  const canEditAction = (a: ProjectAction) => canEdit || (restrictedWrite && isMyAction(a));
  const canEditTask = (t: ProjectTask, parent?: ProjectAction) => canEdit || (restrictedWrite && (isMyTask(t) || (parent ? isMyAction(parent) : false)));
  const getActionById = (actionId: string) => actions.find((a) => a.id === actionId);
  const getTaskWithParent = (taskId: string) => {
    for (const [actionId, tasks] of Object.entries(tasksMap)) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        return { task, parent: actions.find((a) => a.id === actionId) ?? null };
      }
    }
    return { task: null as ProjectTask | null, parent: null as ProjectAction | null };
  };

  const [actions, setActions] = useState<ProjectAction[]>([]);
  const [tasksMap, setTasksMap] = useState<Record<string, ProjectTask[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState<string | null>(null);
  const [newActionTitle, setNewActionTitle] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({});
  const { acteurs, getActeurLabel } = useActeurs();

  const [showResp2, setShowResp2] = useState<Set<string>>(new Set());
  const [showResp3, setShowResp3] = useState<Set<string>>(new Set());

  const [deadlineDialog, setDeadlineDialog] = useState<{
    open: boolean;
    entityType: "action" | "task";
    entityId: string;
    entityTitle: string;
    oldDate: string | null;
    newDate: string;
  } | null>(null);
  const [deadlineReason, setDeadlineReason] = useState("");

  const [logsOpen, setLogsOpen] = useState(false);
  const [deadlineLogs, setDeadlineLogs] = useState<DeadlineLog[]>([]);

  const [disableMultiDialog, setDisableMultiDialog] = useState<string | null>(null);

  // Confirm close action dialog
  const [confirmCloseActionId, setConfirmCloseActionId] = useState<string | null>(null);
  // Reopen action dialog (with mandatory reason)
  const [reopenActionId, setReopenActionId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [historyActionId, setHistoryActionId] = useState<string | null>(null);
  const [historyActionTitle, setHistoryActionTitle] = useState("");
  const [projectHistoryOpen, setProjectHistoryOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");

  useEffect(() => {
    if (!projectId) return;
    supabase.from("projects").select("title").eq("id", projectId).maybeSingle().then(({ data }) => {
      if (data?.title) setProjectTitle(data.title);
    });
  }, [projectId]);

  // Transfer responsibility dialog
  const [transferDialog, setTransferDialog] = useState<{
    actionId: string;
    actionTitle: string;
    fields: { acteur: "responsable_id" | "responsable_id_2" | "responsable_id_3"; user: "responsable_user_id" | "responsable_user_id_2" | "responsable_user_id_3" };
    label: string;
    currentActeurId: string | null;
    currentUserId: string | null;
  } | null>(null);
  const [transferActeurId, setTransferActeurId] = useState<string>("");
  const [transferUserId, setTransferUserId] = useState<string>("");
  const [transferReason, setTransferReason] = useState("");

  // Filters
  const [filterStatut, setFilterStatut] = useState("all");
  const [hideTerminees, setHideTerminees] = useState(false);
  const [filterEcheance, setFilterEcheance] = useState("all");
  const [sortBy, setSortBy] = useState("ordre");
  const [dependencies, setDependencies] = useState<Dependency[]>([]);

  // Resolve real user names for actions/tasks that have a responsable_user_id set
  const responsableUserIds = [
    ...actions.flatMap((a) => [a.responsable_user_id, a.responsable_user_id_2, a.responsable_user_id_3]),
    ...Object.values(tasksMap).flat().map((t) => t.responsable_user_id),
  ].filter(Boolean) as string[];
  const { formatName: formatRespUserName } = useProfilesById(responsableUserIds);

  const fetchActions = async () => {
    const { data, error } = await supabase
      .from("project_actions")
      .select("*")
      .eq("project_id", projectId)
      .order("ordre");
    if (error) { console.error("Fetch actions error:", error); toast.error("Erreur chargement actions: " + error.message); return; }
    const acts = (data ?? []).map((d: any) => ({ ...d, multi_tasks: d.multi_tasks ?? false, pinned: d.pinned ?? false, responsable_id_2: d.responsable_id_2 ?? null, responsable_id_3: d.responsable_id_3 ?? null, responsable_user_id_2: d.responsable_user_id_2 ?? null, responsable_user_id_3: d.responsable_user_id_3 ?? null, poids: d.poids ?? null })) as ProjectAction[];
    setActions(acts);

    const r2 = new Set<string>();
    const r3 = new Set<string>();
    acts.forEach(a => {
      if (a.responsable_id_2) r2.add(a.id);
      if (a.responsable_id_3) r3.add(a.id);
    });
    setShowResp2(prev => new Set([...prev, ...r2]));
    setShowResp3(prev => new Set([...prev, ...r3]));

    if (acts.length > 0) {
      const { data: tasks } = await supabase
        .from("project_tasks")
        .select("*")
        .in("action_id", acts.map((a) => a.id))
        .order("ordre");
      const map: Record<string, ProjectTask[]> = {};
      (tasks ?? []).forEach((t: any) => {
        if (!map[t.action_id]) map[t.action_id] = [];
        map[t.action_id].push(t as ProjectTask);
      });
      setTasksMap(map);
      // Weighted progress using centralized helper (uses normalized task progress for multi-task actions)
      const avg = computeProjectProgress(acts, map);
      onProgressChange(avg);
    } else {
      setTasksMap({});
      onProgressChange(0);
    }

    // Fetch dependencies
    const { data: deps } = await supabase
      .from("project_action_dependencies")
      .select("*")
      .eq("project_id", projectId);
    setDependencies((deps ?? []) as Dependency[]);
  };

  const fetchDeadlineLogs = async () => {
    const { data } = await supabase
      .from("project_deadline_logs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    setDeadlineLogs((data ?? []) as DeadlineLog[]);
  };

  useEffect(() => { fetchActions(); }, [projectId]);

  const addAction = async () => {
    if (!newActionTitle.trim()) return;
    const ordre = actions.length;
    const payload: any = {
      project_id: projectId,
      title: newActionTitle.trim(),
      ordre,
      statut: "planifiee",
      avancement: 0,
    };
    const { error } = await supabase.from("project_actions").insert(payload);
    if (error) {
      console.error("Insert action error:", error);
      toast.error("Erreur création action: " + error.message);
      return;
    }
    setNewActionTitle("");
    toast.success("Action ajoutée");
    fetchActions();
  };

  const addTask = async (actionId: string) => {
    const title = newTaskTitle[actionId]?.trim();
    if (!title) return;
    const action = actions.find(a => a.id === actionId);
    if (!action || !canEditAction(action) || action.statut === "terminee" || action.statut === "annulee") {
      toast.error("Lecture seule sur cette action");
      return;
    }
    const existing = tasksMap[actionId] ?? [];
    const payload: any = {
      action_id: actionId,
      title,
      ordre: existing.length,
      statut: "a_faire",
      avancement: 0,
      echeance: action?.echeance ?? null,
    };
    const { error } = await supabase.from("project_tasks").insert(payload);
    if (error) {
      console.error("Insert task error:", error);
      toast.error("Erreur création tâche: " + error.message);
      return;
    }
    setNewTaskTitle((p) => ({ ...p, [actionId]: "" }));
    toast.success("Tâche ajoutée");
    fetchActions();
  };

  const handleDateChange = (entityType: "action" | "task", entityId: string, entityTitle: string, oldDate: string | null, newDate: string) => {
    if (entityType === "action") {
      const action = getActionById(entityId);
      if (!action || !canEditAction(action) || action.statut === "terminee" || action.statut === "annulee") {
        toast.error("Lecture seule sur cette action");
        return;
      }
    } else {
      const { task, parent } = getTaskWithParent(entityId);
      if (!task || !parent || !canEditTask(task, parent) || parent.statut === "terminee" || parent.statut === "annulee" || task.statut === "termine") {
        toast.error("Lecture seule sur cette tâche");
        return;
      }
    }
    if (projectDeadline && newDate && isAfter(parseISO(newDate), parseISO(projectDeadline))) {
      toast.warning(`⚠️ Cette date dépasse la deadline du projet (${projectDeadline}).`, { duration: 5000 });
    }
    if (oldDate && oldDate !== newDate) {
      setDeadlineDialog({ open: true, entityType, entityId, entityTitle, oldDate, newDate });
      setDeadlineReason("");
    } else {
      if (entityType === "action") updateAction(entityId, { echeance: newDate || null });
      else updateTask(entityId, { echeance: newDate || null });
    }
  };

  const confirmDeadlineChange = async () => {
    if (!deadlineDialog) return;
    const { entityType, entityId, entityTitle, oldDate, newDate } = deadlineDialog;
    await supabase.from("project_deadline_logs").insert({
      entity_type: entityType, entity_id: entityId, entity_title: entityTitle,
      project_id: projectId, old_echeance: oldDate, new_echeance: newDate || null,
      changed_by: user?.id ?? null, reason: deadlineReason.trim() || null,
    });
    if (entityType === "action") await updateAction(entityId, { echeance: newDate || null });
    else await updateTask(entityId, { echeance: newDate || null });
    setDeadlineDialog(null);
    setDeadlineReason("");
    toast.success("Échéance modifiée et tracée");
  };

  const updateAction = async (id: string, updates: Record<string, any>) => {
    const action = getActionById(id);
    if (!action || !canEditAction(action) || action.statut === "terminee" || action.statut === "annulee") {
      toast.error("Lecture seule sur cette action");
      return;
    }
    const { error } = await supabase.from("project_actions").update(updates).eq("id", id);
    if (error) { toast.error(error.message); return; }
    fetchActions();
  };

  const deleteAction = async (id: string) => {
    const { error } = await supabase.from("project_actions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Action supprimée");
    fetchActions();
  };

  const updateTask = async (id: string, updates: Record<string, any>) => {
    const { task, parent } = getTaskWithParent(id);
    if (!task || !parent || !canEditTask(task, parent) || parent.statut === "terminee" || parent.statut === "annulee" || task.statut === "termine") {
      toast.error("Lecture seule sur cette tâche");
      return;
    }
    const { error } = await supabase.from("project_tasks").update(updates).eq("id", id);
    if (error) { toast.error(error.message); return; }
    fetchActions();
  };

  const deleteTask = async (id: string) => {
    // Find the action_id before deleting
    const actionId = Object.entries(tasksMap).find(([, tasks]) => tasks.some(t => t.id === id))?.[0];
    const { error } = await supabase.from("project_tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tâche supprimée");
    if (actionId) await recalcActionFromTasks(actionId);
    fetchActions();
  };

  /** Check if action is blocked by unfinished predecessors */
  const isBlockedByDeps = (actionId: string): boolean => {
    // Find deps where this action is the target and type is "before"
    const blocking = dependencies.filter(d => d.target_action_id === actionId && d.dependency_type === "before");
    // Find deps where this action is the source and type is "after"
    const afterBlocking = dependencies.filter(d => d.source_action_id === actionId && d.dependency_type === "after");
    const allBlockers = [
      ...blocking.map(d => d.source_action_id),
      ...afterBlocking.map(d => d.target_action_id),
    ];
    return allBlockers.some(bid => {
      const blocker = actions.find(a => a.id === bid);
      return blocker && blocker.statut !== "terminee";
    });
  };

  /** Handle status change with validation */
  const handleStatusChange = (action: ProjectAction, newStatut: string) => {
    if (!canEditAction(action) || action.statut === "terminee" || action.statut === "annulee") {
      toast.error("Lecture seule sur cette action");
      return;
    }
    // Blocked actions can't move to en_cours
    if (newStatut === "en_cours" && isBlockedByDeps(action.id)) {
      toast.error("Cette action est bloquée par une dépendance non terminée.", { duration: 5000 });
      return;
    }

    // If trying to set "terminee", apply controls
    if (newStatut === "terminee") {
      if (action.multi_tasks) {
        const tasks = tasksMap[action.id] ?? [];
        if (tasks.length < 2) {
          toast.error("Minimum 2 tâches requises pour clôturer une action multi-tâches.", { duration: 5000 });
          return;
        }
        const allDone = tasks.every(t => t.statut === "termine");
        if (!allDone) {
          toast.error("Toutes les tâches doivent être terminées avant de clôturer l'action.", { duration: 5000 });
          return;
        }
      }
      setConfirmCloseActionId(action.id);
      return;
    }

    if (newStatut === "en_cours" && !action.date_debut) {
      toast.warning("Pensez à définir une date de début pour cette action.", { duration: 4000 });
    }

    updateAction(action.id, { statut: newStatut });
  };

  /** Apply dependency automations when an action is completed */
  const applyDependencyAutomation = async (completedActionId: string) => {
    // 1. Unblock successors (before deps where this is source)
    const successors = dependencies.filter(d => d.source_action_id === completedActionId && d.dependency_type === "before");
    for (const dep of successors) {
      const target = actions.find(a => a.id === dep.target_action_id);
      if (target && (target.statut === "bloquee" || target.statut === "planifiee")) {
        // Check if ALL predecessors are done
        const allPredDeps = dependencies.filter(d => d.target_action_id === dep.target_action_id && d.dependency_type === "before");
        const allDone = allPredDeps.every(d => {
          const src = actions.find(a => a.id === d.source_action_id);
          return src?.id === completedActionId || src?.statut === "terminee";
        });
        if (allDone) {
          await supabase.from("project_actions").update({ statut: "planifiee" }).eq("id", dep.target_action_id);
          toast.info(`Action "${target.title}" débloquée automatiquement`);
        }
      }
    }

    // 2. Unblock "after" deps where this is target
    const afterDeps = dependencies.filter(d => d.target_action_id === completedActionId && d.dependency_type === "after");
    for (const dep of afterDeps) {
      const src = actions.find(a => a.id === dep.source_action_id);
      if (src && (src.statut === "bloquee" || src.statut === "planifiee")) {
        const allAfterDeps = dependencies.filter(d => d.source_action_id === dep.source_action_id && d.dependency_type === "after");
        const allDone = allAfterDeps.every(d => {
          const tgt = actions.find(a => a.id === d.target_action_id);
          return tgt?.id === completedActionId || tgt?.statut === "terminee";
        });
        if (allDone) {
          await supabase.from("project_actions").update({ statut: "planifiee" }).eq("id", dep.source_action_id);
          toast.info(`Action "${src.title}" débloquée automatiquement`);
        }
      }
    }

    // 3. Exclusive: cancel the other action
    const exclusiveDeps = dependencies.filter(d =>
      (d.source_action_id === completedActionId || d.target_action_id === completedActionId) && d.dependency_type === "exclusive"
    );
    for (const dep of exclusiveDeps) {
      const otherId = dep.source_action_id === completedActionId ? dep.target_action_id : dep.source_action_id;
      const other = actions.find(a => a.id === otherId);
      if (other && other.statut !== "terminee" && other.statut !== "annulee") {
        await supabase.from("project_actions").update({ statut: "annulee", avancement: 0 }).eq("id", otherId);
        toast.info(`Action "${other.title}" annulée (exclusive)`);
      }
    }
  };

  /** Confirm closing an action */
  const confirmCloseAction = async () => {
    if (!confirmCloseActionId) return;
    await updateAction(confirmCloseActionId, { statut: "terminee", avancement: 100 });
    await applyDependencyAutomation(confirmCloseActionId);
    setConfirmCloseActionId(null);
    toast.success("Action terminée et figée ✓", { duration: 4000 });
    fetchActions();
  };

  /** Reopen a closed action — only by the action responsible (or admin), with mandatory reason */
  const reopenAction = async (actionId: string, reason: string) => {
    const action = actions.find(a => a.id === actionId);
    if (!action) return;
    const newAvancement = action.multi_tasks
      ? Math.min(action.avancement, 99)
      : 50;
    const oldStatut = action.statut;
    const { error } = await supabase
      .from("project_actions")
      .update({ statut: "en_cours", avancement: newAvancement })
      .eq("id", actionId);
    if (error) { toast.error(error.message); return; }
    // Log reopening with reason in project history
    try {
      await supabase.from("project_action_history").insert({
        action_id: actionId,
        user_id: user?.id ?? null,
        field_name: "reouverture_action",
        old_value: oldStatut,
        new_value: `en_cours — Motif : ${reason.trim()}`,
        entity_type: "action",
      });
    } catch (e) { /* ignore */ }
    toast.info("Action rouverte — motif enregistré dans l'historique");
    fetchActions();
  };

  /** Toggle multi-tasks mode */
  const toggleMultiTasks = async (action: ProjectAction) => {
    if (!canEditAction(action) || action.statut === "terminee" || action.statut === "annulee") {
      toast.error("Lecture seule sur cette action");
      return;
    }
    if (action.multi_tasks) {
      const tasks = tasksMap[action.id] ?? [];
      if (tasks.length > 0) {
        setDisableMultiDialog(action.id);
        return;
      }
      await updateAction(action.id, { multi_tasks: false });
    } else {
      await supabase.from("project_actions").update({ multi_tasks: true, avancement: 0 }).eq("id", action.id);
      toast.success("Mode multi-tâches activé — ajoutez au moins 2 tâches");
      fetchActions();
    }
  };

  const confirmDisableMulti = async (actionId: string) => {
    await supabase.from("project_tasks").delete().eq("action_id", actionId);
    await updateAction(actionId, { multi_tasks: false, avancement: 0 });
    setDisableMultiDialog(null);
    toast.success("Mode multi-tâches désactivé, tâches supprimées");
  };

  /** Update avancement for simple action (no multi-tasks) */
  const handleSimpleAvancement = async (actionId: string, value: number) => {
    const action = getActionById(actionId);
    if (!action || !canEditAction(action) || action.statut === "terminee" || action.statut === "annulee") {
      toast.error("Lecture seule sur cette action");
      return;
    }
    if (value === 100) {
      // Instead of silently setting terminee, show confirmation
      if (action) {
        // Temporarily save progress, then ask to confirm close
        await supabase.from("project_actions").update({ avancement: value }).eq("id", actionId);
        setConfirmCloseActionId(actionId);
        fetchActions();
        return;
      }
    }
    const statut = value > 0 ? "en_cours" : "planifiee";
    await updateAction(actionId, { avancement: value, statut });
    toast.success("Avancement enregistré", { duration: 2000 });
  };

  /** Recalculate action avancement from tasks — uses normalized progress (status-aware) */
  const recalcActionFromTasks = async (actionId: string) => {
    const { data: freshTasks } = await supabase
      .from("project_tasks")
      .select("*")
      .eq("action_id", actionId);
    if (!freshTasks || freshTasks.length === 0) {
      await supabase.from("project_actions").update({ avancement: 0, statut: "planifiee" }).eq("id", actionId);
      fetchActions();
      return;
    }
    // Use centralized normalization: a "terminé" task always counts as 100%, "à faire" as 0%
    const avg = computeMultiTaskActionProgress(freshTasks as any);
    const statut = avg === 100 ? "terminee" : avg > 0 ? "en_cours" : "planifiee";
    // If all tasks done, don't auto-close — user must confirm. But persist the 100% avancement so UI is correct.
    if (statut === "terminee") {
      await supabase.from("project_actions").update({ avancement: avg }).eq("id", actionId);
      fetchActions();
      return;
    }
    await updateAction(actionId, { avancement: avg, statut });
  };

  if (!canReadDetail) {
    return <p className="text-sm text-muted-foreground py-4">Vous n'avez pas la permission de consulter les actions.</p>;
  }

  const isOverdue = (a: ProjectAction) => {
    if (!a.echeance || a.statut === "terminee") return false;
    return isBefore(parseISO(a.echeance), startOfDay(new Date()));
  };

  const isWithinDays = (dateStr: string | null, days: number) => {
    if (!dateStr) return false;
    const d = parseISO(dateStr);
    const today = startOfDay(new Date());
    return !isBefore(d, today) && isBefore(d, addDays(today, days + 1));
  };

  const getFilteredActions = () => {
    return actions
      .filter(a => {
        if (hideTerminees && a.statut === "terminee") return false;
        if (filterStatut !== "all" && filterStatut !== "en_retard" && a.statut !== filterStatut) return false;
        if (filterStatut === "en_retard" && !isOverdue(a)) return false;
        if (filterEcheance === "overdue" && !isOverdue(a)) return false;
        if (filterEcheance === "this_week" && !isWithinDays(a.echeance, 7)) return false;
        if (filterEcheance === "this_month" && !isWithinDays(a.echeance, 30)) return false;
        return true;
      })
      .sort((a, b) => {
        // Pinned first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Then by sortBy
        if (sortBy === "echeance") {
          if (!a.echeance && !b.echeance) return 0;
          if (!a.echeance) return 1;
          if (!b.echeance) return -1;
          return a.echeance.localeCompare(b.echeance);
        }
        if (sortBy === "created_at") return 0; // DB already ordered
        return a.ordre - b.ordre;
      });
  };

  // Stable sequential number per action, based on creation order (ascending).
  // Independent from current sort/filter so the badge never changes for a given action.
  const actionNumberById = useMemo(() => {
    const map: Record<string, number> = {};
    [...actions]
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .forEach((a, i) => { map[a.id] = i + 1; });
    return map;
  }, [actions]);

  const togglePin = async (action: ProjectAction) => {
    if (!canEditAction(action) || action.statut === "terminee" || action.statut === "annulee") {
      toast.error("Lecture seule sur cette action");
      return;
    }
    await updateAction(action.id, { pinned: !action.pinned });
    toast.success(action.pinned ? "Action désépinglée" : "Action épinglée comme prioritaire");
  };

  const DateIndicator = ({ echeance, statut }: { echeance: string | null; statut: string }) => {
    const ds = getDateStatus(echeance, projectDeadline, statut);
    if (ds.status === "ok" || !echeance) return null;
    const IconComp = ds.status === "overdue" ? ShieldAlert : ds.status === "exceeds" ? AlertTriangle : CalendarClock;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-1 ${ds.color}`}>
              <IconComp className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-52">
            <p>{ds.label}</p>
            {ds.status === "exceeds" && projectDeadline && (
              <p className="mt-0.5 opacity-75">Deadline projet : {projectDeadline}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Generic responsable selector (Function → User) — rendered inline (NOT as a child component)
  // to avoid remounting the underlying ActeurUserSelect on every parent render, which would
  // re-trigger its internal fetch effect and cause loops / "Failed to fetch" errors.
  type RespFields = {
    acteur: "responsable_id" | "responsable_id_2" | "responsable_id_3";
    user: "responsable_user_id" | "responsable_user_id_2" | "responsable_user_id_3";
  };
  const renderResponsable = (
    action: ProjectAction,
    fields: RespFields,
    label: string,
    onRemove?: () => void,
  ) => {
    const acteurId = (action[fields.acteur] as string | null) ?? "";
    const userId = (action[fields.user] as string | null) ?? "";
    // Considered "assigned" only when BOTH the function AND a specific user are set.
    // Otherwise the selector stays open so the user can pick a person when several
    // profiles share the function.
    const isAssigned = !!acteurId && !!userId;
    const canTransfer = (isResponsable || isAdmin) && isAssigned && action.statut !== "terminee";

    return (
      <div className="relative rounded-lg border border-border/50 bg-muted/20 p-2.5 pt-2 space-y-1.5 hover:border-border transition-colors">
        <div className="flex items-center justify-between gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            {label}
            {isAssigned && <Lock className="h-2.5 w-2.5 text-muted-foreground/70" />}
          </label>
          <div className="flex items-center gap-1">
            {canTransfer && (
              <button
                type="button"
                onClick={() => {
                  setTransferDialog({
                    actionId: action.id,
                    actionTitle: action.title,
                    fields,
                    label,
                    currentActeurId: acteurId || null,
                    currentUserId: userId || null,
                  });
                  setTransferActeurId(acteurId || "");
                  setTransferUserId(userId || "");
                  setTransferReason("");
                }}
                className="h-4 w-4 inline-flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title={`Transférer ${label}`}
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
            {onRemove && !isAssigned && (
              <button
                type="button"
                onClick={onRemove}
                className="h-4 w-4 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title={`Retirer ${label}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        {isAssigned ? (
          <div className="rounded-md bg-background/80 border border-border/40 px-2 py-1.5 text-xs">
            <div className="font-medium text-foreground">
              {respLabel(acteurId, userId) || "—"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {(isResponsable || isAdmin)
                ? "Figé — utilisez le transfert pour changer"
                : "Champ figé après création"}
            </div>
          </div>
        ) : (
          <ActeurUserSelect
            acteurValue={acteurId}
            userValue={userId}
            onActeurChange={(v) => updateAction(action.id, { [fields.acteur]: v || null, [fields.user]: null })}
            onUserChange={(v) => updateAction(action.id, { [fields.user]: v || null })}
            acteurs={acteurs}
            placeholder="Assigner"
          />
        )}
      </div>
    );
  };

  // Compact label combining function + real user name for read-only displays.
  // If the function has no clear name, falls back to just showing the user name.
  const respLabel = (acteurId: string | null, userId: string | null): string | null => {
    const userName = userId ? formatRespUserName(userId) : null;
    const acteur = acteurId ? acteurs.find((a) => a.id === acteurId) : null;
    const fonction = acteur ? (acteur.fonction || acteur.organisation || null) : null;
    if (fonction && userName) return `${fonction} — ${userName}`;
    if (fonction) return fonction;
    if (userName) return userName;
    if (acteurId) return "Acteur";
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Project deadline banner */}
      {projectDeadline && (
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Deadline du projet :</span>
            <span className="text-muted-foreground">{projectDeadline}</span>
            {(() => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const dl = parseISO(projectDeadline);
              const daysLeft = differenceInDays(dl, today);
              if (daysLeft < 0) return <Badge className="bg-destructive/15 text-destructive text-[10px] ml-1">En retard de {Math.abs(daysLeft)}j</Badge>;
              if (daysLeft <= 7) return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] ml-1">{daysLeft}j restants</Badge>;
              return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] ml-1">{daysLeft}j restants</Badge>;
            })()}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setProjectHistoryOpen(true)} title="Historique complet du projet (actions + tâches)">
              <History className="h-3.5 w-3.5" />
              Historique du projet
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => { fetchDeadlineLogs(); setLogsOpen(true); }}>
              <CalendarClock className="h-3.5 w-3.5" />
              Échéances
            </Button>
          </div>
        </div>
      )}

      {!projectDeadline && actions.length > 0 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setProjectHistoryOpen(true)}>
            <History className="h-3.5 w-3.5" />
            Historique du projet
          </Button>
        </div>
      )}

      {/* Filter bar — desktop ≥sm */}
      {actions.length > 0 && (
        <div className="hidden sm:flex flex-wrap items-center gap-2 rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="h-7 w-[120px] text-[11px] border-border/40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="planifiee">📋 Planifiée</SelectItem>
              <SelectItem value="en_cours">🔄 En cours</SelectItem>
              <SelectItem value="terminee">✅ Terminée</SelectItem>
              <SelectItem value="en_retard">⚠️ En retard</SelectItem>
              <SelectItem value="bloquee">🔒 Bloquée</SelectItem>
              <SelectItem value="annulee">🚫 Annulée</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterEcheance} onValueChange={setFilterEcheance}>
            <SelectTrigger className="h-7 w-[130px] text-[11px] border-border/40">
              <SelectValue placeholder="Échéance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes dates</SelectItem>
              <SelectItem value="overdue">🔴 En retard</SelectItem>
              <SelectItem value="this_week">📅 Cette semaine</SelectItem>
              <SelectItem value="this_month">📆 Ce mois</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-7 w-[120px] text-[11px] border-border/40">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Tri" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ordre">Ordre manuel</SelectItem>
              <SelectItem value="echeance">Échéance</SelectItem>
              <SelectItem value="created_at">Date création</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={hideTerminees ? "default" : "outline"}
            size="sm"
            className="h-7 text-[11px] gap-1 px-2.5"
            onClick={() => setHideTerminees(!hideTerminees)}
          >
            {hideTerminees ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {hideTerminees ? "Terminées masquées" : "Masquer terminées"}
          </Button>

          {/* Active filter count */}
          {(() => {
            const filteredActions = getFilteredActions();
            const hasFilters = filterStatut !== "all" || filterEcheance !== "all" || hideTerminees;
            if (!hasFilters) return null;
            return (
              <Badge variant="outline" className="text-[10px] h-5 ml-auto">
                {filteredActions.length}/{actions.length} actions
              </Badge>
            );
          })()}
        </div>
      )}

      {/* Filter bar — mobile <sm */}
      {actions.length > 0 && (
        <div className="sm:hidden flex items-center gap-2 rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
          <FilterDrawer
            activeCount={
              (filterStatut !== "all" ? 1 : 0) +
              (filterEcheance !== "all" ? 1 : 0) +
              (sortBy !== "ordre" ? 1 : 0) +
              (hideTerminees ? 1 : 0)
            }
            onReset={() => {
              setFilterStatut("all");
              setFilterEcheance("all");
              setSortBy("ordre");
              setHideTerminees(false);
            }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Statut</label>
              <Select value={filterStatut} onValueChange={setFilterStatut}>
                <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="planifiee">📋 Planifiée</SelectItem>
                  <SelectItem value="en_cours">🔄 En cours</SelectItem>
                  <SelectItem value="terminee">✅ Terminée</SelectItem>
                  <SelectItem value="en_retard">⚠️ En retard</SelectItem>
                  <SelectItem value="bloquee">🔒 Bloquée</SelectItem>
                  <SelectItem value="annulee">🚫 Annulée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Échéance</label>
              <Select value={filterEcheance} onValueChange={setFilterEcheance}>
                <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes dates</SelectItem>
                  <SelectItem value="overdue">🔴 En retard</SelectItem>
                  <SelectItem value="this_week">📅 Cette semaine</SelectItem>
                  <SelectItem value="this_month">📆 Ce mois</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Trier par</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ordre">Ordre manuel</SelectItem>
                  <SelectItem value="echeance">Échéance</SelectItem>
                  <SelectItem value="created_at">Date création</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={hideTerminees ? "default" : "outline"}
              className="w-full h-11"
              onClick={() => setHideTerminees(!hideTerminees)}
            >
              {hideTerminees ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {hideTerminees ? "Terminées masquées" : "Masquer terminées"}
            </Button>
          </FilterDrawer>
          {(() => {
            const filteredActions = getFilteredActions();
            return (
              <Badge variant="outline" className="text-[10px] h-5 ml-auto">
                {filteredActions.length}/{actions.length} actions
              </Badge>
            );
          })()}
        </div>
      )}

      {getFilteredActions().map((action) => {
        const tasks = tasksMap[action.id] ?? [];
        const isOpen = expanded === action.id;
        const st = ACTION_STATUS[action.statut] ?? ACTION_STATUS.planifiee;
        const actionDateStatus = getDateStatus(action.echeance, projectDeadline, action.statut);
        const hasResp2 = showResp2.has(action.id) || !!action.responsable_id_2;
        const hasResp3 = showResp3.has(action.id) || !!action.responsable_id_3;
        const isFrozen = action.statut === "terminee";
        const isBlocked = action.statut === "bloquee" || isBlockedByDeps(action.id);
        const isCancelled = action.statut === "annulee";
        const actionEditable = canEditAction(action);
        const mineBadge = restrictedWrite && !canEdit && actionEditable;

        const StatusIcon = st.icon ?? Circle;
        const stripeColor = action.pinned ? "bg-primary" : st.stripe;
        const progressBarClass = action.avancement >= 100
          ? "[&>div]:bg-emerald-500"
          : actionDateStatus.status === "overdue"
            ? "[&>div]:bg-destructive"
            : actionDateStatus.status === "urgent" || actionDateStatus.status === "exceeds"
              ? "[&>div]:bg-amber-500"
              : st.bar;

        return (
          <Collapsible key={action.id} open={isOpen} onOpenChange={() => setExpanded(isOpen ? null : action.id)}>
            <div className={`relative border rounded-xl overflow-hidden bg-card transition-all hover:shadow-md ${
              action.pinned ? "border-primary/40" :
              isFrozen ? "border-emerald-500/40" :
              isBlocked ? "border-slate-400/40" :
              isCancelled ? "border-muted/40 opacity-70" :
              actionDateStatus.status === "overdue" ? "border-destructive/40" :
              actionDateStatus.status === "exceeds" ? "border-orange-400/40" :
              actionDateStatus.status === "urgent" ? "border-amber-400/40" :
              "border-border/40"
            }`} style={{ boxShadow: "var(--shadow-sm)" }}>
              {/* Colored left stripe by status */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripeColor}`} />

              <CollapsibleTrigger className="w-full">
                <div className="flex items-center gap-3 pl-4 pr-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

                  {/* Status icon medallion */}
                  <div className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${st.class} border`}>
                    <StatusIcon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="shrink-0 h-5 px-1.5 text-[10px] font-mono font-semibold tabular-nums bg-primary/5 text-primary border-primary/30"
                        title="Numéro d'action (ordre de création)"
                      >
                        #{String(actionNumberById[action.id] ?? 0).padStart(3, "0")}
                      </Badge>
                      <p className={`font-semibold text-sm line-clamp-1 ${isFrozen ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>{action.title}</p>
                      {action.multi_tasks && (
                        <Badge variant="outline" className="text-[9px] gap-1 h-4 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30">
                          <ListTodo className="h-2.5 w-2.5" /> {tasks.length} tâche{tasks.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {action.pinned && (
                        <Badge className="bg-primary/15 text-primary border border-primary/30 text-[9px] gap-1 h-4">
                          <Pin className="h-2.5 w-2.5" /> Prioritaire
                        </Badge>
                      )}
                      {isFrozen && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[9px] gap-1 h-4">
                          <Lock className="h-2.5 w-2.5" /> Figée
                        </Badge>
                      )}
                      {isBlocked && !isFrozen && (
                        <Badge className="bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30 text-[9px] gap-1 h-4">
                          <Ban className="h-2.5 w-2.5" /> Bloquée
                        </Badge>
                      )}
                      {isCancelled && (
                        <Badge className="bg-muted text-muted-foreground border text-[9px] gap-1 h-4 line-through">
                          Annulée
                        </Badge>
                      )}
                      {restrictedWrite && !canEdit && (
                        actionEditable ? (
                          <Badge className="bg-primary/10 text-primary border border-primary/30 text-[9px] gap-1 h-4" title="Vous êtes responsable : modification autorisée">
                            <Pencil className="h-2.5 w-2.5" /> Mes actions
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] gap-1 h-4 text-muted-foreground" title="Lecture seule : vous n'êtes pas responsable de cette action">
                            <Lock className="h-2.5 w-2.5" /> Lecture seule
                          </Badge>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-muted-foreground flex-wrap">
                      {action.echeance && (
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${
                          actionDateStatus.status === "overdue" ? "bg-destructive/10 text-destructive" :
                          actionDateStatus.status === "urgent" || actionDateStatus.status === "exceeds" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                          actionDateStatus.status === "warning" ? "bg-amber-500/5 text-amber-600 dark:text-amber-400" :
                          "bg-muted/40"
                        }`}>
                          <CalendarClock className="h-3 w-3" />
                          {action.echeance}
                          <DateIndicator echeance={action.echeance} statut={action.statut} />
                        </span>
                      )}
                      {(() => {
                        const r1 = respLabel(action.responsable_id, action.responsable_user_id);
                        const r2 = respLabel(action.responsable_id_2, action.responsable_user_id_2);
                        const r3 = respLabel(action.responsable_id_3, action.responsable_user_id_3);
                        const resps = [r1, r2, r3].filter(Boolean);
                        if (resps.length === 0) return null;
                        return (
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-1.5 py-0.5">
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-[260px]">{resps.join(" · ")}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Progress with colored bar + value chip */}
                    <div className="hidden sm:flex items-center gap-1.5 w-28">
                      <Progress value={action.avancement} className={`h-2 flex-1 ${progressBarClass}`} />
                      <span className={`text-[11px] font-bold tabular-nums w-8 text-right ${
                        action.avancement >= 100 ? "text-emerald-600 dark:text-emerald-400" :
                        action.avancement >= 50 ? "text-primary" :
                        "text-muted-foreground"
                      }`}>{action.avancement}%</span>
                    </div>
                    {actionEditable && !isFrozen && !isCancelled && (
                      <button
                        className={`shrink-0 p-1 rounded transition-colors ${action.pinned ? "text-primary hover:text-primary/70" : "text-muted-foreground/40 hover:text-primary"}`}
                        onClick={(e) => { e.stopPropagation(); togglePin(action); }}
                        title={action.pinned ? "Détacher" : "Épingler"}
                      >
                        {action.pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <Badge className={`${st.class} border text-[10px] font-medium`}>{st.label}</Badge>
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="border-t border-border/30 px-4 py-3 space-y-3 bg-muted/5">

                  {/* Frozen banner */}
                  {isFrozen && (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
                      <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Action terminée — figée</span>
                      </div>
                      {(() => {
                        const isActionResp = !!user && (
                          action.responsable_user_id === user.id ||
                          action.responsable_user_id_2 === user.id ||
                          action.responsable_user_id_3 === user.id
                        );
                        if (!(isActionResp || isAdmin)) return null;
                        return (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => { setReopenActionId(action.id); setReopenReason(""); }}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Rouvrir
                          </Button>
                        );
                      })()}
                    </div>
                  )}

                  {/* Entity links */}
                  <ProjectActionLinks actionId={action.id} canEdit={actionEditable && !isFrozen && !isCancelled} />

                  {/* Dependencies */}
                  <ProjectActionDependencies
                    projectId={projectId}
                    actionId={action.id}
                    actionTitle={action.title}
                    allActions={actions.map(a => ({ id: a.id, title: a.title, statut: a.statut, code: `A-${String(actionNumberById[a.id] ?? 0).padStart(3, "0")}` }))}
                    dependencies={dependencies}
                    onChanged={fetchActions}
                    canEdit={actionEditable && !isFrozen && !isCancelled}
                  />

                  {/* Action inline edit — disabled if frozen */}
                  {actionEditable && !isFrozen && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground">Statut</label>
                          <Select value={action.statut} onValueChange={(v) => handleStatusChange(action, v)}>
                            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(ACTION_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                            Échéance
                            <DateIndicator echeance={action.echeance} statut={action.statut} />
                          </label>
                          <Input
                            type="date"
                            className={`h-8 w-36 text-xs ${actionDateStatus.status !== "ok" ? "border-orange-400/60" : ""}`}
                            value={action.echeance ?? ""}
                            max={projectDeadline ?? undefined}
                            onChange={(e) => handleDateChange("action", action.id, action.title, action.echeance, e.target.value)}
                          />
                        </div>

                        {/* Multi-tâches toggle */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                            <ListTodo className="h-3 w-3" /> Multi-tâches
                          </label>
                          <div className="flex items-center gap-2 h-8">
                            <Switch
                              checked={action.multi_tasks}
                              onCheckedChange={() => toggleMultiTasks(action)}
                              disabled={!actionEditable || isFrozen || isCancelled}
                            />
                            <span className="text-[10px] text-muted-foreground">{action.multi_tasks ? "Activé" : "Désactivé"}</span>
                          </div>
                        </div>

                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive ml-auto">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Supprimer cette action ?</AlertDialogTitle>
                                <AlertDialogDescription>L'action et toutes ses tâches seront supprimées.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteAction(action.id)} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>

                      {/* Responsables — grid alignée pour éviter que la croissance d'une colonne décale les autres */}
                      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-start">
                        {renderResponsable(action, { acteur: "responsable_id", user: "responsable_user_id" }, "Responsable 1")}

                        {hasResp2 ? (
                          renderResponsable(
                            action,
                            { acteur: "responsable_id_2", user: "responsable_user_id_2" },
                            "Responsable 2",
                            () => {
                              updateAction(action.id, { responsable_id_2: null, responsable_user_id_2: null });
                              setShowResp2(prev => { const n = new Set(prev); n.delete(action.id); return n; });
                            },
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowResp2(prev => new Set([...prev, action.id]))}
                            disabled={!actionEditable || isFrozen || isCancelled}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 bg-transparent px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors min-h-[64px]"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Ajouter Responsable 2
                          </button>
                        )}

                        {hasResp2 && (hasResp3 ? (
                          renderResponsable(
                            action,
                            { acteur: "responsable_id_3", user: "responsable_user_id_3" },
                            "Responsable 3",
                            () => {
                              updateAction(action.id, { responsable_id_3: null, responsable_user_id_3: null });
                              setShowResp3(prev => { const n = new Set(prev); n.delete(action.id); return n; });
                            },
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowResp3(prev => new Set([...prev, action.id]))}
                            disabled={!actionEditable || isFrozen || isCancelled}
                            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 bg-transparent px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors min-h-[64px]"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Ajouter Responsable 3
                          </button>
                        ))}
                      </div>

                      {/* Weight (poids) input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Poids dans le projet (%)</label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            className="h-8 w-24 text-xs"
                            placeholder="Auto"
                            value={action.poids ?? ""}
                            disabled={!actionEditable || isFrozen || isCancelled}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                              if (val !== null) {
                                const otherFixed = actions.filter(a => a.id !== action.id && a.poids != null).reduce((s, a) => s + (a.poids ?? 0), 0);
                                if (otherFixed + val > 100) {
                                  toast.error(`La somme des poids ne peut pas dépasser 100% (déjà ${otherFixed}% attribués)`);
                                  return;
                                }
                              }
                              updateAction(action.id, { poids: val });
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {action.poids != null ? `${action.poids}% (fixe)` : (() => {
                              const totalFixed = actions.reduce((s, a) => s + (a.poids ?? 0), 0);
                              const autoCount = actions.filter(a => a.poids == null).length;
                              const autoW = autoCount > 0 ? Math.round((100 - totalFixed) / autoCount * 10) / 10 : 0;
                              return `≈ ${autoW}% (auto)`;
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Simple mode: avancement slider */}
                      {!action.multi_tasks && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-medium text-muted-foreground">Avancement : {action.avancement}%</label>
                          <div className="flex items-center gap-3 max-w-sm">
                            <Slider
                              value={[action.avancement]}
                              max={100}
                              step={5}
                              disabled={!actionEditable || isFrozen || isCancelled}
                              onValueCommit={(v) => handleSimpleAvancement(action.id, v[0])}
                              className="flex-1"
                            />
                            <span className="text-xs font-semibold text-primary w-10 text-right">{action.avancement}%</span>
                          </div>
                        </div>
                      )}

                      {/* Multi-tasks mode: calculated avancement (read-only) */}
                      {action.multi_tasks && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <ListTodo className="h-3.5 w-3.5 text-primary" />
                          <span>Avancement calculé automatiquement depuis les tâches : <span className="font-semibold text-foreground">{action.avancement}%</span></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tasks — only shown in multi-tasks mode */}
                  {action.multi_tasks && (
                    <>
                       <div className="space-y-1.5">
                        {[...tasks].sort((a, b) => {
                          if (!a.echeance && !b.echeance) return 0;
                          if (!a.echeance) return 1;
                          if (!b.echeance) return -1;
                          return a.echeance.localeCompare(b.echeance);
                        }).map((task) => {
                          const ts = TASK_STATUS[task.statut] ?? TASK_STATUS.a_faire;
                          const TaskIcon = ts.icon;
                          const taskDateStatus = getDateStatus(task.echeance, projectDeadline, task.statut);
                          const taskFrozen = isFrozen || task.statut === "termine";
                          const taskEditable = canEditTask(task, action);
                          return (
                            <div key={task.id} className={`flex items-center gap-2 rounded-lg border bg-background px-3 py-2 group ${
                              taskFrozen && task.statut === "termine" ? "border-emerald-500/20 bg-emerald-50/5" :
                              taskDateStatus.status === "overdue" ? "border-destructive/30" :
                              taskDateStatus.status === "exceeds" ? "border-orange-400/30" :
                              "border-border/30"
                            }`}>
                              {taskEditable && !isFrozen ? (
                                task.statut === "termine" ? (
                                  // Terminated task — icon click reopens it
                                  <button
                                    className={`shrink-0 ${ts.class}`}
                                    onClick={async () => {
                                      await updateTask(task.id, { statut: "en_cours", avancement: 50 });
                                      await recalcActionFromTasks(action.id);
                                    }}
                                  >
                                    <TaskIcon className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <button
                                    className={`shrink-0 ${ts.class}`}
                                    onClick={async () => {
                                      const next = task.statut === "a_faire" ? "en_cours" : "termine";
                                      const av = next === "termine" ? 100 : 50;
                                      await updateTask(task.id, { statut: next, avancement: av });
                                      await recalcActionFromTasks(action.id);
                                    }}
                                  >
                                    <TaskIcon className="h-4 w-4" />
                                  </button>
                                )
                              ) : (
                                <TaskIcon className={`h-4 w-4 shrink-0 ${ts.class}`} />
                              )}
                              <span className={`text-sm flex-1 ${task.statut === "termine" ? "text-muted-foreground" : ""}`}>
                                {task.title}
                              </span>
                              {taskEditable && !isFrozen && task.statut !== "termine" && (
                                <TaskRespCompact
                                  acteurId={task.responsable_id}
                                  userId={task.responsable_user_id}
                                  acteurs={acteurs}
                                  onChange={(acteurId, userId) => updateTask(task.id, { responsable_id: acteurId, responsable_user_id: userId })}
                                />
                              )}
                              {(!taskEditable || isFrozen || task.statut === "termine") && task.responsable_id && (() => {
                                const userName = task.responsable_user_id ? formatRespUserName(task.responsable_user_id) : null;
                                const fonction = getActeurLabel(task.responsable_id);
                                const display = userName || fonction;
                                const tooltip = userName && fonction ? `${userName} — ${fonction}` : (userName || fonction || "");
                                return (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground max-w-[140px]" title={tooltip}>
                                    <User className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{display}</span>
                                  </span>
                                );
                              })()}
                              {taskEditable && !isFrozen && task.statut !== "termine" ? (
                                <Input
                                  type="date"
                                  className={`h-6 w-28 text-[10px] border-dashed ${taskDateStatus.status !== "ok" ? "border-orange-400/60" : ""}`}
                                  value={task.echeance ?? ""}
                                  max={projectDeadline ?? undefined}
                                  onChange={(e) => handleDateChange("task", task.id, task.title, task.echeance, e.target.value)}
                                />
                              ) : (
                                task.echeance && <span className="text-[10px] text-muted-foreground">{task.echeance}</span>
                              )}
                              <DateIndicator echeance={task.echeance} statut={task.statut} />
                              <span className="text-[10px] text-muted-foreground w-8 text-right">{task.avancement}%</span>
                              {canDelete && !isFrozen && task.statut !== "termine" && (
                                <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Warning if less than 2 tasks */}
                      {tasks.length < 2 && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md px-3 py-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Minimum 2 tâches requises pour valider cette action multi-tâches ({tasks.length}/2)</span>
                        </div>
                      )}

                      {/* Add task — visible si l'utilisateur peut éditer l'action (complet OU restricted sur sa propre action) */}
                      {actionEditable && !isFrozen && (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Nouvelle tâche..."
                            value={newTaskTitle[action.id] ?? ""}
                            onChange={(e) => setNewTaskTitle((p) => ({ ...p, [action.id]: e.target.value }))}
                            className="h-8 text-xs"
                            onKeyDown={(e) => e.key === "Enter" && addTask(action.id)}
                          />
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addTask(action.id)}>
                            <Plus className="h-3 w-3 mr-1" />Tâche
                          </Button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Comments / Notes */}
                  <div className="pt-2 border-t border-border/20">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        onClick={() => setNotesOpen(notesOpen === action.id ? null : action.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Commentaires
                      </button>
                      {(isResponsable || isAdmin) && (
                        <button
                          onClick={() => { setHistoryActionId(action.id); setHistoryActionTitle(action.title); }}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <History className="h-3.5 w-3.5" />
                          Historique
                        </button>
                      )}
                    </div>
                    {notesOpen === action.id && (
                      <div className="mt-2">
                        <ProjectActionComments actionId={action.id} canComment={canComment} isAdmin={isAdmin} projectId={projectId} projectResponsableUserId={isResponsable ? user?.id : undefined} actionResponsableUserId={action.responsable_user_id} canEdit={actionEditable} />
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

      {/* Add action */}
      {canEdit && (
        <div className="flex gap-2">
          <Input
            placeholder="Nouvelle action..."
            value={newActionTitle}
            onChange={(e) => setNewActionTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAction()}
          />
          <Button onClick={addAction}>
            <Plus className="h-4 w-4 mr-1" />Action
          </Button>
        </div>
      )}

      {/* Confirm close action dialog */}
      <AlertDialog open={!!confirmCloseActionId} onOpenChange={(o) => !o && setConfirmCloseActionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Confirmer la clôture de l'action
            </AlertDialogTitle>
            <AlertDialogDescription>
              Une fois terminée, l'action sera <span className="font-semibold">figée</span> : statut, responsables, échéances et tâches ne seront plus modifiables. Seul un utilisateur autorisé pourra la rouvrir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCloseAction} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Terminer et figer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen action dialog (with mandatory reason) */}
      <Dialog open={!!reopenActionId} onOpenChange={(o) => { if (!o) { setReopenActionId(null); setReopenReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Rouvrir l'action
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Seul le responsable de l'action peut la rouvrir. Le motif sera enregistré dans l'historique du projet.
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Motif de réouverture <span className="text-destructive">*</span></label>
              <Textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Expliquez pourquoi cette action doit être rouverte..."
                rows={4}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setReopenActionId(null); setReopenReason(""); }}>Annuler</Button>
              <Button
                size="sm"
                disabled={!reopenReason.trim()}
                onClick={async () => {
                  if (!reopenActionId || !reopenReason.trim()) return;
                  await reopenAction(reopenActionId, reopenReason.trim());
                  setReopenActionId(null);
                  setReopenReason("");
                }}
              >
                Confirmer la réouverture
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deadline change confirmation dialog */}
      <Dialog open={!!deadlineDialog?.open} onOpenChange={(o) => !o && setDeadlineDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Modification d'échéance
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/30 p-3 space-y-2">
              <p className="text-sm font-medium">{deadlineDialog?.entityTitle}</p>
              <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Ancienne :</span>
                  <Badge variant="outline" className="text-xs">{deadlineDialog?.oldDate ?? "Non définie"}</Badge>
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Nouvelle :</span>
                  <Badge className="bg-primary/15 text-primary text-xs">{deadlineDialog?.newDate || "Retirée"}</Badge>
                </div>
              </div>
              {deadlineDialog?.newDate && projectDeadline && isAfter(parseISO(deadlineDialog.newDate), parseISO(projectDeadline)) && (
                <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Cette date dépasse la deadline du projet ({projectDeadline})
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Motif du changement</label>
              <Textarea
                value={deadlineReason}
                onChange={(e) => setDeadlineReason(e.target.value)}
                placeholder="Pourquoi cette modification ? (optionnel)"
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeadlineDialog(null)}>Annuler</Button>
              <Button onClick={confirmDeadlineChange}>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              deadlineLogs.map((log) => (
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

      {/* Transfer responsibility dialog */}
      <Dialog open={!!transferDialog} onOpenChange={(o) => !o && setTransferDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Transfert de responsabilité
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">Action</p>
              <p className="text-sm font-medium">{transferDialog?.actionTitle}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{transferDialog?.label} actuel(le) :</p>
              <p className="text-xs font-medium text-foreground">
                {respLabel(transferDialog?.currentActeurId ?? null, transferDialog?.currentUserId ?? null) || "—"}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nouveau responsable</label>
              <ActeurUserSelect
                acteurValue={transferActeurId}
                userValue={transferUserId}
                onActeurChange={(v) => { setTransferActeurId(v); setTransferUserId(""); }}
                onUserChange={(v) => setTransferUserId(v)}
                acteurs={acteurs}
                placeholder="Sélectionner"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Motif du transfert (optionnel)</label>
              <Textarea
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Raison du changement de responsable..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setTransferDialog(null)}>Annuler</Button>
              <Button
                size="sm"
                disabled={!transferActeurId || transferActeurId === (transferDialog?.currentActeurId ?? "") && transferUserId === (transferDialog?.currentUserId ?? "")}
                onClick={async () => {
                  if (!transferDialog) return;
                  const updates: Record<string, any> = {
                    [transferDialog.fields.acteur]: transferActeurId || null,
                    [transferDialog.fields.user]: transferUserId || null,
                  };
                  await updateAction(transferDialog.actionId, updates);
                  // Log via project_action_history (optional reason in field)
                  try {
                    await supabase.from("project_action_history").insert({
                      action_id: transferDialog.actionId,
                      user_id: user?.id ?? null,
                      field_name: `transfert_${transferDialog.fields.acteur}`,
                      old_value: respLabel(transferDialog.currentActeurId, transferDialog.currentUserId) ?? "—",
                      new_value: (respLabel(transferActeurId || null, transferUserId || null) ?? "—") + (transferReason.trim() ? ` — Motif : ${transferReason.trim()}` : ""),
                    });
                  } catch (e) { /* ignore */ }
                  toast.success("Responsabilité transférée");
                  setTransferDialog(null);
                }}
              >
                Confirmer le transfert
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm disable multi-tasks dialog */}
      <AlertDialog open={!!disableMultiDialog} onOpenChange={(o) => !o && setDisableMultiDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désactiver le mode multi-tâches ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les tâches existantes de cette action seront supprimées. L'avancement sera remis à 0.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => disableMultiDialog && confirmDisableMulti(disableMultiDialog)} className="bg-destructive text-destructive-foreground">
              Désactiver et supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Action history dialog (per-action) */}
      <ProjectHistoryDialog
        open={!!historyActionId}
        onOpenChange={(o) => !o && setHistoryActionId(null)}
        projectId={projectId}
        projectTitle={projectTitle}
        initialActionId={historyActionId}
      />

      {/* Project-wide history dialog */}
      <ProjectHistoryDialog
        open={projectHistoryOpen}
        onOpenChange={setProjectHistoryOpen}
        projectId={projectId}
        projectTitle={projectTitle}
      />
    </div>
  );
}
