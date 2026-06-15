import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtVerify, decodeJwt } from "https://deno.land/x/jose@v5.9.6/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getBearerToken(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') ?? Deno.env.get('JWT_SECRET');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Configuration serveur manquante (URL ou service role key)." }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    const token = getBearerToken(authHeader);
    if (!authHeader || !token) {
      return jsonResponse({ error: 'En-tête Authorization manquant. Veuillez vous reconnecter.' }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Robust JWT validation (Cloud + self-host)
    let callerUserId: string | undefined;

    if (supabaseAnonKey) {
      try {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: claimsData } = await userClient.auth.getClaims(token);
        callerUserId = claimsData?.claims?.sub as string | undefined;
      } catch (_) { /* ignore */ }
    }

    if (!callerUserId && jwtSecret) {
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
        callerUserId = payload.sub as string | undefined;
      } catch (_) { /* ignore */ }
    }

    if (!callerUserId) {
      try {
        const { data: userData } = await supabaseAdmin.auth.getUser(token);
        if (userData?.user) callerUserId = userData.user.id;
      } catch (_) { /* ignore */ }
    }

    if (!callerUserId) {
      try {
        const payload = decodeJwt(token);
        const sub = payload.sub as string | undefined;
        if (sub) {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(sub);
          if (u?.user) callerUserId = u.user.id;
        }
      } catch (_) { /* ignore */ }
    }

    if (!callerUserId) {
      return jsonResponse({
        error: "Impossible de valider la session. Vérifiez SUPABASE_JWT_SECRET côté serveur.",
      }, 401);
    }

    // STRICT: only admin or super_admin can delete users
    const { data: rolesData, error: rolesErr } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUserId);

    if (rolesErr) {
      return jsonResponse({ error: "Impossible de charger les rôles.", detail: rolesErr.message }, 500);
    }

    const callerRoles = (rolesData ?? []).map((r) => r.role as string);
    const canDelete = callerRoles.includes('admin') || callerRoles.includes('super_admin');

    if (!canDelete) {
      return jsonResponse({ error: 'Seuls les administrateurs et super administrateurs peuvent supprimer un utilisateur.' }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    const userId = body.user_id;
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      return jsonResponse({ error: 'user_id est requis.' }, 400);
    }

    if (userId === callerUserId) {
      return jsonResponse({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, 400);
    }

    // Prevent deleting the last admin / super_admin
    const { data: targetRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const targetIsAdmin = (targetRoles ?? []).some((r) => r.role === 'admin' || r.role === 'super_admin');
    if (targetIsAdmin) {
      const { data: allAdmins } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'super_admin']);
      const uniqueAdmins = new Set((allAdmins ?? []).map((r) => r.user_id));
      if (uniqueAdmins.size <= 1) {
        return jsonResponse({ error: "Impossible de supprimer le dernier administrateur." }, 400);
      }
    }

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error('Delete user error:', delErr.message);
      return jsonResponse({ error: delErr.message }, 400);
    }

    return jsonResponse({ success: true });
  } catch (e) {
    console.error('Unexpected error:', e);
    return jsonResponse({ error: (e as Error).message || 'Erreur interne du serveur' }, 500);
  }
});
