import { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * The teacher's worked-table layout for a continuous series:
 * class | m | f | d′ | fd′ | fd′² | cf … with a Sum row, and the modal / median / quartile class
 * highlighted exactly like the arrow in the notebook. Columns are chosen by the caller so the
 * same component serves the step-deviation table, the moments table and the frequency table.
 */
export type GroupedRow = {
  label: string;
  m: number;
  f: number;
  cf: number;
  rel_pct: number;
  d: number;
  fd: number;
  fd2: number;
  dev: number;
  f_dev2: number;
  f_dev3: number;
  f_dev4: number;
  is_modal: boolean;
  is_median: boolean;
  is_q1: boolean;
  is_q3: boolean;
};

export type GroupedCol = {
  key: keyof GroupedRow | "tally";
  header: ReactNode;
  /** number of decimals; "int" for whole numbers; "sci" for very large values */
  format?: "int" | "sci" | 0 | 1 | 2 | 3 | 4;
};

function show(v: unknown, format: GroupedCol["format"]): string {
  if (typeof v === "boolean") return v ? "yes" : "";
  if (typeof v !== "number") return String(v ?? "–");
  if (format === "int") return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (format === "sci") return Math.abs(v) >= 1e6 ? v.toExponential(3) : v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const digits = typeof format === "number" ? format : 2;
  return v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function GroupedTable({
  rows,
  columns,
  sums,
  highlight = {},
  marks = {},
  className,
}: {
  rows: GroupedRow[];
  columns: GroupedCol[];
  /** values for the Sum row, keyed by column key; missing keys are left blank */
  sums?: Partial<Record<GroupedCol["key"], number | string>>;
  /** which classes to tint */
  highlight?: { modal?: boolean; median?: boolean; q1?: boolean; q3?: boolean };
  /** text shown in the last "note" column for a highlighted class */
  marks?: { modal?: string; median?: string; q1?: string; q3?: string };
  className?: string;
}) {
  const anyMark = Object.values(marks).some(Boolean);
  const rowTone = (r: GroupedRow) => {
    if (highlight.modal && r.is_modal) return "bg-amber-50";
    if (highlight.median && r.is_median) return "bg-sky-50";
    if ((highlight.q1 && r.is_q1) || (highlight.q3 && r.is_q3)) return "bg-emerald-50";
    return "";
  };
  const rowMark = (r: GroupedRow) => {
    const out: string[] = [];
    if (marks.modal && r.is_modal) out.push(marks.modal);
    if (marks.median && r.is_median) out.push(marks.median);
    if (marks.q1 && r.is_q1) out.push(marks.q1);
    if (marks.q3 && r.is_q3) out.push(marks.q3);
    return out.join(" · ");
  };
  return (
    <div className={cn("overflow-x-auto rounded-lg border", className)}>
      <Table className="text-[13px] [&_td]:py-1.5 [&_th]:h-8">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {columns.map((c) => (
              <TableHead key={String(c.key)} className={cn("whitespace-nowrap", c.key !== "label" && "text-right")}>
                {c.header}
              </TableHead>
            ))}
            {anyMark && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label} className={rowTone(r)}>
              {columns.map((c) => (
                <TableCell key={String(c.key)} className={cn("tabular-nums", c.key !== "label" && "text-right", c.key === "label" && "font-medium")}>
                  {c.key === "tally" ? r.f : show(r[c.key], c.format)}
                </TableCell>
              ))}
              {anyMark && <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{rowMark(r)}</TableCell>}
            </TableRow>
          ))}
          {sums && (
            <TableRow className="border-t-2 bg-muted/30 font-semibold hover:bg-muted/30">
              {columns.map((c, i) => (
                <TableCell key={String(c.key)} className={cn("tabular-nums", c.key !== "label" && "text-right")}>
                  {i === 0 ? "Sum" : c.key in sums ? show(sums[c.key], c.format) : ""}
                </TableCell>
              ))}
              {anyMark && <TableCell />}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
