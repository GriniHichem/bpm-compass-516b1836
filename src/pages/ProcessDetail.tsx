import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Save, FileText, Download, Eye, FileDown, CopyPlus, Layers, ListChecks, Archive, Settings2, Users, Target, ArrowRightLeft, Package, Workflow, ShieldCheck } from "lucide-react";
import { ValidationPanel } from "@/components/validation/ValidationPanel";
import { PdfViewerDialog } from "@/components/PdfViewerDialog";
import { exportProcessPdf } from "@/lib/exportProcessPdf";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProcessPermissions } from "@/hooks/useProcessPermissions";
import { ProcessComments } from "@/components/ProcessComments";
import { ProcessElementList } from "@/components/ProcessElementList";
import { ProcessTasksTable } from "@/components/ProcessTasksTable";
import { ProcessInteractionManager } from "@/components/ProcessInteractionManager";
import { PartiePrenanteAdder } from "@/components/PartiePrenanteAdder";
import { ContextIssuesManager } from "@/components/ContextIssuesManager";
import { ProcessArchivedObjects } from "@/components/ProcessArchivedObjects";
import { HelpTooltip } from "@/components/HelpTooltip";
import { CsvTaskImporter } from "@/components/CsvTaskImporter";
import { useActeurs } from "@/hooks/useActeurs";

type ElementType = "finalite" | "donnee_entree" | "donnee_sortie" | "activite" | "interaction" | "partie_prenante" | "ressource";

interface ProcessElement {
  id: string; code: string; description: string; type: ElementType; ordre: number; process_id: string; responsable_id?: string | null;
}

const ELEMENT_SECTIONS: { type: ElementType; title: string; prefix: string; icon: React.ReactNode; helpTerm?: string }[] = [
  { type: "finalite", title: "Finalité", prefix: "F", icon: <Target className="h-4 w-4" />, helpTerm: "finalite" },
  { type: "donnee_entree", title: "Données d'entrée", prefix: "DE", icon: <ArrowRightLeft className="h-4 w-4" />, helpTerm: "donnees_entree" },
  { type: "donnee_sortie", title: "Données de sortie", prefix: "DS", icon: <ArrowRightLeft className="h-4 w-4" />, helpTerm: "donnees_sortie" },
  { type: "activite", title: "Activités principales", prefix: "AP", icon: <Settings2 className="h-4 w-4" />, helpTerm: "activite" },
  { type: "interaction", title: "Interactions", prefix: "I", icon: <ArrowRightLeft className="h-4 w-4" />, helpTerm: "interaction" },
  { type: "partie_prenante", title: "Parties prenantes", prefix: "PP", icon: <Users className="h-4 w-4" />, helpTerm: "parties_interessees" },
  { type: "ressource", title: "Ressources", prefix: "R", icon: <Package className="h-4 w-4" />, helpTerm: "ressources" },
];

const generateNextCode = (prefix: string, existingElements: ProcessElement[]): string => {
  const maxNum = existingElements.reduce((max, el) => {
    const match = el.code.match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
};

const STATUS_STYLES: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground border-muted",
  en_validation: "bg-warning/10 text-warning border-warning/30",
  valide: "bg-success/10 text-success border-success/30",
  archive: "bg-secondary text-secondary-foreground border-secondary",
};

const TYPE_STYLES: Record<string, { label: string; color: string }> = {
  pilotage: { label: "Management", color: "bg-primary/10 text-primary" },
  realisation: { label: "Réalisation", color: "bg-accent/10 text-accent" },
  support: { label: "Support", color: "bg-warning/10 text-warning" },
};

export default function ProcessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole, hasPermission, user } = useAuth();
  const { checkProcessPermission } = useProcessPermissions();
  const { acteurs } = useActeurs();
  const [process, setProcess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [elements, setElements] = useState<ProcessElement[]>([]);
  const [users, setUsers] = useState<{ id: string; nom: string; prenom: string; email: string }[]>([]);
  const [processDocuments, setProcessDocuments] = useState<any[]>([]);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [pdfViewerTitle, setPdfViewerTitle] = useState("");
  const [pdfFullscreen, setPdfFullscreen] = useState(false);

  const fetchElements = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("process_elements").select("*").eq("process_id", id).order("ordre", { ascending: true });
    if (data) setElements(data as ProcessElement[]);
  }, [id]);

  const fetchDocuments = useCallback(async () => {
    if (!id) return;
    const { data: dpData } = await supabase.from("document_processes").select("document_id").eq("process_id", id);
    if (!dpData || dpData.length === 0) { setProcessDocuments([]); return; }
    const docIds = dpData.map((dp: any) => dp.document_id);
    const { data: docsData } = await supabase.from("documents").select("id, titre, type_document, version, nom_fichier, chemin_fichier").in("id", docIds).eq("archive", false);
    setProcessDocuments(docsData ?? []);
  }, [id]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("processes").select("*").eq("id", id).single();
      setProcess(data);
      setLoading(false);
    };
    const fetchUsers = async () => {
      const { data } = await supabase.from("profiles").select("id, nom, prenom, email").eq("actif", true);
      if (data) setUsers(data);
    };
    if (id) { fetch(); fetchElements(); fetchDocuments(); fetchUsers(); }
  }, [id, fetchElements, fetchDocuments]);

  const globalCanEdit = hasPermission("processus", "can_edit");
  const canEdit = checkProcessPermission(id!, "can_edit", globalCanEdit) || (hasRole("responsable_processus") && process?.responsable_id === user?.id);
  const isArchived = process?.statut === "archive";
  const isLockedStatus = process?.statut === "valide" || process?.statut === "en_validation";
  const canDelete = !isArchived && hasPermission("processus", "can_delete") && !isLockedStatus;
  const canChangeStatus = !isArchived && (hasRole("admin") || hasRole("rmq"));
  const canChangeResponsable = !isArchived && (hasRole("admin") || hasRole("rmq"));
  const isLockedForNonAdmin = !hasRole("admin") && (process?.statut === "valide" || isArchived);
  const effectiveCanEdit = canEdit && !isArchived && !isLockedForNonAdmin;
  const isRmqOnly = hasRole("rmq") && !hasRole("admin");
  const canChangeStatusEffective = canChangeStatus && !(isRmqOnly && (process?.statut === "valide"));
  const canCreateNewVersion = checkProcessPermission(id!, "can_version", hasRole("rmq")) && process?.statut === "valide";
  const canDetail = checkProcessPermission(id!, "can_detail", hasPermission("processus", "can_read_detail"));
  const canComment = checkProcessPermission(id!, "can_comment", false);

  const [creatingVersion, setCreatingVersion] = useState(false);
  
  const handleCreateNewVersion = async () => {
    if (!process || !id) return;
    setCreatingVersion(true);
    try {
      const currentVersion = parseFloat(process.version_courante);
      const major = Math.floor(currentVersion);
      const minor = Math.round((currentVersion - major) * 100);
      const newVersion = parseFloat((major + (minor + 1) / 100).toFixed(2));
      const newCode = `${process.code}-v${newVersion}`;

      const { data: newProc, error } = await supabase.from("processes").insert({
        code: newCode, nom: process.nom, description: process.description,
        type_processus: process.type_processus, finalite: process.finalite,
        responsable_id: process.responsable_id, donnees_entree: process.donnees_entree,
        donnees_sortie: process.donnees_sortie, activites: process.activites,
        interactions: process.interactions, parties_prenantes: process.parties_prenantes,
        ressources: process.ressources, statut: "brouillon" as const, version_courante: newVersion,
      }).select("id").single();

      if (error || !newProc) { toast.error(error?.message || "Erreur"); setCreatingVersion(false); return; }

      const elemsToInsert = elements.map(({ id: _id, process_id: _pid, ...rest }) => ({ ...rest, process_id: newProc.id }));
      if (elemsToInsert.length > 0) await supabase.from("process_elements").insert(elemsToInsert);

      const { data: tasksData } = await supabase.from("process_tasks").select("*").eq("process_id", id);
      if (tasksData && tasksData.length > 0) {
        const tasksToInsert = tasksData.map(({ id: _id, process_id: _pid, created_at: _ca, updated_at: _ua, ...rest }) => ({ ...rest, process_id: newProc.id }));
        await supabase.from("process_tasks").insert(tasksToInsert);
      }

      const { data: docLinks } = await supabase.from("document_processes").select("*").eq("process_id", id);
      if (docLinks && docLinks.length > 0) {
        const docLinksToInsert = docLinks.map(({ id: _id, created_at: _ca, ...rest }) => ({ ...rest, process_id: newProc.id }));
        await supabase.from("document_processes").insert(docLinksToInsert);
      }

      const { data: interSource } = await supabase.from("process_interactions").select("*").eq("source_process_id", id);
      if (interSource && interSource.length > 0) {
        const { data: newElems } = await supabase.from("process_elements").select("*").eq("process_id", newProc.id);
        const oldElems = elements;
        const elemIdMap = new Map<string, string>();
        if (newElems) {
          oldElems.forEach(oldEl => {
            const match = newElems.find(ne => ne.code === oldEl.code && ne.type === oldEl.type);
            if (match) elemIdMap.set(oldEl.id, match.id);
          });
        }
        const interToInsert = interSource
          .filter(i => elemIdMap.has(i.element_id))
          .map(({ id: _id, created_at: _ca, ...rest }) => ({
            ...rest, source_process_id: newProc.id,
            element_id: elemIdMap.get(rest.element_id) || rest.element_id,
          }));
        if (interToInsert.length > 0) await supabase.from("process_interactions").insert(interToInsert);
      }

      await supabase.from("processes").update({ statut: "archive" as const }).eq("id", id);
      await supabase.from("process_versions").insert({
        process_id: id, version: currentVersion, donnees: process as any, modifie_par: user?.id ?? null,
      });

      toast.success(`Nouvelle version v${newVersion} créée`);
      navigate(`/processus/${newProc.id}`);
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setCreatingVersion(false);
  };

  const handleSave = async () => {
    if (!process) return;
    setSaving(true);
    const { error } = await supabase.from("processes").update({
      nom: process.nom, description: process.description,
      type_processus: process.type_processus, statut: process.statut,
      responsable_id: process.responsable_id || null,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Processus mis à jour");
    setSaving(false);
  };

  const updateField = (field: string, value: string) => setProcess({ ...process, [field]: value });

  const handleAddElement = async (type: ElementType, prefix: string, description: string) => {
    const typeElements = elements.filter(e => e.type === type);
    const maxOrdre = typeElements.reduce((max, e) => Math.max(max, e.ordre), 0);
    const code = generateNextCode(prefix, typeElements);
    const { error } = await supabase.from("process_elements").insert({ process_id: id, type, code, description, ordre: maxOrdre + 1 });
    if (error) { toast.error(error.message); throw error; }
    toast.success("Élément ajouté");
    await fetchElements();
  };

  const handleUpdateElement = async (elId: string, code: string, description: string) => {
    const { error } = await supabase.from("process_elements").update({ code, description }).eq("id", elId);
    if (error) { toast.error(error.message); return; }
    toast.success("Élément modifié");
    fetchElements();
  };

  const handleRemoveElement = async (elId: string) => {
    const { error } = await supabase.from("process_elements").delete().eq("id", elId);
    if (error) { toast.error(error.message); return; }
    toast.success("Élément supprimé");
    fetchElements();
  };

  const handleUpdateResponsable = async (elementId: string, acteurId: string | null) => {
    const { error } = await supabase.from("process_elements").update({ responsable_id: acteurId }).eq("id", elementId);
    if (error) { toast.error(error.message); return; }
    fetchElements();
  };

  const responsableName = users.find(u => u.id === process?.responsable_id);

  if (loading) return (
    <div className="flex justify-center items-center py-24">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Chargement du processus…</p>
      </div>
    </div>
  );
  if (!process) return (
    <div className="text-center py-24">
      <Layers className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-muted-foreground">Processus non trouvé</p>
      <Button variant="ghost" className="mt-3" onClick={() => navigate("/processus")}>Retour à la liste</Button>
    </div>
  );

  const typeInfo = TYPE_STYLES[process.type_processus] || { label: process.type_processus, color: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      {/* ─── Premium Header ─── */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-card to-accent/5 border border-border/50 p-6" style={{ boxShadow: 'var(--shadow-md)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-accent/5 translate-y-1/2 -translate-x-1/4" />
        <div className="relative flex items-start gap-4">
          <Button variant="ghost" size="icon" className="shrink-0 mt-1 hover:bg-primary/10" onClick={() => navigate("/processus")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{process.code}</span>
              <Badge className={cn("text-xs border", STATUS_STYLES[process.statut] || "")}>
                {process.statut.replace("_", " ")}
              </Badge>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md", typeInfo.color)}>{typeInfo.label}</span>
              <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-md">v{process.version_courante}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{process.nom}</h1>
            {responsableName && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {`${responsableName.prenom} ${responsableName.nom}`.trim()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => exportProcessPdf(id!)} className="gap-1.5">
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            <HelpTooltip term="export_pdf" />
            {canCreateNewVersion && (
              <Button variant="secondary" size="sm" onClick={handleCreateNewVersion} disabled={creatingVersion} className="gap-1.5">
                <CopyPlus className="h-3.5 w-3.5" />{creatingVersion ? "Création..." : "Nouvelle version"}
              </Button>
            )}
            {effectiveCanEdit && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />{saving ? "..." : "Enregistrer"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-card border border-border/50 p-1 h-auto gap-1" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <TabsTrigger value="general" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg text-sm px-4 py-2 transition-all">
            <Settings2 className="h-3.5 w-3.5" /> Général
          </TabsTrigger>
          <TabsTrigger value="elements" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg text-sm px-4 py-2 transition-all">
            <Layers className="h-3.5 w-3.5" /> Éléments
            <span className="ml-1 text-[10px] bg-current/10 rounded-full px-1.5 opacity-60">{elements.length}</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg text-sm px-4 py-2 transition-all">
            <ListChecks className="h-3.5 w-3.5" /> Activités
          </TabsTrigger>
          <TabsTrigger value="validation" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg text-sm px-4 py-2 transition-all">
            <ShieldCheck className="h-3.5 w-3.5" /> Validation
          </TabsTrigger>
          {process.statut === "archive" && (
            <TabsTrigger value="archive" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm rounded-lg text-sm px-4 py-2 transition-all">
              <Archive className="h-3.5 w-3.5" /> Objets liés
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general" className="mt-4 animate-fade-in">
          <Card className="card-elevated border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="section-header text-base">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Intitulé</Label>
                  <Input value={process.nom} onChange={(e) => updateField("nom", e.target.value)} disabled={!effectiveCanEdit} className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</Label>
                  <Select value={process.type_processus} onValueChange={(v) => updateField("type_processus", v)} disabled={!effectiveCanEdit}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pilotage">Management</SelectItem>
                      <SelectItem value="realisation">Réalisation</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Statut</Label>
                  <Select value={process.statut} onValueChange={(v) => updateField("statut", v)} disabled={!canChangeStatusEffective}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brouillon">Brouillon</SelectItem>
                      <SelectItem value="en_validation">En validation</SelectItem>
                      <SelectItem value="valide">Validé</SelectItem>
                      <SelectItem value="archive">Archivé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">Responsable <HelpTooltip term="pilote_processus" /></Label>
                  <Select value={process.responsable_id ?? "none"} onValueChange={(v) => updateField("responsable_id", v === "none" ? null : v)} disabled={!canChangeResponsable}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Non assigné" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non assigné</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{`${u.prenom} ${u.nom}`.trim() || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</Label>
                <Textarea value={process.description ?? ""} onChange={(e) => updateField("description", e.target.value)} disabled={!effectiveCanEdit} rows={3} className="resize-none" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="elements" className="mt-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ELEMENT_SECTIONS.map(({ type, title, prefix, icon, helpTerm }) => (
              <Card key={type} className="card-elevated border-border/50 group">
                <CardContent className="pt-5">
                  {type === "interaction" ? (
                    <ProcessInteractionManager processId={id!} processElements={elements} canEdit={effectiveCanEdit} canDelete={canDelete} onRefreshElements={fetchElements} />
                  ) : (
                    <>
                      <ProcessElementList
                         title={title}
                         helpTerm={helpTerm}
                        elements={elements.filter(e => e.type === type)}
                        canEdit={effectiveCanEdit}
                        canDelete={canDelete}
                        multiline={type === "finalite"}
                        onAdd={(desc) => handleAddElement(type, prefix, desc)}
                        onUpdate={handleUpdateElement}
                        onRemove={handleRemoveElement}
                        showResponsable={type === "activite"}
                        acteurs={type === "activite" ? acteurs : undefined}
                        onUpdateResponsable={type === "activite" ? handleUpdateResponsable : undefined}
                        showAttentes={type === "partie_prenante"}
                        customAdder={type === "partie_prenante" ? (
                          <PartiePrenanteAdder existingDescriptions={elements.filter(e => e.type === "partie_prenante").map(e => e.description)} onAdd={(desc) => handleAddElement("partie_prenante", "PP", desc)} />
                        ) : undefined}
                      />
                      {type === "ressource" && processDocuments.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Documents associés</h4>
                          {processDocuments.map((doc: any) => {
                            const typeLabels: Record<string, string> = { procedure: "Procédure", instruction: "Instruction", formulaire: "Formulaire", enregistrement: "Enregistrement", rapport: "Rapport", compte_rendu_audit: "CR Audit", preuve: "Preuve" };
                            return (
                              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-primary" />
                                  <span className="font-medium">{doc.titre}</span>
                                  <span className="text-xs text-muted-foreground">({typeLabels[doc.type_document] ?? doc.type_document} • v{doc.version})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {doc.nom_fichier && <Badge variant="secondary" className="text-xs">{doc.nom_fichier}</Badge>}
                                  {doc.chemin_fichier && doc.nom_fichier?.toLowerCase().endsWith(".pdf") && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                      onClick={async () => {
                                        const { data, error } = await supabase.storage.from("documents").download(doc.chemin_fichier);
                                        if (error || !data) { toast.error("Impossible d'accéder au fichier"); return; }
                                        const pdfBlob = data.type === "application/pdf" ? data : new Blob([data], { type: "application/pdf" });
                                        const blobUrl = URL.createObjectURL(pdfBlob);
                                        setPdfViewerTitle(doc.titre); setPdfViewerUrl(blobUrl);
                                      }}
                                      title="Consulter le PDF"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {doc.chemin_fichier && (hasRole("rmq") || hasRole("admin") || hasRole("super_admin")) && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7"
                                      onClick={async () => {
                                        const { data } = await supabase.storage.from("documents").download(doc.chemin_fichier);
                                        if (!data) { toast.error("Impossible d'accéder au fichier"); return; }
                                        const blobUrl = URL.createObjectURL(data);
                                        const a = document.createElement("a"); a.href = blobUrl; a.download = doc.nom_fichier || "document"; a.click(); URL.revokeObjectURL(blobUrl);
                                      }}
                                      title="Télécharger"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 animate-fade-in">
          <Card className="card-elevated border-border/50">
            <CardContent className="pt-6">
              {/* View mode toggle */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(`/processus/${id}/logigramme`)}>
                    <Workflow className="h-3.5 w-3.5" /> Logigramme plein écran
                  </Button>
                </div>
                {(hasRole("admin") || hasRole("super_admin")) && effectiveCanEdit && (
                  <CsvTaskImporter processId={id!} processElements={elements} onComplete={() => { fetchElements(); }} />
                )}
              </div>

              <ProcessTasksTable processId={id!} canEdit={effectiveCanEdit} canDelete={canDelete} processElements={elements}
                onAddElement={async (type: ElementType, description: string) => {
                  const section = ELEMENT_SECTIONS.find(s => s.type === type);
                  if (section) await handleAddElement(type, section.prefix, description);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="validation" className="mt-4 animate-fade-in">
          <ValidationPanel
            entityType="processus"
            entityId={id!}
            entityLabel={`${process.code} — v${process.version_courante}`}
            onApproved={() => loadProcess()}
          />
        </TabsContent>
        {process.statut === "archive" && (
          <TabsContent value="archive" className="mt-4 animate-fade-in">
            <ProcessArchivedObjects processId={id!} />
          </TabsContent>
        )}
      </Tabs>

      {/* Process Comments */}
      {canDetail && (
        <ProcessComments processId={id!} canComment={canComment} canRead={canDetail} />
      )}

      <PdfViewerDialog
        open={!!pdfViewerUrl}
        onOpenChange={(open) => {
          if (!open) {
            if (pdfViewerUrl?.startsWith("blob:")) URL.revokeObjectURL(pdfViewerUrl);
            setPdfViewerUrl(null);
            setPdfViewerTitle("");
            setPdfFullscreen(false);
          }
        }}
        pdfUrl={pdfViewerUrl}
        title={pdfViewerTitle}
      />
    </div>
  );
}
