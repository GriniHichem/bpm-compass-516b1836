import * as React from "react";
import { CheckCircle2, ChevronRight, ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";

export interface StepperStep {
  key: string;
  label: string;
  shortLabel?: string;
}

interface ResponsiveStepperProps {
  steps: StepperStep[];
  currentKey: string;
  className?: string;
}

/**
 * Adaptive stepper :
 * - desktop : full horizontal labels
 * - tablet  : short labels + icons
 * - mobile  : Progress bar + "Étape n/N — Label" tappable popover with full list
 */
export function ResponsiveStepper({ steps, currentKey, className }: ResponsiveStepperProps) {
  const bp = useBreakpoint();
  const currentIndex = Math.max(0, steps.findIndex((s) => s.key === currentKey));
  const total = steps.length;
  const progressPct = total > 1 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  if (bp === "mobile") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2.5 text-left",
              className,
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs text-muted-foreground">
                  Étape {currentIndex + 1}/{total}
                </span>
                <span className="text-xs font-medium text-foreground truncate">
                  {steps[currentIndex]?.label}
                </span>
              </div>
              <Progress value={progressPct} className="h-1.5" />
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <div className="space-y-1">
            {steps.map((step, i) => {
              const done = i <= currentIndex;
              const isCurrent = i === currentIndex;
              return (
                <div
                  key={step.key}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded text-xs",
                    isCurrent ? "bg-primary/10 font-medium text-primary" :
                    done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40" />
                  )}
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // tablet & desktop : horizontal
  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {steps.map((step, i) => {
        const done = i <= currentIndex;
        const label = bp === "tablet" ? step.shortLabel ?? step.label : step.label;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {done ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <div className="h-3 w-3 rounded-full border border-muted-foreground" />
              )}
              {label}
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        );
      })}
    </div>
  );
}
