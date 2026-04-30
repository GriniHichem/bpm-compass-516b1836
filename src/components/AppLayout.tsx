import { useState, useEffect } from "react";
import { HelpModeProvider } from "@/contexts/HelpModeContext";
import { AppNavbar } from "@/components/AppNavbar";
import { LicenseBanner } from "@/components/LicenseBanner";
import { OnboardingCarousel } from "@/components/OnboardingCarousel";
import { useAuth } from "@/contexts/AuthContext";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user?.id && !localStorage.getItem(`qprocess_onboarding_seen_${user.id}`)) {
      setShowOnboarding(true);
    }

    const forceShow = () => setShowOnboarding(true);
    window.addEventListener("force-onboarding", forceShow);
    return () => window.removeEventListener("force-onboarding", forceShow);
  }, [user?.id]);

  const handleOnboardingComplete = () => {
    if (user?.id) localStorage.setItem(`qprocess_onboarding_seen_${user.id}`, "true");
    setShowOnboarding(false);
  };

  return (
    <HelpModeProvider>
      <div className="min-h-screen flex flex-col bg-background">
        <AppNavbar />
        <LicenseBanner />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8 overflow-auto pb-safe">
          {children}
        </main>
        {showOnboarding && <OnboardingCarousel onComplete={handleOnboardingComplete} />}
      </div>
    </HelpModeProvider>
  );
}
