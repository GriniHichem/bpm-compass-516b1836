import { createContext, useContext, useMemo, useCallback, ReactNode } from "react";
import { useAppSettings, type AppSettings } from "@/contexts/AppSettingsContext";
import { setLicenseReadOnly } from "@/lib/licenseState";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, addDays, parseISO, isValid } from "date-fns";

export type LicenseStatus = "trial" | "active" | "grace" | "expired";

interface LicenseInfo {
  status: LicenseStatus;
  daysRemaining: number;
  isReadOnly: boolean;
  unlimited: boolean;
  alertMessage: string | null;
  alertLevel: "info" | "warning" | "destructive" | null;
  activateLicense: (code: string) => Promise<{ unlimited: boolean; expires_at: string | null }>;
}

const LicenseContext = createContext<LicenseInfo>({
  status: "trial",
  daysRemaining: 30,
  isReadOnly: false,
  unlimited: false,
  alertMessage: null,
  alertLevel: null,
  activateLicense: async () => ({ unlimited: false, expires_at: null }),
});

export const useLicense = () => useContext(LicenseContext);

function computeLicense(settings: AppSettings): { status: LicenseStatus; daysRemaining: number; unlimited: boolean } {
  const now = new Date();
  const mode = settings.license_mode;
  const unlimited = (settings as any).license_unlimited === "true";

  if (mode === "active" || mode === "grace" || mode === "expired") {
    if (unlimited) {
      return { status: "active", daysRemaining: 99999, unlimited: true };
    }
    const expiresAt = settings.license_expires_at ? parseISO(settings.license_expires_at) : null;
    if (!expiresAt || !isValid(expiresAt)) {
      return { status: "active", daysRemaining: 999, unlimited: false };
    }

    const daysUntilExpiry = differenceInDays(expiresAt, now);
    if (daysUntilExpiry > 0) {
      return { status: "active", daysRemaining: daysUntilExpiry, unlimited: false };
    }

    const graceDays = parseInt(settings.license_grace_days) || 30;
    const graceEnd = addDays(expiresAt, graceDays);
    const daysUntilGraceEnd = differenceInDays(graceEnd, now);

    if (daysUntilGraceEnd > 0) {
      return { status: "grace", daysRemaining: daysUntilGraceEnd, unlimited: false };
    }

    return { status: "expired", daysRemaining: 0, unlimited: false };
  }

  // Trial mode
  const trialStart = settings.license_trial_start ? parseISO(settings.license_trial_start) : now;
  const trialDays = parseInt(settings.license_trial_days) || 30;
  const trialEnd = addDays(isValid(trialStart) ? trialStart : now, trialDays);
  const daysLeft = differenceInDays(trialEnd, now);

  if (daysLeft > 0) {
    return { status: "trial", daysRemaining: daysLeft, unlimited: false };
  }

  // Trial ended → check grace
  const graceDays = parseInt(settings.license_grace_days) || 30;
  const graceEnd = addDays(trialEnd, graceDays);
  const graceLeft = differenceInDays(graceEnd, now);

  if (graceLeft > 0) {
    return { status: "grace", daysRemaining: graceLeft, unlimited: false };
  }

  return { status: "expired", daysRemaining: 0, unlimited: false };
}

function getAlertInfo(
  status: LicenseStatus,
  daysRemaining: number,
  alertDaysBefore: number,
  unlimited: boolean
): { message: string | null; level: "info" | "warning" | "destructive" | null } {
  switch (status) {
    case "trial":
      return {
        message: `Période d'essai : ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""} restant${daysRemaining > 1 ? "s" : ""}`,
        level: "info",
      };
    case "active":
      if (unlimited) return { message: null, level: null };
      if (daysRemaining <= alertDaysBefore) {
        return {
          message: `Votre licence expire dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}`,
          level: "warning",
        };
      }
      return { message: null, level: null };
    case "grace":
      return {
        message: `Licence expirée ! Les services seront bloqués dans ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""}`,
        level: "warning",
      };
    case "expired":
      return {
        message: "Licence expirée — Mode consultation uniquement. Activez votre licence.",
        level: "destructive",
      };
  }
}

export function LicenseProvider({ children }: { children: ReactNode }) {
  const { settings, refreshSettings } = useAppSettings();

  const { status, daysRemaining, unlimited } = useMemo(() => computeLicense(settings), [settings]);
  const alertDaysBefore = parseInt(settings.license_alert_days_before) || 90;
  const { message: alertMessage, level: alertLevel } = useMemo(
    () => getAlertInfo(status, daysRemaining, alertDaysBefore, unlimited),
    [status, daysRemaining, alertDaysBefore, unlimited]
  );

  const isReadOnly = status === "expired";
  setLicenseReadOnly(isReadOnly);

  const activateLicense = useCallback(
    async (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!/^[A-Za-z0-9]{32}$/.test(normalized)) {
        throw new Error("Le code doit contenir exactement 32 caractères alphanumériques");
      }
      const { data, error } = await supabase.functions.invoke("activate-license", {
        body: { code: normalized },
      });
      if (error) {
        const msg = (data as any)?.error || error.message || "Échec d'activation";
        throw new Error(msg);
      }
      if ((data as any)?.error) {
        throw new Error((data as any).error);
      }
      await refreshSettings();
      return {
        unlimited: !!(data as any)?.unlimited,
        expires_at: ((data as any)?.expires_at as string | null) ?? null,
      };
    },
    [refreshSettings]
  );

  return (
    <LicenseContext.Provider value={{ status, daysRemaining, isReadOnly, unlimited, alertMessage, alertLevel, activateLicense }}>
      {children}
    </LicenseContext.Provider>
  );
}
}
