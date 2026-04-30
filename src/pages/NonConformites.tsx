import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, XCircle, Pencil, ChevronRight, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { useAuth } from "@/contexts/AuthContext";
import { HelpTooltip } from "@/components/HelpTooltip";
import { LinkedProjectBadge } from "@/components/projects/LinkedProjectBadge";
import { LinkedActionDetails } from "@/components/projects/LinkedActionDetails";
import { NcMoyensActions } from "@/components/NcMoyensActions";
import { RootCauseAnalysis } from "@/components/RootCauseAnalysis";
import { ResponsiveStepper } from "@/components/ui/responsive-stepper";

type NC = {
  id: string; reference: string; description: string; gravite: string;
  statut: string; origine: string | null; date_detection: string;
  process_id: string | null; audit_id: string | null;
  nature_nc: string | null; criticite: number | null;
  cause_racine: string | null; correction_immediate: string | null;
  plan_action: string | null; verification_efficacite: string | null;
  resultats_actions: string | null;
};

type Audit = { id: string; reference: string };
type Process = { id: string; code: string; nom: string };

const graviteColors: Record<string, string> = {
  mineure: "bg-warning/20 text-warning",
  majeure: "bg-destructive/20 text-destructive",
  critique: "bg-destructive text-destructive-foreground",
};

const statusLabels: Record<string, string> = {
  ouverte: "Ouverte",
  correction: "Correction",
  analyse_cause: "Analyse cause",
  action_corrective: "Action corrective",
  en_traitement: "En traitement",
  verification: "Vérification",
  cloturee: "Clôturée",
};

const workflowSteps = [
  { key: "ouverte", label: "Détection" },
  { key: "correction", label: "Correction" },
  { key: "analyse_cause", label: "Analyse" },
  { key: "action_corrective", label: "Action" },
  { key: "verification", label: "Vérification" },
  { key: "cloturee", label: "Clôture" },
];

export default function NonConformites() {
  const { hasRole, hasPermission } = useAuth();
  const [ncs, setNcs] = useState<NC[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailNC, setDetailNC] = useState<NC | null>(null);
  const [editNC, setEditNC] = useState<NC | null>(null);
  const [newNC, setNewNC] = useState({
    reference: "", description: "", gravite: "mineure", origine: "",
    nature_nc: "", audit_id: "", process_id: "", criticite: "",
  });

  const [deleteNC, setDeleteNC] = useState<NC | null>(null);
  const [confirmClotureOpen, setConfirmClotureOpen] = useState(false);
  const [originalStatut, setOriginalStatut] = useState<string>("");

  const canCreate = hasPermission("non_conformites", "can_edit");
  const canEdit = hasPermission("non_conformites", "can_edit");
  const canDelete = hasPermission("non_conformites", "can_delete");

  const handleDeleteNC = async () => {
    if (!deleteNC) return;
    const { error } = await supabase.from("nonconformities").delete().eq("id", deleteNC.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Non-conformité supprimée");
    setDeleteNC(null);
    setDetailNC(null);
    fetchNCs();
  };

  const fetchNCs = async () => {
    const { data } = await supabase.from("nonconformities").select("*").order("date_detection", { ascending: false });
    setNcs((data ?? []) as NC[]);
    setLoading(false);
  };

  const fetchAudits = async () => {
    const { data } = await supabase.from("audits").select("id, reference");
    setAudits((data ?? []) as Audit[]);
  };

  const fetchProcesses = async () => {
    const { data } = await supabase.from("processes").select("id, code, nom");
    setProcesses((data ?? []) as Process[]);
  };

  useEffect(() => { fetchNCs(); fetchAudits(); fetchProcesses(); }, []);

  const handleCreate = async () => {
    if (!newNC.reference || !newNC.description) { toast.error("Référence et description requises"); return; }
    const { error } = await supabase.from("nonconformities").insert({
      reference: newNC.reference,
      description: newNC.description,
      gravite: newNC.gravite as any,
      origine: newNC.origine || null,
      nature_nc: newNC.nature_nc || null,
      audit_id: newNC.audit_id || null,
      process_id: newNC.process_id || null,
      criticite: newNC.criticite ? parseInt(newNC.criticite) : null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Non-conformité enregistrée");
    setDialogOpen(false);
    setNewNC({ reference: "", description: "", gravite: "mineure", origine: "", nature_nc: "", audit_id: "", process_id: "", criticite: "" });
    fetchNCs();
  };

  const handleUpdate = async () => {
    if (!editNC) return;
    // If changing to cloturee, show confirmation first
    if (editNC.statut === "cloturee" && originalStatut !== "cloturee" && !confirmClotureOpen) {
      setConfirmClotureOpen(true);
      return;
    }
    const { error } = await supabase.from("nonconformities").update({
      reference: editNC.reference,
      description: editNC.description,
      gravite: editNC.gravite as any,
      statut: editNC.statut as any,
      origine: editNC.origine,
      nature_nc: editNC.nature_nc,
      audit_id: editNC.audit_id,
      process_id: editNC.process_id,
      criticite: editNC.criticite,
      cause_racine: editNC.cause_racine,
      correction_immediate: editNC.correction_immediate,
      plan_action: editNC.plan_action,
      verification_efficacite: editNC.verification_efficacite,
      resultats_actions: editNC.resultats_actions,
    }).eq("id", editNC.id);
    if (error) { toast.error(error.message); return; }
    if (editNC.statut === "cloturee" && originalStatut !== "cloturee") {
      toast.success("Non-conformité clôturée définitivement. Aucune modification ne sera possible.");
    } else {
      toast.success("Non-conformité mise à jour");
    }
    setConfirmClotureOpen(false);
    setEditNC(null);
    fetchNCs();
  };

  const getStepIndex = (statut: string) => {
    const idx = workflowSteps.findIndex(s => s.key === statut);
    if (statut === "en_traitement") return 3; // map to action_corrective
    return idx >= 0 ? idx : 0;
  };
  const getProgress = (statut: string) => ((getStepIndex(statut) + 1) / workflowSteps.length) * 100;

  const getAuditRef = (id: string | null) => id ? audits.find(a => a.id === id)?.reference ?? "—" : "—";
  const getProcessName = (id: string | null) => id ? processes.find(p => p.id === id)?.nom ?? "—" : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">Non-conformités <HelpTooltip term="non_conformite" /></h1>
          <p className="text-muted-foreground">Suivi des écarts qualité — workflow complet</p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Enregistrer NC</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Enregistrer une non-conformité</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Référence *</Label><Input value={newNC.reference} onChange={(e) => setNewNC({ ...newNC, reference: e.target.value })} placeholder="NC-2026-001" /></div>
                  <div className="space-y-2">
                    <Label>Gravité</Label>
                    <Select value={newNC.gravite} onValueChange={(v) => setNewNC({ ...newNC, gravite: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mineure">Mineure</SelectItem>
                        <SelectItem value="majeure">Majeure</SelectItem>
                        <SelectItem value="critique">Critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Description *</Label><Textarea value={newNC.description} onChange={(e) => setNewNC({ ...newNC, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Nature de la NC</Label><Input value={newNC.nature_nc} onChange={(e) => setNewNC({ ...newNC, nature_nc: e.target.value })} placeholder="Produit, processus, système..." /></div>
                  <div className="space-y-2"><Label>Criticité (1-5)</Label><Input type="number" min={1} max={5} value={newNC.criticite} onChange={(e) => setNewNC({ ...newNC, criticite: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Origine</Label><Input value={newNC.origine} onChange={(e) => setNewNC({ ...newNC, origine: e.target.value })} placeholder="Audit, réclamation, interne..." /></div>
                  <div className="space-y-2">
                    <Label>Audit lié</Label>
                    <Select value={newNC.audit_id} onValueChange={(v) => setNewNC({ ...newNC, audit_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                      <SelectContent>
                        {audits.map(a => <SelectItem key={a.id} value={a.id}>{a.reference}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Processus concerné</Label>
                  <Select value={newNC.process_id} onValueChange={(v) => setNewNC({ ...newNC, process_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      {processes.map(p => <SelectItem key={p.id} value={p.id}>{p.code} — {p.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} className="w-full">Enregistrer</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : ncs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune non-conformité</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {ncs.map((nc) => (
            <Card key={nc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailNC(nc)}>
              {/* Desktop / tablet ≥sm */}
              <CardContent className="hidden sm:flex items-center justify-between py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">{nc.reference}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {nc.nature_nc && `${nc.nature_nc} • `}{nc.description}
                    </p>
                    <LinkedProjectBadge entityType="nonconformity" entityId={nc.id} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden md:block w-24">
                    <Progress value={getProgress(nc.statut)} className="h-2" />
                  </div>
                  <Badge className={graviteColors[nc.gravite] ?? ""}>{nc.gravite}</Badge>
                  {nc.criticite && <Badge variant="outline">C{nc.criticite}</Badge>}
                  <Badge variant="outline">{statusLabels[nc.statut] ?? nc.statut}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
              {/* Mobile <sm */}
              <CardContent className="sm:hidden py-3 space-y-2">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{nc.reference}</p>
                      <Badge className={`${graviteColors[nc.gravite] ?? ""} text-[10px] shrink-0`}>{nc.gravite}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {nc.nature_nc && `${nc.nature_nc} • `}{nc.description}
                    </p>
                  </div>
                </div>
                <Progress value={getProgress(nc.statut)} className="h-1.5" />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {nc.criticite && <Badge variant="outline" className="text-[10px]">C{nc.criticite}</Badge>}
                    <Badge variant="outline" className="text-[10px]">{statusLabels[nc.statut] ?? nc.statut}</Badge>
                    <LinkedProjectBadge entityType="nonconformity" entityId={nc.id} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailNC} onOpenChange={(o) => !o && setDetailNC(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detailNC && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" /> {detailNC.reference}
                  </DialogTitle>
               {canEdit && detailNC.statut !== "cloturee" && (
                    <div className="flex items-center gap-4 pr-8">
                      <Button variant="outline" size="sm" onClick={() => { setOriginalStatut(detailNC.statut); setEditNC({ ...detailNC }); setDetailNC(null); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Modifier
                      </Button>
                      {canDelete && (
                        <Button variant="destructive" size="sm" className="ml-4" onClick={() => setDeleteNC(detailNC)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                        </Button>
                      )}
                    </div>
                   )}
                   {detailNC.statut === "cloturee" && (
                     <Badge variant="outline" className="text-xs bg-muted mr-8">
                       <CheckCircle2 className="h-3 w-3 mr-1" /> Clôturée — Figée
                     </Badge>
                   )}
                </div>
              </DialogHeader>

              {/* Workflow Progress — adaptive */}
              <ResponsiveStepper
                className="mb-4"
                currentKey={detailNC.statut}
                steps={workflowSteps.map((s) => ({
                  key: s.key,
                  label: s.label,
                  shortLabel: s.label,
                }))}
              />

              <Tabs defaultValue="general">
                <TabsList className="w-full justify-start flex-wrap scroll-fade-x">
                  <TabsTrigger value="general">Général</TabsTrigger>
                  <TabsTrigger value="correction">Correction</TabsTrigger>
                  <TabsTrigger value="analyse">Analyse</TabsTrigger>
                  <TabsTrigger value="action">Action & Vérification</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label className="text-muted-foreground text-xs">Gravité</Label><p><Badge className={graviteColors[detailNC.gravite] ?? ""}>{detailNC.gravite}</Badge></p></div>
                    <div><Label className="text-muted-foreground text-xs">Criticité</Label><p className="font-medium">{detailNC.criticite ? `${detailNC.criticite}/5` : "—"}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Nature</Label><p className="font-medium">{detailNC.nature_nc ?? "—"}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Date détection</Label><p className="font-medium">{detailNC.date_detection}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Origine</Label><p className="font-medium">{detailNC.origine ?? "—"}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Audit lié</Label><p className="font-medium">{getAuditRef(detailNC.audit_id)}</p></div>
                    <div className="sm:col-span-2"><Label className="text-muted-foreground text-xs">Processus</Label><p className="font-medium">{getProcessName(detailNC.process_id)}</p></div>
                  </div>
                  <div><Label className="text-muted-foreground text-xs">Description</Label><p className="text-sm whitespace-pre-wrap">{detailNC.description}</p></div>
                </TabsContent>

                <TabsContent value="correction" className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Correction immédiate</Label>
                    <p className="text-sm whitespace-pre-wrap">{detailNC.correction_immediate || "Non renseignée"}</p>
                  </div>
                </TabsContent>

                <TabsContent value="analyse" className="space-y-4">
                  <RootCauseAnalysis ncId={detailNC.id} canEdit={false} />
                </TabsContent>

                <TabsContent value="action" className="space-y-4">
                  <NcMoyensActions ncId={detailNC.id} canEdit={false} />
                  <div className="pt-4 border-t space-y-3">
                    <div>
                      <Label className="text-muted-foreground text-xs">Vérification d'efficacité</Label>
                      <p className="text-sm whitespace-pre-wrap">{detailNC.verification_efficacite || "Non renseignée"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Résultats des actions correctives</Label>
                      <p className="text-sm whitespace-pre-wrap">{detailNC.resultats_actions || "Non renseignés"}</p>
                    </div>
                  </div>
                  <LinkedActionDetails entityType="nonconformity" entityId={detailNC.id} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editNC} onOpenChange={(o) => !o && setEditNC(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {editNC && (
            <>
              <DialogHeader><DialogTitle>Modifier {editNC.reference}</DialogTitle></DialogHeader>
              {originalStatut === "cloturee" && (
                <div className="bg-muted/50 border rounded-md p-3 text-sm text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Cette non-conformité est clôturée et ne peut plus être modifiée.
                </div>
              )}
              <Tabs defaultValue="general">
                <TabsList className="w-full justify-start flex-wrap">
                  <TabsTrigger value="general">Général</TabsTrigger>
                  <TabsTrigger value="correction">Correction</TabsTrigger>
                  <TabsTrigger value="analyse">Analyse</TabsTrigger>
                  <TabsTrigger value="action">Action & Vérification</TabsTrigger>
                </TabsList>

                {(() => {
                  const frozen = originalStatut === "cloturee";
                  return (<>
                <TabsContent value="general" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Référence</Label><Input value={editNC.reference} onChange={(e) => setEditNC({ ...editNC, reference: e.target.value })} disabled={frozen} /></div>
                    <div className="space-y-2">
                      <Label>Statut (workflow)</Label>
                      <Select value={editNC.statut} onValueChange={(v) => setEditNC({ ...editNC, statut: v })} disabled={frozen}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ouverte">Ouverte</SelectItem>
                          <SelectItem value="correction">Correction immédiate</SelectItem>
                          <SelectItem value="analyse_cause">Analyse de cause</SelectItem>
                          <SelectItem value="action_corrective">Action corrective</SelectItem>
                          <SelectItem value="en_traitement">En traitement</SelectItem>
                          <SelectItem value="verification">Vérification efficacité</SelectItem>
                          <SelectItem value="cloturee">Clôturée</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={editNC.description} onChange={(e) => setEditNC({ ...editNC, description: e.target.value })} disabled={frozen} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gravité</Label>
                      <Select value={editNC.gravite} onValueChange={(v) => setEditNC({ ...editNC, gravite: v })} disabled={frozen}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mineure">Mineure</SelectItem>
                          <SelectItem value="majeure">Majeure</SelectItem>
                          <SelectItem value="critique">Critique</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Criticité (1-5)</Label><Input type="number" min={1} max={5} value={editNC.criticite ?? ""} onChange={(e) => setEditNC({ ...editNC, criticite: e.target.value ? parseInt(e.target.value) : null })} disabled={frozen} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nature</Label><Input value={editNC.nature_nc ?? ""} onChange={(e) => setEditNC({ ...editNC, nature_nc: e.target.value })} disabled={frozen} /></div>
                    <div className="space-y-2"><Label>Origine</Label><Input value={editNC.origine ?? ""} onChange={(e) => setEditNC({ ...editNC, origine: e.target.value })} disabled={frozen} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Audit lié</Label>
                      <Select value={editNC.audit_id ?? ""} onValueChange={(v) => setEditNC({ ...editNC, audit_id: v || null })} disabled={frozen}>
                        <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                        <SelectContent>
                          {audits.map(a => <SelectItem key={a.id} value={a.id}>{a.reference}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Processus</Label>
                      <Select value={editNC.process_id ?? ""} onValueChange={(v) => setEditNC({ ...editNC, process_id: v || null })} disabled={frozen}>
                        <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                        <SelectContent>
                          {processes.map(p => <SelectItem key={p.id} value={p.id}>{p.code} — {p.nom}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="correction" className="space-y-4">
                  <div className="space-y-2"><Label>Correction immédiate</Label><Textarea value={editNC.correction_immediate ?? ""} onChange={(e) => setEditNC({ ...editNC, correction_immediate: e.target.value })} rows={4} placeholder="Actions immédiates pour contenir le problème..." disabled={frozen} /></div>
                </TabsContent>

                <TabsContent value="analyse" className="space-y-4">
                  <RootCauseAnalysis ncId={editNC.id} canEdit={canEdit && !frozen} />
                </TabsContent>

                <TabsContent value="action" className="space-y-4">
                  <NcMoyensActions ncId={editNC.id} canEdit={canEdit && !frozen} />
                  <div className="pt-4 border-t space-y-3">
                    <div className="space-y-2"><Label>Vérification d'efficacité</Label><Textarea value={editNC.verification_efficacite ?? ""} onChange={(e) => setEditNC({ ...editNC, verification_efficacite: e.target.value })} rows={3} placeholder="Critères et résultats de vérification..." disabled={frozen} /></div>
                    <div className="space-y-2"><Label>Résultats des actions correctives</Label><Textarea value={editNC.resultats_actions ?? ""} onChange={(e) => setEditNC({ ...editNC, resultats_actions: e.target.value })} rows={3} placeholder="Bilan et efficacité constatée..." disabled={frozen} /></div>
                  </div>
                </TabsContent>
                  </>);
                })()}
              </Tabs>
              {originalStatut !== "cloturee" && (
                <Button onClick={handleUpdate} className="w-full mt-4">
                  {editNC.statut === "cloturee" ? "Clôturer définitivement" : "Enregistrer"}
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AdminPasswordDialog
        open={!!deleteNC}
        onOpenChange={(o) => !o && setDeleteNC(null)}
        onConfirm={handleDeleteNC}
        title="Supprimer la non-conformité"
        description={`Supprimer définitivement ${deleteNC?.reference ?? ""} ? Cette action est irréversible.`}
      />

      <AlertDialog open={confirmClotureOpen} onOpenChange={setConfirmClotureOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la clôture définitive</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir clôturer <strong>{editNC?.reference}</strong> ?
              Cette action est irréversible : la non-conformité sera figée et aucune modification ne sera possible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdate}>Clôturer définitivement</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
