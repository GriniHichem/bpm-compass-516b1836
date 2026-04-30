import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label?: string;
}

/**
 * Floating Action Button (mobile-first).
 * Sits at bottom-right with safe-area awareness.
 * Use `sm:hidden` on parent to show only on mobile when desktop has its own button.
 */
export const Fab = React.forwardRef<HTMLButtonElement, FabProps>(
  ({ icon, label, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="lg"
        className={cn(
          "fixed right-4 z-40 h-14 rounded-full shadow-lg gap-2 tap-target",
          label ? "px-5" : "w-14 px-0",
          className,
        )}
        style={{
          bottom: "max(1rem, env(safe-area-inset-bottom))",
          boxShadow: "var(--shadow-lg)",
        }}
        {...props}
      >
        {icon}
        {label && <span className="text-sm font-medium">{label}</span>}
      </Button>
    );
  },
);
Fab.displayName = "Fab";
