import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ProcessPermissionLevel = "can_read" | "can_detail" | "can_comment" | "can_edit" | "can_version";

interface ProcessRolePermission {
  process_id: string;
  role: string | null;
  custom_role_id: string | null;
  can_read: boolean;
  can_detail: boolean;
  can_comment: boolean;
  can_edit: boolean;
  can_version: boolean;
}

export function useProcessPermissions() {
  const { user, roles, hasRole } = useAuth();
  const [permissions, setPermissions] = useState<ProcessRolePermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        // Fetch all process_role_permissions (they're small enough to cache client-side)
        const { data } = await supabase
          .from("process_role_permissions")
          .select("*");
        setPermissions((data ?? []) as ProcessRolePermission[]);
      } catch (err) {
        console.error("Error fetching process permissions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user]);

  /**
   * Check if the current user has a specific permission on a process.
   * Resolution: 
   *   1. Admin/Super Admin → always true
   *   2. Check process-specific overrides for user's roles
   *   3. If no override → fallback to global module permission (handled by caller)
   * Returns: true/false if override exists, undefined if no override (use global fallback)
   */
  const hasProcessPermission = useCallback(
    (processId: string, level: ProcessPermissionLevel): boolean | undefined => {
      // Admin/Super Admin bypass
      if (hasRole("admin") || hasRole("super_admin")) return true;

      // Intersection logic per role:
      // - If a role has any override at this level → whitelist mode for that role
      //   → only grants this process if it's explicitly checked
      // - If a role has no override → global applies for that role (signal undefined)
      // OR across roles (most permissive wins between distinct roles)
      let anyRoleInWhitelistMode = false;
      for (const role of roles) {
        const roleOverrides = permissions.filter((p) => p.role === role);
        const hasAnyOverride = roleOverrides.some((p) => p[level]);
        if (hasAnyOverride) {
          anyRoleInWhitelistMode = true;
          const granted = roleOverrides.some((p) => p.process_id === processId && p[level]);
          if (granted) return true;
          // else: this role excluded for this process, try other roles
        } else {
          // This role has no override at this level → defer to global
          return undefined;
        }
      }

      // All user's roles are in whitelist mode and none granted this process
      if (anyRoleInWhitelistMode) return false;
      return undefined;
    },
    [permissions, roles, hasRole]
  );

  /**
   * Check permission with fallback to global module permission.
   * Intersection logic: an override list restricts the global right (whitelist).
   */
  const checkProcessPermission = useCallback(
    (processId: string, level: ProcessPermissionLevel, globalFallback: boolean): boolean => {
      if (hasRole("admin") || hasRole("super_admin")) return true;
      if (!globalFallback) return false;
      const result = hasProcessPermission(processId, level);
      if (result === undefined) return true; // no override → global grants
      return result;
    },
    [hasProcessPermission, hasRole]
  );


  return {
    permissions,
    loading,
    hasProcessPermission,
    checkProcessPermission,
  };
}
