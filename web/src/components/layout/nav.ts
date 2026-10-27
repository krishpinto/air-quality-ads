import {
  AlertTriangle,
  BarChart3,
  Calculator,
  Clock,
  Compass,
  Lightbulb,
  LayoutDashboard,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { name: string; href: string; icon: LucideIcon; module: string; stage: string };

/**
 * One entry per syllabus unit, grouped by the stage of the Data Science Process
 * (Unit 1) that the unit belongs to. The order is the syllabus order.
 */
export const NAV: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Start here",
    items: [{ name: "The pipeline", href: "/", icon: LayoutDashboard, module: "", stage: "" }],
  },
  {
    title: "1 · Prior knowledge & preparation",
    items: [{ name: "Unit 1 · Introduction & process", href: "/unit-1", icon: Compass, module: "1", stage: "Prior knowledge → Preparation" }],
  },
  {
    title: "2 · Exploration",
    items: [
      { name: "Unit 2 · Descriptive statistics", href: "/unit-2", icon: BarChart3, module: "2", stage: "Preparation: explore" },
      { name: "Unit 3 · Inferential statistics", href: "/unit-3", icon: Calculator, module: "3", stage: "Preparation: infer" },
    ],
  },
  {
    title: "3 · Modeling",
    items: [
      { name: "Unit 4 · Regression", href: "/unit-4", icon: TrendingUp, module: "4", stage: "Modeling" },
      { name: "Unit 5 · Anomaly detection", href: "/unit-5", icon: AlertTriangle, module: "5", stage: "Modeling" },
      { name: "Unit 6 · Time series forecasting", href: "/unit-6", icon: Clock, module: "6", stage: "Modeling → Application" },
    ],
  },
  {
    title: "4 · Knowledge",
    items: [{ name: "Conclusion", href: "/conclusion", icon: Lightbulb, module: "", stage: "Knowledge and actions" }],
  },
];
