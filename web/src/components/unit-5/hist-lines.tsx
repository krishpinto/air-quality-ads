"use client";

/**
 * Histogram of one variable drawn as plain SVG, with labelled vertical lines
 * (μ ± 3σ and the IQR fences) so the student can see that no bar lies beyond them.
 * All props are plain data so the server page can pass them.
 */
import { cn } from "@/lib/utils";

export type HistBin = { x0: number; x1: number; mid: number; count: number };
export type VLine = { x: number; label: string; color?: string; dashed?: boolean };

export function HistWithLines({
  bins,
  lines,
  xMin,
  xMax,
  height = 240,
  color = "#2563eb",
  xLabel,
  className,
}: {
  bins: HistBin[];
  lines: VLine[];
  xMin: number;
  xMax: number;
  height?: number;
  color?: string;
  xLabel?: string;
  className?: string;
}) {
  const W = 720;
  const padL = 40, padR = 12, padT = 26, padB = 34;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const x = (v: number) => padL + ((v - xMin) / (xMax - xMin || 1)) * innerW;
  const y = (c: number) => padT + innerH - (c / maxCount) * innerH;
  const yTicks = 4;
  const xTicks = 6;
  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img" aria-label={xLabel ? `Histogram of ${xLabel}` : "Histogram"}>
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const c = (maxCount * i) / yTicks;
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y(c)} y2={y(c)} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text x={padL - 6} y={y(c) + 3.5} fontSize={10} fill="#6b7280" textAnchor="end">
                {Math.round(c)}
              </text>
            </g>
          );
        })}
        {bins.map((b, i) => (
          <rect key={i} x={x(b.x0) + 0.5} y={y(b.count)} width={Math.max(0, x(b.x1) - x(b.x0) - 1)} height={padT + innerH - y(b.count)} fill={color} fillOpacity={0.75} rx={1.5}>
            <title>{`${b.x0.toLocaleString()} – ${b.x1.toLocaleString()}: ${b.count} days`}</title>
          </rect>
        ))}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const v = xMin + ((xMax - xMin) * i) / xTicks;
          return (
            <text key={i} x={x(v)} y={padT + innerH + 14} fontSize={10} fill="#6b7280" textAnchor="middle">
              {Math.round(v).toLocaleString()}
            </text>
          );
        })}
        {xLabel && (
          <text x={padL + innerW / 2} y={height - 4} fontSize={10.5} fill="#6b7280" textAnchor="middle">
            {xLabel}
          </text>
        )}
        {lines.map((l, i) => {
          const xx = x(l.x);
          const above = i % 2 === 0;
          return (
            <g key={i}>
              <line x1={xx} x2={xx} y1={padT - 4} y2={padT + innerH} stroke={l.color ?? "#111827"} strokeWidth={1.4} strokeDasharray={l.dashed ? "5 4" : undefined} />
              <text x={xx} y={above ? padT - 8 : padT + 4} fontSize={10} fill={l.color ?? "#111827"} textAnchor="middle" dominantBaseline={above ? "auto" : "hanging"}>
                {l.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
