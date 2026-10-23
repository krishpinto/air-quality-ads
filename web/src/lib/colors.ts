/** One light-mode palette used by every chart so the whole app reads as one system. */
export const C = {
  blue: "#2563eb",
  orange: "#f97316",
  green: "#16a34a",
  violet: "#7c3aed",
  rose: "#e11d48",
  slate: "#64748b",
  amber: "#d97706",
  teal: "#0d9488",
  sky: "#0ea5e9",
  gray: "#9ca3af",
  ink: "#111827",
} as const;

export const SERIES = [C.blue, C.orange, C.green, C.violet, C.rose, C.teal, C.amber, C.slate];

export const SEASON_COLORS: Record<string, string> = {
  Winter: "#3b82f6",
  Spring: "#22c55e",
  Summer: "#f59e0b",
  Autumn: "#ef4444",
};

export const WIND_COLORS: Record<string, string> = {
  NW: "#2563eb",
  NE: "#0d9488",
  SE: "#f97316",
  cv: "#e11d48",
};

export const AQI_COLORS: Record<string, string> = {
  Good: "#22c55e",
  Moderate: "#eab308",
  "Unhealthy (sensitive)": "#f97316",
  Unhealthy: "#ef4444",
  "Very unhealthy": "#a855f7",
  Hazardous: "#7f1d1d",
};

/** Sequential scale for heat maps: light to deep blue/red. */
export function heat(value: number, min: number, max: number, hue: "blue" | "red" | "diverging" = "red"): string {
  const t = max === min ? 0.5 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  if (hue === "diverging") {
    // -1 .. 1 → blue .. white .. red
    const v = value; // expects -1..1
    if (v < 0) {
      const a = Math.min(1, -v);
      return `rgba(37, 99, 235, ${0.08 + 0.85 * a})`;
    }
    const a = Math.min(1, v);
    return `rgba(225, 29, 72, ${0.08 + 0.85 * a})`;
  }
  const rgb = hue === "blue" ? "37, 99, 235" : "239, 68, 68";
  return `rgba(${rgb}, ${0.06 + 0.9 * t})`;
}
