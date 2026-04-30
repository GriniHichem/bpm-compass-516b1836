import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Tailwind size override on desktop (default: max-w-4xl) */
  desktopMaxWidth?: string;
  /** Sticky footer rendered at the bottom (always reachable on mobile) */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Adaptive container : full-screen Sheet (slide-up) on mobile,
 * classic centered Dialog on tablet/desktop.
 * Preserves the same imperative API as Dialog/Sheet for callers.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  desktopMaxWidth = "max-w-4xl",
  footer,
  className,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "h-[95vh] max-h-[95vh] rounded-t-2xl p-0 flex flex-col overscroll-lock",
            className,
          )}
        >
          {(title || description) && (
            <SheetHeader className="px-4 pt-5 pb-3 border-b border-border/40 text-left">
              {title && <SheetTitle className="text-base">{title}</SheetTitle>}
              {description && <SheetDescription className="text-xs">{description}</SheetDescription>}
            </SheetHeader>
          )}
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer && (
            <div className="border-t border-border/40 bg-background px-4 py-3 pb-safe">
              {footer}
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(desktopMaxWidth, "max-h-[90vh] overflow-y-auto", className)}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
        {footer && <div className="pt-4 border-t border-border/40 mt-4">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
