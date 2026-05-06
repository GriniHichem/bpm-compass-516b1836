import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Shield, Eye, Pencil, Trash2, Plus, Crown, Globe, Lock, RotateCcw } from "lucide-react";

interface Profile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  actif: boolean;
}

interface Collaborator {
  id: string;
  project_id: string;
  user_id: string;
  access_level: string;
  created_at: string;
}

interface Props {
  projectId: string;
  responsableUserId: string | null;
  visibility: string;
  canEdit: boolean;
  onUpdate: () => void;
}

export function ProjectCollaborators({ projectId, responsableUserId, visibility, canEdit, onUpdate }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedAccess, setSelectedAccess] = useState("read");
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferUserId, setTransferUserId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferring, setTransferring] = useState(false);

  const fetchData = async () => {
    const [{ data: profs }, { data: collabs }] = await Promise.all([
      supabase.from("profiles").select("id, nom, prenom, email, actif").eq("actif", true).order("nom"),
      supabase.from("project_collaborators").select("*").eq("project_id", projectId),
    ]);
    setProfiles(profs ?? []);
    setCollaborators((collabs ?? []) as Collaborator[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [projectId]);

  const responsableProfile = profiles.find(p => p.id === responsableUserId);
  const collabUserIds = new Set(collaborators.map(c => c.user_id));
  const availableProfiles = profiles.filter(p => p.id !== responsableUserId && !collabUserIds.has(p.id));
  const transferCandidates = useMemo(() => profiles.filter((p) => p.id !== responsableUserId), [profiles, responsableUserId]);

  const handleTransferResponsable = async () => {
    if (!transferUserId) {
      toast.error("Sélectionnez le nouveau responsable");
      return;
    }

    setTransferring(true);
    const { error } = await supabase.rpc("transfer_project_responsibility", {
      _project_id: projectId,
      _new_responsable_user_id: transferUserId,
      _reason: transferReason || null,
    });

    setTransferring(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Responsabilité transférée");
    setTransferOpen(false);
    setTransferUserId("");
    setTransferReason("");
    onUpdate();
  };

  const handleToggleVisibility = async () => {
    const newVis = visibility === "public" ? "private" : "public";
    const { error } = await supabase.from("projects").update({ visibility: newVis }).eq("id", projectId);
    if (error) { toast.error(error.message); return; }
    toast.success(newVis === "public" ? "Projet rendu public" : "Projet rendu privé");
    onUpdate();
  };

  const addCollaborator = async () => {
    if (!selectedUserId) return;
    const { error } = await supabase.from("project_collaborators").insert({
      project_id: projectId,
      user_id: selectedUserId,
      access_level: selectedAccess,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Collaborateur ajouté");
    setSelectedUserId("");
    fetchData();
  };

  const updateAccess = async (collabId: string, newAccess: string) => {
    const { error } = await supabase.from("project_collaborators").update({ access_level: newAccess }).eq("id", collabId);
    if (error) { toast.error(error.message); return; }
    fetchData();
  };

  const removeCollaborator = async (collabId: string) => {
    const { error } = await supabase.from("project_collaborators").delete().eq("id", collabId);
    if (error) { toast.error(error.message); return; }
    toast.success("Collaborateur retiré");
    fetchData();
  };

  const getProfileName = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    return p ? `${p.prenom} ${p.nom}`.trim() || p.email : "—";
  };

  const getInitials = (userId: string) => {
    const p = profiles.find(pr => pr.id === userId);
    if (!p) return "?";
    return `${p.prenom?.[0] ?? ""}${p.nom?.[0] ?? ""}`.toUpperCase() || "?";
  };

  const getAvatarUrl = (_userId: string) => null;

  if (loading) return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />;

  return (
    <Card>
      <CardContent className="p-5 space-y-5">
        <h3 className="font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4" /> Accès & Collaborateurs
        </h3>

        {/* Visibility toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border/30 p-3">
          <div className="flex items-center gap-3">
            {visibility === "public" ? <Globe className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-amber-600" />}
            <div>
              <p className="text-sm font-medium">{visibility === "public" ? "Projet public" : "Projet privé"}</p>
              <p className="text-xs text-muted-foreground">
                {visibility === "public" ? "Visible par tous les utilisateurs autorisés" : "Visible uniquement par le responsable et les collaborateurs"}
              </p>
            </div>
          </div>
          {canEdit && (
            <Switch checked={visibility === "private"} onCheckedChange={handleToggleVisibility} />
          )}
        </div>

        {/* Responsable */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsable du projet</Label>
          {responsableProfile ? (
            <div className="flex items-center gap-2 justify-between rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-6 w-6">
                <AvatarImage src={undefined} />
                <AvatarFallback className="text-[10px]">{getInitials(responsableProfile.id)}</AvatarFallback>
              </Avatar>
                <span className="text-sm truncate">{getProfileName(responsableProfile.id)}</span>
                <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              </div>
              {canEdit && transferCandidates.length > 0 && (
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setTransferOpen(true)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Transférer
                </Button>
              )}
            </div>
          ) : canEdit ? (
            <div className="space-y-2 rounded-lg border border-dashed border-border/40 p-3">
              <p className="text-sm text-muted-foreground">Aucun responsable défini pour ce projet.</p>
              <div className="flex gap-2">
                <Select value={transferUserId || "none"} onValueChange={(v) => setTransferUserId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir un responsable" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choisir un responsable</SelectItem>
                    {transferCandidates.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {`${p.prenom} ${p.nom}`.trim() || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleTransferResponsable} disabled={!transferUserId || transferring}>
                  {transferring ? "Attribution..." : "Attribuer"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun responsable</p>
          )}
        </div>

        {/* Collaborators list */}
        {(visibility === "private" || collaborators.length > 0) && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Collaborateurs ({collaborators.length})
            </Label>
            <div className="space-y-1.5">
              {collaborators.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-md border border-border/30 bg-muted/10 px-3 py-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={getAvatarUrl(c.user_id) ?? undefined} />
                    <AvatarFallback className="text-[10px]">{getInitials(c.user_id)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm flex-1">{getProfileName(c.user_id)}</span>
                  <Badge variant="outline" className={`text-[10px] ${c.access_level === "write" ? "border-primary/40 text-primary" : "border-muted-foreground/30"}`}>
                    {c.access_level === "write" ? <><Pencil className="h-2.5 w-2.5 mr-0.5" /> Écriture</> : <><Eye className="h-2.5 w-2.5 mr-0.5" /> Lecture</>}
                  </Badge>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <Select value={c.access_level} onValueChange={(v) => updateAccess(c.id, v)}>
                        <SelectTrigger className="h-6 w-20 text-[10px] border-none bg-transparent"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">Lecture</SelectItem>
                          <SelectItem value="write">Écriture</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeCollaborator(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add collaborator */}
            {canEdit && availableProfiles.length > 0 && (
              <div className="flex gap-2 pt-1">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue placeholder="Ajouter un collaborateur..." /></SelectTrigger>
                  <SelectContent>
                    {availableProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {`${p.prenom} ${p.nom}`.trim() || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedAccess} onValueChange={setSelectedAccess}>
                  <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">Lecture</SelectItem>
                    <SelectItem value="write">Écriture</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-8" onClick={addCollaborator} disabled={!selectedUserId}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfert de responsabilité</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nouveau responsable</Label>
              <Select value={transferUserId || "none"} onValueChange={(v) => setTransferUserId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un utilisateur" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sélectionner un utilisateur</SelectItem>
                  {transferCandidates.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {`${p.prenom} ${p.nom}`.trim() || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Motif du transfert</Label>
              <Textarea
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                rows={3}
                placeholder="Précisez la raison si nécessaire"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTransferOpen(false)}>Annuler</Button>
              <Button onClick={handleTransferResponsable} disabled={!transferUserId || transferring}>
                {transferring ? "Transfert..." : "Confirmer le transfert"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
