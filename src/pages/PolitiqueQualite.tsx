import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, FileText, Target, X, Download, ShieldCheck } from "lucide-react";
import { exportPolitiqueQualitePdf, exportObjectifsQualitePdf } from "@/lib/exportStrategicPdf";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import RichTextEditor from "@/components/RichTextEditor";
import { HelpTooltip } from "@/components/HelpTooltip";
import { ValidationPanel } from "@/components/validation/ValidationPanel";

const statutPolicyColors: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  valide: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  archive: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};
const statutObjColors: Record<string, string> = {
  en_cours: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  atteint: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  non_atteint: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
const statutObjLabels: Record<string, string> = { en_cours: "En cours", atteint: "Atteint", non_atteint: "Non atteint" };
const statutPolicyLabels: Record<string, string> = { brouillon: "Brouillon", valide: "Validé", archive: "Archivé" };

export default function PolitiqueQualite() {
  const { hasRole, hasPermission } = useAuth();
  const canEdit = hasPermission("politique_qualite", "can_edit");
  const qc = useQueryClient();

  const [policyDialog, setPolicyDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);
  const [policyForm, setPolicyForm] = useState({ titre: "", contenu: "", objectifs: "", statut: "brouillon", version: 1 });

  const [objDialog, setObjDialog] = useState(false);
  const [editingObj, setEditingObj] = useState<any>(null);
  const [objForm, setObjForm] = useState({ reference: "", description: "", indicateur: "", cible: "", echeance: "", statut: "en_cours", commentaire: "" });
  const [validationObjId, setValidationObjId] = useState<string | null>(null);

  const { data: policies = [] } = useQuery({
    queryKey: ["quality_policy"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quality_policy").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: objectives = [] } = useQuery({
    queryKey: ["quality_objectives"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quality_objectives").select("*").order("reference");
      if (error) throw error;
      return data;
    },
  });

  const savePolicyMut = useMutation({
    mutationFn: async (form: typeof policyForm & { id?: string }) => {
      const payload = { titre: form.titre, contenu: form.contenu, objectifs: form.objectifs, statut: form.statut, version: form.version };
      if (form.id) {
        const { error } = await supabase.from("quality_policy").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quality_policy").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quality_policy"] }); setPolicyDialog(false); toast({ title: "Politique qualité enregistrée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deletePolicyMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("quality_policy").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quality_policy"] }); toast({ title: "Politique supprimée" }); },
  });

  const saveObjMut = useMutation({
    mutationFn: async (form: typeof objForm & { id?: string }) => {
      const payload = { reference: form.reference, description: form.description, indicateur: form.indicateur, cible: form.cible, echeance: form.echeance || null, statut: form.statut, commentaire: form.commentaire };
      if (form.id) {
        const { error } = await supabase.from("quality_objectives").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quality_objectives").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quality_objectives"] }); setObjDialog(false); toast({ title: "Objectif enregistré" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteObjMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("quality_objectives").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quality_objectives"] }); toast({ title: "Objectif supprimé" }); },
  });

  const openEditPolicy = (p: any) => { setEditingPolicy(p); setPolicyForm({ titre: p.titre, contenu: p.contenu, objectifs: p.objectifs, statut: p.statut, version: p.version }); setPolicyDialog(true); };
  const openNewPolicy = () => { setEditingPolicy(null); setPolicyForm({ titre: "", contenu: "", objectifs: "", statut: "brouillon", version: 1 }); setPolicyDialog(true); };
  const openEditObj = (o: any) => { setEditingObj(o); setObjForm({ reference: o.reference, description: o.description, indicateur: o.indicateur, cible: o.cible, echeance: o.echeance || "", statut: o.statut, commentaire: o.commentaire }); setObjDialog(true); };
  const openNewObj = () => { setEditingObj(null); setObjForm({ reference: "", description: "", indicateur: "", cible: "", echeance: "", statut: "en_cours", commentaire: "" }); setObjDialog(true); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">Politique & Objectifs Qualité <HelpTooltip term="politique_qualite" /></h1>
      </div>

      <Tabs defaultValue="politique">
        <TabsList>
          <TabsTrigger value="politique"><FileText className="h-4 w-4 mr-1" />Politique qualité</TabsTrigger>
          <TabsTrigger value="objectifs"><Target className="h-4 w-4 mr-1" />Objectifs qualité</TabsTrigger>
        </TabsList>

        <TabsContent value="politique" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Politique qualité</h2>
            <div className="flex gap-2">
              {policies.length > 0 && <Button variant="outline" onClick={exportPolitiqueQualitePdf}><Download className="h-4 w-4 mr-1" />Exporter PDF</Button>}
              {canEdit && <Button onClick={openNewPolicy}><Plus className="h-4 w-4 mr-1" />Nouvelle version</Button>}
            </div>
          </div>

          {policies.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune politique qualité définie.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              {policies.map((p: any) => (
                <Card key={p.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{p.titre || "Politique qualité"}</CardTitle>
                      <CardDescription>Version {p.version} — {p.date_approbation ? format(new Date(p.date_approbation), "dd/MM/yyyy") : "Non approuvée"}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statutPolicyColors[p.statut]}>{statutPolicyLabels[p.statut]}</Badge>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEditPolicy(p)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deletePolicyMut.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Contenu de la politique</Label>
                      <div className="prose prose-sm max-w-none mt-1 text-sm" dangerouslySetInnerHTML={{ __html: p.contenu || "—" }} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Objectifs stratégiques</Label>
                      <div className="prose prose-sm max-w-none mt-1 text-sm" dangerouslySetInnerHTML={{ __html: p.objectifs || "—" }} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="objectifs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Objectifs qualité</h2>
            <div className="flex gap-2">
              {objectives.length > 0 && <Button variant="outline" onClick={exportObjectifsQualitePdf}><Download className="h-4 w-4 mr-1" />Exporter PDF</Button>}
              {canEdit && <Button onClick={openNewObj}><Plus className="h-4 w-4 mr-1" />Nouvel objectif</Button>}
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf.</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Indicateur</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Statut</TableHead>
                  {canEdit && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {objectives.length === 0 ? (
                  <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center text-muted-foreground py-8">Aucun objectif défini.</TableCell></TableRow>
                ) : objectives.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.reference}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{o.description}</TableCell>
                    <TableCell>{o.indicateur}</TableCell>
                    <TableCell>{o.cible}</TableCell>
                    <TableCell>{o.echeance ? format(new Date(o.echeance), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell><Badge className={statutObjColors[o.statut]}>{statutObjLabels[o.statut]}</Badge></TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditObj(o)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteObjMut.mutate(o.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Policy Dialog - Fullscreen */}
      {policyDialog && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold">{editingPolicy ? "Modifier" : "Nouvelle"} politique qualité</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Version</Label>
                <Input type="number" className="w-20 h-8" value={policyForm.version} onChange={e => setPolicyForm(f => ({ ...f, version: parseInt(e.target.value) || 1 }))} />
              </div>
              <Select value={policyForm.statut} onValueChange={v => setPolicyForm(f => ({ ...f, statut: v }))}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brouillon">Brouillon</SelectItem>
                  <SelectItem value="valide">Validé</SelectItem>
                  <SelectItem value="archive">Archivé</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Titre de la politique" className="w-64 h-8" value={policyForm.titre} onChange={e => setPolicyForm(f => ({ ...f, titre: e.target.value }))} />
              <Button size="sm" variant="outline" onClick={() => setPolicyDialog(false)}>Annuler</Button>
              <Button size="sm" onClick={() => savePolicyMut.mutate({ ...policyForm, id: editingPolicy?.id })} disabled={savePolicyMut.isPending}>Enregistrer</Button>
              <Button size="sm" variant="ghost" onClick={() => setPolicyDialog(false)}><X className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden grid grid-cols-2 gap-0 divide-x divide-border">
            <div className="flex flex-col overflow-hidden">
              <div className="px-4 py-2 bg-muted/20 border-b border-border">
                <Label className="text-sm font-medium">Contenu de la politique</Label>
              </div>
              <div className="flex-1 overflow-hidden">
                <RichTextEditor
                  value={policyForm.contenu}
                  onChange={v => setPolicyForm(f => ({ ...f, contenu: v }))}
                  placeholder="Engagement de la direction, orientations stratégiques..."
                  a4
                />
              </div>
            </div>
            <div className="flex flex-col overflow-hidden">
              <div className="px-4 py-2 bg-muted/20 border-b border-border">
                <Label className="text-sm font-medium">Objectifs stratégiques</Label>
              </div>
              <div className="flex-1 overflow-hidden">
                <RichTextEditor
                  value={policyForm.objectifs}
                  onChange={v => setPolicyForm(f => ({ ...f, objectifs: v }))}
                  placeholder="Objectifs globaux de la politique qualité..."
                  a4
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Objective Dialog */}
      <Dialog open={objDialog} onOpenChange={setObjDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingObj ? "Modifier" : "Nouvel"} objectif qualité</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Référence</Label><Input value={objForm.reference} onChange={e => setObjForm(f => ({ ...f, reference: e.target.value }))} placeholder="OBJ-001" /></div>
              <div><Label>Statut</Label>
                <Select value={objForm.statut} onValueChange={v => setObjForm(f => ({ ...f, statut: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="atteint">Atteint</SelectItem>
                    <SelectItem value="non_atteint">Non atteint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Description</Label><Textarea value={objForm.description} onChange={e => setObjForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Indicateur de mesure</Label><Input value={objForm.indicateur} onChange={e => setObjForm(f => ({ ...f, indicateur: e.target.value }))} /></div>
              <div><Label>Cible</Label><Input value={objForm.cible} onChange={e => setObjForm(f => ({ ...f, cible: e.target.value }))} /></div>
            </div>
            <div><Label>Échéance</Label><Input type="date" value={objForm.echeance} onChange={e => setObjForm(f => ({ ...f, echeance: e.target.value }))} /></div>
            <div><Label>Commentaire</Label><Textarea value={objForm.commentaire} onChange={e => setObjForm(f => ({ ...f, commentaire: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObjDialog(false)}>Annuler</Button>
            <Button onClick={() => saveObjMut.mutate({ ...objForm, id: editingObj?.id })} disabled={saveObjMut.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
