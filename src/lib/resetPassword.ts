import { supabase } from "@/integrations/supabase/client";

/**
 * Appelle l'edge function admin-reset-password en direct (fetch) plutôt que via
 * supabase.functions.invoke : cela fonctionne aussi en auto-hébergement (CORS
 * explicite, apikey optionnelle) et remonte le VRAI message d'erreur du serveur.
 */
export async function callResetPasswordFunction(params: {
  user_id?: string;
  new_password: string;
}): Promise<void> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? anonKey;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (anonKey) headers["apikey"] = anonKey;
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/functions/v1/admin-reset-password`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
  } catch (e) {
    throw new Error(
      "Impossible de joindre le serveur (réseau ou CORS). Vérifiez que l'URL du backend est correcte et que la fonction admin-reset-password est déployée."
    );
  }

  const raw = await res.text();
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    /* réponse non JSON */
  }

  if (!res.ok) {
    throw new Error(payload?.error || raw || `Erreur serveur (${res.status})`);
  }
}
