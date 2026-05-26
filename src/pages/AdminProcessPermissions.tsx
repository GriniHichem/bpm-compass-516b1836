import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Copy, RotateCcw, Save, History, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ALL_ROLES, ROLE_LABELS, type AppRole } from "@/lib/defaultPermissions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ProcessInfo {
  id: string;
  code: string;
  nom: string;
  type_processus: string;
  statut: string;
}

interface CustomRoleInfo {
  id: string;
  nom: string;
}

interface PermRow {
  id?: string;
  role: string | null;
  custom_role_id: string | null;
  process_id: string;
  can_read: boolean;
  can_detail: boolean;
  can_comment: boolean;
  can_edit: boolean;
  can_version: boolean;
  can_verify: boolean;
  can_approve: boolean;
}

interface AuditEntry {
  id: string;
  changed_by: string;
  target_role: string | null;
  target_custom_role_id: string | null;
  process_id: string | null;
  old_perms: any;
  new_perms: any;
  changed_at: string;
  profiles?: { nom: string; prenom: string } | null;
}

const LEVELS = ["can_read", "can_detail", "can_comment", "can_edit", "can_version", "can_verify", "can_approve"] as const;
const LEVEL_LABELS: Record<string, string> = {
  can_read: "Lecture",
  can_detail: "Détail",
  can_comment: "Commenter",
  can_edit: "Modifier",
  can_version: "Version",
  can_verify: "Vérifier",
  can_approve: "Approuver",
};

const TEMPLATES: Record<string, Record<string, boolean>> = {
  lecture_seule:   { can_read: true,  can_detail: false, can_comment: false, can_edit: false, can_version: false, can_verify: false, can_approve: false },
  lecture_detail:  { can_read: true,  can_detail: true,  can_comment: false, can_edit: false, can_version: false, can_verify: false, can_approve: false },
  consultation:    { can_read: true,  can_detail: true,  can_comment: true,  can_edit: false, can_version: false, can_verify: false, can_approve: false },
  modification:    { can_read: true,  can_detail: true,  can_comment: true,  can_edit: true,  can_version: false, can_verify: false, can_approve: false },
  verificateur:    { can_read: true,  can_detail: true,  can_comment: true,  can_edit: false, can_version: false, can_verify: true,  can_approve: false },
  approbateur:     { can_read: true,  can_detail: true,  can_comment: true,  can_edit: false, can_version: false, can_verify: false, can_approve: true  },
  validation_full: { can_read: true,  can_detail: true,  can_comment: true,  can_edit: false, can_version: false, can_verify: true,  can_approve: true  },
  acces_complet:   { can_read: true,  can_detail: true,  can_comment: true,  can_edit: true,  can_version: true,  can_verify: true,  can_approve: true  },
  aucun:           { can_read: false, can_detail: false, can_comment: false, can_edit: false, can_version: false, can_verify: false, can_approve: false },
};

const TEMPLATE_LABELS: Record<string, string> = {
  lecture_seule: "Lecture seule",
  lecture_detail: "Lecture + Détail",
  consultation: "Consultation (+ Commenter)",
  modification: "Modification complète",
  verificateur: "Vérificateur (workflow)",
  approbateur: "Approbateur (workflow)",
  validation_full: "Vérifier + Approuver",
  acces_complet: "Accès complet",
  aucun: "Aucun accès (héritage global)",
};

const TYPE_LABELS: Record<string, string> = {
  pilotage: "Management",
  realisation: "Réalisation",
  support: "Support",
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function AdminProcessPermissions() {
  const { user } = useAuth();
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRoleInfo[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [selectedProcessId, setSelectedProcessId] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [copySource, setCopySource] = useState<string>("");
  const [copyTarget, setCopyTarget] = useState<string>("");
  const [viewMode, setViewMode] = useState<"process" | "matrix">("process");

  const roleOptions: { key: string; label: string; isCustom: boolean }[] = [
    ...ALL_ROLES.filter((r) => r !== "super_admin" && r !== "admin").map((r) => ({
      key: `role:${r}`,
      label: ROLE_LABELS[r],
      isCustom: false,
    })),
    ...customRoles.map((cr) => ({
      key: `custom:${cr.id}`,
      label: cr.nom,
      isCustom: true,
    })),
  ];

  const fetchData = useCallback(async () => {
    const [procRes, crRes, permRes] = await Promise.all([
      supabase.from("processes").select("id, code, nom, type_processus, statut").neq("statut", "archive").order("code"),
      supabase.from("custom_roles").select("id, nom").order("nom"),
      supabase.from("process_role_permissions").select("*"),
    ]);
    const procs = (procRes.data ?? []) as ProcessInfo[];
    setProcesses(procs);
    setCustomRoles((crRes.data ?? []) as CustomRoleInfo[]);
    setPerms((permRes.data ?? []) as PermRow[]);
    if (!selectedProcessId && procs.length > 0) {
      setSelectedProcessId(procs[0].id);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getPermKey = (roleKey: string, processId: string) => `${roleKey}:${processId}`;

  const findPerm = (roleKey: string, processId: string): PermRow | undefined => {
    const [type, id] = roleKey.split(":");
    return perms.find((p) =>
      p.process_id === processId &&
      (type === "role" ? p.role === id && !p.custom_role_id : p.custom_role_id === id)
    );
  };

  const getPermValue = (roleKey: string, processId: string, level: string): boolean => {
    const perm = findPerm(roleKey, processId);
    return perm ? (perm as any)[level] : false;
  };

  const hasOverride = (roleKey: string, processId: string): boolean => {
    return !!findPerm(roleKey, processId);
  };

  const togglePerm = (roleKey: string, processId: string, level: string) => {
    const [type, id] = roleKey.split(":");
    const existing = findPerm(roleKey, processId);
    if (existing) {
      const updated = { ...existing, [level]: !(existing as any)[level] };
      setPerms((prev) => prev.map((p) => (p === existing ? updated : p)));
    } else {
      const newPerm: PermRow = {
        role: type === "role" ? id : null,
        custom_role_id: type === "custom" ? id : null,
        process_id: processId,
        can_read: false, can_detail: false, can_comment: false, can_edit: false, can_version: false,
        can_verify: false, can_approve: false,
        [level]: true,
      };
      setPerms((prev) => [...prev, newPerm]);
    }
    setDirty((prev) => new Set(prev).add(getPermKey(roleKey, processId)));
  };

  const applyTemplate = (roleKey: string, processId: string, templateKey: string) => {
    const template = TEMPLATES[templateKey];
    if (!template) return;
    const [type, id] = roleKey.split(":");
    const existing = findPerm(roleKey, processId);
    if (templateKey === "aucun" && existing) {
      setPerms((prev) => prev.filter((p) => p !== existing));
    } else if (existing) {
      setPerms((prev) => prev.map((p) => (p === existing ? { ...existing, ...template } : p)));
    } else if (templateKey !== "aucun") {
      const newPerm: PermRow = {
        role: type === "role" ? id : null,
        custom_role_id: type === "custom" ? id : null,
        process_id: processId,
        ...template as any,
      };
      setPerms((prev) => [...prev, newPerm]);
    }
    setDirty((prev) => new Set(prev).add(getPermKey(roleKey, processId)));
  };

  const handleCopyRole = async () => {
    if (!copySource || !copyTarget || copySource === copyTarget) return;
    const sourcePerms = perms.filter((p) => {
      const [type, id] = copySource.split(":");
      return type === "role" ? p.role === id && !p.custom_role_id : p.custom_role_id === id;
    });
    const [targetType, targetId] = copyTarget.split(":");
    for (const sp of sourcePerms) {
      const newPerm: PermRow = {
        ...sp, id: undefined,
        role: targetType === "role" ? targetId : null,
        custom_role_id: targetType === "custom" ? targetId : null,
      };
      const existing = findPerm(copyTarget, sp.process_id);
      if (existing) {
        setPerms((prev) => prev.map((p) => (p === existing ? { ...existing, ...newPerm } : p)));
      } else {
        setPerms((prev) => [...prev, newPerm]);
      }
      setDirty((prev) => new Set(prev).add(getPermKey(copyTarget, sp.process_id)));
    }
    toast.success("Permissions copiées (non enregistrées)");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dirtyPerms = perms.filter((p) => {
        const roleKey = p.role ? `role:${p.role}` : `custom:${p.custom_role_id}`;
        return dirty.has(getPermKey(roleKey, p.process_id));
      });
      for (const p of dirtyPerms) {
        if (p.id) {
          await supabase.from("process_role_permissions").update({
            can_read: p.can_read, can_detail: p.can_detail, can_comment: p.can_comment,
            can_edit: p.can_edit, can_version: p.can_version,
          }).eq("id", p.id);
        } else {
          const { data } = await supabase.from("process_role_permissions").insert({
            role: p.role as any, custom_role_id: p.custom_role_id, process_id: p.process_id,
            can_read: p.can_read, can_detail: p.can_detail, can_comment: p.can_comment,
            can_edit: p.can_edit, can_version: p.can_version,
          } as any).select().single();
          if (data) setPerms((prev) => prev.map((pp) => (pp === p ? { ...pp, id: data.id } : pp)));
        }
        if (user) {
          await supabase.from("permission_audit_log").insert({
            changed_by: user.id, target_role: p.role as any, target_custom_role_id: p.custom_role_id,
            process_id: p.process_id,
            new_perms: { can_read: p.can_read, can_detail: p.can_detail, can_comment: p.can_comment, can_edit: p.can_edit, can_version: p.can_version },
          } as any);
        }
      }
      setDirty(new Set());
      toast.success("Permissions enregistrées");
      fetchData();
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (roleKey: string, processId: string) => {
    const existing = findPerm(roleKey, processId);
    if (existing) {
      if (existing.id) {
        supabase.from("process_role_permissions").delete().eq("id", existing.id).then(() => {
          setPerms((prev) => prev.filter((p) => p !== existing));
          toast.success("Override supprimé — héritage global rétabli");
        });
      } else {
        setPerms((prev) => prev.filter((p) => p !== existing));
      }
    }
  };

  const fetchAuditLog = async () => {
    const { data } = await supabase
      .from("permission_audit_log")
      .select("*, profiles:changed_by(nom, prenom)")
      .order("changed_at", { ascending: false })
      .limit(50);
    setAuditLog((data ?? []) as AuditEntry[]);
  };

  const filteredProcesses = processes.filter((p) => typeFilter === "all" || p.type_processus === typeFilter);
  const selectedProcess = processes.find((p) => p.id === selectedProcessId);

  // Navigation between processes
  const currentIdx = filteredProcesses.findIndex((p) => p.id === selectedProcessId);
  const goPrev = () => {
    if (currentIdx > 0) setSelectedProcessId(filteredProcesses[currentIdx - 1].id);
  };
  const goNext = () => {
    if (currentIdx < filteredProcesses.length - 1) setSelectedProcessId(filteredProcesses[currentIdx + 1].id);
  };

  // Count overrides per process
  const overrideCount = (processId: string) => perms.filter((p) => p.process_id === processId).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Permissions par processus
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez les accès granulaires par rôle et par processus
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="process" className="text-xs px-3 h-7">Par processus</TabsTrigger>
              <TabsTrigger value="matrix" className="text-xs px-3 h-7">Matrice globale</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => { fetchAuditLog(); setHistoryOpen(true); }}>
            <History className="h-4 w-4 mr-1" /> Historique
          </Button>
          <Button onClick={handleSave} disabled={dirty.size === 0 || saving} size="sm">
            <Save className="h-4 w-4 mr-1" /> Enregistrer ({dirty.size})
          </Button>
        </div>
      </div>

      {/* Tools row */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Type processus</label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); }}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="pilotage">Management</SelectItem>
                  <SelectItem value="realisation">Réalisation</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-l pl-4 flex items-end gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Copier de</label>
                <Select value={copySource} onValueChange={setCopySource}>
                  <SelectTrigger className="w-36 h-8"><SelectValue placeholder="Source" /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Vers</label>
                <Select value={copyTarget} onValueChange={setCopyTarget}>
                  <SelectTrigger className="w-36 h-8"><SelectValue placeholder="Cible" /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyRole} disabled={!copySource || !copyTarget}>
                <Copy className="h-4 w-4 mr-1" /> Copier
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === "process" ? (
        <div className="grid grid-cols-12 gap-4">
          {/* Process list sidebar */}
          <div className="col-span-3">
            <Card className="h-full">
              <CardHeader className="py-3 px-3">
                <CardTitle className="text-sm">Processus ({filteredProcesses.length})</CardTitle>
              </CardHeader>
              <ScrollArea className="h-[calc(100vh-340px)]">
                <div className="px-2 pb-2 space-y-1">
                  {filteredProcesses.map((p) => {
                    const oc = overrideCount(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProcessId(p.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                          p.id === selectedProcessId
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="font-mono text-xs opacity-80">{p.code}</div>
                        <div className="truncate font-medium">{p.nom}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={cn(
                            "text-[10px] px-1",
                            p.id === selectedProcessId && "border-primary-foreground/30 text-primary-foreground"
                          )}>
                            {TYPE_LABELS[p.type_processus] || p.type_processus}
                          </Badge>
                          {oc > 0 && (
                            <Badge variant="secondary" className={cn(
                              "text-[10px] px-1",
                              p.id === selectedProcessId && "bg-primary-foreground/20 text-primary-foreground"
                            )}>
                              {oc} override{oc > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          </div>

          {/* Permission matrix for selected process */}
          <div className="col-span-9">
            {selectedProcess ? (
              <Card>
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">{selectedProcess.code}</span>
                      {selectedProcess.nom}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {TYPE_LABELS[selectedProcess.type_processus] || selectedProcess.type_processus} · Statut : {selectedProcess.statut}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={goPrev} disabled={currentIdx <= 0}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">{currentIdx + 1}/{filteredProcesses.length}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={goNext} disabled={currentIdx >= filteredProcesses.length - 1}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Rôle</TableHead>
                        {LEVELS.map((l) => (
                          <TableHead key={l} className="text-center w-[100px]">{LEVEL_LABELS[l]}</TableHead>
                        ))}
                        <TableHead className="text-center w-[140px]">Modèle</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roleOptions.map((role) => {
                        const override = hasOverride(role.key, selectedProcess.id);
                        return (
                          <TableRow key={role.key} className={cn(override && "bg-primary/5")}>
                            <TableCell className="font-medium py-2">
                              <div className="flex items-center gap-1.5">
                                {role.label}
                                {role.isCustom && <Badge variant="outline" className="text-[10px] px-1">Custom</Badge>}
                                {override && <Badge variant="secondary" className="text-[9px] px-1">Override</Badge>}
                              </div>
                            </TableCell>
                            {LEVELS.map((level) => (
                              <TableCell key={level} className="text-center py-2">
                                <Checkbox
                                  checked={getPermValue(role.key, selectedProcess.id, level)}
                                  onCheckedChange={() => togglePerm(role.key, selectedProcess.id, level)}
                                  className="h-4 w-4"
                                />
                              </TableCell>
                            ))}
                            <TableCell className="py-2">
                              <Select value="" onValueChange={(v) => applyTemplate(role.key, selectedProcess.id, v)}>
                                <SelectTrigger className="h-7 text-xs w-full">
                                  <SelectValue placeholder="Appliquer..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(TEMPLATE_LABELS).map(([k, v]) => (
                                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-2">
                              {override && (
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => handleReset(role.key, selectedProcess.id)}
                                  title="Réinitialiser (héritage global)"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card className="flex items-center justify-center h-64 text-muted-foreground">
                Sélectionnez un processus
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* Matrix view — compact overview of all processes × roles */
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="min-w-[800px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Processus</TableHead>
                      {roleOptions.map((r) => (
                        <TableHead key={r.key} className="text-center text-xs px-2 min-w-[90px]">
                          <div>{r.label}</div>
                          {r.isCustom && <span className="text-[9px] text-muted-foreground">(custom)</span>}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProcesses.map((proc) => (
                      <TableRow key={proc.id}>
                        <TableCell className="sticky left-0 bg-background z-10 py-2">
                          <button
                            onClick={() => { setSelectedProcessId(proc.id); setViewMode("process"); }}
                            className="text-left hover:underline"
                          >
                            <div className="font-mono text-xs text-muted-foreground">{proc.code}</div>
                            <div className="text-sm font-medium truncate max-w-[150px]">{proc.nom}</div>
                          </button>
                        </TableCell>
                        {roleOptions.map((role) => {
                          const perm = findPerm(role.key, proc.id);
                          if (!perm) {
                            return (
                              <TableCell key={role.key} className="text-center py-2">
                                <span className="text-xs text-muted-foreground">—</span>
                              </TableCell>
                            );
                          }
                          const activeCount = LEVELS.filter((l) => (perm as any)[l]).length;
                          const color = activeCount === 5
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : activeCount >= 3
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            : activeCount >= 1
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
                          return (
                            <TableCell key={role.key} className="text-center py-2">
                              <Badge className={cn("text-[10px] px-1.5 py-0", color)}>
                                {LEVELS.filter((l) => (perm as any)[l]).map((l) => LEVEL_LABELS[l].charAt(0)).join("")}
                              </Badge>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Audit History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historique des permissions</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Par</TableHead>
                  <TableHead>Rôle cible</TableHead>
                  <TableHead>Nouvelles permissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs">
                      {format(new Date(entry.changed_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.profiles ? `${entry.profiles.prenom} ${entry.profiles.nom}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.target_role || entry.target_custom_role_id || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.new_perms && Object.entries(entry.new_perms)
                        .filter(([, v]) => v)
                        .map(([k]) => LEVEL_LABELS[k] || k)
                        .join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
