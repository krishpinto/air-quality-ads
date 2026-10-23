"use client";

/**
 * Scatter / fitted-line / band charts. evilcharts has no scatter component, so
 * this uses Recharts directly inside the evilcharts ChartContainer so the axis,
 * grid and tooltip styling match the other charts.
 */
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { SERIES } from "@/lib/colors";
import { getFormatter, type Fmt } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export type Pt = { x: number; y: number; [k: string]: unknown };

const axisStyle = { fontSize: 11, fill: "#6b7280" };

function TooltipBox({ active, payload, xLabel, yLabel }: { active?: boolean; payload?: Array<{ payload: Pt; name?: string; value?: number }>; xLabel: string; yLabel: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Pt;
  const extra = p.label ? String(p.label) : p.date ? String(p.date) : p.group ? String(p.group) : null;
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-sm">
      {extra && <div className="mb-0.5 font-medium">{extra}</div>}
      <div className="text-muted-foreground">
        {xLabel}: <span className="font-medium text-foreground tabular-nums">{typeof p.x === "number" ? p.x.toFixed(2) : String(p.x)}</span>
      </div>
      <div className="text-muted-foreground">
        {yLabel}: <span className="font-medium text-foreground tabular-nums">{typeof p.y === "number" ? p.y.toFixed(2) : String(p.y)}</span>
      </div>
    </div>
  );
}

export function ScatterPlot({
  points,
  groups,
  line,
  band,
  xLabel,
  yLabel,
  height = 280,
  xDomain,
  yDomain,
  color = SERIES[0],
  size = 28,
  opacity = 0.55,
  refX,
  refY,
  diagonal = false,
  className,
  lineColor = "#e11d48",
  lineLabel = "Fit",
}: {
  points: Pt[];
  /** colour points by `group` key */
  groups?: Record<string, string>;
  /** fitted line as x/y points */
  line?: Pt[];
  /** band around the line: {x, lo, hi} */
  band?: Array<{ x: number; lo: number; hi: number }>;
  xLabel: string;
  yLabel: string;
  height?: number;
  xDomain?: [number | "auto", number | "auto"];
  yDomain?: [number | "auto", number | "auto"];
  color?: string;
  size?: number;
  opacity?: number;
  refX?: number;
  refY?: number;
  /** draw y = x */
  diagonal?: boolean;
  className?: string;
  lineColor?: string;
  lineLabel?: string;
}) {
  const config: ChartConfig = { y: { label: yLabel, colors: { light: [color] } } };
  const groupNames = groups ? Object.keys(groups) : [];
  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <ComposedChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" name={xLabel} domain={xDomain ?? ["auto", "auto"]} tickLine={false} axisLine={false} tick={axisStyle} tickMargin={8}
          label={{ value: xLabel, position: "insideBottom", offset: -2, style: axisStyle }} height={34} />
        <YAxis type="number" dataKey="y" name={yLabel} domain={yDomain ?? ["auto", "auto"]} tickLine={false} axisLine={false} tick={axisStyle} width={48}
          label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 12, style: axisStyle }} />
        <ZAxis range={[size, size]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<TooltipBox xLabel={xLabel} yLabel={yLabel} />} />
        {band && <Area data={band} dataKey="hi" stroke="none" fill={lineColor} fillOpacity={0.12} isAnimationActive={false} type="monotone" legendType="none" activeDot={false} />}
        {band && <Area data={band} dataKey="lo" stroke="none" fill="#fff" fillOpacity={1} isAnimationActive={false} type="monotone" legendType="none" activeDot={false} />}
        {groups
          ? groupNames.map((g) => (
              <Scatter key={g} name={g} data={points.filter((p) => p.group === g)} fill={groups[g]} fillOpacity={opacity} isAnimationActive={false} />
            ))
          : (
            <Scatter name={yLabel} data={points} fill={color} fillOpacity={opacity} isAnimationActive={false}>
              {points.map((p, i) => (
                <Cell key={i} fill={typeof p.color === "string" ? p.color : color} />
              ))}
            </Scatter>
          )}
        {line && <Line data={line} dataKey="y" name={lineLabel} stroke={lineColor} strokeWidth={2} dot={false} isAnimationActive={false} type="monotone" activeDot={false} />}
        {diagonal && <Line data={[{ x: minX, y: minX }, { x: maxX, y: maxX }]} dataKey="y" stroke="#111827" strokeDasharray="4 4" strokeWidth={1.2} dot={false} isAnimationActive={false} activeDot={false} />}
        {refX !== undefined && <ReferenceLine x={refX} stroke="#111827" strokeDasharray="4 4" />}
        {refY !== undefined && <ReferenceLine y={refY} stroke="#111827" strokeDasharray="4 4" />}
      </ComposedChart>
    </ChartContainer>
  );
}

/** Vertical bars where each category has its own colour (seasons, wind directions, …). */
export function CategoryBars({
  data,
  xKey,
  yKey,
  colors,
  colorKey,
  height = 240,
  yLabel,
  yFormat,
  refY,
  refLabel,
  className,
  fallback = SERIES[0],
  horizontal = false,
}: {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  colors?: Record<string, string>;
  /** which field of the row to look up in `colors` (defaults to xKey) */
  colorKey?: string;
  height?: number;
  yLabel?: string;
  yFormat?: Fmt;
  refY?: number;
  refLabel?: string;
  className?: string;
  fallback?: string;
  horizontal?: boolean;
}) {
  const config: ChartConfig = { [yKey]: { label: yLabel ?? yKey, colors: { light: [fallback] } } };
  const yFormatter = getFormatter(yFormat);
  const colorOf = (row: Record<string, unknown>) => (colors ? colors[String(row[colorKey ?? xKey])] ?? fallback : fallback);
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} strokeDasharray="3 3" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={yFormatter} />
            <YAxis type="category" dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} tickMargin={8} interval={0} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={44} tickFormatter={yFormatter}
              label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", offset: 12, style: axisStyle } : undefined} />
          </>
        )}
        <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [typeof v === "number" ? v.toLocaleString() : String(v), yLabel ?? yKey]} />
        {refY !== undefined && <ReferenceLine y={refY} stroke="#111827" strokeDasharray="4 4" label={refLabel ? { value: refLabel, position: "right", style: axisStyle } : undefined} />}
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((row, i) => (
            <Cell key={i} fill={colorOf(row)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** ACF / PACF stem plot with the ±1.96/√n significance band. */
export function AcfChart({ values, key: k = "acf", band, height = 200, className }: { values: Array<{ lag: number; acf: number | null; pacf: number | null }>; key?: "acf" | "pacf"; band: number; height?: number; className?: string }) {
  const config: ChartConfig = { [k]: { label: k.toUpperCase(), colors: { light: [SERIES[0]] } } };
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", className)} style={{ height }}>
      <BarChart data={values} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="40%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="lag" tick={axisStyle} tickLine={false} axisLine={false} interval={values.length > 30 ? 4 : 1} />
        <YAxis domain={[-1, 1]} tick={axisStyle} tickLine={false} axisLine={false} width={36} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [typeof v === "number" ? v.toFixed(3) : String(v), k.toUpperCase()]} labelFormatter={(l) => `lag ${l}`} />
        <ReferenceLine y={0} stroke="#111827" />
        <ReferenceLine y={band} stroke="#e11d48" strokeDasharray="4 4" />
        <ReferenceLine y={-band} stroke="#e11d48" strokeDasharray="4 4" />
        <Bar dataKey={k} isAnimationActive={false} radius={2}>
          {values.map((v, i) => (
            <Cell key={i} fill={Math.abs(Number(v[k] ?? 0)) > band ? SERIES[0] : "#9ca3af"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
