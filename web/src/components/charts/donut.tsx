"use client";

import { EvilPieChart } from "@/components/evilcharts/charts/recharts-pie-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/recharts-chart";
import { SERIES } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function Donut({ data, nameKey, valueKey, colors, height = 240, className, inner = 55, legend = true }: { data: Array<Record<string, unknown>>; nameKey: string; valueKey: string; colors?: Record<string, string>; height?: number; className?: string; inner?: number; legend?: boolean }) {
  const config = Object.fromEntries(
    data.map((d, i) => [String(d[nameKey]), { label: String(d[nameKey]), colors: { light: [colors?.[String(d[nameKey])] ?? SERIES[i % SERIES.length]] } }]),
  ) as ChartConfig;
  return (
    <div style={{ height }} className="w-full">
    <EvilPieChart config={config} data={data} dataKey={valueKey} nameKey={nameKey} className={cn("aspect-auto h-full w-full", className)}>
      <EvilPieChart.Pie innerRadius={inner} paddingAngle={2} cornerRadius={4} />
      <EvilPieChart.Tooltip />
      {legend && <EvilPieChart.Legend variant="circle" verticalAlign="bottom" />}
    </EvilPieChart>
    </div>
  );
}
