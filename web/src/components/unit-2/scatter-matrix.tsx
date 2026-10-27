"use client";

import { ScatterPlot } from "@/components/charts/scatter";
import { cn } from "@/lib/utils";

/**
 * Scatter matrix (pairs plot) as taught in 2.5: n variables → n × n cells. Lower triangle = the scatter
 * plot of the pair, diagonal = the variable's name, upper triangle = Karl Pearson's r for the pair
 * (so the picture and the number sit side by side).
 */
export type MatrixPair = { row: string; col: string; r: number; degree: string; points: Array<{ x: number; y: number }> | null };

export function ScatterMatrix({ vars, labels, pairs, className }: { vars: string[]; labels: Record<string, string>; pairs: MatrixPair[]; className?: string }) {
  const find = (row: string, col: string) => pairs.find((p) => p.row === row && p.col === col);
  const short = (v: string) => labels[v].replace(/\s*\(.*\)/, "");
  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="grid min-w-[560px] gap-1" style={{ gridTemplateColumns: `repeat(${vars.length}, minmax(0, 1fr))` }}>
        {vars.map((row, i) =>
          vars.map((col, j) => {
            if (i === j) {
              return (
                <div key={`${row}-${col}`} className="flex h-40 items-center justify-center rounded-md border bg-muted/40 px-2 text-center text-xs font-medium">
                  {labels[row]}
                </div>
              );
            }
            const p = find(row, col);
            if (!p) return <div key={`${row}-${col}`} />;
            if (j > i) {
              const tone = Math.abs(p.r) > 0.5 ? "text-foreground" : "text-muted-foreground";
              return (
                <div key={`${row}-${col}`} className="flex h-40 flex-col items-center justify-center rounded-md border px-2 text-center">
                  <div className={cn("font-mono text-xl font-semibold tabular-nums", tone)}>
                    r = {p.r >= 0 ? "+" : ""}
                    {p.r.toFixed(3)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{p.degree}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {short(row)} vs {short(col)}
                  </div>
                </div>
              );
            }
            return (
              <div key={`${row}-${col}`} className="h-40 rounded-md border p-1">
                <ScatterPlot points={p.points ?? []} xLabel={short(col)} yLabel={short(row)} height={150} size={10} opacity={0.35} />
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
