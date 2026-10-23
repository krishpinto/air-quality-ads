"use client";

/**
 * Thin wrappers around the evilcharts components so pages can describe a chart
 * as `data + series` without repeating the composition boilerplate.
 * All props are plain data (no functions) so server pages can use them.
 */
import { EvilAreaChart } from "@/components/evilcharts/charts/recharts-area-chart";
import { EvilLineChart } from "@/components/evilcharts/charts/recharts-line-chart";
import { EvilBarChart } from "@/components/evilcharts/charts/recharts-bar-chart";
import { EvilComposedChart } from "@/components/evilcharts/charts/recharts-composed-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { SERIES } from "@/lib/colors";
import { getFormatter, type Fmt } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export type Row = Record<string, unknown>;
export type Series = {
  key: string;
  label: string;
  color?: string;
  /** area fill style */
  variant?: "gradient" | "gradient-reverse" | "solid" | "dotted" | "lines" | "hatched";
  /** line / area stroke style */
  stroke?: "solid" | "dashed" | "animated-dashed";
  strokeWidth?: number;
  /** composed chart: render this series as bars instead of a line */
  asBar?: boolean;
  dots?: boolean;
};

function toConfig(series: Series[]): ChartConfig {
  return Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, colors: { light: [s.color ?? SERIES[i % SERIES.length]] } }]),
  ) as ChartConfig;
}

type Common = {
  data: Row[];
  xKey: string;
  series: Series[];
  height?: number;
  xFormat?: Fmt;
  yFormat?: Fmt;
  yDomain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
  legend?: boolean;
  className?: string;
  animate?: boolean;
  xTicks?: number;
  yLabel?: string;
};

const yLabelProps = (label?: string) =>
  label ? { label: { value: label, angle: -90, position: "insideLeft" as const, offset: 10, style: { fontSize: 11, fill: "#6b7280" } } } : {};

const interval = (n: number, ticks?: number) => (ticks ? Math.max(0, Math.floor(n / ticks) - 1) : ("preserveStartEnd" as const));

export function AreaSeries({ data, xKey, series, height = 260, xFormat, yFormat, yDomain, legend, className, animate = false, stack = false, curve = "monotone", xTicks, yLabel }: Common & { stack?: boolean; curve?: "monotone" | "linear" | "step" | "natural" }) {
  return (
    <div style={{ height }} className="w-full">
      <EvilAreaChart config={toConfig(series)} data={data} className={cn("aspect-auto h-full w-full", className)} curveType={curve} stackType={stack ? "stacked" : "default"} animationType={animate ? "left-to-right" : "none"}>
        <EvilAreaChart.Grid vertical={false} />
        <EvilAreaChart.XAxis dataKey={xKey} tickFormatter={getFormatter(xFormat)} interval={interval(data.length, xTicks)} />
        <EvilAreaChart.YAxis tickFormatter={getFormatter(yFormat)} domain={yDomain} {...yLabelProps(yLabel)} />
        {series.map((s) => (
          <EvilAreaChart.Area key={s.key} dataKey={s.key} variant={s.variant ?? "gradient"} strokeVariant={s.stroke ?? "solid"} strokeWidth={s.strokeWidth ?? 1.6} connectNulls />
        ))}
        <EvilAreaChart.Tooltip />
        {legend && <EvilAreaChart.Legend variant="circle" />}
      </EvilAreaChart>
    </div>
  );
}

export function LineSeries({ data, xKey, series, height = 260, xFormat, yFormat, yDomain, legend, className, animate = false, curve = "monotone", xTicks, yLabel }: Common & { curve?: "monotone" | "linear" | "step" | "natural" }) {
  return (
    <div style={{ height }} className="w-full">
      <EvilLineChart config={toConfig(series)} data={data} className={cn("aspect-auto h-full w-full", className)} curveType={curve} animationType={animate ? "left-to-right" : "none"}>
        <EvilLineChart.Grid vertical={false} />
        <EvilLineChart.XAxis dataKey={xKey} tickFormatter={getFormatter(xFormat)} interval={interval(data.length, xTicks)} />
        <EvilLineChart.YAxis tickFormatter={getFormatter(yFormat)} domain={yDomain} {...yLabelProps(yLabel)} />
        {series.map((s) => (
          <EvilLineChart.Line key={s.key} dataKey={s.key} strokeVariant={s.stroke ?? "solid"} strokeWidth={s.strokeWidth ?? 1.8} connectNulls>
            {s.dots && <EvilLineChart.Dot variant="border" />}
          </EvilLineChart.Line>
        ))}
        <EvilLineChart.Tooltip />
        {legend && <EvilLineChart.Legend variant="circle" />}
      </EvilLineChart>
    </div>
  );
}

export function BarSeries({ data, xKey, series, height = 260, xFormat, yFormat, yDomain, legend, className, animate = false, stack = "default", variant = "gradient", horizontal = false, radius = 4, xTicks, yLabel }: Common & { stack?: "default" | "stacked" | "percent"; variant?: "default" | "hatched" | "duotone" | "duotone-reverse" | "gradient" | "stripped"; horizontal?: boolean; radius?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <EvilBarChart config={toConfig(series)} data={data} className={cn("aspect-auto h-full w-full", className)} stackType={stack} layout={horizontal ? "horizontal" : "vertical"} barRadius={radius} animationType={animate ? "left-to-right" : "none"}>
        <EvilBarChart.Grid vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <EvilBarChart.XAxis type="number" tickFormatter={getFormatter(yFormat)} />
            <EvilBarChart.YAxis type="category" dataKey={xKey} tickFormatter={getFormatter(xFormat)} width={90} />
          </>
        ) : (
          <>
            <EvilBarChart.XAxis dataKey={xKey} tickFormatter={getFormatter(xFormat)} interval={xTicks ? Math.max(0, Math.floor(data.length / xTicks) - 1) : 0} />
            <EvilBarChart.YAxis tickFormatter={getFormatter(yFormat)} domain={yDomain} {...yLabelProps(yLabel)} />
          </>
        )}
        {series.map((s) => (
          <EvilBarChart.Bar key={s.key} dataKey={s.key} variant={variant} />
        ))}
        <EvilBarChart.Tooltip />
        {legend && <EvilBarChart.Legend variant="circle" />}
      </EvilBarChart>
    </div>
  );
}

/** Bars + lines on the same axes (histogram with a fitted curve, actual vs forecast, …). */
export function ComposedSeries({ data, xKey, series, height = 260, xFormat, yFormat, yDomain, legend, className, animate = false, barVariant = "gradient", xTicks, yLabel, curve = "monotone" }: Common & { barVariant?: "default" | "hatched" | "duotone" | "duotone-reverse" | "gradient" | "stripped"; curve?: "monotone" | "linear" | "step" }) {
  return (
    <div style={{ height }} className="w-full">
      <EvilComposedChart config={toConfig(series)} data={data} className={cn("aspect-auto h-full w-full", className)} curveType={curve} animationType={animate ? "left-to-right" : "none"} barCategoryGap={1}>
        <EvilComposedChart.Grid vertical={false} />
        <EvilComposedChart.XAxis dataKey={xKey} tickFormatter={getFormatter(xFormat)} interval={interval(data.length, xTicks)} />
        <EvilComposedChart.YAxis tickFormatter={getFormatter(yFormat)} domain={yDomain} {...yLabelProps(yLabel)} />
        {series.filter((s) => s.asBar).map((s) => (
          <EvilComposedChart.Bar key={s.key} dataKey={s.key} variant={barVariant} radius={2} />
        ))}
        {series.filter((s) => !s.asBar).map((s) => (
          <EvilComposedChart.Line key={s.key} dataKey={s.key} strokeVariant={s.stroke ?? "solid"} connectNulls>
            {s.dots && <EvilComposedChart.Dot variant="border" />}
          </EvilComposedChart.Line>
        ))}
        <EvilComposedChart.Tooltip />
        {legend && <EvilComposedChart.Legend variant="circle" />}
      </EvilComposedChart>
    </div>
  );
}

/** Histogram bins ({mid,count,density,normal?}) with an optional fitted-normal curve. */
export function Histogram({ bins, height = 240, showNormal = true, color = SERIES[0], label = "Observed", mode = "density", className, xFormat = "1dp" }: { bins: Row[]; height?: number; showNormal?: boolean; color?: string; label?: string; mode?: "density" | "count"; className?: string; xFormat?: Fmt }) {
  const series: Series[] = [{ key: mode, label, color, asBar: true }];
  if (showNormal && mode === "density") series.push({ key: "normal", label: "Normal fit", color: "#e11d48" });
  return <ComposedSeries data={bins} xKey="mid" series={series} height={height} xFormat={xFormat} yFormat={mode === "density" ? "exp" : "int"} xTicks={8} className={className} curve="monotone" />;
}
