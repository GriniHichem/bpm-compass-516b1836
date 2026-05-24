import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

type TabsProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & {
  /**
   * Si fourni, l'onglet actif est persisté dans sessionStorage sous cette clé
   * et restauré après un rafraîchissement de page (F5, reload).
   */
  persistKey?: string;
};

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({ persistKey, defaultValue, value, onValueChange, ...props }, ref) => {
  const isControlled = value !== undefined;

  const initial = React.useMemo(() => {
    if (!persistKey || isControlled || typeof window === "undefined") return defaultValue;
    try {
      return window.sessionStorage.getItem(`tabs:${persistKey}`) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }, [persistKey, isControlled, defaultValue]);

  const [internalValue, setInternalValue] = React.useState<string | undefined>(initial as string | undefined);

  const handleChange = React.useCallback((v: string) => {
    if (!isControlled) setInternalValue(v);
    if (persistKey && typeof window !== "undefined") {
      try { window.sessionStorage.setItem(`tabs:${persistKey}`, v); } catch { /* noop */ }
    }
    onValueChange?.(v);
  }, [isControlled, persistKey, onValueChange]);

  if (isControlled || !persistKey) {
    return <TabsPrimitive.Root ref={ref} defaultValue={defaultValue} value={value} onValueChange={onValueChange} {...props} />;
  }

  return <TabsPrimitive.Root ref={ref} value={internalValue} onValueChange={handleChange} {...props} />;
});
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground max-w-full overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
