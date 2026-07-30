import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { callResetPasswordFunction } from "@/lib/resetPassword";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setReady(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      const { error: directError } = await supabase.auth.updateUser({ password });

      if (directError) {
        const { data: userData } = await supabase.auth.getUser();
        await callResetPasswordFunction({
          user_id: userData?.user?.id,
          new_password: password,
        });
      }

      toast.success("Mot de passe mis à jour avec succès.");
      navigate("/");
    } catch (err: any) {
      toast.error("Erreur : " + (err?.message ?? "inconnue"));
    } finally {
      setLoading(false);
    }
  };


  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Lien de réinitialisation invalide ou expiré.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-6 pb-safe">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Nouveau mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 tap-target" disabled={loading}>
              {loading ? "Mise à jour..." : "Mettre à jour"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
