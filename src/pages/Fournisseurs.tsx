import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, ShieldCheck } from "lucide-react";
import { ValidationPanel } from "@/components/validation/ValidationPanel";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { HelpTooltip } from "@/components/HelpTooltip";

const statutColors: Record<string, string> = {
  actif: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  suspendu: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  retire: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
const statutLabels: Record<string, string> = { actif: "Actif", suspendu: "Suspendu", retire: "Retiré" };
const typeLabels: Record<string, string> = { fournisseur: "Fournisseur", sous_traitant: "Sous-traitant", prestataire: "Prestataire" };

const emptyForm = { reference: "", nom: "", type_prestataire: "fournisseur", domaine: "", contact: "", email: "", telephone: "", statut: "actif", date_evaluation: "", score_evaluation: "", criteres_evaluation: "", commentaire: "" };

export default function Fournisseurs() {
  const { hasRole, hasPermission } = useAuth();
  const canEdit = hasPermission("fournisseurs", "can_edit");
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [validationId, setValidationId] = useState<string | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("nom");
      if (error) throw error;
      return data;
    },
  });

  const saveMut = useMutation({
    mutationFn: async (f: typeof form & { id?: string }) => {
      const payload = { reference: f.reference, nom: f.nom, type_prestataire: f.type_prestataire, domaine: f.domaine, contact: f.contact, email: f.email || null, telephone: f.telephone || null, statut: f.statut, date_evaluation: f.date_evaluation || null, score_evaluation: f.score_evaluation ? parseFloat(f.score_evaluation) : null, criteres_evaluation: f.criteres_evaluation, commentaire: f.commentaire };
      if (f.id) { const { error } = await supabase.from("suppliers").update(payload).eq("id", f.id); if (error) throw error; }
      else { const { error } = await supabase.from("suppliers").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); setDialog(false); toast({ title: "Fournisseur enregistré" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("suppliers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast({ title: "Fournisseur supprimé" }); },
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialog(true); };
  const openEdit = (s: any) => {
    setEditing(s);
    setForm({ reference: s.reference, nom: s.nom, type_prestataire: s.type_prestataire, domaine: s.domaine, contact: s.contact, email: s.email || "", telephone: s.telephone || "", statut: s.statut, date_evaluation: s.date_evaluation || "", score_evaluation: s.score_evaluation?.toString() || "", criteres_evaluation: s.criteres_evaluation, commentaire: s.commentaire });
    setDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">Prestataires externes <HelpTooltip term="fournisseur" /></h1>
          
        </div>
        {canEdit && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nouveau fournisseur</Button>}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Réf.</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Domaine</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Statut</TableHead>
              {canEdit && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow><TableCell colSpan={canEdit ? 8 : 7} className="text-center text-muted-foreground py-8">Aucun fournisseur enregistré.</TableCell></TableRow>
            ) : suppliers.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.reference}</TableCell>
                <TableCell className="font-medium">{s.nom}</TableCell>
                <TableCell>{typeLabels[s.type_prestataire] || s.type_prestataire}</TableCell>
                <TableCell>{s.domaine}</TableCell>
                <TableCell className="text-sm">{s.contact}</TableCell>
                <TableCell className="font-semibold">{s.score_evaluation != null ? `${s.score_evaluation}/10` : "—"}</TableCell>
                <TableCell><Badge className={statutColors[s.statut]}>{statutLabels[s.statut]}</Badge></TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Validation" onClick={() => setValidationId(s.id)}><ShieldCheck className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouveau"} fournisseur</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Référence</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="FRN-001" /></div>
              <div><Label>Nom</Label><Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
              <div><Label>Type</Label>
                <Select value={form.type_prestataire} onValueChange={v => setForm(f => ({ ...f, type_prestataire: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fournisseur">Fournisseur</SelectItem>
                    <SelectItem value="sous_traitant">Sous-traitant</SelectItem>
                    <SelectItem value="prestataire">Prestataire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Domaine</Label><Input value={form.domaine} onChange={e => setForm(f => ({ ...f, domaine: e.target.value }))} /></div>
              <div><Label>Contact</Label><Input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Téléphone</Label><Input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Statut</Label>
                <Select value={form.statut} onValueChange={v => setForm(f => ({ ...f, statut: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="suspendu">Suspendu</SelectItem>
                    <SelectItem value="retire">Retiré</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date d'évaluation</Label><Input type="date" value={form.date_evaluation} onChange={e => setForm(f => ({ ...f, date_evaluation: e.target.value }))} /></div>
              <div><Label>Score (/10)</Label><Input type="number" min={0} max={10} step={0.5} value={form.score_evaluation} onChange={e => setForm(f => ({ ...f, score_evaluation: e.target.value }))} /></div>
            </div>
            <div><Label>Critères d'évaluation</Label><Textarea value={form.criteres_evaluation} onChange={e => setForm(f => ({ ...f, criteres_evaluation: e.target.value }))} placeholder="Qualité, délai, prix, service après-vente..." /></div>
            <div><Label>Commentaire</Label><Textarea value={form.commentaire} onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Annuler</Button>
            <Button onClick={() => saveMut.mutate({ ...form, id: editing?.id })} disabled={saveMut.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!validationId} onOpenChange={(o) => !o && setValidationId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Validation du fournisseur critique</DialogTitle></DialogHeader>
          {validationId && (
            <ValidationPanel
              entityType="fournisseur"
              entityId={validationId}
              onApproved={() => qc.invalidateQueries({ queryKey: ["suppliers"] })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
