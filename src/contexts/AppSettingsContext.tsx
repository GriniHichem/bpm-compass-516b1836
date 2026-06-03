import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  app_name: string;
  company_name: string;
  app_version: string;
  app_description: string;
  info_copyright: string;
  info_credits: string;
  info_credits_help: string;
  logo_url: string;
  brand_logo_url: string;
  support_email: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  notif_email_enabled: string;
  notif_rappel_jours_defaut: string;
  license_mode: string;
  license_key: string;
  license_trial_days: string;
  license_trial_start: string;
  license_activated_at: string;
  license_expires_at: string;
  license_alert_days_before: string;
  license_alert_interval_days: string;
  license_grace_days: string;
  license_unlimited: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  app_name: "Q-Process",
  company_name: "Groupe AMOUR",
  app_version: "v1.01",
  app_description: "Système intégré ISO 9001 et gestion par processus",
  info_copyright: "© 2026 Groupe AMOUR. Tous droits réservés.",
  info_credits: "H. GRINI & F. SERRADJ — SI TEAM",
  info_credits_help: "Radja BENHAMIDA",
  logo_url: "",
  brand_logo_url: "",
  support_email: "",
  smtp_host: "",
  smtp_port: "587",
  smtp_user: "",
  notif_email_enabled: "true",
  notif_rappel_jours_defaut: "3",
  license_mode: "trial",
  license_key: "",
  license_trial_days: "30",
  license_trial_start: new Date().toISOString().split("T")[0],
  license_activated_at: "",
  license_expires_at: "",
  license_alert_days_before: "90",
  license_alert_interval_days: "7",
  license_grace_days: "30",
  license_unlimited: "false",
};

interface AppSettingsContextType {
  settings: AppSettings;
  loading: boolean;
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextType>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  updateSetting: async () => {},
  refreshSettings: async () => {},
});

export const useAppSettings = () => useContext(AppSettingsContext);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await supabase.from("app_settings").select("key, value");
      if (data) {
        const merged = { ...DEFAULT_SETTINGS };
        for (const row of data) {
          if (row.key in merged) {
            (merged as any)[row.key] = row.value;
          }
        }
        setSettings(merged);
      }
    } catch (err) {
      console.error("Error fetching app settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    // Realtime: tout changement de app_settings (ex: activation de licence par l'admin)
    // est immédiatement répercuté sur toutes les sessions ouvertes.
    const channel = supabase
      .channel("app_settings_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => { fetchSettings(); }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  const updateSetting = useCallback(async (key: keyof AppSettings, value: string) => {
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    if (error) throw error;
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, loading, updateSetting, refreshSettings: fetchSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}
