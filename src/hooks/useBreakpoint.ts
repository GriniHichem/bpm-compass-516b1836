import { useEffect, useState } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

const MOBILE_MAX = 639;   // < 640 px
const TABLET_MAX = 1023;  // 640–1023 px

function compute(): Breakpoint {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w <= MOBILE_MAX) return "mobile";
  if (w <= TABLET_MAX) return "tablet";
  return "desktop";
}

/**
 * Hook responsive 3 niveaux : mobile (<640), tablet (640-1023), desktop (≥1024).
 * Un seul listener resize partagé par instance, debounce naturel via matchMedia.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => compute());

  useEffect(() => {
    const mqlMobile = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const mqlTablet = window.matchMedia(`(max-width: ${TABLET_MAX}px)`);
    const onChange = () => setBp(compute());
    mqlMobile.addEventListener("change", onChange);
    mqlTablet.addEventListener("change", onChange);
    onChange();
    return () => {
      mqlMobile.removeEventListener("change", onChange);
      mqlTablet.removeEventListener("change", onChange);
    };
  }, []);

  return bp;
}

export function useIsMobileBp(): boolean {
  return useBreakpoint() === "mobile";
}

export function useIsTabletOrBelow(): boolean {
  const bp = useBreakpoint();
  return bp === "mobile" || bp === "tablet";
}
