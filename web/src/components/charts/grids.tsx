"use client";

import { heat } from "@/lib/colors";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------- Heat map */
export function Heatmap({
  rows,
  cols,
  cells,
  min,
  max,
  digits = 0,
  hue = "red",
  rowLabel,
  colLabel,
  cellClass = "h-9",
  className,
}: {
  rows: string[];
  cols: string[];
  cells: Array<{ row: string; col: string; value: number | null | undefined }>;
  min?: number;
  max?: number;
  digits?: number;
  hue?: "blue" | "red" | "diverging";
  rowLabel?: string;
  colLabel?: string;
  cellClass?: string;
  className?: string;
}) {
  const map = new Map(cells.map((c) => [`${c.row}|${c.col}`, c.value]));
  const value = (r: string, c: string) => map.get(`${r}|${c}`);
  const format = (v: number) => v.toFixed(digits);
  const all = cells.map((c) => c.value).filter((v): v is number => typeof v === "number");
  const lo = min ?? Math.min(...all), hi = max ?? Math.max(...all);
  return (
    <div className={cn("overflow-x-auto", className)}>
      {colLabel && <div className="mb-1 text-center text-xs text-muted-foreground">{colLabel}</div>}
      <div className="flex">
        {rowLabel && <div className="flex w-5 items-center justify-center [writing-mode:vertical-rl] rotate-180 text-xs text-muted-foreground">{rowLabel}</div>}
        <div className="grid flex-1 gap-[3px] text-[11px]" style={{ gridTemplateColumns: `minmax(64px,auto) repeat(${cols.length}, minmax(34px,1fr))` }}>
          <div />
          {cols.map((c) => (
            <div key={c} className="truncate text-center text-muted-foreground" title={c}>
              {c}
            </div>
          ))}
          {rows.map((r) => (
            <div key={r} className="contents">
              <div className="flex items-center truncate pr-2 text-muted-foreground" title={r}>
                {r}
              </div>
              {cols.map((c) => {
                const v = value(r, c);
                const bg = typeof v === "number" ? heat(v, lo, hi, hue) : "transparent";
                const t = typeof v === "number" ? (hue === "diverging" ? Math.abs(v) : (v - lo) / (hi - lo || 1)) : 0;
                return (
                  <div key={c} className={cn("flex items-center justify-center rounded-sm tabular-nums", cellClass, t > 0.6 ? "text-white" : "text-foreground")} style={{ background: bg }} title={`${r} × ${c}: ${typeof v === "number" ? format(v) : "–"}`}>
                    {typeof v === "number" ? format(v) : "–"}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Correlation matrix */
export function CorrMatrix({ cols, labels, cells, className }: { cols: string[]; labels?: Record<string, string>; cells: Array<{ row: string; col: string; value: number | null }>; className?: string }) {
  return <Heatmap rows={cols} cols={cols} cells={cells} min={-1} max={1} hue="diverging" digits={2} cellClass="h-10" className={className} />;
}

/* ------------------------------------------------------------- Box plot (horizontal) */
export type BoxStats = { key: string; whisker_low: number; q1: number; median: number; q3: number; whisker_high: number; mean?: number; min?: number; max?: number; outliers?: number; n?: number };

export function BoxPlot({ items, colors, max, min, height = 34, className, unit = "", note = true }: { items: BoxStats[]; colors?: Record<string, string>; max?: number; min?: number; height?: number; className?: string; unit?: string; note?: boolean }) {
  const hi = max ?? Math.max(...items.map((b) => b.whisker_high)) * 1.05;
  const lo = min ?? 0;
  const W = 600, pad = 4;
  const x = (v: number) => pad + ((Math.max(lo, Math.min(v, hi)) - lo) / (hi - lo || 1)) * (W - 2 * pad);
  const ticks = 5;
  return (
    <div className={cn("space-y-1", className)}>
      {items.map((b) => {
        const color = colors?.[b.key] ?? "#2563eb";
        return (
          <div key={b.key} className="grid grid-cols-[110px_1fr] items-center gap-3 text-xs">
            <div className="truncate text-muted-foreground" title={b.key}>
              {b.key}
              {b.n !== undefined && <span className="ml-1 text-[10px]">(n={b.n.toLocaleString()})</span>}
            </div>
            <svg viewBox={`0 0 ${W} ${height}`} className="h-8 w-full" preserveAspectRatio="none">
              <line x1={x(b.whisker_low)} x2={x(b.q1)} y1={height / 2} y2={height / 2} stroke={color} strokeWidth={1.5} />
              <line x1={x(b.q3)} x2={x(b.whisker_high)} y1={height / 2} y2={height / 2} stroke={color} strokeWidth={1.5} />
              <line x1={x(b.whisker_low)} x2={x(b.whisker_low)} y1={height * 0.3} y2={height * 0.7} stroke={color} strokeWidth={1.5} />
              <line x1={x(b.whisker_high)} x2={x(b.whisker_high)} y1={height * 0.3} y2={height * 0.7} stroke={color} strokeWidth={1.5} />
              <rect x={x(b.q1)} y={height * 0.15} width={Math.max(1, x(b.q3) - x(b.q1))} height={height * 0.7} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.5} rx={2} />
              <line x1={x(b.median)} x2={x(b.median)} y1={height * 0.15} y2={height * 0.85} stroke={color} strokeWidth={2.5} />
              {b.mean !== undefined && <circle cx={x(b.mean)} cy={height / 2} r={3.2} fill="#fff" stroke={color} strokeWidth={1.5} />}
              {b.max !== undefined && b.max > b.whisker_high && <circle cx={x(b.max)} cy={height / 2} r={2.2} fill={color} fillOpacity={0.6} />}
            </svg>
          </div>
        );
      })}
      <div className="grid grid-cols-[110px_1fr] gap-3 text-[10px] text-muted-foreground">
        <div />
        <div className="flex justify-between">
          {Array.from({ length: ticks + 1 }, (_, i) => (
            <span key={i}>
              {Math.round(lo + ((hi - lo) * i) / ticks)}
              {unit}
            </span>
          ))}
        </div>
      </div>
      {note && <div className="text-[11px] text-muted-foreground">Box = Q1 to Q3, thick line = median, circle = mean, whiskers = last point within 1.5·IQR, dot = maximum.</div>}
    </div>
  );
}

/* ------------------------------------------------------------- Confusion matrix */
export function ConfusionMatrix({ tn, fp, fn, tp, posLabel = "Severe", negLabel = "Normal", className }: { tn: number; fp: number; fn: number; tp: number; posLabel?: string; negLabel?: string; className?: string }) {
  const total = tn + fp + fn + tp;
  const cell = (v: number, kind: "good" | "bad", title: string) => (
    <div className={cn("flex flex-col items-center justify-center rounded-md p-3", kind === "good" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900")} style={{ opacity: 0.55 + 0.45 * Math.min(1, v / (total * 0.5 || 1)) }}>
      <div className="text-xl font-semibold tabular-nums">{v.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wide">{title}</div>
      <div className="text-[10px] text-muted-foreground">{((100 * v) / total).toFixed(1)}%</div>
    </div>
  );
  return (
    <div className={cn("grid grid-cols-[auto_1fr_1fr] gap-1.5 text-xs", className)}>
      <div />
      <div className="text-center text-muted-foreground">Predicted {negLabel}</div>
      <div className="text-center text-muted-foreground">Predicted {posLabel}</div>
      <div className="flex items-center text-muted-foreground [writing-mode:vertical-rl] rotate-180">Actual {negLabel}</div>
      {cell(tn, "good", "True negative")}
      {cell(fp, "bad", "False positive")}
      <div className="flex items-center text-muted-foreground [writing-mode:vertical-rl] rotate-180">Actual {posLabel}</div>
      {cell(fn, "bad", "False negative")}
      {cell(tp, "good", "True positive")}
    </div>
  );
}
