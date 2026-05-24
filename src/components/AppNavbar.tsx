import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useLicense } from "@/contexts/LicenseContext";
import { useHelpMode } from "@/contexts/HelpModeContext";
import { ROLE_LABELS, type AppRole, type AppModule } from "@/lib/defaultPermissions";
import { GlobalSearch } from "@/components/GlobalSearch";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { UserProfileDialog } from "@/components/UserProfileDialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard, Users, Network, Map, FileText, BarChart3, AlertTriangle, Landmark,
  ClipboardCheck, XCircle, Zap, ScrollText, Settings, LogOut, Shield, Contact, AlertOctagon,
  FolderOpen, BookOpen, Target, GraduationCap, SmilePlus, Truck, CalendarCheck, ClipboardList,
  Lock, Crown, TrendingUp, Bell, Menu, HelpCircle, Eye, EyeOff, KeyRound, Info, UserCircle,
  ChevronDown, Grid3X3, Home, FolderKanban,
} from "lucide-react";
import defaultLogo from "@/assets/logo.jpg";

function LicenseAboutInfo() {
  const { status, daysRemaining } = useLicense();
  const statusLabels: Record<string, string> = {
    trial: "Période d'essai",
    active: "Licence active",
    grace: "Période de grâce",
    expired: "Licence expirée",
  };
  const statusColors: Record<string, string> = {
    trial: "text-blue-500",
    active: "text-green-500",
    grace: "text-amber-500",
    expired: "text-destructive",
  };
  return (
    <div className="text-xs space-y-1">
      <p className="text-muted-foreground">
        Licence : <span className={`font-semibold ${statusColors[status]}`}>{statusLabels[status]}</span>
      </p>
      {status !== "expired" && (
        <p className="text-muted-foreground">
          {status === "active" ? "Expire dans" : "Reste"} : <span className="font-semibold text-foreground">{daysRemaining} jour{daysRemaining > 1 ? "s" : ""}</span>
        </p>
      )}
    </div>
  );
}

type NavItem = { title: string; url: string; icon: any; module?: AppModule; description?: string };

const moduleGroups: { label: string; icon: any; items: NavItem[] }[] = [
  {
    label: "Principal",
    icon: Home,
    items: [
      { title: "Tableau de bord", url: "/", icon: LayoutDashboard, description: "Vue d'ensemble et KPIs" },
      { title: "Acteurs", url: "/acteurs", icon: Contact, module: "acteurs", description: "Référentiel des acteurs" },
      { title: "Évaluation processus", url: "/evaluation-processus", icon: ClipboardList, module: "evaluation_processus", description: "Évaluer la performance" },
    ],
  },
  {
    label: "Processus",
    icon: Network,
    items: [
      { title: "Processus", url: "/processus", icon: Network, module: "processus", description: "Liste des processus" },
      { title: "Cartographie", url: "/cartographie", icon: Map, module: "cartographie", description: "Vue d'ensemble visuelle" },
      { title: "BPMN", url: "/bpmn", icon: Settings, module: "bpmn", description: "Diagrammes de flux" },
      { title: "Gestion documentaire", url: "/documents", icon: FolderOpen, module: "documents", description: "Documents et fichiers" },
    ],
  },
  {
    label: "Manager processus",
    icon: BarChart3,
    items: [
      { title: "Dashboard Indicateurs", url: "/dashboard-indicateurs", icon: TrendingUp, module: "indicateurs", description: "Synthèse des indicateurs" },
      { title: "Indicateurs", url: "/indicateurs", icon: BarChart3, module: "indicateurs", description: "Suivi des métriques" },
      { title: "Risques & Opportunités", url: "/risques", icon: AlertTriangle, module: "risques", description: "Analyse des risques" },
      { title: "Incidents", url: "/incidents", icon: AlertOctagon, module: "incidents", description: "Gestion des incidents" },
      { title: "Enjeux du contexte", url: "/enjeux-contexte", icon: Landmark, module: "enjeux_contexte", description: "Enjeux internes/externes" },
    ],
  },
  {
    label: "Pilotage SMQ",
    icon: Target,
    items: [
      { title: "Politique qualité", url: "/politique-qualite", icon: BookOpen, module: "politique_qualite", description: "Orientations stratégiques" },
      { title: "Revue de processus", url: "/revue-direction", icon: CalendarCheck, module: "revue_direction", description: "Bilans processus" },
      { title: "Revue de direction", url: "/revue-direction-iso", icon: Target, module: "revue_direction_iso", description: "Revue stratégique" },
      { title: "Compétences", url: "/competences", icon: GraduationCap, module: "competences", description: "Formations et compétences" },
      { title: "Satisfaction client", url: "/satisfaction-client", icon: SmilePlus, module: "satisfaction_client", description: "Enquêtes et satisfaction" },
      { title: "Fournisseurs", url: "/fournisseurs", icon: Truck, module: "fournisseurs", description: "Évaluation fournisseurs" },
    ],
  },
  {
    label: "Audit & Amélioration",
    icon: ClipboardCheck,
    items: [
      { title: "Tableau Audit/NC", url: "/dashboard-audit", icon: BarChart3, module: "audits", description: "Synthèse Audit & NC" },
      { title: "Audits", url: "/audits", icon: ClipboardCheck, module: "audits", description: "Planification et suivi" },
      { title: "Non-conformités", url: "/non-conformites", icon: XCircle, module: "non_conformites", description: "Traitement des NC" },
      { title: "Plans d'action", url: "/actions", icon: FolderKanban, module: "actions", description: "Projets et plans d'action" },
      { title: "Journal d'activité", url: "/journal", icon: ScrollText, module: "journal", description: "Historique système" },
    ],
  },
  {
    label: "Administration",
    icon: Settings,
    items: [
      { title: "Utilisateurs", url: "/utilisateurs", icon: Users, module: "utilisateurs", description: "Gestion des comptes" },
      { title: "Groupes d'acteurs", url: "/groupes-acteurs", icon: FolderOpen, module: "groupes_acteurs", description: "Organisation des groupes" },
      { title: "Permissions", url: "/admin/permissions", icon: Lock, description: "Matrice des droits" },
      { title: "Permissions processus", url: "/admin/permissions-processus", icon: Shield, description: "Droits par processus" },
      { title: "Config. notifications", url: "/admin/notifications", icon: Bell, module: "notifications", description: "Règles de notification" },
      { title: "Config. documents", url: "/admin/documents-config", icon: FolderOpen, module: "gestion_documentaire", description: "Types et tags documents" },
    ],
  },
];

export { moduleGroups };

function HeaderHelpButton() {
  const { helpMode, toggleHelpMode } = useHelpMode();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={helpMode ? "default" : "ghost"}
          size="icon"
          className={`h-9 w-9 rounded-xl ${helpMode ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          onClick={toggleHelpMode}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{helpMode ? "Désactiver le mode aide" : "Activer le mode aide"}</TooltipContent>
    </Tooltip>
  );
}

export function AppNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, roles, hasRole, hasPermission, signOut } = useAuth();
  const { settings } = useAppSettings();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accessible, setAccessible] = useState(() => localStorage.getItem("qprocess-accessible") === "true");

  const showAdmin = hasRole("admin") || hasRole("rmq") || hasRole("super_admin");
  const showSuperAdmin = hasRole("super_admin");
  const logoSrc = settings.logo_url || defaultLogo;

  const toggleAccessible = () => {
    const next = !accessible;
    setAccessible(next);
    document.documentElement.classList.toggle("theme-accessible", next);
    localStorage.setItem("qprocess-accessible", String(next));
  };

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => !item.module || hasPermission(item.module, "can_read"));

  const isActive = (url: string) => location.pathname === url;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/30 bg-card/80 backdrop-blur-xl" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 max-w-[1600px] mx-auto">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-3 lg:gap-5 min-w-0">
            <Link to="/" className="flex items-center gap-2 shrink-0 group">
              <img src={logoSrc} alt={settings.company_name} className="h-7 object-contain transition-transform duration-200 group-hover:scale-105" />
              {settings.brand_logo_url && (
                <img src={settings.brand_logo_url} alt="Logo marque" className="h-6 object-contain hidden sm:block" />
              )}
              <span className="text-sm font-bold tracking-tight text-foreground hidden lg:inline truncate max-w-[160px]">
                {settings.app_name}
              </span>
              <span className="text-[9px] font-bold text-primary-foreground bg-primary px-1.5 py-0.5 rounded-md leading-none hidden lg:inline">
                SMQ
              </span>
            </Link>

            <div className="h-6 w-px bg-border/40 hidden lg:block" />

            {/* Desktop nav links (lg+) */}
            <nav className="hidden lg:flex items-center gap-0.5">
              <Link
                to="/"
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive("/") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}
              >
                Accueil
              </Link>

              <Link
                to="/modules"
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${isActive("/modules") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                Modules
              </Link>

              {/* Navigation dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="px-3.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all duration-200 flex items-center gap-1">
                    Navigation
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[560px] p-0 rounded-xl border-border/40" align="start" sideOffset={8} style={{ boxShadow: "var(--shadow-xl)" }}>
                  <div className="grid grid-cols-2 gap-0 max-h-[70vh] overflow-y-auto">
                    {moduleGroups.map((group) => {
                      if (group.label === "Administration" && !showAdmin) return null;
                      const visible = filterItems(group.items);
                      if (visible.length === 0) return null;
                      return (
                        <div key={group.label} className="p-3 border-b border-r border-border/20 last:border-b-0">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                            <group.icon className="h-3.5 w-3.5" />
                            {group.label}
                          </p>
                          <div className="space-y-0.5">
                            {visible.map((item) => (
                              <button
                                key={item.url}
                                onClick={() => navigate(item.url)}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${isActive(item.url) ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted/50 hover:text-foreground"}`}
                              >
                                <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                                <span>{item.title}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {showSuperAdmin && (
                      <div className="p-3 border-b border-r border-border/20">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Crown className="h-3.5 w-3.5" />
                          Super Admin
                        </p>
                        <button
                          onClick={() => navigate("/super-admin")}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${isActive("/super-admin") ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted/50"}`}
                        >
                          <Crown className="h-4 w-4 opacity-70" />
                          Configuration
                        </button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </nav>
          </div>

          {/* Center: Search */}
          <div className="hidden lg:flex flex-1 justify-center max-w-xs mx-6">
            <GlobalSearch />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="lg:hidden">
              <GlobalSearch />
            </div>

            <NotificationBell />
            <HeaderHelpButton />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hidden sm:inline-flex" onClick={() => setInfoOpen(true)}>
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>À propos</TooltipContent>
            </Tooltip>

            <div className="hidden sm:flex items-center gap-0.5 border border-border/30 rounded-xl p-0.5 bg-muted/20">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={accessible ? "default" : "ghost"} size="icon" className="h-7 w-7 rounded-lg" onClick={toggleAccessible}>
                    {accessible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{accessible ? "Désactiver le confort visuel" : "Confort visuel"}</TooltipContent>
              </Tooltip>
              <DarkModeToggle />
            </div>

            <div className="h-6 w-px bg-border/30 mx-1 hidden lg:block" />

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-xl px-1.5 sm:px-2 py-1.5 hover:bg-muted/40 transition-all duration-200">
                  <Avatar className="h-8 w-8 rounded-xl">
                    <AvatarImage src={profile?.photo_url || undefined} alt={`${profile?.prenom} ${profile?.nom}`} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground text-[11px] font-bold">
                      {profile?.prenom?.[0] ?? ""}{profile?.nom?.[0] ?? ""}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-right hidden xl:block">
                    <p className="text-xs font-semibold text-foreground leading-tight">{profile?.prenom} {profile?.nom}</p>
                    <p className="text-[10px] text-muted-foreground capitalize leading-tight">
                      {roles.map(r => ROLE_LABELS[r as AppRole] || r).join(", ").replace(/_/g, " ")}
                    </p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden xl:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl" style={{ boxShadow: "var(--shadow-lg)" }}>
                <DropdownMenuLabel className="font-normal px-3 py-2.5">
                  <p className="text-sm font-semibold">{profile?.prenom} {profile?.nom}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setProfileOpen(true)} className="px-3 py-2 rounded-lg mx-1 cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  Mon profil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPasswordOpen(true)} className="px-3 py-2 rounded-lg mx-1 cursor-pointer">
                  <KeyRound className="mr-2 h-4 w-4" />
                  Modifier mot de passe
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive px-3 py-2 rounded-lg mx-1 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile/Tablet hamburger (below lg) */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Ouvrir le menu" className="h-9 w-9 rounded-xl lg:hidden text-muted-foreground tap-target">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-sm p-0 overflow-y-auto">
                <div className="p-4 border-b border-border/30">
                  <p className="font-bold text-foreground">{settings.app_name}</p>
                  <p className="text-xs text-muted-foreground">SMQ</p>
                </div>
                <nav className="p-2 space-y-4">
                  {moduleGroups.map((group) => {
                    if (group.label === "Administration" && !showAdmin) return null;
                    const visible = filterItems(group.items);
                    if (visible.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-1.5">
                          {group.label}
                        </p>
                        {visible.map((item) => (
                          <button
                            key={item.url}
                            onClick={() => { navigate(item.url); setMobileOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${isActive(item.url) ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted/40"}`}
                          >
                            <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                            {item.title}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  {showSuperAdmin && (
                    <div>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-1.5">Super Admin</p>
                      <button
                        onClick={() => { navigate("/super-admin"); setMobileOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:bg-muted/40"
                      >
                        <Crown className="h-4 w-4 opacity-70" />
                        Configuration
                      </button>
                    </div>
                  )}

                  {/* Préférences accessibles aussi sur mobile (boutons cachés en <sm) */}
                  <div className="pt-2 mt-2 border-t border-border/30 sm:hidden">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-1.5">Préférences</p>
                    <button
                      onClick={toggleAccessible}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:bg-muted/40"
                    >
                      {accessible ? <EyeOff className="h-4 w-4 opacity-70" /> : <Eye className="h-4 w-4 opacity-70" />}
                      {accessible ? "Désactiver confort visuel" : "Confort visuel"}
                    </button>
                    <button
                      onClick={() => { setMobileOpen(false); setInfoOpen(true); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:bg-muted/40"
                    >
                      <Info className="h-4 w-4 opacity-70" />
                      À propos
                    </button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* About dialog */}
      {infoOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setInfoOpen(false)}>
          <div className="bg-card rounded-2xl border border-border/40 max-w-sm w-full mx-4 p-8 text-center" style={{ boxShadow: "var(--shadow-xl)" }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
              {settings.app_name}
            </h2>
            <p className="text-sm text-muted-foreground">{settings.company_name}</p>
            <p className="text-sm font-semibold text-foreground mt-1">{settings.app_version}</p>
            <p className="text-xs text-muted-foreground italic mt-3">{settings.app_description}</p>
            <div className="h-px bg-border/40 my-4" />
            <LicenseAboutInfo />
            <div className="h-px bg-border/40 my-4" />
            <p className="text-xs text-muted-foreground">{settings.info_copyright}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Développé par <span className="font-semibold text-foreground">{settings.info_credits}</span>
            </p>
            {settings.info_credits_help && (
              <p className="text-xs text-muted-foreground mt-1">
                Aide contextuelle par <span className="font-semibold text-foreground">{settings.info_credits_help}</span>
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-5" onClick={() => setInfoOpen(false)}>Fermer</Button>
          </div>
        </div>
      )}

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
