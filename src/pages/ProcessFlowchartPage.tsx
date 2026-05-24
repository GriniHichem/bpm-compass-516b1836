import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, ChevronLeft, ChevronRight, Search, X, ZoomIn, ZoomOut, Locate, RotateCcw } from "lucide-react";
import { ProcessTasksFlowchart } from "@/components/ProcessTasksFlowchart";
import { useAuth } from "@/contexts/AuthContext";
import { useProcessPermissions } from "@/hooks/useProcessPermissions";
import { useActeurs } from "@/hooks/useActeurs";
import { cn } from "@/lib/utils";

type ElementType = "finalite" | "donnee_entree" | "donnee_sortie" | "activite" | "interaction" | "partie_prenante" | "ressource";

interface ProcessElement {
  id: string; code: string; description: string; type: ElementType; ordre: number; process_id: string; responsable_id?: string | null;
}

const ELEMENT_SECTIONS: { type: ElementType; prefix: string }[] = [
  { type: "finalite", prefix: "F" },
  { type: "donnee_entree", prefix: "DE" },
  { type: "donnee_sortie", prefix: "DS" },
  { type: "activite", prefix: "AP" },
  { type: "interaction", prefix: "I" },
  { type: "partie_prenante", prefix: "PP" },
  { type: "ressource", prefix: "R" },
];

const generateNextCode = (prefix: string, existingElements: ProcessElement[]): string => {
  const maxNum = existingElements.reduce((max, el) => {
    const match = el.code.match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
};

export default function ProcessFlowchartPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole, hasPermission, user } = useAuth();
  const { checkProcessPermission } = useProcessPermissions();
  const { acteurs } = useActeurs();
  const [process, setProcess] = useState<any>(null);
  const [elements, setElements] = useState<ProcessElement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchElements = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("process_elements").select("*").eq("process_id", id).order("ordre", { ascending: true });
    if (data) setElements(data as ProcessElement[]);
  }, [id]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("processes").select("*").eq("id", id).single();
      setProcess(data);
      setLoading(false);
    };
    if (id) { fetch(); fetchElements(); }
  }, [id, fetchElements]);

  const globalCanEdit = hasPermission("processus", "can_edit");
  const canEdit = checkProcessPermission(id!, "can_edit", globalCanEdit) || (hasRole("responsable_processus") && process?.responsable_id === user?.id);
  const isArchived = process?.statut === "archive";
  const isLockedForNonAdmin = !hasRole("admin") && (process?.statut === "valide" || isArchived);
  const effectiveCanEdit = canEdit && !isArchived && !isLockedForNonAdmin;
  const canDelete = !isArchived && hasPermission("processus", "can_delete") && !(process?.statut === "valide" || process?.statut === "en_validation");

  const handleAddElement = async (type: ElementType, description: string) => {
    const section = ELEMENT_SECTIONS.find(s => s.type === type);
    if (!section) return;
    const typeElements = elements.filter(e => e.type === type);
    const maxOrdre = typeElements.reduce((max, e) => Math.max(max, e.ordre), 0);
    const code = generateNextCode(section.prefix, typeElements);
    const { error } = await supabase.from("process_elements").insert({ process_id: id, type, code, description, ordre: maxOrdre + 1 });
    if (error) { toast.error(error.message); throw error; }
    toast.success("Élément ajouté");
    await fetchElements();
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-background">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
    </div>
  );

  if (!process) return (
    <div className="flex flex-col items-center justify-center h-screen bg-background gap-3">
      <p className="text-muted-foreground">Processus non trouvé</p>
      <Button variant="ghost" onClick={() => navigate(-1)}>Retour</Button>
    </div>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border/50 bg-card/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/processus/${id}`)} className="gap-1.5 shrink-0">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Retour</span>
          </Button>
          <div className="h-5 w-px bg-border/50 hidden sm:block" />
          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">{process.code}</span>
          <span className="text-sm font-semibold text-foreground truncate min-w-0">{process.nom}</span>
          <Badge variant="secondary" className="text-[10px] shrink-0 hidden sm:inline-flex">Logigramme</Badge>
        </div>
      </div>

      {/* Flowchart workspace - full remaining height */}
      <div className="flex-1 min-h-0">
        <ProcessTasksFlowchart
          processId={id!}
          canEdit={effectiveCanEdit}
          canDelete={canDelete}
          processElements={elements}
          onAddElement={handleAddElement}
          standalone
        />
      </div>
    </div>
  );
}
