import {
  AlertTriangle,
  BarChart3,
  Calculator,
  Clock,
  Database,
  Grid3X3,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  ShieldCheck,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { name: string; href: string; icon: LucideIcon; module: string };

export const NAV: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Overview",
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard, module: "" }],
  },
  {
    title: "Data exploration",
    items: [
      { name: "Dataset", href: "/dataset", icon: Database, module: "1" },
      { name: "Descriptive statistics", href: "/descriptive", icon: BarChart3, module: "2" },
      { name: "Visualization", href: "/visualization", icon: LineChart, module: "3" },
      { name: "Correlation", href: "/correlation", icon: Grid3X3, module: "4" },
    ],
  },
  {
    title: "Statistical analysis",
    items: [
      { name: "Probability & inference", href: "/inference", icon: Calculator, module: "5" },
      { name: "Regression", href: "/regression", icon: TrendingUp, module: "6" },
      { name: "Model validation", href: "/validation", icon: ShieldCheck, module: "7" },
    ],
  },
  {
    title: "Advanced analytics",
    items: [
      { name: "Anomaly detection", href: "/anomaly", icon: AlertTriangle, module: "8" },
      { name: "Time series", href: "/timeseries", icon: Clock, module: "9" },
      { name: "Forecasting", href: "/forecasting", icon: Target, module: "10" },
    ],
  },
  {
    title: "Results",
    items: [{ name: "Insights", href: "/insights", icon: Lightbulb, module: "11" }],
  },
];
