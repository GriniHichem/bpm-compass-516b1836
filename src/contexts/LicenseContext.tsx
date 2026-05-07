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
  alertMessage: null,
  alertLevel: null,
  activateLicense: async () => {},
});

export const useLicense = () => useContext(LicenseContext);

function computeLicense(settings: AppSettings): { status: LicenseStatus; daysRemaining: number } {
  const now = new Date();
  const mode = settings.license_mode;

  if (mode === "active" || mode === "grace" || mode === "expired") {
    const expiresAt = settings.license_expires_at ? parseISO(settings.license_expires_at) : null;
    if (!expiresAt || !isValid(expiresAt)) {
      return { status: "active", daysRemaining: 999 };
    }

    const daysUntilExpiry = differenceInDays(expiresAt, now);
    if (daysUntilExpiry > 0) {
      return { status: "active", daysRemaining: daysUntilExpiry };
    }

    const graceDays = parseInt(settings.license_grace_days) || 30;
    const graceEnd = addDays(expiresAt, graceDays);
    const daysUntilGraceEnd = differenceInDays(graceEnd, now);

    if (daysUntilGraceEnd > 0) {
      return { status: "grace", daysRemaining: daysUntilGraceEnd };
    }

    return { status: "expired", daysRemaining: 0 };
  }

  // Trial mode
  const trialStart = settings.license_trial_start ? parseISO(settings.license_trial_start) : now;
  const trialDays = parseInt(settings.license_trial_days) || 30;
  const trialEnd = addDays(isValid(trialStart) ? trialStart : now, trialDays);
  const daysLeft = differenceInDays(trialEnd, now);

  if (daysLeft > 0) {
    return { status: "trial", daysRemaining: daysLeft };
  }

  // Trial ended → check grace
  const graceDays = parseInt(settings.license_grace_days) || 30;
  const graceEnd = addDays(trialEnd, graceDays);
  const graceLeft = differenceInDays(graceEnd, now);

  if (graceLeft > 0) {
    return { status: "grace", daysRemaining: graceLeft };
  }

  return { status: "expired", daysRemaining: 0 };
}

function getAlertInfo(
  status: LicenseStatus,
  daysRemaining: number,
  alertDaysBefore: number
): { message: string | null; level: "info" | "warning" | "destructive" | null } {
  switch (status) {
    case "trial":
      return {
        message: `Période d'essai : ${daysRemaining} jour${daysRemaining > 1 ? "s" : ""} restant${daysRemaining > 1 ? "s" : ""}`,
        level: "info",
      };
    case "active":
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
  const { settings, updateSetting, refreshSettings } = useAppSettings();

  const { status, daysRemaining } = useMemo(() => computeLicense(settings), [settings]);
  const alertDaysBefore = parseInt(settings.license_alert_days_before) || 90;
  const { message: alertMessage, level: alertLevel } = useMemo(
    () => getAlertInfo(status, daysRemaining, alertDaysBefore),
    [status, daysRemaining, alertDaysBefore]
  );

  const isReadOnly = status === "expired";
  setLicenseReadOnly(isReadOnly);

  const activateLicense = useCallback(
    async (code: string, expiresAt: string) => {
      if (!/^[A-Za-z0-9]{32}$/.test(code)) {
        throw new Error("Le code doit contenir exactement 32 caractères alphanumériques");
      }
      await updateSetting("license_key", code);
      await updateSetting("license_mode", "active");
      await updateSetting("license_activated_at", new Date().toISOString().split("T")[0]);
      await updateSetting("license_expires_at", expiresAt);
      await refreshSettings();
    },
    [updateSetting, refreshSettings]
  );

  return (
    <LicenseContext.Provider value={{ status, daysRemaining, isReadOnly, alertMessage, alertLevel, activateLicense }}>
      {children}
    </LicenseContext.Provider>
  );
}
