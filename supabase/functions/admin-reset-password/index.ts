import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtVerify, decodeJwt } from "https://deno.land/x/jose@v5.9.6/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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
      return jsonResponse({ error: 'Configuration serveur manquante (URL, clé publique ou service role). Vérifiez vos variables d\'environnement.' }, 500);
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

    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    const callerUserId = claimsData?.claims?.sub;

    if (claimsErr || !callerUserId) {
      console.error('Auth error:', claimsErr?.message || 'No claims found for token');
      return jsonResponse({ error: 'Session invalide ou expirée. Veuillez vous reconnecter.' }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corps de requête JSON invalide.' }, 400);
    }

    const rawUserId = body.user_id;
    const rawNewPassword = body.new_password;

    if (rawNewPassword == null) {
      return jsonResponse({ error: 'new_password est requis.' }, 400);
    }

    if (rawUserId != null && typeof rawUserId !== 'string') {
      return jsonResponse({ error: 'user_id doit être une chaîne de caractères.' }, 400);
    }

    if (typeof rawNewPassword !== 'string') {
      return jsonResponse({ error: 'new_password doit être une chaîne de caractères.' }, 400);
    }

    const user_id = typeof rawUserId === 'string' && rawUserId.trim().length > 0
      ? rawUserId.trim()
      : callerUserId;
    const new_password = rawNewPassword;
    const isSelfChange = user_id === callerUserId;

    if (new_password.trim().length < 8) {
      return jsonResponse({ error: 'Le mot de passe doit contenir au moins 8 caractères.' }, 400);
    }

    if (!isSelfChange) {
      const [rolesRes, rolePermsRes, customRolesRes] = await Promise.all([
        supabaseAdmin.from('user_roles').select('role').eq('user_id', callerUserId),
        supabaseAdmin.from('role_permissions').select('role, can_edit').eq('module', 'utilisateurs'),
        supabaseAdmin.from('user_custom_roles').select('custom_role_id').eq('user_id', callerUserId),
      ]);

      if (rolesRes.error || rolePermsRes.error || customRolesRes.error) {
        console.error('Permission loading error:', rolesRes.error?.message || rolePermsRes.error?.message || customRolesRes.error?.message);
        return jsonResponse({
          error: 'Impossible de charger les permissions utilisateur.',
          detail: rolesRes.error?.message || rolePermsRes.error?.message || customRolesRes.error?.message,
        }, 500);
      }

      const callerRoles = (rolesRes.data ?? []).map((row) => row.role as string);
      const roleEditOverrides = new Map((rolePermsRes.data ?? []).map((row) => [row.role as string, !!row.can_edit]));

      let canManageUsers = callerRoles.includes('admin') || callerRoles.includes('super_admin');

      if (!canManageUsers) {
        canManageUsers = callerRoles.some((role) => roleEditOverrides.get(role) ?? defaultUserManagementEditRights[role] ?? false);
      }

      if (!canManageUsers) {
        const customRoleIds = (customRolesRes.data ?? []).map((row) => row.custom_role_id);

        if (customRoleIds.length > 0) {
          const { data: customRolePerms, error: customRolePermsErr } = await supabaseAdmin
            .from('custom_role_permissions')
            .select('custom_role_id, can_edit')
            .eq('module', 'utilisateurs')
            .in('custom_role_id', customRoleIds);

          if (customRolePermsErr) {
            console.error('Custom role permission error:', customRolePermsErr.message);
            return jsonResponse({
              error: 'Impossible de vérifier les permissions des rôles personnalisés.',
              detail: customRolePermsErr.message,
            }, 500);
          }

          canManageUsers = (customRolePerms ?? []).some((row) => !!row.can_edit);
        }
      }

      if (!canManageUsers) {
        return jsonResponse({ error: 'Droit de modification du module Utilisateurs requis.' }, 403);
      }
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) {
      console.error('Reset password error:', error.message);
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ success: true });
  } catch (e) {
    console.error('Unexpected error:', e);
    return jsonResponse({ error: e.message || 'Erreur interne du serveur' }, 500);
  }
});
