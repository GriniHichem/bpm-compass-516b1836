import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsTabletOrBelow } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";

export interface ResponsiveTableColumn<T> {
  /** Column header label (also used as label on mobile) */
  header: string;
  /** Render cell content */
  cell: (row: T, index: number) => React.ReactNode;
  /** Class for the desktop <td> */
  className?: string;
  /** On mobile : render as header (top of card) instead of label/value pair */
  mobileHeader?: boolean;
  /** On mobile : full width row instead of inline */
  mobileFullWidth?: boolean;
  /** Hide this column entirely on mobile */
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty?: React.ReactNode;
  /** Optional row click handler */
  onRowClick?: (row: T) => void;
  className?: string;
}

/**
 * Renders as a real <table> on desktop/tablet ≥1024 px,
 * and as a vertical stack of <Card> on mobile/tablet portrait <1024 px.
 */
export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  className,
}: ResponsiveTableProps<T>) {
  const stack = useIsTabletOrBelow();

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  if (stack) {
    return (
      <div className={cn("space-y-2", className)}>
        {rows.map((row, idx) => {
          const headerCols = columns.filter((c) => c.mobileHeader && !c.hideOnMobile);
          const bodyCols = columns.filter((c) => !c.mobileHeader && !c.hideOnMobile);
          return (
            <Card
              key={rowKey(row, idx)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border border-border/50",
                onRowClick && "cursor-pointer hover:border-primary/40 transition-colors",
              )}
            >
              <CardContent className="p-3 space-y-2">
                {headerCols.length > 0 && (
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    {headerCols.map((col) => (
                      <div key={col.header} className="min-w-0">{col.cell(row, idx)}</div>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  {bodyCols.map((col) => (
                    <div
                      key={col.header}
                      className={cn(
                        col.mobileFullWidth ? "block" : "flex items-start gap-2 text-xs",
                      )}
                    >
                      <span className="text-muted-foreground shrink-0 min-w-[80px]">
                        {col.header} :
                      </span>
                      <span className="text-foreground break-words flex-1">
                        {col.cell(row, idx)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.header}>{col.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, idx) => (
          <TableRow
            key={rowKey(row, idx)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={onRowClick ? "cursor-pointer" : undefined}
          >
            {columns.map((col) => (
              <TableCell key={col.header} className={col.className}>
                {col.cell(row, idx)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
