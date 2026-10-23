"use client";

/**
 * Numeric-x multi-line chart (ROC / PR curves, power curves) and a
 * category-x "lines + confidence band" chart for forecasts, both built on raw
 * Recharts inside the evilcharts ChartContainer for consistent styling.
 */
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { SERIES } from "@/lib/colors";
import { getFormatter, type Fmt } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const axisStyle = { fontSize: 11, fill: "#6b7280" };

export function XYLines({
  series,
  xLabel,
  yLabel,
  height = 260,
  diagonal = false,
  xDomain = [0, 1],
  yDomain = [0, 1],
  className,
  legend = true,
}: {
  series: Array<{ name: string; color?: string; points: Array<{ x: number; y: number }>; dashed?: boolean }>;
  xLabel: string;
  yLabel: string;
  height?: number;
  diagonal?: boolean;
  xDomain?: [number | "auto", number | "auto"];
  yDomain?: [number | "auto", number | "auto"];
  className?: string;
  legend?: boolean;
}) {
  const config = Object.fromEntries(series.map((s, i) => [s.name, { label: s.name, colors: { light: [s.color ?? SERIES[i % SERIES.length]] } }])) as ChartConfig;
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <ComposedChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" domain={xDomain} tick={axisStyle} tickLine={false} axisLine={false} tickMargin={8} height={34} label={{ value: xLabel, position: "insideBottom", offset: -2, style: axisStyle }} />
        <YAxis type="number" dataKey="y" domain={yDomain} tick={axisStyle} tickLine={false} axisLine={false} width={44} label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 12, style: axisStyle }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(3) : String(v))} labelFormatter={(l) => `${xLabel}: ${typeof l === "number" ? l.toFixed(3) : l}`} />
        {diagonal && <Line data={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} dataKey="y" stroke="#9ca3af" strokeDasharray="4 4" dot={false} isAnimationActive={false} legendType="none" activeDot={false} />}
        {series.map((s, i) => (
          <Line key={s.name} data={s.points} dataKey="y" name={s.name} stroke={s.color ?? SERIES[i % SERIES.length]} strokeWidth={2} strokeDasharray={s.dashed ? "5 4" : undefined} dot={false} isAnimationActive={false} type="monotone" />
        ))}
        {legend && <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />}
      </ComposedChart>
    </ChartContainer>
  );
}

export function BandLines({
  data,
  xKey,
  lines,
  band,
  height = 300,
  xFormat,
  yLabel,
  className,
  splitAt,
  markers,
}: {
  data: Array<Record<string, unknown>>;
  xKey: string;
  lines: Array<{ key: string; label: string; color?: string; dashed?: boolean; width?: number; dots?: boolean }>;
  /** keys of the lower and upper bound, drawn as a shaded range */
  band?: { lo: string; hi: string; color?: string; label?: string };
  height?: number;
  xFormat?: Fmt;
  yLabel?: string;
  className?: string;
  /** x value where a vertical "train | test" line is drawn */
  splitAt?: string | number;
  /** key of a numeric series rendered as dots (e.g. flagged anomalies) */
  markers?: { key: string; label: string; color?: string };
}) {
  const config = Object.fromEntries(lines.map((s, i) => [s.key, { label: s.label, colors: { light: [s.color ?? SERIES[i % SERIES.length]] } }])) as ChartConfig;
  const rows = band ? data.map((r) => ({ ...r, __band: typeof r[band.lo] === "number" && typeof r[band.hi] === "number" ? [r[band.lo], r[band.hi]] : null })) : data;
  const xf = getFormatter(xFormat);
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={xf} minTickGap={24} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={46} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", offset: 12, style: axisStyle } : undefined} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(l) => (xf ? xf(l) : String(l))} formatter={(v: unknown, name: unknown) => [Array.isArray(v) ? `${Number(v[0]).toFixed(1)} – ${Number(v[1]).toFixed(1)}` : typeof v === "number" ? v.toFixed(1) : String(v), String(name)]} />
        {band && <Area dataKey="__band" name={band.label ?? "95% interval"} stroke="none" fill={band.color ?? "#2563eb"} fillOpacity={0.14} isAnimationActive={false} connectNulls={false} activeDot={false} />}
        {lines.map((s, i) => (
          <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color ?? SERIES[i % SERIES.length]} strokeWidth={s.width ?? 1.8} strokeDasharray={s.dashed ? "5 4" : undefined} dot={s.dots ? { r: 2.5 } : false} isAnimationActive={false} type="monotone" connectNulls={false} />
        ))}
        {markers && <Scatter dataKey={markers.key} name={markers.label} fill={markers.color ?? "#e11d48"} isAnimationActive={false} />}
        {splitAt !== undefined && <ReferenceLine x={splitAt} stroke="#111827" strokeDasharray="4 4" label={{ value: "train | test", position: "insideTopLeft", style: axisStyle }} />}
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
      </ComposedChart>
    </ChartContainer>
  );
}
