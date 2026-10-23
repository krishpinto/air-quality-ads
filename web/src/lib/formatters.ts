/**
 * Named tick formatters. Server pages pass the *name*, client charts resolve it,
 * because functions cannot cross the server → client boundary.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Fmt =
  | "shortDate" // 12 Jan 13
  | "monthYear" // Jan 2013
  | "monthYearShort" // Jan 13
  | "dayMonth" // 12 Jan
  | "year"
  | "int"
  | "1dp"
  | "2dp"
  | "3dp"
  | "pct"
  | "exp"
  | "hour"
  | "none";

export function getFormatter(f?: Fmt): ((v: unknown) => string) | undefined {
  if (!f || f === "none") return undefined;
  switch (f) {
    case "shortDate":
      return (v) => {
        const [y, m, d] = String(v).split("-");
        return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y?.slice(2)}`;
      };
    case "monthYear":
      return (v) => {
        const [y, m] = String(v).split("-");
        return `${MONTHS[Number(m) - 1]} ${y}`;
      };
    case "monthYearShort":
      return (v) => {
        const [y, m] = String(v).split("-");
        return `${MONTHS[Number(m) - 1]} ${y?.slice(2)}`;
      };
    case "dayMonth":
      return (v) => {
        const [, m, d] = String(v).split("-");
        return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
      };
    case "year":
      return (v) => String(v).slice(0, 4);
    case "int":
      return (v) => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : String(v));
    case "1dp":
      return (v) => (typeof v === "number" ? v.toFixed(1) : String(v));
    case "2dp":
      return (v) => (typeof v === "number" ? v.toFixed(2) : String(v));
    case "3dp":
      return (v) => (typeof v === "number" ? v.toFixed(3) : String(v));
    case "pct":
      return (v) => (typeof v === "number" ? `${v.toFixed(0)}%` : String(v));
    case "exp":
      return (v) => (typeof v === "number" ? (v === 0 ? "0" : v.toExponential(0)) : String(v));
    case "hour":
      return (v) => `${String(v).padStart(2, "0")}:00`;
  }
}
