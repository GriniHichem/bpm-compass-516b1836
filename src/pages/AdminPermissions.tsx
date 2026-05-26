import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Shield, Plus, Trash2, ChevronRight, Users, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_MODULES,
  ALL_ROLES,
  MODULE_LABELS,
  ROLE_LABELS,
  DEFAULT_PERMISSIONS,
  WORKFLOW_MODULES,
  type AppRole,
  type AppModule,
  type ModulePermissions,
  type PermissionLevel,
} from "@/lib/defaultPermissions";

const PERM_LEVELS: { key: PermissionLevel; label: string; workflowOnly?: boolean }[] = [
  { key: "can_read", label: "Lecture" },
  { key: "can_read_detail", label: "Détail" },
  { key: "can_edit", label: "Modifier" },
  { key: "can_delete", label: "Supprimer" },
  { key: "can_verify", label: "Vérifier", workflowOnly: true },
  { key: "can_approve", label: "Approuver", workflowOnly: true },
];

const WORKFLOW_MODULE_SET = new Set<AppModule>(WORKFLOW_MODULES);
const isLevelApplicable = (mod: AppModule, level: PermissionLevel) => {
  const def = PERM_LEVELS.find((p) => p.key === level);
  if (!def?.workflowOnly) return true;
  return WORKFLOW_MODULE_SET.has(mod);
};

const NON_ADMIN_ROLES = ALL_ROLES.filter((r) => r !== "admin" && r !== "super_admin") as Exclude<AppRole, "admin" | "super_admin">[];

interface CustomRole {
  id: string;
  nom: string;
  description: string;
}

type SelectedRole =
  | { type: "standard"; role: Exclude<AppRole, "admin"> }
  | { type: "custom"; role: CustomRole };

export default function AdminPermissions() {
  const { hasRole } = useAuth();
  const [overrides, setOverrides] = useState<Record<string, ModulePermissions>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customPerms, setCustomPerms] = useState<Record<string, ModulePermissions>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [duplicateFrom, setDuplicateFrom] = useState<string>("none");
  const [deleteRole, setDeleteRole] = useState<CustomRole | null>(null);

  const [selected, setSelected] = useState<SelectedRole | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [permRes, crRes, crpRes] = await Promise.all([
      supabase.from("role_permissions").select("*"),
      supabase.from("custom_roles").select("*").order("nom"),
      supabase.from("custom_role_permissions").select("*"),
    ]);

    if (permRes.data) {
      const map: Record<string, ModulePermissions> = {};
      for (const row of permRes.data as any[]) {
        map[`${row.role}:${row.module}`] = {
          can_read: row.can_read, can_read_detail: row.can_read_detail,
          can_edit: row.can_edit, can_delete: row.can_delete,
          can_verify: row.can_verify ?? false, can_approve: row.can_approve ?? false,
        };
      }
      setOverrides(map);
    }

    if (crRes.data) setCustomRoles(crRes.data as CustomRole[]);

    if (crpRes.data) {
      const map: Record<string, ModulePermissions> = {};
      for (const row of crpRes.data as any[]) {
        map[`${row.custom_role_id}:${row.module}`] = {
          can_read: row.can_read, can_read_detail: row.can_read_detail,
          can_edit: row.can_edit, can_delete: row.can_delete,
          can_verify: row.can_verify ?? false, can_approve: row.can_approve ?? false,
        };
      }
      setCustomPerms(map);
    }

    setLoaded(true);
  };

  // --- Standard role helpers ---
  const getPermValue = (role: Exclude<AppRole, "admin">, module: AppModule, level: PermissionLevel): boolean => {
    const key = `${role}:${module}`;
    if (overrides[key]) return overrides[key][level];
    return DEFAULT_PERMISSIONS[role][module]?.[level] ?? false;
  };

  const isOverridden = (role: Exclude<AppRole, "admin">, module: AppModule): boolean => !!overrides[`${role}:${module}`];

  const togglePerm = (role: Exclude<AppRole, "admin">, module: AppModule, level: PermissionLevel) => {
    const key = `${role}:${module}`;
    const current = getPermValue(role, module, level);
    const defaults = DEFAULT_PERMISSIONS[role][module];
    const existing: ModulePermissions = overrides[key] || {
      can_read: defaults?.can_read ?? false,
      can_read_detail: defaults?.can_read_detail ?? false,
      can_edit: defaults?.can_edit ?? false,
      can_delete: defaults?.can_delete ?? false,
      can_verify: defaults?.can_verify ?? false,
      can_approve: defaults?.can_approve ?? false,
    };
    setOverrides((prev) => ({ ...prev, [key]: { ...existing, [level]: !current } }));
  };

  const resetToDefault = (role: Exclude<AppRole, "admin">, module: AppModule) => {
    setOverrides((prev) => { const next = { ...prev }; delete next[`${role}:${module}`]; return next; });
  };

  // --- Custom role helpers ---
  const getCustomPermValue = (crId: string, module: AppModule, level: PermissionLevel): boolean => {
    return customPerms[`${crId}:${module}`]?.[level] ?? false;
  };

  const toggleCustomPerm = (crId: string, module: AppModule, level: PermissionLevel) => {
    const key = `${crId}:${module}`;
    const current = getCustomPermValue(crId, module, level);
    const existing: ModulePermissions = customPerms[key] || { can_read: false, can_read_detail: false, can_edit: false, can_delete: false, can_verify: false, can_approve: false };
    setCustomPerms((prev) => ({ ...prev, [key]: { ...existing, [level]: !current } }));
  };

  // --- Create custom role ---
  const handleCreateRole = async () => {
    if (!newRoleName.trim()) { toast.error("Le nom est requis"); return; }
    const { data, error } = await supabase.from("custom_roles").insert({ nom: newRoleName.trim(), description: newRoleDesc.trim() }).select().single();
    if (error) { toast.error(error.message); return; }

    const newRole = data as CustomRole;
    setCustomRoles((prev) => [...prev, newRole]);

    if (duplicateFrom !== "none" && duplicateFrom) {
      const permsToInsert: Record<string, ModulePermissions> = {};
      if (duplicateFrom.startsWith("custom:")) {
        const sourceId = duplicateFrom.replace("custom:", "");
        for (const mod of ALL_MODULES) {
          const key = `${sourceId}:${mod}`;
          if (customPerms[key]) permsToInsert[`${newRole.id}:${mod}`] = { ...customPerms[key] };
        }
      } else {
        const sourceRole = duplicateFrom as Exclude<AppRole, "admin">;
        const defaults = DEFAULT_PERMISSIONS[sourceRole];
        if (defaults) {
          for (const mod of ALL_MODULES) {
            const overrideKey = `${sourceRole}:${mod}`;
            const perms = overrides[overrideKey] || defaults[mod];
            if (perms) permsToInsert[`${newRole.id}:${mod}`] = { ...perms };
          }
        }
      }

      const rows = Object.entries(permsToInsert).map(([key, perms]) => {
        const mod = key.split(":")[1];
        return { custom_role_id: newRole.id, module: mod, ...perms };
      });
      if (rows.length > 0) await supabase.from("custom_role_permissions").insert(rows);
      setCustomPerms((prev) => ({ ...prev, ...permsToInsert }));
    }

    setCreateDialogOpen(false);
    setNewRoleName("");
    setNewRoleDesc("");
    setDuplicateFrom("none");
    setSelected({ type: "custom", role: newRole });
    toast.success(`Rôle "${newRole.nom}" créé`);
  };

  // --- Delete custom role ---
  const handleDeleteRole = async () => {
    if (!deleteRole) return;
    const { error } = await supabase.from("custom_roles").delete().eq("id", deleteRole.id);
    if (error) { toast.error(error.message); return; }
    setCustomRoles((prev) => prev.filter((r) => r.id !== deleteRole.id));
    setCustomPerms((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${deleteRole.id}:`)) delete next[key];
      }
      return next;
    });
    if (selected?.type === "custom" && selected.role.id === deleteRole.id) setSelected(null);
    setDeleteRole(null);
    toast.success("Rôle supprimé");
  };

  // --- Save all ---
  const saveAll = async () => {
    setSaving(true);
    try {
      await supabase.from("role_permissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const stdRows = Object.entries(overrides).map(([key, perms]) => {
        const [role, module] = key.split(":");
        return { role: role as AppRole, module, ...perms };
      });
      if (stdRows.length > 0) {
        const { error } = await supabase.from("role_permissions").insert(stdRows);
        if (error) throw error;
      }

      for (const cr of customRoles) {
        await supabase.from("custom_role_permissions").delete().eq("custom_role_id", cr.id);
        const crRows = ALL_MODULES
          .filter((mod) => customPerms[`${cr.id}:${mod}`])
          .map((mod) => ({ custom_role_id: cr.id, module: mod, ...customPerms[`${cr.id}:${mod}`] }));
        if (crRows.length > 0) {
          const { error } = await supabase.from("custom_role_permissions").insert(crRows);
          if (error) throw error;
        }
      }

      toast.success("Permissions sauvegardées avec succès");
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Count permissions for a role ---
  const countPerms = (role: Exclude<AppRole, "admin">): number => {
    let count = 0;
    for (const mod of ALL_MODULES) {
      for (const p of PERM_LEVELS) {
        if (getPermValue(role, mod, p.key)) count++;
      }
    }
    return count;
  };

  const countCustomPerms = (crId: string): number => {
    let count = 0;
    for (const mod of ALL_MODULES) {
      for (const p of PERM_LEVELS) {
        if (getCustomPermValue(crId, mod, p.key)) count++;
      }
    }
    return count;
  };

  const totalPerms = ALL_MODULES.length * PERM_LEVELS.length;

  if (!hasRole("admin") && !hasRole("super_admin")) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Accès réservé aux administrateurs.</CardContent></Card>;
  }

  if (!loaded) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Chargement...</CardContent></Card>;
  }

  const isStdSelected = selected?.type === "standard";
  const isCustomSelected = selected?.type === "custom";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestion des permissions</h1>
            <p className="text-sm text-muted-foreground">Sélectionnez un rôle pour configurer ses droits d'accès.</p>
          </div>
        </div>
        <Button onClick={saveAll} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4" style={{ minHeight: "calc(100vh - 220px)" }}>
        {/* LEFT PANEL - Role list */}
        <div className="col-span-4 space-y-3">
          {/* System roles */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                <Users className="h-4 w-4" />
                Rôles système
              </div>
            </CardHeader>
            <CardContent className="p-1">
              {/* Admin - disabled */}
              <div className="flex items-center gap-3 rounded-md px-3 py-2.5 opacity-50 cursor-not-allowed">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">Administrateur</div>
                  <div className="text-xs text-muted-foreground">Accès complet — non modifiable</div>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">{totalPerms}/{totalPerms}</Badge>
              </div>

              {NON_ADMIN_ROLES.map((role) => {
                const active = isStdSelected && selected.role === role;
                const count = countPerms(role);
                const hasOverrides = ALL_MODULES.some((mod) => isOverridden(role, mod));
                return (
                  <button
                    key={role}
                    onClick={() => setSelected({ type: "standard", role })}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                      active ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/60"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {ROLE_LABELS[role]}
                        {hasOverrides && <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{count}/{totalPerms}</Badge>
                    <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", active && "text-primary")} />
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Custom roles */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <UserCog className="h-4 w-4" />
                  Rôles personnalisés
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      <Plus className="mr-1 h-3 w-3" />Nouveau
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Créer un rôle personnalisé</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nom du rôle *</Label>
                        <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Ex: Superviseur, Directeur..." />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Description du rôle..." />
                      </div>
                      <div>
                        <Label>Dupliquer les permissions de</Label>
                        <Select value={duplicateFrom} onValueChange={setDuplicateFrom}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Rôle vide —</SelectItem>
                            {NON_ADMIN_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                            ))}
                            {customRoles.map((cr) => (
                              <SelectItem key={cr.id} value={`custom:${cr.id}`}>{cr.nom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="w-full" onClick={handleCreateRole}>
                        <Plus className="mr-2 h-4 w-4" />Créer
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-1">
              {customRoles.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-6">Aucun rôle personnalisé</div>
              ) : (
                customRoles.map((cr) => {
                  const active = isCustomSelected && selected.role.id === cr.id;
                  const count = countCustomPerms(cr.id);
                  return (
                    <button
                      key={cr.id}
                      onClick={() => setSelected({ type: "custom", role: cr })}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/60"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{cr.nom}</div>
                        {cr.description && <div className="text-xs text-muted-foreground truncate">{cr.description}</div>}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{count}/{totalPerms}</Badge>
                      <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", active && "text-primary")} />
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL - Permission matrix */}
        <div className="col-span-8">
          {!selected ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground py-20">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Sélectionnez un rôle</p>
                <p className="text-sm mt-1">Cliquez sur un rôle à gauche pour configurer ses permissions.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {isStdSelected ? ROLE_LABELS[selected.role] : selected.role.nom}
                    </CardTitle>
                    {isCustomSelected && selected.role.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{selected.role.description}</p>
                    )}
                  </div>
                  {isCustomSelected && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteRole(selected.role)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[calc(100vh-320px)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px] sticky top-0 bg-background z-10">Module</TableHead>
                        {PERM_LEVELS.map((p) => (
                          <TableHead key={p.key} className="text-center w-24 sticky top-0 bg-background z-10">{p.label}</TableHead>
                        ))}
                        {isStdSelected && <TableHead className="text-center w-28 sticky top-0 bg-background z-10">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ALL_MODULES.map((mod) => {
                        const overridden = isStdSelected && isOverridden(selected.role, mod);
                        return (
                          <TableRow key={mod} className={overridden ? "bg-accent/30" : ""}>
                            <TableCell className="font-medium text-sm">{MODULE_LABELS[mod]}</TableCell>
                            {PERM_LEVELS.map((p) => {
                              const applicable = isLevelApplicable(mod, p.key);
                              return (
                                <TableCell key={p.key} className="text-center">
                                  <Checkbox
                                    disabled={!applicable}
                                    checked={
                                      applicable && (isStdSelected
                                        ? getPermValue(selected.role, mod, p.key)
                                        : getCustomPermValue(selected.role.id, mod, p.key))
                                    }
                                    onCheckedChange={() =>
                                      applicable && (isStdSelected
                                        ? togglePerm(selected.role, mod, p.key)
                                        : toggleCustomPerm(selected.role.id, mod, p.key))
                                    }
                                  />
                                </TableCell>
                              );
                            })}
                            {isStdSelected && (
                              <TableCell className="text-center">
                                {overridden && (
                                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => resetToDefault(selected.role, mod)}>
                                    Réinitialiser
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteRole} onOpenChange={(o) => !o && setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le rôle "{deleteRole?.nom}" ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible. Tous les utilisateurs ayant ce rôle le perdront.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
