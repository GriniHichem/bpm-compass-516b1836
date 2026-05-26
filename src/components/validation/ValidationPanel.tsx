import { useEffect, useMemo, useState } from "react";
import { useValidationWorkflow, type ValidationStatut } from "@/hooks/useValidationWorkflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Send, ShieldCheck, Archive, History } from "lucide-react";

interface Profile {
  id: string;
  nom: string;
  prenom: string;
  fonction: string | null;
}

interface ValidationPanelProps {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  onApproved?: () => void;
  className?: string;
}

const STATUT_LABELS: Record<ValidationStatut, string> = {
  brouillon: "Brouillon",
  en_revue: "En revue",
  en_approbation: "En approbation",
  approuve: "Approuvé",
  refuse: "Refusé",
  obsolete: "Obsolète",
};

const STATUT_VARIANTS: Record<ValidationStatut, "default" | "secondary" | "destructive" | "outline"> = {
  brouillon: "outline",
  en_revue: "secondary",
  en_approbation: "secondary",
  approuve: "default",
  refuse: "destructive",
  obsolete: "outline",
};

export function ValidationPanel({
  entityType,
  entityId,
  entityLabel,
  onApproved,
  className,
}: ValidationPanelProps) {
  const { user } = useAuth();
  const { workflow, config, history, loading, ensureWorkflow, submit, verify, approve, reject, markObsolete } =
    useValidationWorkflow(entityType, entityId);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [verificateurId, setVerificateurId] = useState<string>("");
  const [approbateurId, setApprobateurId] = useState<string>("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [obsoleteOpen, setObsoleteOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, nom, prenom, fonction")
      .eq("actif", true)
      .order("nom")
      .then(({ data }) => setProfiles((data ?? []) as Profile[]));
  }, []);

  useEffect(() => {
    if (workflow) {
      setVerificateurId(workflow.verificateur_user_id ?? "");
      setApprobateurId(workflow.approbateur_user_id ?? "");
    }
  }, [workflow]);

  const userName = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.find((x) => x.id === id);
    return p ? `${p.prenom} ${p.nom}`.trim() : id.slice(0, 8);
  };

  const isAdmin = useMemo(() => false, []); // role check is enforced server-side
  const previousApproved = workflow?.statut === "approuve";

  const handleSubmit = async () => {
    if (!config) return;
    if (config.requires_verificateur && !verificateurId) {
      toast.error("Vérificateur requis");
      return;
    }
    if (config.requires_approbateur && !approbateurId) {
      toast.error("Approbateur requis");
      return;
    }
    try {
      setBusy(true);
      if (!workflow) await ensureWorkflow();
      await submit(verificateurId || null, approbateurId || null);
      toast.success("Soumis pour validation");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    try {
      setBusy(true);
      await verify();
      toast.success("Vérification enregistrée");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    try {
      setBusy(true);
      await approve();
      toast.success("Approuvé");
      if (!previousApproved) onApproved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!motif.trim()) {
      toast.error("Motif obligatoire");
      return;
    }
    try {
      setBusy(true);
      await reject(motif.trim());
      toast.success("Refusé");
      setRejectOpen(false);
      setMotif("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const handleObsolete = async () => {
    if (!motif.trim()) {
      toast.error("Motif obligatoire");
      return;
    }
    try {
      setBusy(true);
      await markObsolete(motif.trim());
      toast.success("Marqué obsolète");
      setObsoleteOpen(false);
      setMotif("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !workflow) {
    return (
      <Card className={className}>
        <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Chargement…
        </CardContent>
      </Card>
    );
  }

  const statut: ValidationStatut = workflow?.statut ?? "brouillon";
  const canSubmit = ["brouillon", "refuse"].includes(statut);
  const canVerify = statut === "en_revue" && (user?.id === workflow?.verificateur_user_id);
  const canApprove = statut === "en_approbation" && (user?.id === workflow?.approbateur_user_id);
  const canReject = ["en_revue", "en_approbation"].includes(statut);
  const canObsolete = statut === "approuve";

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Workflow de validation
            {entityLabel && <span className="text-muted-foreground font-normal">— {entityLabel}</span>}
          </CardTitle>
          <Badge variant={STATUT_VARIANTS[statut]}>{STATUT_LABELS[statut]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Acteurs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Rédacteur</Label>
            <div className="text-sm py-2">{userName(workflow?.redacteur_user_id ?? null)}</div>
          </div>
          <div>
            <Label className="text-xs">Vérificateur</Label>
            {canSubmit && config?.requires_verificateur ? (
              <Select value={verificateurId} onValueChange={setVerificateurId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm py-2">{userName(workflow?.verificateur_user_id ?? null)}</div>
            )}
          </div>
          <div>
            <Label className="text-xs">Approbateur</Label>
            {canSubmit && config?.requires_approbateur ? (
              <Select value={approbateurId} onValueChange={setApprobateurId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm py-2">{userName(workflow?.approbateur_user_id ?? null)}</div>
            )}
          </div>
        </div>

        {workflow?.statut === "refuse" && workflow.commentaire_refus && (
          <div className="text-sm p-3 rounded border border-destructive/40 bg-destructive/5 text-destructive">
            <strong>Motif de refus :</strong> {workflow.commentaire_refus}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <Button size="sm" onClick={handleSubmit} disabled={busy}>
              <Send className="h-3.5 w-3.5 mr-1" /> Soumettre
            </Button>
          )}
          {canVerify && (
            <Button size="sm" onClick={handleVerify} disabled={busy}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Vérifier
            </Button>
          )}
          {canApprove && (
            <Button size="sm" onClick={handleApprove} disabled={busy}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approuver
            </Button>
          )}
          {canReject && (
            <Button size="sm" variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Refuser
            </Button>
          )}
          {canObsolete && (
            <Button size="sm" variant="outline" onClick={() => setObsoleteOpen(true)} disabled={busy}>
              <Archive className="h-3.5 w-3.5 mr-1" /> Rendre obsolète
            </Button>
          )}
        </div>

        {/* Historique */}
        {history.length > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
              <History className="h-3.5 w-3.5" /> Historique ({history.length})
            </div>
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {history.map((h) => (
                <li key={h.id} className="text-xs flex items-start gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(h.created_at).toLocaleString("fr-FR")}
                  </span>
                  <span>
                    {h.from_statut ? `${STATUT_LABELS[h.from_statut as ValidationStatut] ?? h.from_statut} → ` : ""}
                    <strong>{STATUT_LABELS[h.to_statut as ValidationStatut] ?? h.to_statut}</strong>
                    {" par "}{userName(h.actor_user_id)}
                    {h.commentaire && <em className="text-muted-foreground"> — {h.commentaire}</em>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refuser la validation</DialogTitle></DialogHeader>
          <Label>Motif du refus *</Label>
          <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleReject} disabled={busy}>Refuser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={obsoleteOpen} onOpenChange={setObsoleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rendre obsolète</DialogTitle></DialogHeader>
          <Label>Motif d'obsolescence *</Label>
          <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setObsoleteOpen(false)}>Annuler</Button>
            <Button onClick={handleObsolete} disabled={busy}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
