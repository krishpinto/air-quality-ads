import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Formula } from "@/components/formula";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ Section */
export function Section({
  id,
  title,
  subtitle,
  children,
  className,
}: {
  id?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("space-y-4 scroll-mt-16", className)}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="max-w-3xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ StatCard */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  const toneCls = {
    default: "",
    good: "text-green-700",
    bad: "text-rose-700",
    warn: "text-amber-700",
  }[tone];
  return (
    <Card className="gap-1 py-4 shadow-none">
      <CardHeader className="px-4 pb-0">
        <CardDescription className="text-xs">{label}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <div className={cn("text-2xl font-semibold tabular-nums tracking-tight", toneCls)}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function StatGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 | 6 }) {
  const cls = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4", 5: "md:grid-cols-5", 6: "md:grid-cols-3 lg:grid-cols-6" }[cols];
  return <div className={cn("grid grid-cols-2 gap-3", cls)}>{children}</div>;
}

/* ------------------------------------------------------------------ ChartCard */
export function ChartCard({
  title,
  description,
  children,
  footer,
  className,
  right,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  right?: ReactNode;
}) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>}
        </div>
        {right}
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {footer && <div className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">{footer}</div>}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ FormulaCard */
export function FormulaCard({
  title,
  tex,
  where,
  children,
  className,
}: {
  title: string;
  tex: string | string[];
  /** symbol → meaning */
  where?: [string, ReactNode][];
  children?: ReactNode;
  className?: string;
}) {
  const list = Array.isArray(tex) ? tex : [tex];
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border bg-muted/40 px-4 py-2">
          {list.map((t, i) => (
            <Formula key={i} tex={t} />
          ))}
        </div>
        {where && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {where.map(([s, m]) => (
              <div key={s} className="contents">
                <dt>
                  <Formula tex={s} display={false} />
                </dt>
                <dd>{m}</dd>
              </div>
            ))}
          </dl>
        )}
        {children && <div className="text-sm leading-relaxed">{children}</div>}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ Decision badge */
export function Decision({ p, alpha = 0.05, rejectText = "Reject H₀", failText = "Fail to reject H₀" }: { p: number | null | undefined; alpha?: number; rejectText?: string; failText?: string }) {
  const reject = p !== null && p !== undefined && p < alpha;
  return (
    <Badge className={cn("rounded-md", reject ? "bg-rose-600 hover:bg-rose-600" : "bg-emerald-600 hover:bg-emerald-600")}>
      {reject ? rejectText : failText}
    </Badge>
  );
}

/* ------------------------------------------------------------------ Note */
export function Note({ children, tone = "info", title }: { children: ReactNode; tone?: "info" | "warn" | "good"; title?: string }) {
  const cls = {
    info: "border-blue-200 bg-blue-50/60 text-blue-950",
    warn: "border-amber-200 bg-amber-50/60 text-amber-950",
    good: "border-emerald-200 bg-emerald-50/60 text-emerald-950",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm leading-relaxed", cls)}>
      {title && <div className="mb-1 font-medium">{title}</div>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ DataTable */
export type Column<T> = {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  dense = true,
  className,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  dense?: boolean;
  className?: string;
  rowKey?: (row: T, i: number) => string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border", className)}>
      <Table className={cn(dense && "[&_td]:py-1.5 [&_th]:h-8 text-[13px]")}>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn(c.align === "right" && "text-right", c.align === "center" && "text-center", "whitespace-nowrap", c.className)}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={rowKey ? rowKey(row, i) : i}>
              {columns.map((c) => (
                <TableCell key={c.key} className={cn("tabular-nums", c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                  {c.render ? c.render(row) : (row[c.key] as ReactNode)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ------------------------------------------------------------------ Key/value list */
export function KV({ items, cols = 2 }: { items: [ReactNode, ReactNode][]; cols?: 1 | 2 | 3 | 4 }) {
  const cls = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[cols];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-2 text-sm", cls)}>
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed py-1">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
