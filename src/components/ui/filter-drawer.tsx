import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FilterDrawerProps {
  /** Filter UI content (Selects, Switches…) */
  children: React.ReactNode;
  /** Number of active filters (shown as badge on the trigger) */
  activeCount?: number;
  /** Optional reset callback shown in footer */
  onReset?: () => void;
  triggerLabel?: string;
  className?: string;
}

/**
 * Mobile-friendly filter drawer.
 * On mobile, opens a bottom Sheet containing all filters stacked vertically with full-width controls.
 * Use inside `<div className="sm:hidden">` and render filters inline on ≥sm.
 */
export function FilterDrawer({
  children,
  activeCount = 0,
  onReset,
  triggerLabel = "Filtres",
  className,
}: FilterDrawerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-1.5 relative tap-target", className)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {triggerLabel}
          {activeCount > 0 && (
            <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-primary text-primary-foreground ml-1">
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85vh] flex flex-col p-0"
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border/40 text-left flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-base">Filtres</SheetTitle>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {children}
        </div>
        <div className="border-t border-border/40 px-4 py-3 pb-safe flex gap-2">
          {onReset && (
            <Button variant="outline" className="flex-1" onClick={() => { onReset(); }}>
              Réinitialiser
            </Button>
          )}
          <Button className="flex-1" onClick={() => setOpen(false)}>
            Appliquer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
