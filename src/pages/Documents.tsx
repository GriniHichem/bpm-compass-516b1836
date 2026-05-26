import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, FileText, Trash2, X, Eye, Download, ImageIcon, FolderOpen, Search, BarChart3, Clock, FileImage, File, Tag, ShieldCheck, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { HelpTooltip } from "@/components/HelpTooltip";
import { PdfViewerDialog } from "@/components/PdfViewerDialog";
import { ImageViewerDialog } from "@/components/ImageViewerDialog";
import { DocumentWorkflowDialog, WORKFLOW_LABELS, WORKFLOW_COLORS, type WorkflowStatut } from "@/components/DocumentWorkflowDialog";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { format, subMonths, startOfMonth, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

type DocType = { id: string; label: string; code: string; actif: boolean; };
type DocTag = { id: string; label: string; color: string; };

type Doc = {
  id: string;
  titre: string;
  code: string | null;
  type_document: string;
  version: number;
  archive: boolean;
  nom_fichier: string | null;
  chemin_fichier: string | null;
  created_at: string;
  process_ids: string[];
  consulte_count: number;
  retired_at: string | null;
  tag_ids: string[];
  statut_workflow: WorkflowStatut;
  date_prochaine_revue: string | null;
  date_approbation: string | null;
};

type AuditLog = {
  id: string;
  action: string;
  entity_id: string | null;
  created_at: string;
  user_id: string | null;
  new_value: any;
  old_value: any;
};

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff", ".tif"];
const ACCEPTED_FILES = ".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.tiff,.tif";

const isImageFile = (filename: string | null) => {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
};

const isPdfFile = (filename: string | null) => {
  if (!filename) return false;
  return filename.toLowerCase().endsWith(".pdf");
};

const CHART_COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--accent))",
  "hsl(var(--muted-foreground))", "hsl(var(--destructive))",
];

export default function Documents() {
  const { hasRole, hasPermission, user, profile } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processes, setProcesses] = useState<{ id: string; nom: string }[]>([]);
  const [newDoc, setNewDoc] = useState({ titre: "", type_document: "procedure", selectedProcessIds: [] as string[], selectedTagIds: [] as string[] });
  const [file, setFile] = useState<File | null>(null);

  // Dynamic types & tags
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [docTags, setDocTags] = useState<DocTag[]>([]);

  // Filters
  const [filterProcessId, setFilterProcessId] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTagId, setFilterTagId] = useState("all");

  // Viewers
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [pdfViewerTitle, setPdfViewerTitle] = useState("");
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [imageViewerTitle, setImageViewerTitle] = useState("");

  // History
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const canCreate = hasPermission("documents", "can_edit");
  const canDelete = hasPermission("documents", "can_delete");
  const canDownload = hasRole("rmq") || hasRole("admin") || hasRole("super_admin");
  const isOnlyResponsable = hasRole("responsable_processus") && !hasRole("admin") && !hasRole("rmq");

  // Type labels from dynamic types
  const typeLabels = useMemo(() => {
    const map: Record<string, string> = {};
    docTypes.forEach(t => { map[t.code] = t.label; });
    return map;
  }, [docTypes]);

  const fetchDocs = async () => {
    // Fetch dynamic types & tags
    const [typesRes, tagsRes] = await Promise.all([
      supabase.from("document_types").select("*").order("label"),
      supabase.from("document_tags").select("*").order("label"),
    ]);
    setDocTypes((typesRes.data ?? []) as DocType[]);
    setDocTags((tagsRes.data ?? []) as DocTag[]);

    let procQuery = supabase.from("processes").select("id, nom").order("nom");
    if (isOnlyResponsable && user) procQuery = procQuery.eq("responsable_id", user.id);
    const { data: procData } = await procQuery;
    setProcesses(procData ?? []);
    const myProcessIds = (procData ?? []).map(p => p.id);

    const { data: docsData } = await supabase
      .from("documents").select("*").eq("archive", false).order("created_at", { ascending: false });

    const [dpRes, tagLinksRes] = await Promise.all([
      supabase.from("document_processes").select("document_id, process_id"),
      supabase.from("document_tag_links").select("document_id, tag_id"),
    ]);
    const dpMap = new Map<string, string[]>();
    (dpRes.data ?? []).forEach((dp: any) => {
      const list = dpMap.get(dp.document_id) || [];
      list.push(dp.process_id);
      dpMap.set(dp.document_id, list);
    });
    const tagMap = new Map<string, string[]>();
    (tagLinksRes.data ?? []).forEach((tl: any) => {
      const list = tagMap.get(tl.document_id) || [];
      list.push(tl.tag_id);
      tagMap.set(tl.document_id, list);
    });

    let enriched: Doc[] = (docsData ?? []).map((d: any) => ({
      id: d.id, titre: d.titre, type_document: d.type_document, version: d.version,
      archive: d.archive, nom_fichier: d.nom_fichier, chemin_fichier: d.chemin_fichier,
      created_at: d.created_at, process_ids: dpMap.get(d.id) || [],
      consulte_count: d.consulte_count ?? 0, retired_at: d.retired_at,
      tag_ids: tagMap.get(d.id) || [],
    }));

    if (isOnlyResponsable) {
      enriched = enriched.filter(d => d.process_ids.some(pid => myProcessIds.includes(pid)));
    }

    setDocs(enriched);
    setLoading(false);
  };

  const fetchHistory = async () => {
    const { data } = await supabase
      .from("audit_logs").select("id, action, entity_id, created_at, user_id, new_value, old_value")
      .eq("entity_type", "documents").order("created_at", { ascending: false }).limit(200);
    setAuditLogs(data ?? []);

    const { data: profilesData } = await supabase.from("profiles").select("id, nom, prenom, email");
    const map: Record<string, string> = {};
    (profilesData ?? []).forEach((p: any) => {
      map[p.id] = [p.prenom, p.nom].filter(Boolean).join(" ") || p.email || p.id;
    });
    setProfiles(map);
  };

  useEffect(() => { fetchDocs(); fetchHistory(); }, []);

  const handleUpload = async () => {
    if (!newDoc.titre) { toast.error("Titre requis"); return; }
    let chemin = null, nom_fichier = null, taille_fichier = null;
    let detectedType = newDoc.type_document;

    if (file) {
      const path = `${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("documents").upload(path, file);
      if (uploadErr) {
        toast.error("Erreur upload : " + (uploadErr.message.includes("row-level security") ? "Vous n'avez pas les droits pour uploader des fichiers." : uploadErr.message));
        return;
      }
      chemin = path;
      nom_fichier = file.name;
      taille_fichier = file.size;
      if (isImageFile(file.name) && detectedType === "procedure") detectedType = "image";
    }

    const { data: insertedDoc, error } = await supabase.from("documents").insert({
      titre: newDoc.titre,
      type_document: detectedType as any,
      process_id: newDoc.selectedProcessIds[0] || null,
      chemin_fichier: chemin, nom_fichier, taille_fichier,
    }).select("id").single();

    if (error || !insertedDoc) {
      toast.error("Erreur création document : " + (error?.message.includes("row-level security") ? "Vous n'avez pas les droits pour créer des documents." : error?.message || "Erreur inconnue"));
      return;
    }

    if (newDoc.selectedProcessIds.length > 0) {
      const rows = newDoc.selectedProcessIds.map(pid => ({ document_id: insertedDoc.id, process_id: pid }));
      await supabase.from("document_processes").insert(rows);
    }

    // Save tag links
    if (newDoc.selectedTagIds.length > 0) {
      const tagRows = newDoc.selectedTagIds.map(tid => ({ document_id: insertedDoc.id, tag_id: tid }));
      await supabase.from("document_tag_links").insert(tagRows);
    }

    toast.success("Document ajouté");
    setDialogOpen(false);
    setNewDoc({ titre: "", type_document: "procedure", selectedProcessIds: [], selectedTagIds: [] });
    setFile(null);
    fetchDocs();
    fetchHistory();
  };

  const handleDeleteClick = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Document supprimé");
    fetchDocs();
    fetchHistory();
  };

  const addProcessToSelection = (pid: string) => {
    if (pid && !newDoc.selectedProcessIds.includes(pid))
      setNewDoc({ ...newDoc, selectedProcessIds: [...newDoc.selectedProcessIds, pid] });
  };
  const removeProcessFromSelection = (pid: string) => {
    setNewDoc({ ...newDoc, selectedProcessIds: newDoc.selectedProcessIds.filter(p => p !== pid) });
  };
  const getProcessName = (pid: string) => processes.find(p => p.id === pid)?.nom || pid;
  const getTag = (tid: string) => docTags.find(t => t.id === tid);

  const toggleTagSelection = (tid: string) => {
    const current = newDoc.selectedTagIds;
    const updated = current.includes(tid) ? current.filter(x => x !== tid) : [...current, tid];
    setNewDoc({ ...newDoc, selectedTagIds: updated });
  };

  // Filtered docs
  const filteredDocs = useMemo(() => {
    return docs.filter(d => {
      if (filterProcessId !== "all" && !d.process_ids.includes(filterProcessId)) return false;
      if (filterType !== "all" && d.type_document !== filterType) return false;
      if (filterTagId !== "all" && !d.tag_ids.includes(filterTagId)) return false;
      if (filterSearch && !d.titre.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      if (filterDateFrom) {
        try { if (parseISO(d.created_at) < parseISO(filterDateFrom)) return false; } catch {}
      }
      if (filterDateTo) {
        try {
          const to = new Date(filterDateTo);
          to.setHours(23, 59, 59, 999);
          if (parseISO(d.created_at) > to) return false;
        } catch {}
      }
      return true;
    });
  }, [docs, filterProcessId, filterType, filterSearch, filterDateFrom, filterDateTo, filterTagId]);

  const openFileViewer = async (doc: Doc) => {
    if (!doc.chemin_fichier) return;
    // Increment consulte_count
    supabase.from("documents").update({ consulte_count: (doc.consulte_count || 0) + 1 } as any).eq("id", doc.id).then();

    const { data, error } = await supabase.storage.from("documents").download(doc.chemin_fichier);
    if (error || !data) { toast.error("Impossible d'accéder au fichier"); return; }
    const blobUrl = URL.createObjectURL(data);

    if (isPdfFile(doc.nom_fichier)) {
      setPdfViewerTitle(doc.titre);
      setPdfViewerUrl(blobUrl);
    } else if (isImageFile(doc.nom_fichier)) {
      setImageViewerTitle(doc.titre);
      setImageViewerUrl(blobUrl);
    } else {
      // Fallback: download
      const a = document.createElement("a"); a.href = blobUrl; a.download = doc.nom_fichier || "document"; a.click();
      URL.revokeObjectURL(blobUrl);
    }
  };

  // ===== Dashboard KPIs =====
  const totalDocs = docs.length;
  const activeDocs = docs.filter(d => !d.retired_at).length;
  const retiredDocs = docs.filter(d => !!d.retired_at).length;
  const noFileDocs = docs.filter(d => !d.chemin_fichier).length;

  const typeDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    docs.forEach(d => { map[d.type_document] = (map[d.type_document] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: typeLabels[name] || name, value }));
  }, [docs]);

  const processDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    docs.forEach(d => d.process_ids.forEach(pid => { const n = getProcessName(pid); map[n] = (map[n] || 0) + 1; }));
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [docs, processes]);

  const monthlyUploads = useMemo(() => {
    const months: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const label = format(d, "MMM yy", { locale: fr });
      const start = startOfMonth(d);
      const end = startOfMonth(subMonths(new Date(), i - 1));
      const count = docs.filter(doc => {
        try {
          const cd = parseISO(doc.created_at);
          return cd >= start && cd < end;
        } catch { return false; }
      }).length;
      months.push({ label, count });
    }
    return months;
  }, [docs]);

  const topConsulted = useMemo(() =>
    [...docs].sort((a, b) => (b.consulte_count || 0) - (a.consulte_count || 0)).slice(0, 5),
  [docs]);

  // ===== History =====
  const actionBadge = (action: string) => {
    switch (action) {
      case "create": return <Badge className="bg-primary/10 text-primary border-primary/20">Ajout</Badge>;
      case "update": return <Badge className="bg-accent text-accent-foreground border-accent">Modification</Badge>;
      case "delete": return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Suppression</Badge>;
      default: return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const getDocIcon = (doc: Doc) => {
    if (isImageFile(doc.nom_fichier)) return <FileImage className="h-5 w-5 text-chart-3" />;
    if (isPdfFile(doc.nom_fichier)) return <FileText className="h-5 w-5 text-destructive" />;
    return <File className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-6 w-6" /> Gestion documentaire <HelpTooltip term="document" />
          </h1>
          <p className="text-muted-foreground">Documents, dashboard et historique d'activité</p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Ajouter</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Titre</Label>
                  <Input value={newDoc.titre} onChange={e => setNewDoc({ ...newDoc, titre: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newDoc.type_document} onValueChange={v => setNewDoc({ ...newDoc, type_document: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {docTypes.filter(t => t.actif).map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-1">
                    {docTags.map(tag => (
                      <Badge
                        key={tag.id}
                        className="cursor-pointer text-xs px-2 py-1"
                        style={newDoc.selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color, color: "#fff" } : { backgroundColor: "transparent", border: `1px solid ${tag.color}`, color: tag.color }}
                        onClick={() => toggleTagSelection(tag.id)}
                      >
                        {tag.label}
                      </Badge>
                    ))}
                    {docTags.length === 0 && <p className="text-xs text-muted-foreground">Aucun tag configuré</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Processus associés</Label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {newDoc.selectedProcessIds.map(pid => (
                      <Badge key={pid} variant="secondary" className="gap-1">
                        {getProcessName(pid)}
                        <button type="button" onClick={() => removeProcessFromSelection(pid)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <Select value="__placeholder__" onValueChange={v => { if (v !== "__placeholder__") addProcessToSelection(v); }}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un processus..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__placeholder__" disabled>Sélectionner un processus...</SelectItem>
                      {processes.filter(p => !newDoc.selectedProcessIds.includes(p.id)).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fichier (PDF ou Image)</Label>
                  <Input type="file" accept={ACCEPTED_FILES} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  <p className="text-xs text-muted-foreground">Formats acceptés : PDF, JPG, PNG, GIF, WEBP, SVG, BMP, TIFF</p>
                </div>
                <Button onClick={handleUpload} className="w-full">Ajouter</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-1"><BarChart3 className="h-4 w-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1"><FileText className="h-4 w-4" /> Documents</TabsTrigger>
          <TabsTrigger value="historique" className="gap-1"><Clock className="h-4 w-4" /> Historique</TabsTrigger>
        </TabsList>

        {/* ===== DASHBOARD ===== */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total documents", value: totalDocs, icon: FolderOpen },
              { label: "Documents actifs", value: activeDocs, icon: FileText },
              { label: "Retirés / Archivés", value: retiredDocs, icon: Trash2 },
              { label: "Sans fichier", value: noFileDocs, icon: File },
            ].map(kpi => (
              <Card key={kpi.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{kpi.label}</p>
                      <p className="text-3xl font-bold">{kpi.value}</p>
                    </div>
                    <kpi.icon className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Répartition par type</CardTitle></CardHeader>
              <CardContent>
                {typeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} (${value})`}>
                        {typeDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-muted-foreground text-center py-8">Aucune donnée</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Documents par processus</CardTitle></CardHeader>
              <CardContent>
                {processDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={processDistribution} layout="vertical">
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-muted-foreground text-center py-8">Aucune donnée</p>}
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Ajouts mensuels (6 mois)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={monthlyUploads}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} name="Documents" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Top 5 — Les plus consultés</CardTitle></CardHeader>
              <CardContent>
                {topConsulted.filter(d => d.consulte_count > 0).length > 0 ? (
                  <div className="space-y-3">
                    {topConsulted.filter(d => d.consulte_count > 0).map((d, i) => (
                      <div key={d.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                          <span className="text-sm truncate max-w-[200px]">{d.titre}</span>
                        </div>
                        <Badge variant="secondary">{d.consulte_count} consultations</Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-muted-foreground text-center py-8">Aucune consultation enregistrée</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== DOCUMENTS ===== */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par titre..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="pl-9 w-[220px]" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {docTypes.filter(t => t.actif).map(t => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTagId} onValueChange={setFilterTagId}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les tags</SelectItem>
                {docTags.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterProcessId} onValueChange={setFilterProcessId}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les processus</SelectItem>
                {processes.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Label className="text-xs whitespace-nowrap">Du</Label>
              <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-[150px]" />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs whitespace-nowrap">Au</Label>
              <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-[150px]" />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : filteredDocs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun document trouvé</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filteredDocs.map(d => (
                <Card key={d.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      {getDocIcon(d)}
                      <div>
                        <p className="font-medium">{d.titre}</p>
                        <p className="text-xs text-muted-foreground">
                          {typeLabels[d.type_document] ?? d.type_document} • v{d.version}
                          {d.consulte_count > 0 && <> • {d.consulte_count} consultation{d.consulte_count > 1 ? "s" : ""}</>}
                          {d.created_at && <> • {format(parseISO(d.created_at), "dd/MM/yyyy")}</>}
                        </p>
                        {(d.process_ids.length > 0 || d.tag_ids.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {d.process_ids.map(pid => (
                              <Badge key={pid} variant="outline" className="text-xs">{getProcessName(pid)}</Badge>
                            ))}
                            {d.tag_ids.map(tid => {
                              const tag = getTag(tid);
                              return tag ? (
                                <Badge key={tid} className="text-xs" style={{ backgroundColor: tag.color, color: "#fff" }}>{tag.label}</Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.nom_fichier && <Badge variant="secondary" className="max-w-[160px] truncate">{d.nom_fichier}</Badge>}
                      {d.chemin_fichier && (isPdfFile(d.nom_fichier) || isImageFile(d.nom_fichier)) && (
                        <Button variant="ghost" size="icon" onClick={() => openFileViewer(d)} title="Consulter">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {d.chemin_fichier && canDownload && (
                        <Button variant="ghost" size="icon"
                          onClick={async e => {
                            e.stopPropagation();
                            const { data } = await supabase.storage.from("documents").download(d.chemin_fichier!);
                            if (!data) { toast.error("Impossible d'accéder au fichier"); return; }
                            const blobUrl = URL.createObjectURL(data);
                            const a = document.createElement("a"); a.href = blobUrl; a.download = d.nom_fichier || "document"; a.click(); URL.revokeObjectURL(blobUrl);
                          }}
                          title="Télécharger"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={e => { e.stopPropagation(); handleDeleteClick(d.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== HISTORIQUE ===== */}
        <TabsContent value="historique" className="space-y-4">
          {auditLogs.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun historique d'activité</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {auditLogs.map(log => {
                const docTitle = log.new_value?.titre || log.old_value?.titre || "Document";
                return (
                  <Card key={log.id}>
                    <CardContent className="flex items-center gap-4 py-3">
                      {actionBadge(log.action)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{docTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.user_id ? profiles[log.user_id] || "Utilisateur" : "Système"} • {format(parseISO(log.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PdfViewerDialog
        open={!!pdfViewerUrl}
        onOpenChange={open => {
          if (!open) { if (pdfViewerUrl?.startsWith("blob:")) URL.revokeObjectURL(pdfViewerUrl); setPdfViewerUrl(null); setPdfViewerTitle(""); }
        }}
        pdfUrl={pdfViewerUrl}
        title={pdfViewerTitle}
      />
      <ImageViewerDialog
        open={!!imageViewerUrl}
        onOpenChange={open => {
          if (!open) { if (imageViewerUrl?.startsWith("blob:")) URL.revokeObjectURL(imageViewerUrl); setImageViewerUrl(null); setImageViewerTitle(""); }
        }}
        imageUrl={imageViewerUrl}
        title={imageViewerTitle}
      />
    </div>
  );
}
