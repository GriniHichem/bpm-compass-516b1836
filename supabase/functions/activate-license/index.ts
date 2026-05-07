import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { code } = await req.json();
    if (typeof code !== "string" || !/^[A-Za-z0-9]{32}$/.test(code)) {
      return json({ error: "Code de licence invalide (32 caractères alphanumériques requis)" }, 400);
    }
    const normalized = code.toUpperCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: lic, error: selErr } = await supabase
      .from("licenses")
      .select("code, duration_days, used")
      .eq("code", normalized)
      .maybeSingle();

    if (selErr) return json({ error: selErr.message }, 500);
    if (!lic) return json({ error: "Code de licence inconnu" }, 404);
    if (lic.used) return json({ error: "Ce code a déjà été utilisé" }, 409);

    const now = new Date();
    const expiresAt =
      lic.duration_days === null
        ? null
        : new Date(now.getTime() + lic.duration_days * 86400000);

    // Mark as used (race-safe: only update if still unused)
    const installId = crypto.randomUUID();
    const { data: updated, error: updErr } = await supabase
      .from("licenses")
      .update({ used: true, used_at: now.toISOString(), used_by_install: installId })
      .eq("code", normalized)
      .eq("used", false)
      .select("code")
      .maybeSingle();

    if (updErr) return json({ error: updErr.message }, 500);
    if (!updated) return json({ error: "Ce code a déjà été utilisé" }, 409);

    // Update app_settings (server-authoritative)
    const settings = [
      { key: "license_key", value: normalized },
      { key: "license_mode", value: "active" },
      { key: "license_activated_at", value: now.toISOString().split("T")[0] },
      { key: "license_expires_at", value: expiresAt ? expiresAt.toISOString().split("T")[0] : "" },
      { key: "license_unlimited", value: expiresAt ? "false" : "true" },
    ];
    for (const s of settings) {
      await supabase.from("app_settings").upsert(
        { ...s, updated_at: now.toISOString() },
        { onConflict: "key" }
      );
    }

    return json({
      ok: true,
      unlimited: expiresAt === null,
      expires_at: expiresAt ? expiresAt.toISOString().split("T")[0] : null,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Erreur inattendue" }, 500);
  }
});
