import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Eye, X, Download, ShieldCheck } from "lucide-react";
import { ValidationPanel } from "@/components/validation/ValidationPanel";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import RichTextEditor from "@/components/RichTextEditor";
import ParticipantSelector, { formatParticipantsDisplay, parseParticipants } from "@/components/ParticipantSelector";
import { ReviewInputItemsEditor, ReviewInputItemsView } from "@/components/ReviewInputItems";
import { ReviewDecisionsEditor, ReviewDecisionsView } from "@/components/ReviewDecisions";
import { HelpTooltip } from "@/components/HelpTooltip";
import { exportRevueDirectionIsoPdf } from "@/lib/exportStrategicPdf";

const statutColors: Record<string, string> = {
  planifiee: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  realisee: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cloturee: "bg-muted text-muted-foreground",
};
const statutLabels: Record<string, string> = { planifiee: "Planifiée", realisee: "Réalisée", cloturee: "Clôturée" };

const emptyForm = { reference: "", date_revue: "", participants: "", elements_entree: "", decisions: "", actions_decidees: "", statut: "planifiee", compte_rendu: "", prochaine_revue: "" };

const ISO_932_SECTIONS = [
  { key: "participants", label: "Participants" },
  { key: "entree_a", label: "a) Actions revues précédentes", iso: "§9.3.2 a)" },
  { key: "entree_b", label: "b) Enjeux externes/internes", iso: "§9.3.2 b)" },
  { key: "entree_c", label: "c) Performance SMQ", iso: "§9.3.2 c)" },
  { key: "entree_d", label: "d) Adéquation des ressources", iso: "§9.3.2 d)" },
  { key: "entree_e", label: "e) Risques et opportunités", iso: "§9.3.2 e)" },
  { key: "entree_f", label: "f) Opportunités d'amélioration", iso: "§9.3.2 f)" },
  { key: "sortie_a", label: "a) Opportunités d'amélioration", iso: "§9.3.3 a)" },
  { key: "sortie_b", label: "b) Changements SMQ", iso: "§9.3.3 b)" },
  { key: "sortie_c", label: "c) Besoins en ressources", iso: "§9.3.3 c)" },
  { key: "decisions", label: "Décisions" },
  { key: "compte_rendu", label: "Compte rendu" },
] as const;

const ENTREE_SECTIONS = ISO_932_SECTIONS.filter(s => s.key.startsWith("entree_"));
const SORTIE_SECTIONS = ISO_932_SECTIONS.filter(s => s.key.startsWith("sortie_"));

// Pre-populate ISO categories as root items when creating a new review
async function prepopulateIsoCategories(reviewId: string) {
  const categories = [
    // §9.3.2 Éléments d'entrée
    { ordre: 1, type: "iso", label: "a) État d'avancement des actions des revues précédentes" },
    { ordre: 2, type: "iso", label: "b) Modifications des enjeux externes et internes" },
    { ordre: 3, type: "iso", label: "c) Performance et efficacité du SMQ" },
    { ordre: 4, type: "iso", label: "c.1) Satisfaction clients et retours parties intéressées" },
    { ordre: 5, type: "iso", label: "c.2) Degré de réalisation des objectifs qualité" },
    { ordre: 6, type: "iso", label: "c.3) Performance des processus et conformité" },
    { ordre: 7, type: "iso", label: "c.4) Non-conformités et actions correctives" },
    { ordre: 8, type: "iso", label: "c.5) Résultats de surveillance et de mesure" },
    { ordre: 9, type: "iso", label: "c.6) Résultats d'audit" },
    { ordre: 10, type: "iso", label: "c.7) Performances des prestataires externes" },
    { ordre: 11, type: "iso", label: "d) Adéquation des ressources" },
    { ordre: 12, type: "iso", label: "e) Efficacité des actions face aux risques et opportunités" },
    { ordre: 13, type: "iso", label: "f) Opportunités d'amélioration" },
  ];

  const items = categories.map(c => ({
    review_id: reviewId,
    parent_id: null,
    ...c,
    entity_id: null,
    commentaire: "",
  }));

  await supabase.from("review_input_items").insert(items as any);
}

export default function RevueDirectionISO() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("revue_direction_iso", "can_edit");
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeField, setActiveField] = useState<string>("participants");

  const { data: reviews = [] } = useQuery({
    queryKey: ["management_reviews_iso"],
    queryFn: async () => {
      const { data, error } = await supabase.from("management_reviews").select("*").filter("type_revue", "eq", "direction").order("date_revue", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMut = useMutation({
    mutationFn: async (f: typeof form & { id?: string }) => {
      const payload = { reference: f.reference, date_revue: f.date_revue || null, participants: f.participants, elements_entree: f.elements_entree, decisions: f.decisions, actions_decidees: f.actions_decidees, statut: f.statut, compte_rendu: f.compte_rendu, prochaine_revue: f.prochaine_revue || null } as any;
      if (f.id) {
        const { error } = await supabase.from("management_reviews").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        payload.type_revue = "direction";
        const { error } = await supabase.from("management_reviews").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["management_reviews_iso"] }); setDialog(false); toast({ title: "Revue de direction enregistrée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("management_reviews").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["management_reviews_iso"] }); toast({ title: "Revue supprimée" }); },
  });

  const openNew = async () => {
    const { data, error } = await supabase.from("management_reviews").insert({ reference: "", statut: "planifiee", type_revue: "direction" } as any).select().single();
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    // Pre-populate ISO §9.3.2 categories
    await prepopulateIsoCategories(data.id);
    setEditing(data);
    setForm({ reference: data.reference, date_revue: data.date_revue || "", participants: data.participants, elements_entree: data.elements_entree, decisions: data.decisions, actions_decidees: data.actions_decidees, statut: data.statut, compte_rendu: data.compte_rendu, prochaine_revue: data.prochaine_revue || "" });
    setActiveField("participants");
    setDialog(true);
  };

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({ reference: r.reference, date_revue: r.date_revue || "", participants: r.participants, elements_entree: r.elements_entree, decisions: r.decisions, actions_decidees: r.actions_decidees, statut: r.statut, compte_rendu: r.compte_rendu, prochaine_revue: r.prochaine_revue || "" });
    setActiveField("participants");
    setDialog(true);
  };

  const ALL_EDIT_SECTIONS = [
    { key: "participants", label: "Participants" },
    { key: "elements_entree", label: "§9.3.2 — Éléments d'entrée" },
    { key: "decisions", label: "Décisions" },
    { key: "actions_decidees", label: "§9.3.3 — Éléments de sortie" },
    { key: "compte_rendu", label: "Compte rendu" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            Revue de direction <HelpTooltip term="revue_direction_iso" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Conforme à l'article 9.3 de la norme ISO 9001:2015</p>
        </div>
        {canEdit && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nouvelle revue</Button>}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Réf.</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Prochaine revue</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune revue de direction enregistrée.</TableCell></TableRow>
            ) : reviews.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                <TableCell>{r.date_revue ? format(new Date(r.date_revue), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{formatParticipantsDisplay(r.participants)}</TableCell>
                <TableCell><Badge className={statutColors[r.statut]}>{statutLabels[r.statut]}</Badge></TableCell>
                <TableCell>{r.prochaine_revue ? format(new Date(r.prochaine_revue), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setViewing(r); setViewDialog(true); }}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => exportRevueDirectionIsoPdf(r.id)} title="Exporter PDF"><Download className="h-4 w-4" /></Button>
                    {canEdit && <>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Revue de direction — {viewing?.reference}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs text-muted-foreground">Date</Label><p className="text-sm">{viewing.date_revue ? format(new Date(viewing.date_revue), "dd/MM/yyyy") : "—"}</p></div>
                <div><Label className="text-xs text-muted-foreground">Statut</Label><Badge className={statutColors[viewing.statut]}>{statutLabels[viewing.statut]}</Badge></div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Participants</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {parseParticipants(viewing.participants).length === 0 ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : parseParticipants(viewing.participants).map((p, i) => (
                    <Badge key={i} variant={p.type === "user" ? "default" : "secondary"} className="text-xs">
                      {p.name} {p.fonction ? `(${p.fonction})` : ""} {p.type === "guest" ? "[Invité]" : ""}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">§9.3.2 — Éléments d'entrée</Label>
                <div className="mt-1"><ReviewInputItemsView reviewId={viewing.id} /></div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Décisions</Label>
                <div className="prose prose-sm max-w-none text-sm mt-1" dangerouslySetInnerHTML={{ __html: viewing.decisions || "—" }} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">§9.3.3 — Éléments de sortie (Actions)</Label>
                <div className="mt-1"><ReviewDecisionsView reviewId={viewing.id} filterType="action" /></div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Compte rendu</Label>
                <div className="prose prose-sm max-w-none text-sm mt-1" dangerouslySetInnerHTML={{ __html: viewing.compte_rendu || "—" }} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit - Fullscreen */}
      {dialog && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/30">
            <h2 className="text-lg font-semibold">{editing ? "Modifier" : "Nouvelle"} revue de direction (§9.3)</h2>
            <div className="flex items-center gap-3">
              <Input placeholder="Réf." className="w-32 h-8" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
              <Input type="date" className="w-40 h-8" value={form.date_revue} onChange={e => setForm(f => ({ ...f, date_revue: e.target.value }))} />
              <Select value={form.statut} onValueChange={v => setForm(f => ({ ...f, statut: v }))}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planifiee">Planifiée</SelectItem>
                  <SelectItem value="realisee">Réalisée</SelectItem>
                  <SelectItem value="cloturee">Clôturée</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Prochaine</Label>
                <Input type="date" className="w-40 h-8" value={form.prochaine_revue} onChange={e => setForm(f => ({ ...f, prochaine_revue: e.target.value }))} />
              </div>
              <Button size="sm" variant="outline" onClick={() => setDialog(false)}>Annuler</Button>
              <Button size="sm" onClick={() => saveMut.mutate({ ...form, id: editing?.id })} disabled={saveMut.isPending}>Enregistrer</Button>
              <Button size="sm" variant="ghost" onClick={() => setDialog(false)}><X className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="w-64 border-r border-border bg-muted/20 py-2 flex-shrink-0 overflow-y-auto">
              {ALL_EDIT_SECTIONS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveField(f.key)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    activeField === f.key
                      ? "bg-accent text-accent-foreground font-medium border-r-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Participants */}
              <div className={`p-6 ${activeField === "participants" ? "" : "hidden"}`}>
                <div className="max-w-2xl mx-auto">
                  <h3 className="text-lg font-semibold mb-4">Participants à la revue de direction</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Membres de la direction et parties intéressées participant à la revue.
                  </p>
                  <ParticipantSelector value={form.participants} onChange={v => setForm(prev => ({ ...prev, participants: v }))} />
                </div>
              </div>

              {/* §9.3.2 Éléments d'entrée */}
              <div className={`p-6 ${activeField === "elements_entree" ? "" : "hidden"}`}>
                <div className="max-w-3xl mx-auto">
                  <h3 className="text-lg font-semibold mb-2">§9.3.2 — Éléments d'entrée de la revue de direction</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Les catégories ISO 9001 sont pré-créées. Ajoutez des sous-éléments sous chaque catégorie en liant des données existantes (indicateurs, risques, audits, NC, etc.).
                  </p>
                  <ReviewInputItemsEditor reviewId={editing?.id} canEdit={canEdit} />
                </div>
              </div>

              {/* Décisions */}
              <div className={`h-full ${activeField === "decisions" ? "" : "hidden"}`}>
                <RichTextEditor
                  value={form.decisions}
                  onChange={v => setForm(prev => ({ ...prev, decisions: v }))}
                  placeholder="Décisions prises lors de la revue de direction..."
                  a4
                />
              </div>

              {/* §9.3.3 Actions / Éléments de sortie */}
              <div className={`p-6 ${activeField === "actions_decidees" ? "" : "hidden"}`}>
                <div className="max-w-3xl mx-auto">
                  <h3 className="text-lg font-semibold mb-2">§9.3.3 — Éléments de sortie de la revue de direction</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Décisions et actions relatives aux opportunités d'amélioration, changements SMQ et besoins en ressources.
                  </p>
                  <ReviewDecisionsEditor reviewId={editing?.id} canEdit={canEdit} filterType="action" />
                </div>
              </div>

              {/* Compte rendu */}
              <div className={`h-full ${activeField === "compte_rendu" ? "" : "hidden"}`}>
                <RichTextEditor
                  value={form.compte_rendu}
                  onChange={v => setForm(prev => ({ ...prev, compte_rendu: v }))}
                  placeholder="Compte rendu détaillé de la revue de direction..."
                  a4
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
