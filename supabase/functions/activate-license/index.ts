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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentification requise" }, 401);
    }

    const { code } = await req.json();
    if (typeof code !== "string" || !/^[A-Za-z0-9]{32}$/.test(code)) {
      return json({ error: "Code de licence invalide (32 caractères alphanumériques requis)" }, 400);
    }
    const normalized = code.toUpperCase();

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData.user) {
      return json({ error: "Session invalide ou expirée" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roles, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id);

    if (roleErr) return json({ error: `Vérification des droits impossible: ${roleErr.message}` }, 500);
    const canActivateLicense = Array.isArray(roles)
      && roles.some((r) => r.role === "super_admin" || r.role === "admin");
    if (!canActivateLicense) {
      return json({ error: "Seul un administrateur peut activer la licence" }, 403);
    }

    const { data: lic, error: selErr } = await supabase
      .from("licenses")
      .select("code, duration_days, used, used_at, used_by_install")
      .eq("code", normalized)
      .maybeSingle();

    if (selErr) return json({ error: selErr.message }, 500);
    if (!lic) return json({ error: "Code de licence inconnu" }, 404);

    const { data: settingsRows, error: settingsReadErr } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["license_key", "license_mode", "license_expires_at", "license_unlimited", "license_install_id"]);

    if (settingsReadErr) return json({ error: settingsReadErr.message }, 500);

    const currentSettings = Object.fromEntries((settingsRows ?? []).map((row) => [row.key, row.value]));
    const currentInstallId = currentSettings.license_install_id || crypto.randomUUID();
    const isSameDatabaseLicense = currentSettings.license_key === normalized
      && ["active", "grace", "expired"].includes(currentSettings.license_mode ?? "");

    const persistLicenseSettings = async (activatedAt: Date) => {
      const expiresAt =
        lic.duration_days === null
          ? null
          : new Date(activatedAt.getTime() + lic.duration_days * 86400000);

      const settings = [
        { key: "license_key", value: normalized },
        { key: "license_mode", value: "active" },
        { key: "license_activated_at", value: activatedAt.toISOString().split("T")[0] },
        { key: "license_expires_at", value: expiresAt ? expiresAt.toISOString().split("T")[0] : "" },
        { key: "license_unlimited", value: expiresAt ? "false" : "true" },
        { key: "license_install_id", value: currentInstallId },
      ];

      for (const s of settings) {
        const { error: settingErr } = await supabase.from("app_settings").upsert(
          { ...s, updated_at: new Date().toISOString(), updated_by: authData.user.id },
          { onConflict: "key" }
        );
        if (settingErr) throw settingErr;
      }

      return {
        unlimited: expiresAt === null,
        expires_at: expiresAt ? expiresAt.toISOString().split("T")[0] : null,
      };
    };

    if (lic.used) {
      if (isSameDatabaseLicense) {
        return json({
          ok: true,
          already_active: true,
          unlimited: currentSettings.license_unlimited === "true",
          expires_at: currentSettings.license_expires_at || null,
        });
      }

      const restoredActivationDate = lic.used_at ? new Date(lic.used_at) : new Date();
      const restored = await persistLicenseSettings(restoredActivationDate);

      return json({
        ok: true,
        restored: true,
        ...restored,
      });
    }

    const now = new Date();

    // Mark as used (race-safe: only update if still unused)
    const { data: updated, error: updErr } = await supabase
      .from("licenses")
      .update({ used: true, used_at: now.toISOString(), used_by_install: currentInstallId })
      .eq("code", normalized)
      .eq("used", false)
      .select("code, used_at")
      .maybeSingle();

    if (updErr) return json({ error: updErr.message }, 500);
    if (!updated) {
      const { data: latestLicense, error: latestErr } = await supabase
        .from("licenses")
        .select("used_at")
        .eq("code", normalized)
        .maybeSingle();

      if (latestErr) return json({ error: latestErr.message }, 500);

      const recovered = await persistLicenseSettings(
        latestLicense?.used_at ? new Date(latestLicense.used_at) : now
      );

      return json({
        ok: true,
        restored: true,
        ...recovered,
      });
    }

    const activated = await persistLicenseSettings(updated.used_at ? new Date(updated.used_at) : now);

    return json({
      ok: true,
      ...activated,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Erreur inattendue" }, 500);
  }
});
