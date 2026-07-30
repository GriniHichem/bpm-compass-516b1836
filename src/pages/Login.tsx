import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, Workflow, BarChart3, Loader2, Mail, Lock } from "lucide-react";
import defaultLogo from "@/assets/logo.jpg";

const HIGHLIGHTS = [
  { icon: Workflow, title: "Pilotage par processus", desc: "Cartographie, BPMN et interactions" },
  { icon: ShieldCheck, title: "Conformité ISO 9001", desc: "Audits, non-conformités et revues" },
  { icon: BarChart3, title: "Indicateurs en temps réel", desc: "Tableaux de bord et alertes" },
];

export default function Login() {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error("Échec de connexion : " + error.message);
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  const logoSrc = settings.logo_url || defaultLogo;

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-background lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Panneau de marque */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between bg-sidebar p-12 text-sidebar-foreground">
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.55), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.5), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--sidebar-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--sidebar-foreground)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative animate-fade-in">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-card/95 px-4 py-3 shadow-lg">
            <img src={logoSrc} alt={settings.company_name} className="h-9 object-contain" width={120} height={36} />
          </div>
        </div>

        <div className="relative max-w-lg space-y-8">
          <div className="space-y-4 animate-slide-up">
            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              <span className="bg-gradient-to-r from-primary-glow to-accent bg-clip-text text-transparent">
                {settings.app_name}
              </span>
            </h1>
            <p className="text-lg text-sidebar-foreground/70">{settings.app_description}</p>
          </div>

          <ul className="space-y-3">
            {HIGHLIGHTS.map((item, i) => (
              <li
                key={item.title}
                className="flex items-start gap-4 rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-sidebar-accent/70 animate-slide-up"
                style={{ animationDelay: `${120 + i * 90}ms`, animationFillMode: "backwards" }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-glow">
                  <item.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-sm text-sidebar-foreground/60">{item.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} {settings.company_name} — Tous droits réservés
        </p>
      </aside>

      {/* Formulaire */}
      <main className="relative flex min-h-[100dvh] items-center justify-center px-4 py-10 pb-safe lg:min-h-0">
        <div
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{ background: "radial-gradient(120% 60% at 50% 0%, hsl(var(--primary) / 0.12), transparent 60%)" }}
        />

        <div className="relative w-full max-w-md animate-scale-in">
          <div className="mb-8 text-center lg:hidden">
            <img
              src={logoSrc}
              alt={settings.company_name}
              className="mx-auto h-14 object-contain"
              width={186}
              height={56}
              fetchPriority="high"
            />
            <h1 className="mt-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              {settings.app_name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{settings.app_description}</p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-xl sm:p-8">
            <div className="mb-6 hidden lg:block">
              <h2 className="text-2xl font-bold tracking-tight">Bienvenue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Connectez-vous pour accéder à votre espace qualité.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="h-12 pl-10 transition-shadow focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/0.1)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="h-12 pl-10 pr-11 transition-shadow focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/0.1)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-12 w-full tap-target bg-gradient-to-r from-primary to-primary-glow text-base font-semibold shadow-md transition-all duration-300 hover:shadow-lg hover:brightness-110 active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Mot de passe oublié ? Contactez l'administrateur du système.
              </p>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
            © {new Date().getFullYear()} {settings.company_name}
          </p>
        </div>
      </main>
    </div>
  );
}
