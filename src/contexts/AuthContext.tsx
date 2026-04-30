import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isLicenseReadOnly } from "@/lib/licenseState";
import {
  type AppModule,
  type PermissionLevel,
  type ModulePermissions,
  type AppRole,
  type CustomRolePermissions,
  getEffectivePermission,
} from "@/lib/defaultPermissions";

interface Profile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  fonction: string;
  actif: boolean;
  acteur_id: string | null;
  photo_url: string | null;
}

export interface CustomRole {
  id: string;
  nom: string;
  description: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  customRoles: CustomRole[];
  /** @deprecated use hasRole() instead */
  role: AppRole | null;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasPermission: (module: AppModule, level: PermissionLevel) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  roles: [],
  customRoles: [],
  role: null,
  loading: true,
  hasRole: () => false,
  hasPermission: () => false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// Profile columns actually used across the app — avoid SELECT *
const PROFILE_COLS = "id, nom, prenom, email, fonction, actif, acteur_id, photo_url";
const ROLE_PERM_COLS = "role, module, can_read, can_read_detail, can_edit, can_delete";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customRoleIds, setCustomRoleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [coreLoaded, setCoreLoaded] = useState(false);
  const [permOverrides, setPermOverrides] = useState<Record<string, ModulePermissions>>({});
  const [customRolePerms, setCustomRolePerms] = useState<CustomRolePermissions>({});
  const fetchGenRef = useRef(0);
  const lastFetchedUserId = useRef<string | null>(null);

  const hasRole = useCallback((role: AppRole) => {
    if (role === "admin" && roles.includes("super_admin")) return true;
    return roles.includes(role);
  }, [roles]);

  const hasPermission = useCallback(
    (module: AppModule, level: PermissionLevel): boolean => {
      if (roles.length === 0 && customRoleIds.length === 0) return false;
      if (isLicenseReadOnly() && (level === "can_edit" || level === "can_delete")) return false;
      return getEffectivePermission(roles, module, level, permOverrides, customRoleIds, customRolePerms);
    },
    [roles, permOverrides, customRoleIds, customRolePerms]
  );

  /**
   * Loads ALL user-related data in a single Promise.all for maximum parallelism.
   * The app becomes interactive as soon as profile + roles are set (coreLoaded),
   * permission overrides land slightly after (no UI blocker).
   */
  const fetchUserData = async (userId: string, force = false) => {
    if (!force && lastFetchedUserId.current === userId && coreLoaded) return;
    const gen = ++fetchGenRef.current;
    lastFetchedUserId.current = userId;

    try {
      // 4 critical queries in parallel + 1 secondary that we await separately
      const [profileRes, rolesRes, permRes, userCustomRolesRes] = await Promise.all([
        supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("role_permissions").select(ROLE_PERM_COLS),
        supabase
          .from("user_custom_roles")
          .select("custom_role_id, custom_roles(id, nom, description)")
          .eq("user_id", userId),
      ]);

      // Stale response guard
      if (gen !== fetchGenRef.current) return;

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (rolesRes.data) setRoles(rolesRes.data.map((r) => r.role as AppRole));

      if (permRes.data) {
        const overrides: Record<string, ModulePermissions> = {};
        for (const row of permRes.data) {
          overrides[`${row.role}:${row.module}`] = {
            can_read: row.can_read,
            can_read_detail: row.can_read_detail,
            can_edit: row.can_edit,
            can_delete: row.can_delete,
          };
        }
        setPermOverrides(overrides);
      }

      let crIds: string[] = [];
      if (userCustomRolesRes.data) {
        const crs: CustomRole[] = [];
        for (const ucr of userCustomRolesRes.data as any[]) {
          crIds.push(ucr.custom_role_id);
          if (ucr.custom_roles) crs.push(ucr.custom_roles as CustomRole);
        }
        setCustomRoleIds(crIds);
        setCustomRoles(crs);
      }

      // Mark core as loaded BEFORE the secondary fetch so the UI unblocks immediately
      setCoreLoaded(true);

      // Secondary: custom-role permissions (only if needed)
      if (crIds.length > 0) {
        const { data: crpData } = await supabase
          .from("custom_role_permissions")
          .select("custom_role_id, module, can_read, can_read_detail, can_edit, can_delete")
          .in("custom_role_id", crIds);
        if (gen !== fetchGenRef.current) return;
        if (crpData) {
          const crPerms: CustomRolePermissions = {};
          for (const row of crpData) {
            crPerms[`${row.custom_role_id}:${row.module}`] = {
              can_read: row.can_read,
              can_read_detail: row.can_read_detail,
              can_edit: row.can_edit,
              can_delete: row.can_delete,
            };
          }
          setCustomRolePerms(crPerms);
        }
      } else {
        setCustomRolePerms({});
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
      // Even on partial failure, don't keep the UI hostage forever
      if (gen === fetchGenRef.current) setCoreLoaded(true);
    }
  };

  useEffect(() => {
    // Single source of truth: onAuthStateChange handles INITIAL_SESSION too
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Token refresh → just update the session, no re-fetch
        if (event === "TOKEN_REFRESHED") {
          setSession(newSession);
          return;
        }

        // Tab focus may re-emit SIGNED_IN with the same user → ignore to keep form state
        if (
          event === "SIGNED_IN" &&
          newSession?.user?.id &&
          lastFetchedUserId.current === newSession.user.id
        ) {
          setSession(newSession);
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Defer DB calls to avoid running inside the auth callback
          setTimeout(() => fetchUserData(newSession.user.id), 0);
        } else {
          setProfile(null);
          setRoles([]);
          setCustomRoles([]);
          setCustomRoleIds([]);
          setPermOverrides({});
          setCustomRolePerms({});
          lastFetchedUserId.current = null;
          setCoreLoaded(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setCustomRoles([]);
    setCustomRoleIds([]);
    setPermOverrides({});
    setCustomRolePerms({});
    lastFetchedUserId.current = null;
    fetchGenRef.current++;
    setCoreLoaded(false);
  };

  // Backward compat: role = highest priority role
  const priorityOrder: AppRole[] = ["super_admin", "admin", "rmq", "responsable_processus", "consultant", "auditeur", "acteur"];
  const role = priorityOrder.find((r) => roles.includes(r)) ?? null;

  // App is ready when: not in initial bootstrap AND (no user OR core data loaded)
  const isFullyLoaded = !loading && (user ? coreLoaded : true);

  return (
    <AuthContext.Provider value={{ user, session, profile, roles, customRoles, role, loading: !isFullyLoaded, hasRole, hasPermission, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
