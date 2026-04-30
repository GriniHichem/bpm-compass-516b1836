import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, ClipboardCheck, Pencil, Eye, ChevronRight, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminPasswordDialog } from "@/components/AdminPasswordDialog";
import { HelpTooltip } from "@/components/HelpTooltip";
import { ResponsiveStepper } from "@/components/ui/responsive-stepper";
import { ResponsiveTable } from "@/components/ui/responsive-table";

type Audit = {
  id: string; reference: string; type_audit: string; perimetre: string | null;
  date_audit: string | null; date_fin: string | null; statut: string;
  auditeur_id: string | null; rapport: string | null;
  frequence: string | null; methodes: string | null; responsabilites: string | null;
  programme: string | null; preuve_realisation: string | null; resultats: string | null;
  checklist: any | null;
};

type Finding = {
  id: string; audit_id: string; type_constat: string; description: string;
  preuve: string | null; statut: string; process_id: string | null;
};

type Acteur = { id: string; fonction: string | null };

const statusColors: Record<string, string> = {
  planifie: "bg-muted text-muted-foreground",
  en_cours: "bg-primary/20 text-primary",
  termine: "bg-success/20 text-success",
  cloture: "bg-secondary text-secondary-foreground",
};

const statusLabels: Record<string, string> = {
  planifie: "Planifié",
  en_cours: "En cours",
  termine: "Terminé",
  cloture: "Clôturé",
};

const workflowSteps = [
  { key: "planifie", label: "Programme" },
  { key: "en_cours", label: "Réalisation" },
  { key: "termine", label: "Rapport" },
  { key: "cloture", label: "Clôture" },
];

const findingTypeLabels: Record<string, string> = {
  conformite: "Conformité",
  observation: "Observation",
  non_conformite_mineure: "NC Mineure",
  non_conformite_majeure: "NC Majeure",
  amelioration: "Amélioration",
};

export default function Audits() {
  const { hasRole, hasPermission } = useAuth();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [acteurs, setActeurs] = useState<Acteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailAudit, setDetailAudit] = useState<Audit | null>(null);
  const [editAudit, setEditAudit] = useState<Audit | null>(null);
  const [deleteAudit, setDeleteAudit] = useState<Audit | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [newFinding, setNewFinding] = useState({ type_constat: "observation", description: "", preuve: "" });
  const [newAudit, setNewAudit] = useState({
    reference: "", type_audit: "interne", perimetre: "", date_audit: "",
    frequence: "", methodes: "", responsabilites: "", programme: "",
  });

  const canCreate = hasPermission("audits", "can_edit");
  const canEdit = hasPermission("audits", "can_edit");

  const fetchAudits = async () => {
    const { data } = await supabase.from("audits").select("*").order("date_audit", { ascending: false });
    setAudits((data ?? []) as Audit[]);
    setLoading(false);
  };

  const fetchActeurs = async () => {
    const { data } = await supabase.from("acteurs").select("id, fonction").eq("actif", true);
    setActeurs(data ?? []);
  };

  const fetchFindings = async (auditId: string) => {
    const { data } = await supabase.from("audit_findings").select("*").eq("audit_id", auditId).order("created_at");
    setFindings((data ?? []) as Finding[]);
  };

  useEffect(() => { fetchAudits(); fetchActeurs(); }, []);

  const handleCreate = async () => {
    if (!newAudit.reference) { toast.error("Référence requise"); return; }
    const { error } = await supabase.from("audits").insert({
      reference: newAudit.reference,
      type_audit: newAudit.type_audit as any,
      perimetre: newAudit.perimetre || null,
      date_audit: newAudit.date_audit || null,
      frequence: newAudit.frequence || null,
      methodes: newAudit.methodes || null,
      responsabilites: newAudit.responsabilites || null,
      programme: newAudit.programme || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Audit créé");
    setDialogOpen(false);
    setNewAudit({ reference: "", type_audit: "interne", perimetre: "", date_audit: "", frequence: "", methodes: "", responsabilites: "", programme: "" });
    fetchAudits();
  };

  const handleUpdate = async () => {
    if (!editAudit) return;
    const { error } = await supabase.from("audits").update({
      reference: editAudit.reference,
      type_audit: editAudit.type_audit as any,
      perimetre: editAudit.perimetre,
      date_audit: editAudit.date_audit,
      date_fin: editAudit.date_fin,
      statut: editAudit.statut as any,
      auditeur_id: editAudit.auditeur_id,
      rapport: editAudit.rapport,
      frequence: editAudit.frequence,
      methodes: editAudit.methodes,
      responsabilites: editAudit.responsabilites,
      programme: editAudit.programme,
      preuve_realisation: editAudit.preuve_realisation,
      resultats: editAudit.resultats,
    }).eq("id", editAudit.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Audit mis à jour");
    setEditAudit(null);
    fetchAudits();
  };

  const handleAddFinding = async () => {
    if (!detailAudit || !newFinding.description) { toast.error("Description requise"); return; }
    const { error } = await supabase.from("audit_findings").insert({
      audit_id: detailAudit.id,
      type_constat: newFinding.type_constat as any,
      description: newFinding.description,
      preuve: newFinding.preuve || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Constat ajouté");
    setNewFinding({ type_constat: "observation", description: "", preuve: "" });
    fetchFindings(detailAudit.id);
  };

  const handleDeleteAudit = async () => {
    if (!deleteAudit) return;
    // Delete findings first, then the audit
    await supabase.from("audit_findings").delete().eq("audit_id", deleteAudit.id);
    const { error } = await supabase.from("audits").delete().eq("id", deleteAudit.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Audit ${deleteAudit.reference} supprimé`);
    setDeleteAudit(null);
    setDetailAudit(null);
    fetchAudits();
  };

  const openDetail = (audit: Audit) => {
    setDetailAudit(audit);
    fetchFindings(audit.id);
  };

  const getStepIndex = (statut: string) => workflowSteps.findIndex(s => s.key === statut);
  const getProgress = (statut: string) => ((getStepIndex(statut) + 1) / workflowSteps.length) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">Audits <HelpTooltip term="audit" /></h1>
          <p className="text-muted-foreground">Programme et suivi des audits qualité</p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Nouvel audit</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Planifier un audit</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Référence *</Label><Input value={newAudit.reference} onChange={(e) => setNewAudit({ ...newAudit, reference: e.target.value })} placeholder="AUD-2026-001" /></div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newAudit.type_audit} onValueChange={(v) => setNewAudit({ ...newAudit, type_audit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="interne">Interne</SelectItem>
                        <SelectItem value="externe">Externe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date prévue</Label><Input type="date" value={newAudit.date_audit} onChange={(e) => setNewAudit({ ...newAudit, date_audit: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Fréquence</Label><Input value={newAudit.frequence} onChange={(e) => setNewAudit({ ...newAudit, frequence: e.target.value })} placeholder="Annuelle, semestrielle..." /></div>
                </div>
                <div className="space-y-2"><Label>Programme d'audit</Label><Textarea value={newAudit.programme} onChange={(e) => setNewAudit({ ...newAudit, programme: e.target.value })} placeholder="Objectifs, périmètre global, calendrier..." /></div>
                <div className="space-y-2"><Label>Périmètre</Label><Textarea value={newAudit.perimetre} onChange={(e) => setNewAudit({ ...newAudit, perimetre: e.target.value })} /></div>
                <div className="space-y-2"><Label>Méthodes</Label><Textarea value={newAudit.methodes} onChange={(e) => setNewAudit({ ...newAudit, methodes: e.target.value })} placeholder="Entretiens, revue documentaire, observation..." /></div>
                <div className="space-y-2"><Label>Responsabilités</Label><Textarea value={newAudit.responsabilites} onChange={(e) => setNewAudit({ ...newAudit, responsabilites: e.target.value })} placeholder="Auditeur principal, co-auditeurs, audités..." /></div>
                <Button onClick={handleCreate} className="w-full">Créer</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : audits.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun audit</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {audits.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(a)}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{a.reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.type_audit} • {a.date_audit ?? "Non planifié"}
                      {a.frequence && ` • ${a.frequence}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden md:block w-32">
                    <Progress value={getProgress(a.statut)} className="h-2" />
                  </div>
                  <Badge className={statusColors[a.statut] ?? ""}>{statusLabels[a.statut] ?? a.statut}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailAudit} onOpenChange={(o) => !o && setDetailAudit(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detailAudit && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" /> {detailAudit.reference}
                  </DialogTitle>
                   <div className="flex items-center gap-4 pr-8">
                    {canEdit && (
                      <Button variant="outline" size="sm" onClick={() => { setEditAudit({ ...detailAudit }); setDetailAudit(null); }}>
                        <Pencil className="mr-2 h-4 w-4" /> Modifier
                      </Button>
                    )}
                    <Button variant="destructive" size="sm" className="ml-4" onClick={() => { setDeleteAudit(detailAudit); }}>
                      <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* Workflow Progress — adaptive */}
              <ResponsiveStepper
                className="mb-4"
                currentKey={detailAudit.statut}
                steps={workflowSteps.map((s) => ({ key: s.key, label: s.label, shortLabel: s.label }))}
              />

              <Tabs defaultValue="general">
                <TabsList className="w-full justify-start scroll-fade-x">
                  <TabsTrigger value="general">Général</TabsTrigger>
                  <TabsTrigger value="programme">Programme</TabsTrigger>
                  <TabsTrigger value="constats">Constats</TabsTrigger>
                  <TabsTrigger value="rapport">Rapport & Résultats</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label className="text-muted-foreground text-xs">Type</Label><p className="font-medium">{detailAudit.type_audit}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Statut</Label><p><Badge className={statusColors[detailAudit.statut] ?? ""}>{statusLabels[detailAudit.statut] ?? detailAudit.statut}</Badge></p></div>
                    <div><Label className="text-muted-foreground text-xs">Date début</Label><p className="font-medium">{detailAudit.date_audit ?? "—"}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Date fin</Label><p className="font-medium">{detailAudit.date_fin ?? "—"}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Fréquence</Label><p className="font-medium">{detailAudit.frequence ?? "—"}</p></div>
                    <div><Label className="text-muted-foreground text-xs">Auditeur</Label><p className="font-medium">{detailAudit.auditeur_id ? acteurs.find(a => a.id === detailAudit.auditeur_id)?.fonction ?? "—" : "—"}</p></div>
                  </div>
                  {detailAudit.perimetre && <div><Label className="text-muted-foreground text-xs">Périmètre</Label><p className="text-sm">{detailAudit.perimetre}</p></div>}
                  {detailAudit.responsabilites && <div><Label className="text-muted-foreground text-xs">Responsabilités</Label><p className="text-sm whitespace-pre-wrap">{detailAudit.responsabilites}</p></div>}
                </TabsContent>

                <TabsContent value="programme" className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Programme d'audit</Label>
                    <p className="text-sm whitespace-pre-wrap">{detailAudit.programme || "Non défini"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Méthodes d'audit</Label>
                    <p className="text-sm whitespace-pre-wrap">{detailAudit.methodes || "Non définies"}</p>
                  </div>
                </TabsContent>

                <TabsContent value="constats" className="space-y-4">
                  <ResponsiveTable
                    rows={findings}
                    rowKey={(f) => f.id}
                    empty={<p className="text-muted-foreground text-center py-6">Aucun constat enregistré</p>}
                    columns={[
                      {
                        header: "Type",
                        mobileHeader: true,
                        cell: (f) => (
                          <Badge variant={f.type_constat.includes("non_conformite") ? "destructive" : "outline"}>
                            {findingTypeLabels[f.type_constat] ?? f.type_constat}
                          </Badge>
                        ),
                      },
                      {
                        header: "Statut",
                        mobileHeader: true,
                        cell: (f) => <Badge variant="outline">{f.statut}</Badge>,
                      },
                      {
                        header: "Description",
                        mobileFullWidth: true,
                        className: "max-w-xs truncate",
                        cell: (f) => f.description,
                      },
                      {
                        header: "Preuve",
                        className: "max-w-[120px] truncate text-xs",
                        cell: (f) => f.preuve || "—",
                      },
                    ]}
                  />

                  {canEdit && (
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Ajouter un constat</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Type</Label>
                            <Select value={newFinding.type_constat} onValueChange={(v) => setNewFinding({ ...newFinding, type_constat: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="conformite">Conformité</SelectItem>
                                <SelectItem value="observation">Observation</SelectItem>
                                <SelectItem value="non_conformite_mineure">NC Mineure</SelectItem>
                                <SelectItem value="non_conformite_majeure">NC Majeure</SelectItem>
                                <SelectItem value="amelioration">Amélioration</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Preuve</Label>
                            <Input value={newFinding.preuve} onChange={(e) => setNewFinding({ ...newFinding, preuve: e.target.value })} placeholder="Référence preuve..." />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description *</Label>
                          <Textarea value={newFinding.description} onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })} />
                        </div>
                        <Button size="sm" onClick={handleAddFinding}>Ajouter</Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="rapport" className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Rapport d'audit</Label>
                    <p className="text-sm whitespace-pre-wrap">{detailAudit.rapport || "Non rédigé"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Résultats d'audit</Label>
                    <p className="text-sm whitespace-pre-wrap">{detailAudit.resultats || "Non renseignés"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Preuve de réalisation</Label>
                    <p className="text-sm whitespace-pre-wrap">{detailAudit.preuve_realisation || "Non renseignée"}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{findings.filter(f => f.type_constat.includes("non_conformite")).length} non-conformité(s) détectée(s)</span>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editAudit} onOpenChange={(o) => !o && setEditAudit(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {editAudit && (
            <>
              <DialogHeader><DialogTitle>Modifier l'audit {editAudit.reference}</DialogTitle></DialogHeader>
              <Tabs defaultValue="general">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="general">Général</TabsTrigger>
                  <TabsTrigger value="programme">Programme</TabsTrigger>
                  <TabsTrigger value="rapport">Rapport</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Référence</Label><Input value={editAudit.reference} onChange={(e) => setEditAudit({ ...editAudit, reference: e.target.value })} /></div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={editAudit.type_audit} onValueChange={(v) => setEditAudit({ ...editAudit, type_audit: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interne">Interne</SelectItem>
                          <SelectItem value="externe">Externe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Statut</Label>
                      <Select value={editAudit.statut} onValueChange={(v) => setEditAudit({ ...editAudit, statut: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planifie">Planifié</SelectItem>
                          <SelectItem value="en_cours">En cours</SelectItem>
                          <SelectItem value="termine">Terminé</SelectItem>
                          <SelectItem value="cloture">Clôturé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Fréquence</Label><Input value={editAudit.frequence ?? ""} onChange={(e) => setEditAudit({ ...editAudit, frequence: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Date début</Label><Input type="date" value={editAudit.date_audit ?? ""} onChange={(e) => setEditAudit({ ...editAudit, date_audit: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Date fin</Label><Input type="date" value={editAudit.date_fin ?? ""} onChange={(e) => setEditAudit({ ...editAudit, date_fin: e.target.value })} /></div>
                    <div className="space-y-2 col-span-2">
                      <Label>Auditeur</Label>
                      <Select value={editAudit.auditeur_id ?? ""} onValueChange={(v) => setEditAudit({ ...editAudit, auditeur_id: v || null })}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>
                          {acteurs.map(a => <SelectItem key={a.id} value={a.id}>{a.fonction || "—"}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Périmètre</Label><Textarea value={editAudit.perimetre ?? ""} onChange={(e) => setEditAudit({ ...editAudit, perimetre: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Responsabilités</Label><Textarea value={editAudit.responsabilites ?? ""} onChange={(e) => setEditAudit({ ...editAudit, responsabilites: e.target.value })} /></div>
                </TabsContent>

                <TabsContent value="programme" className="space-y-4">
                  <div className="space-y-2"><Label>Programme d'audit</Label><Textarea value={editAudit.programme ?? ""} onChange={(e) => setEditAudit({ ...editAudit, programme: e.target.value })} rows={4} placeholder="Objectifs, périmètre global, calendrier..." /></div>
                  <div className="space-y-2"><Label>Méthodes</Label><Textarea value={editAudit.methodes ?? ""} onChange={(e) => setEditAudit({ ...editAudit, methodes: e.target.value })} rows={3} placeholder="Entretiens, revue documentaire, observation..." /></div>
                </TabsContent>

                <TabsContent value="rapport" className="space-y-4">
                  <div className="space-y-2"><Label>Rapport d'audit</Label><Textarea value={editAudit.rapport ?? ""} onChange={(e) => setEditAudit({ ...editAudit, rapport: e.target.value })} rows={5} /></div>
                  <div className="space-y-2"><Label>Résultats d'audit</Label><Textarea value={editAudit.resultats ?? ""} onChange={(e) => setEditAudit({ ...editAudit, resultats: e.target.value })} rows={4} /></div>
                  <div className="space-y-2"><Label>Preuve de réalisation</Label><Textarea value={editAudit.preuve_realisation ?? ""} onChange={(e) => setEditAudit({ ...editAudit, preuve_realisation: e.target.value })} rows={3} /></div>
                </TabsContent>
              </Tabs>
              <Button onClick={handleUpdate} className="w-full mt-4">Enregistrer</Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Delete Confirmation */}
      <AdminPasswordDialog
        open={!!deleteAudit}
        onOpenChange={(o) => !o && setDeleteAudit(null)}
        onConfirm={handleDeleteAudit}
        title="Suppression d'audit"
        description={`La suppression de l'audit "${deleteAudit?.reference}" est irréversible. Tous les constats associés seront également supprimés. Cette action nécessite les identifiants d'un administrateur.`}
      />
    </div>
  );
}
