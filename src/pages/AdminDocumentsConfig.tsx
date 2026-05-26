import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { FolderOpen, Plus, Trash2, Tag, Settings, ChevronDown, Hash } from "lucide-react";
import { useActeurs } from "@/hooks/useActeurs";

interface DocType { id: string; label: string; code: string; actif: boolean; }
interface DocTag { id: string; label: string; color: string; }
interface DocActeurPerm {
  id: string; acteur_id: string;
  can_read: boolean; can_download: boolean; can_delete: boolean;
  allowed_type_ids: string[]; allowed_tag_ids: string[];
}

export default function AdminDocumentsConfig() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("gestion_documentaire", "can_edit");
  const { acteurs, getActeurLabel } = useActeurs();

  const [types, setTypes] = useState<DocType[]>([]);
  const [tags, setTags] = useState<DocTag[]>([]);
  const [perms, setPerms] = useState<DocActeurPerm[]>([]);
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newTypeCode, setNewTypeCode] = useState("");
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [tRes, tagRes, pRes] = await Promise.all([
      supabase.from("document_types").select("*").order("label"),
      supabase.from("document_tags").select("*").order("label"),
      supabase.from("document_actor_permissions").select("*"),
    ]);
    setTypes((tRes.data ?? []) as DocType[]);
    setTags((tagRes.data ?? []) as DocTag[]);
    setPerms((pRes.data ?? []) as DocActeurPerm[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const addType = async () => {
    if (!newTypeLabel.trim() || !newTypeCode.trim()) { toast.error("Label et code requis"); return; }
    const { error } = await supabase.from("document_types").insert({ label: newTypeLabel.trim(), code: newTypeCode.trim().toLowerCase().replace(/\s+/g, "_") });
    if (error) { toast.error(error.message); return; }
    toast.success("Type ajouté");
    setNewTypeLabel(""); setNewTypeCode("");
    fetchAll();
  };

  const toggleTypeActif = async (t: DocType) => {
    await supabase.from("document_types").update({ actif: !t.actif } as any).eq("id", t.id);
    fetchAll();
  };

  const deleteType = async (id: string) => {
    if (!confirm("Supprimer ce type ?")) return;
    const { error } = await supabase.from("document_types").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Type supprimé");
    fetchAll();
  };

  const addTag = async () => {
    if (!newTagLabel.trim()) { toast.error("Label requis"); return; }
    const { error } = await supabase.from("document_tags").insert({ label: newTagLabel.trim(), color: newTagColor });
    if (error) { toast.error(error.message); return; }
    toast.success("Tag ajouté");
    setNewTagLabel(""); setNewTagColor("#6366f1");
    fetchAll();
  };

  const deleteTag = async (id: string) => {
    if (!confirm("Supprimer ce tag ?")) return;
    const { error } = await supabase.from("document_tags").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tag supprimé");
    fetchAll();
  };

  const getPermForActeur = (acteurId: string) => perms.find(p => p.acteur_id === acteurId);

  const upsertPerm = async (acteurId: string, field: string, value: any) => {
    const existing = getPermForActeur(acteurId);
    if (existing) {
      const { error } = await supabase.from("document_actor_permissions").update({ [field]: value } as any).eq("id", existing.id);
      if (error) { toast.error("Erreur mise à jour : " + error.message); return; }
    } else {
      const { error } = await supabase.from("document_actor_permissions").insert({ acteur_id: acteurId, [field]: value } as any);
      if (error) { toast.error("Erreur création : " + error.message); return; }
    }
    fetchAll();
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FolderOpen className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuration documentaire</h1>
          <p className="text-sm text-muted-foreground">
            Types, tags et permissions par acteur
            {!canEdit && <span className="ml-2 text-amber-500 font-medium">(lecture seule)</span>}
          </p>
        </div>
      </div>

      {/* Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Types de documents</CardTitle>
          <CardDescription>Gérez les types de documents disponibles pour le classement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <div className="flex gap-2">
              <Input placeholder="Label (ex: Manuel qualité)" value={newTypeLabel} onChange={e => setNewTypeLabel(e.target.value)} className="flex-1" />
              <Input placeholder="Code (ex: manuel_qualite)" value={newTypeCode} onChange={e => setNewTypeCode(e.target.value)} className="w-[200px]" />
              <Button onClick={addType} size="sm"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="w-[80px]">Actif</TableHead>
                {canEdit && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.label}</TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">{t.code}</TableCell>
                  <TableCell>
                    <Switch checked={t.actif} onCheckedChange={() => toggleTypeActif(t)} disabled={!canEdit} />
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteType(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Tag className="h-4 w-4" /> Tags</CardTitle>
          <CardDescription>Étiquettes pour catégoriser les documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canEdit && (
            <div className="flex gap-2 items-center">
              <Input placeholder="Label (ex: Technique)" value={newTagLabel} onChange={e => setNewTagLabel(e.target.value)} className="flex-1" />
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Couleur</Label>
                <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="h-8 w-8 rounded border cursor-pointer" />
              </div>
              <Button onClick={addTag} size="sm"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <Badge key={tag.id} style={{ backgroundColor: tag.color, color: "#fff" }} className="gap-1 text-sm px-3 py-1.5">
                {tag.label}
                {canEdit && (
                  <button onClick={() => deleteTag(tag.id)} className="ml-1 hover:opacity-70"><Trash2 className="h-3 w-3" /></button>
                )}
              </Badge>
            ))}
            {tags.length === 0 && <p className="text-sm text-muted-foreground">Aucun tag configuré</p>}
          </div>
        </CardContent>
      </Card>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Settings className="h-4 w-4" /> Permissions documentaires par acteur</CardTitle>
          <CardDescription>Définissez les droits de lecture, téléchargement et suppression pour chaque acteur.</CardDescription>
        </CardHeader>
        <CardContent>
          {acteurs.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Aucun acteur configuré</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acteur</TableHead>
                  <TableHead className="text-center w-[80px]">Lire</TableHead>
                  <TableHead className="text-center w-[100px]">Télécharger</TableHead>
                  <TableHead className="text-center w-[90px]">Supprimer</TableHead>
                  <TableHead>Types autorisés</TableHead>
                  <TableHead>Tags autorisés</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acteurs.map(act => {
                  const perm = getPermForActeur(act.id);
                  return (
                    <TableRow key={act.id}>
                      <TableCell className="font-medium text-sm">{act.fonction || act.organisation || "Acteur"}</TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={perm?.can_read ?? true} onCheckedChange={v => upsertPerm(act.id, "can_read", !!v)} disabled={!canEdit} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={perm?.can_download ?? false} onCheckedChange={v => upsertPerm(act.id, "can_download", !!v)} disabled={!canEdit} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox checked={perm?.can_delete ?? false} onCheckedChange={v => upsertPerm(act.id, "can_delete", !!v)} disabled={!canEdit} />
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs w-[140px] justify-between" disabled={!canEdit}>
                              {(perm?.allowed_type_ids?.length ?? 0) === 0 ? "Tous" : `${perm!.allowed_type_ids.length} type(s)`}
                              <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[200px] p-2 space-y-1" align="start">
                            {types.filter(t => t.actif).map(t => (
                              <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                <Checkbox
                                  checked={(perm?.allowed_type_ids ?? []).includes(t.id)}
                                  onCheckedChange={() => {
                                    const current = perm?.allowed_type_ids ?? [];
                                    const updated = current.includes(t.id) ? current.filter(x => x !== t.id) : [...current, t.id];
                                    upsertPerm(act.id, "allowed_type_ids", updated);
                                  }}
                                />
                                {t.label}
                              </label>
                            ))}
                            {types.filter(t => t.actif).length === 0 && <p className="text-xs text-muted-foreground p-2">Aucun type actif</p>}
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs w-[140px] justify-between" disabled={!canEdit}>
                              {(perm?.allowed_tag_ids?.length ?? 0) === 0 ? "Tous" : `${perm!.allowed_tag_ids.length} tag(s)`}
                              <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[200px] p-2 space-y-1" align="start">
                            {tags.map(t => (
                              <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                                <Checkbox
                                  checked={(perm?.allowed_tag_ids ?? []).includes(t.id)}
                                  onCheckedChange={() => {
                                    const current = perm?.allowed_tag_ids ?? [];
                                    const updated = current.includes(t.id) ? current.filter(x => x !== t.id) : [...current, t.id];
                                    upsertPerm(act.id, "allowed_tag_ids", updated);
                                  }}
                                />
                                {t.label}
                              </label>
                            ))}
                            {tags.length === 0 && <p className="text-xs text-muted-foreground p-2">Aucun tag</p>}
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
