import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Network, Zap, ClipboardCheck, XCircle, FileText,
  BarChart3, AlertTriangle, Contact, Loader2, ArrowRight,
  LayoutDashboard, Users, Map, ScrollText, BookOpen, Target,
  GraduationCap, SmilePlus, Truck, CalendarCheck, ClipboardList,
  Settings, Landmark, FolderOpen, Lock, Crown, AlertOctagon, FolderKanban,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalSearch, SearchEntityType, SearchResult } from "@/hooks/useGlobalSearch";
import { cn } from "@/lib/utils";

/* ─── Page navigation items ─── */
interface NavItem { title: string; url: string; icon: any; group: string; keywords?: string; }
const navItems: NavItem[] = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard, group: "Pages", keywords: "dashboard accueil" },
  { title: "Acteurs", url: "/acteurs", icon: Contact, group: "Pages", keywords: "parties prenantes" },
  { title: "Évaluation processus", url: "/evaluation-processus", icon: ClipboardList, group: "Pages" },
  { title: "Processus", url: "/processus", icon: Network, group: "Pages", keywords: "process" },
  { title: "Cartographie", url: "/cartographie", icon: Map, group: "Pages", keywords: "carte map" },
  { title: "BPMN", url: "/bpmn", icon: Settings, group: "Pages", keywords: "diagramme flux" },
  { title: "Documents", url: "/documents", icon: FileText, group: "Pages", keywords: "fichier procedure" },
  { title: "Indicateurs", url: "/indicateurs", icon: BarChart3, group: "Pages", keywords: "kpi mesure" },
  { title: "Risques & Opportunités", url: "/risques", icon: AlertTriangle, group: "Pages" },
  { title: "Incidents", url: "/incidents", icon: AlertOctagon, group: "Pages" },
  { title: "Enjeux du contexte", url: "/enjeux-contexte", icon: Landmark, group: "Pages" },
  { title: "Politique qualité", url: "/politique-qualite", icon: BookOpen, group: "Pages" },
  { title: "Revue de processus", url: "/revue-direction", icon: CalendarCheck, group: "Pages" },
  { title: "Revue de direction (§9.3)", url: "/revue-direction-iso", icon: Target, group: "Pages", keywords: "management review iso" },
  { title: "Compétences", url: "/competences", icon: GraduationCap, group: "Pages", keywords: "formation" },
  { title: "Satisfaction client", url: "/satisfaction-client", icon: SmilePlus, group: "Pages", keywords: "sondage enquete" },
  { title: "Fournisseurs", url: "/fournisseurs", icon: Truck, group: "Pages" },
  { title: "Audits", url: "/audits", icon: ClipboardCheck, group: "Pages" },
  { title: "Non-conformités", url: "/non-conformites", icon: XCircle, group: "Pages", keywords: "nc" },
  { title: "Actions", url: "/actions", icon: Zap, group: "Pages", keywords: "amelioration" },
  { title: "Journal d'activité", url: "/journal", icon: ScrollText, group: "Pages", keywords: "log historique" },
  { title: "Utilisateurs", url: "/utilisateurs", icon: Users, group: "Admin" },
  { title: "Groupes d'acteurs", url: "/groupes-acteurs", icon: FolderOpen, group: "Admin" },
  { title: "Permissions", url: "/admin/permissions", icon: Lock, group: "Admin" },
  { title: "Notifications", url: "/notifications", icon: Target, group: "Pages", keywords: "alerte" },
  { title: "Super Admin", url: "/super-admin", icon: Crown, group: "Admin" },
];

/* ─── Filter chips config ─── */
const FILTERS: { value: SearchEntityType; label: string; icon: any }[] = [
  { value: "all", label: "Tout", icon: Search },
  { value: "processus", label: "Processus", icon: Network },
  { value: "projets", label: "Plans d'action", icon: FolderKanban },
  { value: "actions", label: "Actions", icon: Zap },
  { value: "audits", label: "Audits", icon: ClipboardCheck },
  { value: "nonconformites", label: "NC", icon: XCircle },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "indicateurs", label: "Indicateurs", icon: BarChart3 },
  { value: "risques", label: "Enjeux", icon: AlertTriangle },
  { value: "acteurs", label: "Acteurs", icon: Contact },
];

const TYPE_COLORS: Record<string, string> = {
  processus: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  actions: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  audits: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  nonconformites: "bg-red-500/15 text-red-700 dark:text-red-300",
  documents: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  indicateurs: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  risques: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  acteurs: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
};

const STATUS_COLORS: Record<string, string> = {
  actif: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  brouillon: "bg-muted text-muted-foreground",
  planifie: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  planifiee: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  en_cours: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  terminee: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  termine: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  ouverte: "bg-red-500/20 text-red-700 dark:text-red-300",
  cloturee: "bg-muted text-muted-foreground",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { query, setQuery, filter, setFilter, results, loading } = useGlobalSearch();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
    setFilter("all");
  }, [setQuery, setFilter]);

  const handleSelect = useCallback(
    (url: string) => {
      handleClose();
      navigate(url);
    },
    [navigate, handleClose]
  );

  const showAdmin = hasRole("admin") || hasRole("rmq") || hasRole("super_admin");
  const showSuperAdmin = hasRole("super_admin");

  // Filter nav items by query (simple client-side)
  const filteredNav = query.length < 2
    ? []
    : navItems.filter((item) => {
        if (item.group === "Admin" && !showAdmin) return false;
        if (item.url === "/super-admin" && !showSuperAdmin) return false;
        const hay = `${item.title} ${item.keywords ?? ""}`.toLowerCase();
        return hay.includes(query.toLowerCase());
      });

  const hasResults = filteredNav.length > 0 || results.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Recherche avancée"
        className="flex items-center justify-center sm:justify-start gap-2 h-9 w-9 sm:w-auto sm:px-3 rounded-xl sm:rounded-md border border-input bg-background text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        <span className="hidden lg:inline">Recherche avancée…</span>
        <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
        <DialogContent className="max-w-2xl w-[95vw] p-0 gap-0 overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher dans processus, actions, audits, documents…"
              className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto text-base bg-transparent"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                  filter === f.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                <f.icon className="h-3 w-3" />
                {f.label}
              </button>
            ))}
          </div>

          {/* Results */}
          <ScrollArea className="max-h-[60vh] sm:max-h-[400px]">
            {query.length < 2 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p>Tapez au moins 2 caractères pour chercher</p>
                <p className="text-xs mt-1">dans toutes les données de l'application</p>
              </div>
            ) : !hasResults && !loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <p>Aucun résultat pour « {query} »</p>
              </div>
            ) : (
              <div className="py-1">
                {/* Page navigation results */}
                {filteredNav.length > 0 && (
                  <div>
                    <p className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Pages
                    </p>
                    {filteredNav.map((item) => (
                      <button
                        key={item.url}
                        onClick={() => handleSelect(item.url)}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-accent/50 transition-colors text-left"
                      >
                        <item.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{item.title}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Data results */}
                {results.length > 0 && (
                  <div>
                    {filteredNav.length > 0 && <div className="h-px bg-border mx-4 my-1" />}
                    <p className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Données ({results.length} résultat{results.length > 1 ? "s" : ""})
                    </p>
                    {results.map((item) => (
                      <SearchResultRow key={`${item.type}-${item.id}`} item={item} onSelect={handleSelect} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer hint */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-[11px] text-muted-foreground">
            <span>↑↓ naviguer · ↵ ouvrir · esc fermer</span>
            <span>Filtrez par type pour affiner</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SearchResultRow({ item, onSelect }: { item: SearchResult; onSelect: (url: string) => void }) {
  const typeColor = TYPE_COLORS[item.type] ?? "bg-muted text-muted-foreground";
  const statusColor = item.status ? (STATUS_COLORS[item.status] ?? "bg-muted text-muted-foreground") : null;

  return (
    <button
      onClick={() => onSelect(item.url)}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/50 transition-colors text-left group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.title}</span>
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", typeColor)}>
            {item.typeLabel}
          </Badge>
          {item.status && statusColor && (
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", statusColor)}>
              {item.status.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
        )}
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
