import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Plus, KeyRound, Pencil, Camera, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ActeurRef = { id: string; fonction: string | null };
type CustomRoleRef = { id: string; nom: string };

type UserWithRoles = {
  id: string; nom: string; prenom: string; email: string; fonction: string; actif: boolean;
  roles: string[];
  customRoleIds: string[];
  acteur_id: string | null;
  photo_url: string | null;
};

const allRoles = [
  { key: "admin", label: "Admin" },
  { key: "rmq", label: "RMQ" },
  { key: "dg", label: "DG (Direction Générale)" },
  { key: "responsable_processus", label: "Resp. processus" },
  { key: "consultant", label: "Consultant" },
  { key: "auditeur", label: "Auditeur" },
  { key: "acteur", label: "Acteur" },
];

export default function Utilisateurs() {
  const { hasRole, hasPermission } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [acteursList, setActeursList] = useState<ActeurRef[]>([]);
  const [customRolesList, setCustomRolesList] = useState<CustomRoleRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", nom: "", prenom: "", fonction: "" });
  const [creating, setCreating] = useState(false);

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [editUser, setEditUser] = useState<UserWithRoles | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserWithRoles | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editFields, setEditFields] = useState({ nom: "", prenom: "", email: "", fonction: "" });
  const [editSaving, setEditSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = async () => {
    const [profilesRes, rolesRes, customRolesRes, userCustomRolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("nom"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("custom_roles").select("id, nom").order("nom"),
      supabase.from("user_custom_roles").select("user_id, custom_role_id"),
    ]);

    const roleMap = new Map<string, string[]>();
    (rolesRes.data ?? []).forEach((r) => {
      const list = roleMap.get(r.user_id) || [];
      list.push(r.role);
      roleMap.set(r.user_id, list);
    });

    const customRoleMap = new Map<string, string[]>();
    (userCustomRolesRes.data ?? []).forEach((ucr) => {
      const list = customRoleMap.get(ucr.user_id) || [];
      list.push(ucr.custom_role_id);
      customRoleMap.set(ucr.user_id, list);
    });

    setCustomRolesList((customRolesRes.data ?? []) as CustomRoleRef[]);
    setUsers(
      (profilesRes.data ?? []).map((p) => ({
        ...p,
        roles: roleMap.get(p.id) ?? [],
        customRoleIds: customRoleMap.get(p.id) ?? [],
      })) as UserWithRoles[]
    );
    setLoading(false);
  };

  const fetchActeurs = async () => {
    const { data } = await supabase.from("acteurs").select("id, fonction").eq("actif", true).order("fonction");
    setActeursList((data ?? []) as ActeurRef[]);
  };

  useEffect(() => { fetchUsers(); fetchActeurs(); }, []);

  const canEdit = hasPermission("utilisateurs", "can_edit");
  const canDeleteUsers = hasRole("admin") || hasRole("super_admin");

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: deleteUser.id },
      });
      if (error) {
        let msg = error.message || "Erreur";
        try {
          const parsed = JSON.parse((error as any).context?.body || '{}');
          if (parsed.error) msg = parsed.error;
        } catch { /* ignore */ }
        toast.error(msg, { duration: 8000 });
        setDeleting(false);
        return;
      }
      if (data?.error) {
        toast.error(data.error, { duration: 8000 });
        setDeleting(false);
        return;
      }
      toast.success("Utilisateur supprimé");
      setDeleteUser(null);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setDeleting(false);
  };
  const canDelete = hasPermission("utilisateurs", "can_delete");

  const handleToggleRole = async (userId: string, roleKey: string, currentRoles: string[]) => {
    if (!canEdit) return;
    const has = currentRoles.includes(roleKey);
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", roleKey as any);
      if (error) { toast.error(error.message); return; }
    } else {
      if (currentRoles.length >= 2) { toast.error("Maximum 2 rôles par utilisateur"); return; }
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: roleKey as any });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Rôles mis à jour");
    fetchUsers();
  };

  const handleToggleCustomRole = async (userId: string, customRoleId: string, currentCustomRoleIds: string[]) => {
    if (!canEdit) return;
    const has = currentCustomRoleIds.includes(customRoleId);
    if (has) {
      const { error } = await supabase.from("user_custom_roles").delete().eq("user_id", userId).eq("custom_role_id", customRoleId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("user_custom_roles").insert({ user_id: userId, custom_role_id: customRoleId });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Rôle personnalisé mis à jour");
    fetchUsers();
  };

  const toggleActive = async (userId: string, currentActive: boolean) => {
    if (!canEdit) return;
    const { error } = await supabase.from("profiles").update({ actif: !currentActive }).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success(currentActive ? "Compte désactivé" : "Compte activé"); fetchUsers(); }
  };

  const handleAssignActeur = async (userId: string, acteurId: string | null) => {
    const { error } = await supabase.from("profiles").update({ acteur_id: acteurId }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Acteur assigné");
    fetchUsers();
  };

  const openEditUser = (u: UserWithRoles) => {
    setEditUser(u);
    setEditFields({ nom: u.nom || "", prenom: u.prenom || "", email: u.email || "", fonction: u.fonction || "" });
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setEditSaving(true);
    const { error } = await supabase.from("profiles").update({
      nom: editFields.nom,
      prenom: editFields.prenom,
      email: editFields.email,
      fonction: editFields.fonction,
    }).eq("id", editUser.id);
    if (error) { toast.error(error.message); setEditSaving(false); return; }
    toast.success("Profil mis à jour");
    setEditUser(null);
    fetchUsers();
    setEditSaving(false);
  };

  const handlePhotoUpload = async (userId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${userId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) { toast.error("Erreur upload: " + uploadError.message); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const photoUrl = urlData.publicUrl + "?t=" + Date.now();
    const { error } = await supabase.from("profiles").update({ photo_url: photoUrl } as any).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Photo mise à jour");
    fetchUsers();
  };


  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password) { toast.error("Email et mot de passe requis"); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: newUser.email, password: newUser.password, nom: newUser.nom, prenom: newUser.prenom, fonction: newUser.fonction },
      });
      if (error) {
        // Try to parse the actual error from the response body
        let msg = error.message || "Erreur lors de la création";
        try {
          const parsed = JSON.parse((error as any).context?.body || '{}');
          if (parsed.error) msg = parsed.error;
        } catch {
          // If the error contains a JSON body in the message, try to extract it
          const match = msg.match(/\{.*"error"\s*:\s*"([^"]+)"/);
          if (match) msg = match[1];
        }
        toast.error(msg, { duration: 8000 });
        setCreating(false);
        return;
      }
      if (data?.error) {
        toast.error(data.error + (data.detail ? ` (${data.detail})` : ''), { duration: 8000 });
        setCreating(false);
        return;
      }
      toast.success("Utilisateur créé");
      setCreateOpen(false);
      setNewUser({ email: "", password: "", nom: "", prenom: "", fonction: "" });
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setCreating(false);
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword) { toast.error("Mot de passe requis"); return; }
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
        body: { user_id: resetUserId, new_password: resetPassword },
      });
      if (error) {
        let msg = error.message || "Erreur";
        try {
          const parsed = JSON.parse((error as any).context?.body || '{}');
          if (parsed.error) msg = parsed.error;
        } catch {
          const match = msg.match(/\{.*"error"\s*:\s*"([^"]+)"/);
          if (match) msg = match[1];
        }
        toast.error(msg, { duration: 8000 });
        setResetting(false);
        return;
      }
      if (data?.error) {
        toast.error(data.error + (data.detail ? ` (${data.detail})` : ''), { duration: 8000 });
        setResetting(false);
        return;
      }
      toast.success("Mot de passe réinitialisé");
      setResetUserId(null);
      setResetPassword("");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    }
    setResetting(false);
  };

  if (!hasPermission("utilisateurs", "can_read")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <Card><CardContent className="py-12 text-center text-muted-foreground">Accès non autorisé</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Gestion des utilisateurs</h1><p className="text-muted-foreground">Administration des comptes et rôles</p></div>
        {canEdit && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nouvel utilisateur</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer un utilisateur</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Prénom</Label><Input value={newUser.prenom} onChange={(e) => setNewUser({ ...newUser, prenom: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Nom</Label><Input value={newUser.nom} onChange={(e) => setNewUser({ ...newUser, nom: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Email *</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Mot de passe *</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></div>
                <div className="space-y-2"><Label>Fonction</Label><Input value={newUser.fonction} onChange={(e) => setNewUser({ ...newUser, fonction: e.target.value })} /></div>
                <Button onClick={handleCreateUser} className="w-full" disabled={creating}>{creating ? "Création..." : "Créer"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative group">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.photo_url || undefined} alt={`${u.prenom} ${u.nom}`} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                          {u.prenom?.[0]}{u.nom?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      {canEdit && (
                        <button
                          className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          title="Changer la photo"
                          onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = "image/*";
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handlePhotoUpload(u.id, file);
                            };
                            input.click();
                          }}
                        >
                          <Camera className="h-4 w-4 text-white" />
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{u.prenom} {u.nom}</p>
                      <p className="text-xs text-muted-foreground">{u.email} {u.fonction ? `• ${u.fonction}` : ""}</p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier le profil" onClick={() => openEditUser(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Réinitialiser mot de passe" onClick={() => setResetUserId(u.id)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {canDeleteUsers && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Supprimer l'utilisateur" onClick={() => setDeleteUser(u)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Badge className="cursor-pointer" variant={u.actif ? "default" : "destructive"} onClick={() => toggleActive(u.id, u.actif)}>
                        {u.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                  )}
                  {!canEdit && (
                    <Badge variant={u.actif ? "default" : "destructive"}>{u.actif ? "Actif" : "Inactif"}</Badge>
                  )}
                </div>

                {/* Standard roles */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Rôles système</p>
                  <div className="flex flex-wrap gap-3">
                    {allRoles.map((r) => (
                      <label key={r.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <Checkbox
                          checked={u.roles.includes(r.key)}
                          onCheckedChange={() => handleToggleRole(u.id, r.key, u.roles)}
                          disabled={!canEdit}
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Custom roles */}
                {customRolesList.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Rôles personnalisés</p>
                    <div className="flex flex-wrap gap-3">
                      {customRolesList.map((cr) => (
                        <label key={cr.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <Checkbox
                            checked={u.customRoleIds.includes(cr.id)}
                            onCheckedChange={() => handleToggleCustomRole(u.id, cr.id, u.customRoleIds)}
                            disabled={!canEdit}
                          />
                          {cr.nom}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Acteur :</Label>
                  <Select value={u.acteur_id ?? "none"} onValueChange={(v) => handleAssignActeur(u.id, v === "none" ? null : v)} disabled={!canEdit}>
                    <SelectTrigger className="h-8 w-60 text-xs"><SelectValue placeholder="Aucun acteur" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {acteursList.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.fonction || "—"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reset password dialog */}
      <Dialog open={!!resetUserId} onOpenChange={(o) => { if (!o) { setResetUserId(null); setResetPassword(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Réinitialiser le mot de passe</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Nouveau mot de passe" />
            </div>
            <Button onClick={handleResetPassword} className="w-full" disabled={resetting}>{resetting ? "Réinitialisation..." : "Réinitialiser"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit profile dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier le profil</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Prénom</Label><Input value={editFields.prenom} onChange={(e) => setEditFields({ ...editFields, prenom: e.target.value })} /></div>
              <div className="space-y-2"><Label>Nom</Label><Input value={editFields.nom} onChange={(e) => setEditFields({ ...editFields, nom: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={editFields.email} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Fonction</Label><Input value={editFields.fonction} onChange={(e) => setEditFields({ ...editFields, fonction: e.target.value })} /></div>
            <Button onClick={handleSaveEdit} className="w-full" disabled={editSaving}>{editSaving ? "Enregistrement..." : "Enregistrer"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete user confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => { if (!o) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le compte de <strong>{deleteUser?.prenom} {deleteUser?.nom}</strong> ({deleteUser?.email}) sera définitivement supprimé. Les données liées (responsabilités, historiques) seront conservées mais détachées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteUser(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
