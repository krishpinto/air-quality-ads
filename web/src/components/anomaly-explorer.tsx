"use client";

import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BandLines } from "@/components/charts/xy";
import { ScatterPlot } from "@/components/charts/scatter";

type Row = { date: string; pm25: number; z: number; maha: number; lof: number; agree: number; f_z: boolean; f_modz: boolean; f_iqr: boolean; f_maha: boolean; f_knn: boolean; f_lof: boolean; f_iso: boolean };
type Method = { key: string; name: string; family: string; rule: string; count: number };

export function AnomalyExplorer({ series, methods, explorer }: { series: Row[]; methods: Method[]; explorer: Array<{ x: number; y: number; maha: boolean; lof: boolean; z: boolean; date: string }> }) {
  const [method, setMethod] = useState("maha");
  const m = methods.find((x) => x.key === method)!;
  const data = useMemo(
    () => series.map((r) => ({ date: r.date, pm25: r.pm25, flagged: (r as unknown as Record<string, boolean>)[`f_${method}`] ? r.pm25 : null })),
    [series, method],
  );
  const flaggedCount = data.filter((d) => d.flagged !== null).length;
  const flagKey = method === "maha" ? "maha" : method === "lof" ? "lof" : "z";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={method} onValueChange={(v) => v && setMethod(v)} variant="outline" size="sm">
          {methods.map((x) => (
            <ToggleGroupItem key={x.key} value={x.key} className="text-xs">
              {x.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="text-xs text-muted-foreground">
          {m.family} · rule: {m.rule} · <span className="font-medium text-foreground">{flaggedCount} days flagged</span>
        </span>
      </div>
      <BandLines data={data} xKey="date" lines={[{ key: "pm25", label: "Daily mean PM2.5", color: "#94a3b8", width: 1 }]} markers={{ key: "flagged", label: `Flagged by ${m.name}`, color: "#e11d48" }} height={300} xFormat="monthYearShort" yLabel="µg/m³" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium">PM2.5 vs wind speed: {m.key === "maha" ? "Mahalanobis" : m.key === "lof" ? "LOF" : "z-score"} flags in red</div>
          <ScatterPlot points={explorer.map((p) => ({ x: p.x, y: p.y, color: (p as unknown as Record<string, boolean>)[flagKey] ? "#e11d48" : "#94a3b8", label: p.date }))} xLabel="Iws (daily mean)" yLabel="PM2.5" height={260} size={16} opacity={0.6} />
        </div>
        <div className="text-sm leading-relaxed text-muted-foreground">
          <p className="mb-2">
            <span className="font-medium text-foreground">Univariate</span> rules (z, modified z, IQR) look only at PM2.5, so they flag the highest days and nothing else.
          </p>
          <p className="mb-2">
            <span className="font-medium text-foreground">Distance-based</span> rules (Mahalanobis, k-NN) and the <span className="font-medium text-foreground">density-based</span> LOF look at the whole weather+pollution vector, so they can flag a moderately polluted day that is unusual <em>for its weather</em> - e.g. high PM2.5 despite strong wind - and ignore a very polluted day that is typical for calm, humid winter air.
          </p>
          <p>
            Isolation Forest isolates points with random splits: anomalies need fewer splits. Toggle the methods and watch which points in the scatter change colour.
          </p>
        </div>
      </div>
    </div>
  );
}
