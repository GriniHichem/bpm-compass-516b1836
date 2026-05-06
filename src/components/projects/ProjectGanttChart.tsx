import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChevronDown, ChevronRight, Lock, Ban, Calendar, User, Target, X, Weight, MessageSquare, Link2, ArrowUp, ArrowDown, GitBranch, Zap } from "lucide-react";
import { ProjectActionComments } from "./ProjectActionComments";
import { supabase } from "@/integrations/supabase/client";

interface GanttItem {
  id: string;
  title: string;
  date_debut: string | null;
  echeance: string | null;
  statut: string;
  avancement: number;
  responsable?: string | null;
  level: "project" | "action" | "task";
  poids?: number | null;
  created_at?: string | null;
  children?: GanttItem[];
}

interface Props {
  items: GanttItem[];
  fullscreen?: boolean;
  canComment?: boolean;
  isAdmin?: boolean;
  projectId?: string;
  projectResponsableUserId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  brouillon: "bg-slate-400",
  en_cours: "bg-gradient-to-r from-primary to-primary/80",
  planifiee: "bg-gradient-to-r from-slate-400 to-slate-500",
  terminee: "bg-gradient-to-r from-emerald-500 to-emerald-600",
  termine: "bg-gradient-to-r from-emerald-500 to-emerald-600",
  a_faire: "bg-slate-400",
  en_retard: "bg-gradient-to-r from-destructive to-red-600",
  archive: "bg-secondary",
  bloquee: "bg-gradient-to-r from-slate-500 to-slate-600",
  annulee: "bg-muted-foreground/30",
};

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  brouillon: { label: "Brouillon", class: "bg-muted text-muted-foreground" },
  planifiee: { label: "Planifiée", class: "bg-muted text-muted-foreground" },
  en_cours: { label: "En cours", class: "bg-primary/15 text-primary" },
  terminee: { label: "Terminée", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  termine: { label: "Terminé", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  a_faire: { label: "À faire", class: "bg-muted text-muted-foreground" },
  en_retard: { label: "En retard", class: "bg-destructive/15 text-destructive" },
  archive: { label: "Archivé", class: "bg-secondary text-secondary-foreground" },
  bloquee: { label: "Bloquée", class: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
  annulee: { label: "Annulée", class: "bg-muted/50 text-muted-foreground" },
};

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a: Date, b: Date) { return Math.ceil((b.getTime() - a.getTime()) / 86400000); }

const DEP_TYPES: Record<string, { label: string; icon: typeof ArrowUp; color: string }> = {
  before: { label: "Avant", icon: ArrowUp, color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  after: { label: "Après", icon: ArrowDown, color: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  parallel: { label: "Parallèle", icon: GitBranch, color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  exclusive: { label: "Exclusive", icon: Zap, color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
};

export function ProjectGanttChart({ items, fullscreen, canComment, isAdmin, projectId, projectResponsableUserId }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [focusedItem, setFocusedItem] = useState<GanttItem | null>(null);
  const [dependencies, setDependencies] = useState<Array<{ id: string; source_action_id: string; target_action_id: string; dependency_type: string }>>([]);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase
        .from("project_action_dependencies" as any)
        .select("id, source_action_id, target_action_id, dependency_type")
        .eq("project_id", projectId);
      if (data) setDependencies(data as any);
    })();
  }, [projectId]);

  const { startDate, endDate, totalDays, months } = useMemo(() => {
    let minD = new Date();
    let maxD = addDays(new Date(), 30);
    const scan = (list: GanttItem[]) => {
      list.forEach((item) => {
        if (item.date_debut) { const d = new Date(item.date_debut); if (d < minD) minD = d; }
        if (item.echeance) { const d = new Date(item.echeance); if (d > maxD) maxD = d; }
        if (item.children) scan(item.children);
      });
    };
    scan(items);
    const start = addDays(minD, -3);
    const end = addDays(maxD, 7);
    const total = diffDays(start, end);
    const ms: { label: string; start: number; width: number }[] = [];
    let cur = new Date(start);
    while (cur < end) {
      const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const mStart = Math.max(0, diffDays(start, cur));
      const mEnd = Math.min(total, diffDays(start, monthEnd));
      ms.push({ label: cur.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), start: mStart, width: mEnd - mStart });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return { startDate: start, endDate: end, totalDays: total, months: ms };
  }, [items]);

  const todayOffset = diffDays(startDate, new Date());

  // Stable per-action sequential number based on creation order (project-wide).
  const actionNumberById = useMemo(() => {
    const allActions: GanttItem[] = [];
    const collect = (list: GanttItem[]) => {
      list.forEach((it) => {
        if (it.level === "action") allActions.push(it);
        if (it.children) collect(it.children);
      });
    };
    collect(items);
    const map: Record<string, number> = {};
    [...allActions]
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .forEach((a, i) => { map[a.id] = i + 1; });
    return map;
  }, [items]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleRowClick = (item: GanttItem) => {
    setFocusedItem(prev => prev?.id === item.id ? null : item);
  };

  const renderRows = (list: GanttItem[], depth: number = 0): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    list.forEach((item, idx) => {
      // Tasks are NOT rendered as Gantt rows — they live in the side panel of their parent action.
      if (item.level === "task") return;

      // For the chart, only consider non-task children (i.e. project → actions).
      const visibleChildren = (item.children ?? []).filter((c) => c.level !== "task");
      const hasVisibleChildren = visibleChildren.length > 0;
      const taskCount = (item.children ?? []).filter((c) => c.level === "task").length;

      const isCollapsed = collapsed.has(item.id);
      const isFocused = focusedItem?.id === item.id;
      const start = item.date_debut ? diffDays(startDate, new Date(item.date_debut)) : null;
      const end = item.echeance ? diffDays(startDate, new Date(item.echeance)) : null;
      const barStart = start ?? todayOffset;
      const barEnd = end ?? barStart + 7;
      const barColor = STATUS_COLORS[item.statut] ?? "bg-primary";
      const isOverdue = item.echeance && new Date(item.echeance) < new Date() && item.avancement < 100;
      const isEvenRow = idx % 2 === 0;

      rows.push(
        <div
          key={item.id}
          className={`flex border-b border-border/15 transition-all min-h-[42px] cursor-pointer ${
            isFocused
              ? "bg-primary/8 ring-1 ring-inset ring-primary/25"
              : isEvenRow ? "hover:bg-muted/30" : "bg-muted/5 hover:bg-muted/30"
          }`}
          onClick={() => handleRowClick(item)}
        >
          {/* Label column */}
          <div
            className="w-72 shrink-0 flex items-center gap-1.5 px-3 py-2 border-r border-border/20"
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            {hasVisibleChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleCollapse(item.id); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            {item.level === "action" && actionNumberById[item.id] != null && (
              <span className="shrink-0 inline-flex items-center h-4 px-1 mr-1 rounded border border-primary/30 bg-primary/10 text-primary text-[9px] font-mono font-semibold tabular-nums">
                #{String(actionNumberById[item.id]).padStart(3, "0")}
              </span>
            )}
            <span className={`text-xs truncate ${item.level === "project" ? "font-semibold text-foreground" : "font-medium text-foreground"} ${item.statut === "annulee" ? "line-through opacity-50" : ""}`}>
              {item.statut === "bloquee" && <Lock className="h-3 w-3 inline mr-1 text-slate-500" />}
              {item.statut === "annulee" && <Ban className="h-3 w-3 inline mr-1 text-muted-foreground" />}
              {item.title}
              {item.level === "action" && item.poids != null && (
                <span className="ml-1 text-[9px] text-primary font-normal">({item.poids}%)</span>
              )}
              {item.level === "action" && taskCount > 0 && (
                <span className="ml-1 text-[9px] text-muted-foreground font-normal">· {taskCount} tâche{taskCount > 1 ? "s" : ""}</span>
              )}
            </span>
          </div>

          {/* Gantt bar area */}
          <div className="flex-1 relative min-w-0">
            {barStart >= 0 && barEnd > barStart && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 rounded-md h-7 overflow-hidden shadow-sm transition-all hover:h-8 hover:shadow-md ${isOverdue ? "ring-2 ring-destructive/60" : "ring-1 ring-black/5 dark:ring-white/10"}`}
                    style={{
                      left: `${(barStart / totalDays) * 100}%`,
                      width: `${(Math.max(1, barEnd - barStart) / totalDays) * 100}%`,
                      minWidth: "14px",
                    }}
                  >
                    {/* Track */}
                    <div className={`absolute inset-0 ${barColor} opacity-25 rounded-md`} />
                    {/* Progress fill */}
                    <div
                      className={`absolute inset-y-0 left-0 ${barColor} rounded-md transition-all`}
                      style={{ width: `${item.avancement}%` }}
                    />
                    {/* Diagonal stripes for overdue */}
                    {isOverdue && (
                      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.4) 4px, rgba(255,255,255,0.4) 8px)" }} />
                    )}
                    {/* Percentage label */}
                    {item.avancement > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-sm tracking-wide">
                        {item.avancement}%
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <p className="font-medium">{item.title}</p>
                  <p>{item.date_debut ?? "?"} → {item.echeance ?? "?"}</p>
                  <p>Avancement: {item.avancement}%</p>
                  {item.responsable && <p>Resp: {item.responsable}</p>}
                  {item.level === "action" && taskCount > 0 && (
                    <p className="text-muted-foreground">{taskCount} tâche{taskCount > 1 ? "s" : ""} (voir panneau de droite)</p>
                  )}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      );

      if (hasVisibleChildren && !isCollapsed) {
        rows.push(...renderRows(visibleChildren, depth + 1));
      }
    });
    return rows;
  };

  const renderDetailPanel = () => {
    if (!focusedItem) return null;
    const st = STATUS_LABELS[focusedItem.statut] ?? STATUS_LABELS.planifiee;
    const isOverdue = focusedItem.echeance && new Date(focusedItem.echeance) < new Date() && focusedItem.avancement < 100;
    const daysLeft = focusedItem.echeance ? diffDays(new Date(), new Date(focusedItem.echeance)) : null;
    const children = focusedItem.children ?? [];
    const showComments = canComment && focusedItem.level === "action" && projectId;

    return (
      <div className="h-full flex flex-col">
        {/* Sticky header */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/30 bg-gradient-to-b from-muted/30 to-transparent">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-semibold">
                  {focusedItem.level === "project" ? "Projet" : focusedItem.level === "action" ? "Action" : "Tâche"}
                </Badge>
                <Badge className={`${st.class} text-[10px] font-semibold`}>{st.label}</Badge>
                {isOverdue && (
                  <Badge className="bg-destructive/15 text-destructive text-[10px] font-semibold">
                    En retard {daysLeft !== null ? `de ${Math.abs(daysLeft)}j` : ""}
                  </Badge>
                )}
                {!isOverdue && daysLeft !== null && daysLeft >= 0 && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
                    {daysLeft}j restant{daysLeft > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <h3 className="text-sm font-semibold text-foreground leading-snug">{focusedItem.title}</h3>
            </div>
            <button
              onClick={() => setFocusedItem(null)}
              className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Compact info grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/30 bg-muted/15 p-2.5 space-y-1 col-span-2">
                <div className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <Calendar className="h-3 w-3" /> Période
                </div>
                <p className="text-xs font-medium text-foreground">
                  {focusedItem.date_debut
                    ? new Date(focusedItem.date_debut).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                    : "—"}
                  {" → "}
                  {focusedItem.echeance
                    ? new Date(focusedItem.echeance).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                    : "—"}
                </p>
              </div>

              <div className={`rounded-lg border border-border/30 bg-muted/15 p-2.5 space-y-1.5 ${focusedItem.poids != null ? "" : "col-span-2"}`}>
                <div className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <Target className="h-3 w-3" /> Avancement
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={focusedItem.avancement} className="h-2 flex-1" />
                  <span className="text-xs font-bold text-foreground tabular-nums">{focusedItem.avancement}%</span>
                </div>
              </div>

              {focusedItem.poids != null && (
                <div className="rounded-lg border border-border/30 bg-muted/15 p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <Weight className="h-3 w-3" /> Poids
                  </div>
                  <p className="text-xs font-bold text-foreground">{focusedItem.poids}%</p>
                </div>
              )}

              {focusedItem.responsable && (
                <div className="rounded-lg border border-border/30 bg-muted/15 p-2.5 space-y-1 col-span-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <User className="h-3 w-3" /> Responsable
                  </div>
                  <p className="text-xs font-medium text-foreground">{focusedItem.responsable}</p>
                </div>
              )}
            </div>

            {/* Children list */}
            {children.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {focusedItem.level === "project" ? "Actions" : "Tâches"} ({children.length})
                </h4>
                <div className="grid gap-1.5">
                  {children.map(child => {
                    const cst = STATUS_LABELS[child.statut] ?? STATUS_LABELS.planifiee;
                    return (
                      <div
                        key={child.id}
                        className="flex items-center gap-2.5 rounded-lg border border-border/20 bg-card px-3 py-2 hover:bg-muted/40 hover:border-primary/30 cursor-pointer transition-all"
                        onClick={(e) => { e.stopPropagation(); setFocusedItem(child); }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{child.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {child.echeance && (
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(child.echeance).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                              </span>
                            )}
                            {child.responsable && (
                              <span className="text-[10px] text-muted-foreground truncate">• {child.responsable}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 w-16">
                            <Progress value={child.avancement} className="h-1.5 flex-1" />
                            <span className="text-[10px] font-medium text-muted-foreground w-7 text-right tabular-nums">{child.avancement}%</span>
                          </div>
                          <Badge className={`${cst.class} text-[9px]`}>{cst.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Comments section — accessible to all read-access users */}
            {showComments && (
              <div className="space-y-2 pt-3 border-t border-border/30">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 text-primary" /> Commentaires
                </h4>
                <div className="rounded-lg border border-border/30 bg-muted/10 p-2">
                  <ProjectActionComments
                    actionId={focusedItem.id}
                    canComment={canComment!}
                    isAdmin={isAdmin ?? false}
                    projectId={projectId}
                    projectResponsableUserId={projectResponsableUserId}
                    actionResponsableUserId={undefined}
                  />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const ganttContent = (
    <>
      {/* Header */}
      <div className="flex border-b border-border/40 bg-gradient-to-b from-muted/40 to-muted/20 shrink-0 sticky top-0 z-20 backdrop-blur">
        <div className="w-72 shrink-0 px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-r border-border/20">
          Élément
        </div>
        <div className="flex-1 relative">
          <div className="flex">
            {months.map((m, i) => (
              <div
                key={i}
                className="text-[10px] font-medium text-muted-foreground text-center py-2.5 border-r border-border/10"
                style={{ width: `${(m.width / totalDays) * 100}%` }}
              >
                {m.label}
              </div>
            ))}
          </div>
          {/* Today label in header */}
          {todayOffset >= 0 && todayOffset <= totalDays && (
            <div
              className="absolute bottom-0 -translate-x-1/2 text-[8px] font-bold text-destructive"
              style={{ left: `${(todayOffset / totalDays) * 100}%` }}
            >
              Aujourd'hui
            </div>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 relative overflow-y-auto">
        {/* Today marker line */}
        {todayOffset >= 0 && todayOffset <= totalDays && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10 pointer-events-none shadow-[0_0_8px_hsl(var(--destructive)/0.5)]"
            style={{ left: `calc(288px + (100% - 288px) * ${todayOffset / totalDays})` }}
          />
        )}
        {renderRows(items)}
        {items.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucune donnée à afficher</div>
        )}
      </div>
    </>
  );

  if (fullscreen) {
    return (
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={focusedItem ? 62 : 100} minSize={35}>
          <div className="h-full flex flex-col overflow-hidden bg-card">
            {ganttContent}
          </div>
        </ResizablePanel>
        {focusedItem && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={38} minSize={28} maxSize={55}>
              <div className="h-full border-l border-border/30 bg-card animate-in slide-in-from-right-4 duration-200">
                {renderDetailPanel()}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    );
  }

  // Non-fullscreen (inline) mode — simple card with no detail panel
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden bg-card" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex flex-col max-h-[500px]">
        {ganttContent}
      </div>
    </div>
  );
}
