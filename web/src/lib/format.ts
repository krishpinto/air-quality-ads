export function fmt(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  if (Math.abs(x) >= 1e6) return x.toExponential(2);
  return x.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function fmtInt(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  return x.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function fmtP(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "–";
  if (p < 0.0001) return "< 0.0001";
  if (p < 0.001) return p.toFixed(5);
  return p.toFixed(4);
}

export function pct(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  return `${(100 * x).toFixed(digits)}%`;
}

export function sig(p: number | null | undefined, alpha = 0.05): "reject" | "fail" {
  return p !== null && p !== undefined && p < alpha ? "reject" : "fail";
}

export function shortDate(d: string): string {
  // "2013-01-12" -> "Jan 2013" or "12 Jan 13"
  const [y, m, day] = d.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day ? Number(day) + " " : ""}${months[Number(m) - 1]} ${y.slice(2)}`;
}

export function monthYear(d: string): string {
  const [y, m] = d.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1]} ${y}`;
}
