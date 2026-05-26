import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, XCircle, Send, ShieldCheck, Archive, Clock, ArrowRight } from "lucide-react";

export type WorkflowStatut = "brouillon" | "en_revue" | "en_approbation" | "approuve" | "refuse" | "obsolete";

export const WORKFLOW_LABELS: Record<WorkflowStatut, string> = {
  brouillon: "Brouillon",
  en_revue: "En revue",
  en_approbation: "En approbation",
  approuve: "Approuvé",
  refuse: "Refusé",
  obsolete: "Obsolète",
};

export const WORKFLOW_COLORS: Record<WorkflowStatut, string> = {
  brouillon: "bg-muted text-muted-foreground border-border",
  en_revue: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  en_approbation: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  approuve: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  refuse: "bg-destructive/15 text-destructive border-destructive/30",
  obsolete: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  onChanged?: () => void;
}

interface DocFull {
  id: string;
  titre: string;
  code: string | null;
  statut_workflow: WorkflowStatut;
  redacteur_user_id: string | null;
  verificateur_user_id: string | null;
  approbateur_user_id: string | null;
  date_soumission: string | null;
  date_verification: string | null;
  date_approbation: string | null;
  date_prochaine_revue: string | null;
  frequence_revue_mois: number | null;
  motif_refus: string | null;
  obsolete_motif: string | null;
}

interface HistoryRow {
  id: string;
  user_id: string | null;
  action: string;
  from_statut: string | null;
  to_statut: string | null;
  commentaire: string | null;
  created_at: string;
}

export function DocumentWorkflowDialog({ open, onOpenChange, documentId, onChanged }: Props) {
  const { user, hasRole, hasPermission } = useAuth();
  const [doc, setDoc] = useState<DocFull | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);
  const [verifId, setVerifId] = useState<string>("");
  const [appId, setAppId] = useState<string>("");
  const [freqMois, setFreqMois] = useState<string>("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = hasRole("admin") || hasRole("rmq") || hasRole("super_admin");
  const canEdit = hasPermission("gestion_documentaire", "can_edit") || hasPermission("documents", "can_edit");

  const load = async () => {
    setLoading(true);
    const [{ data: d }, { data: h }, { data: p }] = await Promise.all([
      supabase.from("documents").select("id,titre,code,statut_workflow,redacteur_user_id,verificateur_user_id,approbateur_user_id,date_soumission,date_verification,date_approbation,date_prochaine_revue,frequence_revue_mois,motif_refus,obsolete_motif").eq("id", documentId).maybeSingle(),
      supabase.from("document_workflow_history").select("*").eq("document_id", documentId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,nom,prenom,email,actif"),
    ]);
    setDoc(d as any);
    setHistory((h ?? []) as any);
    const map: Record<string, string> = {};
    const opts: { id: string; label: string }[] = [];
    (p ?? []).forEach((row: any) => {
      const label = [row.prenom, row.nom].filter(Boolean).join(" ") || row.email || row.id;
      map[row.id] = label;
      if (row.actif) opts.push({ id: row.id, label });
    });
    setProfiles(map);
    setUsers(opts);
    if (d) {
      setVerifId((d as any).verificateur_user_id ?? "");
      setAppId((d as any).approbateur_user_id ?? "");
      setFreqMois((d as any).frequence_revue_mois?.toString() ?? "");
    }
    setLoading(false);
  };

  useEffect(() => { if (open && documentId) load(); }, [open, documentId]);

  if (!doc) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Chargement…</DialogTitle></DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const statut = doc.statut_workflow;
  const isRedacteur = user?.id === doc.redacteur_user_id;
  const isVerificateur = user?.id === doc.verificateur_user_id;
  const isApprobateur = user?.id === doc.approbateur_user_id;

  // Action permissions
  const canSubmit = (isRedacteur || isAdmin || canEdit) && statut === "brouillon";
  const canVerify = (isVerificateur || isAdmin) && statut === "en_revue";
  const canSendToApproval = (isVerificateur || isAdmin) && statut === "en_revue";
  const canApprove = (isApprobateur || isAdmin) && statut === "en_approbation";
  const canReject = (isVerificateur || isApprobateur || isAdmin) && (statut === "en_revue" || statut === "en_approbation");
  const canMakeObsolete = isAdmin && statut === "approuve";
  const canReactivate = isAdmin && (statut === "refuse" || statut === "obsolete");

  const updateStatut = async (
    newStatut: WorkflowStatut,
    extra: Partial<DocFull> = {},
    requiresComment = false,
  ) => {
    if (requiresComment && !comment.trim()) {
      toast.error("Un commentaire est requis pour cette action.");
      return;
    }
    setSaving(true);
    const payload: any = { statut_workflow: newStatut, ...extra };
    if (newStatut === "en_revue") payload.date_soumission = new Date().toISOString();
    if (newStatut === "en_approbation") payload.date_verification = new Date().toISOString();
    if (newStatut === "refuse") payload.motif_refus = comment.trim() || null;
    if (newStatut === "obsolete") payload.obsolete_motif = comment.trim() || null;
    const { error } = await supabase.from("documents").update(payload).eq("id", documentId);
    if (error) {
      toast.error("Erreur : " + error.message);
      setSaving(false);
      return;
    }
    toast.success("Statut mis à jour : " + WORKFLOW_LABELS[newStatut]);
    setComment("");
    setSaving(false);
    await load();
    onChanged?.();
  };

  const saveRoles = async () => {
    setSaving(true);
    const payload: any = {
      verificateur_user_id: verifId || null,
      approbateur_user_id: appId || null,
      frequence_revue_mois: freqMois ? parseInt(freqMois, 10) : null,
    };
    const { error } = await supabase.from("documents").update(payload).eq("id", documentId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Configuration enregistrée");
    await load();
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Cycle d'approbation
            {doc.code && <Badge variant="outline" className="font-mono text-xs">{doc.code}</Badge>}
            <Badge className={WORKFLOW_COLORS[statut] + " border"}>{WORKFLOW_LABELS[statut]}</Badge>
          </DialogTitle>
          <DialogDescription>{doc.titre}</DialogDescription>
        </DialogHeader>

        {/* Roles */}
        <div className="space-y-3 border-b pb-4">
          <h3 className="text-sm font-semibold">Rôles & paramètres</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Rédacteur</Label>
              <Input value={doc.redacteur_user_id ? profiles[doc.redacteur_user_id] || "—" : "—"} disabled className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fréquence de revue (mois)</Label>
              <Input type="number" min={1} max={120} value={freqMois} onChange={e => setFreqMois(e.target.value)} disabled={!isAdmin || statut === "obsolete"} className="h-8 text-xs" placeholder="ex : 12" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vérificateur</Label>
              <Select value={verifId || "__none__"} onValueChange={v => setVerifId(v === "__none__" ? "" : v)} disabled={!isAdmin || (statut !== "brouillon" && statut !== "en_revue")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucun —</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Approbateur</Label>
              <Select value={appId || "__none__"} onValueChange={v => setAppId(v === "__none__" ? "" : v)} disabled={!isAdmin || statut === "approuve" || statut === "obsolete"}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Aucun —</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={saveRoles} disabled={saving}>Enregistrer la configuration</Button>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-b pb-3">
          {doc.date_soumission && <div>Soumission : {format(parseISO(doc.date_soumission), "dd/MM/yyyy", { locale: fr })}</div>}
          {doc.date_verification && <div>Vérification : {format(parseISO(doc.date_verification), "dd/MM/yyyy", { locale: fr })}</div>}
          {doc.date_approbation && <div>Approbation : {format(parseISO(doc.date_approbation), "dd/MM/yyyy", { locale: fr })}</div>}
          {doc.date_prochaine_revue && <div className="text-amber-600 dark:text-amber-400">Prochaine revue : {format(parseISO(doc.date_prochaine_revue), "dd/MM/yyyy", { locale: fr })}</div>}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Actions disponibles</h3>
          {(canReject || statut === "obsolete" || statut === "refuse") && (
            <Textarea placeholder="Commentaire (requis pour refus/obsolescence)" value={comment} onChange={e => setComment(e.target.value)} rows={2} className="text-sm" />
          )}
          <div className="flex flex-wrap gap-2">
            {canSubmit && (
              <Button size="sm" onClick={() => updateStatut("en_revue")} disabled={saving || !doc.verificateur_user_id}>
                <Send className="h-3.5 w-3.5 mr-1" /> Soumettre pour revue
              </Button>
            )}
            {canSendToApproval && (
              <Button size="sm" onClick={() => updateStatut("en_approbation")} disabled={saving || !doc.approbateur_user_id}>
                <ArrowRight className="h-3.5 w-3.5 mr-1" /> Envoyer en approbation
              </Button>
            )}
            {canApprove && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatut("approuve")} disabled={saving}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approuver
              </Button>
            )}
            {canReject && (
              <Button size="sm" variant="destructive" onClick={() => updateStatut("refuse", {}, true)} disabled={saving}>
                <XCircle className="h-3.5 w-3.5 mr-1" /> Refuser
              </Button>
            )}
            {canMakeObsolete && (
              <Button size="sm" variant="outline" onClick={() => updateStatut("obsolete", { retired_at: new Date().toISOString() } as any, true)} disabled={saving}>
                <Archive className="h-3.5 w-3.5 mr-1" /> Rendre obsolète
              </Button>
            )}
            {canReactivate && (
              <Button size="sm" variant="outline" onClick={() => updateStatut("brouillon", { retired_at: null, motif_refus: null, obsolete_motif: null } as any)} disabled={saving}>
                Réactiver (brouillon)
              </Button>
            )}
            {!canSubmit && !canSendToApproval && !canApprove && !canReject && !canMakeObsolete && !canReactivate && (
              <p className="text-xs text-muted-foreground italic">Aucune action disponible pour vous à ce stade.</p>
            )}
          </div>
          {doc.motif_refus && <p className="text-xs text-destructive">Motif de refus : {doc.motif_refus}</p>}
          {doc.obsolete_motif && <p className="text-xs text-muted-foreground">Motif d'obsolescence : {doc.obsolete_motif}</p>}
        </div>

        {/* History */}
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Historique du workflow</h3>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucun événement</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {history.map(h => (
                <div key={h.id} className="text-xs flex items-start gap-2 p-2 rounded bg-muted/50">
                  <Badge className={WORKFLOW_COLORS[(h.to_statut as WorkflowStatut) ?? "brouillon"] + " border text-[10px] shrink-0"}>
                    {WORKFLOW_LABELS[(h.to_statut as WorkflowStatut) ?? "brouillon"]}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-muted-foreground">
                      {h.from_statut && <>{WORKFLOW_LABELS[h.from_statut as WorkflowStatut]} → </>}
                      <span className="font-medium text-foreground">{WORKFLOW_LABELS[(h.to_statut as WorkflowStatut) ?? "brouillon"]}</span>
                    </p>
                    {h.commentaire && <p className="text-foreground/80 italic">« {h.commentaire} »</p>}
                    <p className="text-[10px] text-muted-foreground">
                      {h.user_id ? profiles[h.user_id] || "Utilisateur" : "Système"} • {format(parseISO(h.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
