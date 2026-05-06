import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Upload, Image as ImageIcon, Globe, Lock } from "lucide-react";

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  editProject?: {
    id: string;
    title: string;
    slogan: string | null;
    description: string | null;
    resources: string | null;
    statut: string;
    date_debut: string | null;
    date_fin: string | null;
    image_url: string | null;
    objectives?: any;
    resources_list?: any;
    responsable_user_id?: string | null;
    visibility?: string;
  } | null;
  /** Si false, l'utilisateur ne peut ni uploader ni retirer l'image (réservé au responsable du projet et admin). */
  canManageImage?: boolean;
}

export function ProjectForm({ open, onOpenChange, onSaved, editProject, canManageImage = true }: ProjectFormProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "", slogan: "", description: "", statut: "en_cours",
    date_debut: "", date_fin: "",
  });
  const [objectives, setObjectives] = useState<string[]>([]);
  const [newObjective, setNewObjective] = useState("");
  const [resourcesList, setResourcesList] = useState<string[]>([]);
  const [newResource, setNewResource] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [responsableUserId, setResponsableUserId] = useState<string>("");
  const [visibility, setVisibility] = useState("public");
  const [profiles, setProfiles] = useState<{ id: string; nom: string; prenom: string; email: string }[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("id, nom, prenom, email").eq("actif", true).order("nom").then(({ data }) => setProfiles(data ?? []));
  }, []);

  useEffect(() => {
    if (editProject) {
      setForm({
        title: editProject.title,
        slogan: editProject.slogan ?? "",
        description: editProject.description ?? "",
        statut: editProject.statut,
        date_debut: editProject.date_debut ?? "",
        date_fin: editProject.date_fin ?? "",
      });
      setImageUrl(editProject.image_url ?? null);
      setImagePreview(editProject.image_url ?? null);
      setObjectives(Array.isArray(editProject.objectives) ? editProject.objectives : []);
      setResourcesList(Array.isArray(editProject.resources_list) ? editProject.resources_list : []);
      setResponsableUserId(editProject.responsable_user_id ?? "");
      setVisibility(editProject.visibility ?? "public");
    } else {
      setForm({ title: "", slogan: "", description: "", statut: "en_cours", date_debut: "", date_fin: "" });
      setObjectives([]);
      setResourcesList([]);
      setImageUrl(null);
      setImagePreview(null);
      setResponsableUserId("");
      setVisibility("public");
    }
    setImageFile(null);
    setNewObjective("");
    setNewResource("");
  }, [editProject, open]);

  const getProfileLabel = (userId: string | null | undefined) => {
    if (!userId) return "Aucun responsable";
    const profile = profiles.find((p) => p.id === userId);
    return profile ? `${profile.prenom} ${profile.nom}`.trim() || profile.email : "Utilisateur introuvable";
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Fichier image requis"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop volumineuse (max 5 Mo)"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (projectId: string): Promise<string | null> => {
    if (!canManageImage) return imageUrl; // sécurité côté client
    if (!imageFile) return imageUrl;
    const ext = imageFile.name.split(".").pop();
    const path = `project-images/${projectId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("branding").upload(path, imageFile, { upsert: true });
    if (error) { toast.error("Erreur upload image: " + error.message); return imageUrl; }
    const { data: urlData } = supabase.storage.from("branding").getPublicUrl(path);
    return urlData?.publicUrl ?? null;
  };

  const addObjective = () => {
    if (!newObjective.trim()) return;
    setObjectives([...objectives, newObjective.trim()]);
    setNewObjective("");
  };

  const addResource = () => {
    if (!newResource.trim()) return;
    setResourcesList([...resourcesList, newResource.trim()]);
    setNewResource("");
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Le titre est requis"); return; }
    setSaving(true);

    try {
      if (editProject) {
        const uploadedUrl = await uploadImage(editProject.id);
        const payload: any = {
          title: form.title.trim(),
          slogan: form.slogan || null,
          description: form.description || null,
          statut: form.statut,
          date_debut: form.date_debut || null,
          date_fin: form.date_fin || null,
          image_url: uploadedUrl,
          objectives: objectives,
          resources_list: resourcesList,
          visibility,
        };
        const { error } = await supabase.from("projects").update(payload).eq("id", editProject.id);
        if (error) { toast.error(error.message); setSaving(false); return; }
        toast.success("Projet modifié");
      } else {
        // Create project first to get ID for image upload
        const payload: any = {
          title: form.title.trim(),
          slogan: form.slogan || null,
          description: form.description || null,
          statut: form.statut,
          date_debut: form.date_debut || null,
          date_fin: form.date_fin || null,
          created_by: user?.id ?? null,
          objectives: objectives,
          resources_list: resourcesList,
          responsable_user_id: responsableUserId || null,
          visibility,
        };
        const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
        if (error || !data) { toast.error(error?.message ?? "Erreur"); setSaving(false); return; }
        // Upload image if selected
        if (imageFile) {
          const uploadedUrl = await uploadImage(data.id);
          if (uploadedUrl) {
            await supabase.from("projects").update({ image_url: uploadedUrl }).eq("id", data.id);
          }
        }
        toast.success("Projet créé");
      }
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editProject ? "Modifier le projet" : "Nouveau projet"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Image upload */}
          <div className="space-y-1.5">
            <Label>Image du projet</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden h-32 border border-border/40">
                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                {canManageImage && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" />Changer
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setImageFile(null); setImagePreview(null); setImageUrl(null); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />Retirer
                    </Button>
                  </div>
                )}
              </div>
            ) : canManageImage ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-24 rounded-lg border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40 hover:bg-muted/20 transition-colors"
              >
                <ImageIcon className="h-5 w-5" />
                <span className="text-xs">Cliquez pour ajouter une image</span>
              </button>
            ) : (
              <div className="w-full h-24 rounded-lg border border-dashed border-border/40 flex flex-col items-center justify-center gap-1 text-muted-foreground/60">
                <Lock className="h-4 w-4" />
                <span className="text-[11px]">Réservé au responsable du projet</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Titre *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nom du projet" />
          </div>
          <div className="space-y-1.5">
            <Label>Slogan</Label>
            <Input value={form.slogan} onChange={(e) => setForm({ ...form, slogan: e.target.value })} placeholder="Phrase d'accroche" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>

          {/* Objectifs - liste dynamique */}
          <div className="space-y-1.5">
            <Label>Objectifs</Label>
            <div className="space-y-1">
              {objectives.map((obj, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border/30 bg-muted/10 px-3 py-1.5 text-sm">
                  <span className="flex-1">{obj}</span>
                  <button onClick={() => setObjectives(objectives.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                placeholder="Ajouter un objectif..."
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addObjective())}
              />
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={addObjective}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Ressources - liste dynamique */}
          <div className="space-y-1.5">
            <Label>Ressources</Label>
            <div className="space-y-1">
              {resourcesList.map((res, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border/30 bg-muted/10 px-3 py-1.5 text-sm">
                  <span className="flex-1">{res}</span>
                  <button onClick={() => setResourcesList(resourcesList.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newResource}
                onChange={(e) => setNewResource(e.target.value)}
                placeholder="Ajouter une ressource..."
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addResource())}
              />
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={addResource}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Responsable */}
          <div className="space-y-1.5">
            <Label>Responsable du projet</Label>
            {editProject ? (
              <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{getProfileLabel(responsableUserId || editProject.responsable_user_id)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ce champ est figé après la création du projet. Utilisez le transfert de responsabilité dans « Accès & Collaborateurs ».
                </p>
              </div>
            ) : (
              <Select value={responsableUserId || "none"} onValueChange={(v) => setResponsableUserId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Aucun responsable" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {`${p.prenom} ${p.nom}`.trim() || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Visibility */}
          <div className="flex items-center justify-between rounded-lg border border-border/30 p-3">
            <div className="flex items-center gap-2">
              {visibility === "public" ? <Globe className="h-4 w-4 text-emerald-600" /> : <Lock className="h-4 w-4 text-amber-600" />}
              <span className="text-sm">{visibility === "public" ? "Public" : "Privé"}</span>
            </div>
            <Switch checked={visibility === "private"} onCheckedChange={(checked) => setVisibility(checked ? "private" : "public")} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="brouillon">Brouillon</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="termine">Terminé</SelectItem>
                  <SelectItem value="archive">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date début</Label>
              <Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date fin</Label>
              <Input type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Enregistrement..." : editProject ? "Enregistrer" : "Créer le projet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
