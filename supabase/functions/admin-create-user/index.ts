import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const defaultUserManagementEditRights: Record<string, boolean> = {
  rmq: true,
  responsable_processus: false,
  consultant: false,
  auditeur: false,
  acteur: false,
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

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error('Missing env: SUPABASE_URL, SUPABASE_ANON_KEY/PUBLISHABLE_KEY or SUPABASE_SERVICE_ROLE_KEY');
      return jsonResponse({ error: "Configuration serveur manquante (URL, clé publique ou service role). Vérifiez vos variables d'environnement." }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    const token = getBearerToken(authHeader);
    if (!authHeader || !token) {
      return jsonResponse({ error: 'En-tête Authorization manquant. Veuillez vous reconnecter.' }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Robust JWT validation (works on Cloud + self-host with signing-keys)
    let callerUserId: string | undefined;
    try {
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      callerUserId = claimsData?.claims?.sub as string | undefined;
      if (claimsErr) console.warn('getClaims warning:', claimsErr.message);
    } catch (e) {
      console.warn('getClaims threw:', (e as Error).message);
    }

    // Fallback for older self-host runtimes where getClaims may not exist
    if (!callerUserId) {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
      if (userErr || !userData?.user) {
        console.error('Auth fallback failed:', userErr?.message);
        return jsonResponse({ error: 'Session invalide ou expirée. Veuillez vous reconnecter.' }, 401);
      }
      callerUserId = userData.user.id;
    }

    // Permission check: admin / super_admin / role override / custom role with can_edit on "utilisateurs"
    const [rolesRes, rolePermsRes, customRolesRes] = await Promise.all([
      supabaseAdmin.from('user_roles').select('role').eq('user_id', callerUserId),
      supabaseAdmin.from('role_permissions').select('role, can_edit').eq('module', 'utilisateurs'),
      supabaseAdmin.from('user_custom_roles').select('custom_role_id').eq('user_id', callerUserId),
    ]);

    if (rolesRes.error) {
      console.error('Roles load error:', rolesRes.error.message);
      return jsonResponse({
        error: "Impossible de charger les rôles. La table user_roles est-elle bien migrée ?",
        detail: rolesRes.error.message,
      }, 500);
    }

    const callerRoles = (rolesRes.data ?? []).map((row) => row.role as string);
    let canManage = callerRoles.includes('admin') || callerRoles.includes('super_admin');

    if (!canManage && !rolePermsRes.error) {
      const overrides = new Map((rolePermsRes.data ?? []).map((r) => [r.role as string, !!r.can_edit]));
      canManage = callerRoles.some((r) => overrides.get(r) ?? defaultUserManagementEditRights[r] ?? false);
    }

    if (!canManage && !customRolesRes.error) {
      const ids = (customRolesRes.data ?? []).map((r) => r.custom_role_id);
      if (ids.length > 0) {
        const { data: crp } = await supabaseAdmin
          .from('custom_role_permissions')
          .select('can_edit')
          .eq('module', 'utilisateurs')
          .in('custom_role_id', ids);
        canManage = (crp ?? []).some((r) => !!r.can_edit);
      }
    }

    if (!canManage) {
      return jsonResponse({ error: 'Droit de création requis sur le module Utilisateurs (admin, super_admin ou rôle équivalent).' }, 403);
    }

    let body: Record<string, string>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    const { email, password, nom, prenom, fonction } = body;
    if (!email || !password) {
      return jsonResponse({ error: 'Email et mot de passe sont requis.' }, 400);
    }
    if (String(password).length < 8) {
      return jsonResponse({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400);
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nom: nom || '', prenom: prenom || '', fonction: fonction || '' },
    });

    if (error) {
      console.error('Create user error:', error.message);
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ user: data.user });
  } catch (e) {
    console.error('Unexpected error:', e);
    return jsonResponse({ error: (e as Error).message || 'Erreur interne du serveur' }, 500);
  }
});
