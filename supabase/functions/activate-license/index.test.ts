import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/activate-license`;

/**
 * Génère un code de licence de test (32 caractères alphanumériques majuscules)
 * et l'insère dans la table `licenses` via la service_role.
 * Retourne le code généré pour qu'on puisse l'activer ensuite SANS JWT utilisateur.
 */
async function seedTestLicense(durationDays: number | null = 30): Promise<string> {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquant dans .env — requis pour seeder une licence de test"
    );
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 32; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  const { error } = await admin
    .from("licenses")
    .insert({ code, duration_days: durationDays, used: false });
  if (error) throw new Error(`Seed licence échoué: ${error.message}`);
  return code;
}

async function cleanupTestLicense(code: string) {
  if (!SERVICE_ROLE_KEY) return;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  await admin.from("licenses").delete().eq("code", code);
}

Deno.test("activate-license: rejette un code invalide (validation format)", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ code: "trop-court" }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assert(typeof body.error === "string");
});

Deno.test(
  "activate-license: s'active SANS JWT (mode self-hosting)",
  async () => {
    if (!SERVICE_ROLE_KEY) {
      console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY absent — test sauté");
      return;
    }
    const code = await seedTestLicense(30);
    try {
      // Aucune en-tête Authorization → simule un appel self-hosted sans session.
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ code }),
      });
      const body = await res.json();
      assertEquals(res.status, 200, `Réponse inattendue: ${JSON.stringify(body)}`);
      assertEquals(body.ok, true);
      assert(
        body.expires_at !== undefined,
        "Le champ expires_at doit être présent"
      );
    } finally {
      await cleanupTestLicense(code);
    }
  }
);

Deno.test(
  "activate-license: réactiver le même code renvoie already_active/restored sans JWT",
  async () => {
    if (!SERVICE_ROLE_KEY) {
      console.warn("⚠️  SUPABASE_SERVICE_ROLE_KEY absent — test sauté");
      return;
    }
    const code = await seedTestLicense(30);
    try {
      // 1ère activation
      const res1 = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ code }),
      });
      await res1.json();
      assertEquals(res1.status, 200);

      // 2ème activation (toujours sans JWT)
      const res2 = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ code }),
      });
      const body2 = await res2.json();
      assertEquals(res2.status, 200);
      assertEquals(body2.ok, true);
      assert(
        body2.already_active === true || body2.restored === true,
        `Attendu already_active ou restored, reçu: ${JSON.stringify(body2)}`
      );
    } finally {
      await cleanupTestLicense(code);
    }
  }
);
