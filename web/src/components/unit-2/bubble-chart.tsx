"use client";

import { useState } from "react";

/**
 * Bubble chart as taught in 2.5: x and y are two attributes, bubble SIZE is a third, COLOUR is the class.
 * Pure SVG so the area of each bubble is proportional to the third attribute (a two-dimensional
 * diagram: area represents the data, so radius ∝ √value).
 */
export type Bubble = { label: string; year: string; x: number; y: number; size: number };

export function BubbleChart({
  points,
  xLabel,
  yLabel,
  sizeLabel,
  colors,
  height = 320,
}: {
  points: Bubble[];
  xLabel: string;
  yLabel: string;
  sizeLabel: string;
  colors: Record<string, string>;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, padL = 56, padR = 16, padT = 12, padB = 40;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y), ss = points.map((p) => p.size);
  const xMin = Math.floor(Math.min(...xs) / 5) * 5, xMax = Math.ceil(Math.max(...xs) / 5) * 5;
  const yMin = 0, yMax = Math.ceil(Math.max(...ys) / 1000) * 1000;
  const sMax = Math.max(...ss);
  const sx = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * (W - padL - padR);
  const sy = (v: number) => H - padB - ((v - yMin) / (yMax - yMin)) * (H - padT - padB);
  const radius = (s: number) => 4 + 18 * Math.sqrt(s / sMax);
  const xTicks = Array.from({ length: (xMax - xMin) / 5 + 1 }, (_, i) => xMin + 5 * i);
  const yTicks = Array.from({ length: yMax / 1000 + 1 }, (_, i) => 1000 * i);
  const groups = Array.from(new Set(points.map((p) => p.year)));
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="xMidYMid meet">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={sy(t)} y2={sy(t)} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={padL - 6} y={sy(t) + 3} fontSize={10} fill="#6b7280" textAnchor="end">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={sx(t)} y={H - padB + 14} fontSize={10} fill="#6b7280" textAnchor="middle">
            {t}
          </text>
        ))}
        <text x={(padL + W - padR) / 2} y={H - 6} fontSize={11} fill="#6b7280" textAnchor="middle">
          {xLabel}
        </text>
        <text x={12} y={(padT + H - padB) / 2} fontSize={11} fill="#6b7280" textAnchor="middle" transform={`rotate(-90 12 ${(padT + H - padB) / 2})`}>
          {yLabel}
        </text>
        {points.map((p, i) => (
          <circle
            key={p.label}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={radius(p.size)}
            fill={colors[p.year] ?? "#2563eb"}
            fillOpacity={hover === i ? 0.85 : 0.45}
            stroke={colors[p.year] ?? "#2563eb"}
            strokeWidth={1}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${p.label}: ${xLabel} ${p.x.toFixed(1)}, ${yLabel} ${p.y.toLocaleString()}, ${sizeLabel} ${p.size.toFixed(1)}`}</title>
          </circle>
        ))}
        {hover !== null && (
          <text x={sx(points[hover].x)} y={sy(points[hover].y) - radius(points[hover].size) - 4} fontSize={10} fill="#111827" textAnchor="middle">
            {points[hover].label} · {sizeLabel} {points[hover].size.toFixed(1)}
          </text>
        )}
      </svg>
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        {groups.map((g) => (
          <span key={g} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: colors[g] }} /> {g}
          </span>
        ))}
        <span className="ml-auto">bubble area ∝ {sizeLabel}</span>
      </div>
    </div>
  );
}
