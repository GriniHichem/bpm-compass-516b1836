import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import defaultLogo from "@/assets/logo.jpg";

export default function Login() {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-6 pb-safe">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-3">
          <img src={logoSrc} alt={settings.company_name} className="mx-auto h-14 object-contain" width={186} height={56} fetchPriority="high" />
          <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {settings.app_name}
          </CardTitle>
          <CardDescription>{settings.app_description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 tap-target" disabled={loading}>
              {loading ? "Chargement..." : "Se connecter"}
            </Button>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Mot de passe oublié ? Contactez l'administrateur du système.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
