import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { AreaSeries } from "@/components/charts/series";
import { CategoryBars } from "@/components/charts/scatter";
import { Donut } from "@/components/charts/donut";
import { NAV } from "@/components/layout/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AQI_COLORS, WIND_COLORS } from "@/lib/colors";
import { fmt, fmtInt } from "@/lib/format";

type Dataset = { overview: { rows_raw: number; rows_clean: number; rows_dropped: number; pct_dropped: number; start: string; end: string; daily_rows: number }; categorical: { aqi: Array<{ key: string; count: number; pct: number }> } };
type Viz = { weekly_series: Array<{ date: string; pm25: number }>; wind_bar: Array<{ key: string; label: string; mean_pm25: number; count: number }> };
type Insights = { executive_summary: string; headline: { mean_pm25: number; median_pm25: number; skew: number; pct_unhealthy: number; r2_full: number; best_daily_model: string; best_daily_rmse: number; naive_daily_rmse: number } };

const PIPELINE = [
  ["Problem", "How much does weather explain PM2.5 in Beijing, and can we flag or forecast severe days?"],
  ["Data", "UCI Beijing PM2.5: 43,824 hourly rows, 2010–2014, one monitor + airport weather."],
  ["Clean & engineer", "Parse time, drop missing target, add season, EPA category, log target, daily/monthly tables."],
  ["Explore", "Descriptive statistics, distributions, correlation, group tabulation."],
  ["Infer", "Normal/Poisson/Binomial fits, CLT, confidence intervals, z/t/ANOVA/χ² tests, power."],
  ["Model", "Simple & multiple regression, validation (hold-out, k-fold, LOOCV, bootstrap)."],
  ["Detect & forecast", "Z-score, IQR, Mahalanobis, LOF, Isolation Forest, SMOTE; decomposition, ARIMA, Holt-Winters."],
  ["Communicate", "Findings, limitations and recommendations."],
];

export default async function Home() {
  const [ds, viz, ins] = await Promise.all([loadData<Dataset>("dataset"), loadData<Viz>("visualization"), loadData<Insights>("insights")]);
  const h = ins.headline;
  return (
    <PageShell
      title="Dashboard"
      description="An end-to-end Applied Data Science study of hourly PM2.5 air pollution in Beijing (2010–2014). Every syllabus module is applied to the same dataset: from cleaning and descriptive statistics through hypothesis testing, regression and validation to anomaly detection, time-series decomposition and forecasting."
      concepts={["Data science process", "Problem statement", "Dataset overview"]}
    >
      <StatGrid cols={6}>
        <StatCard label="Valid hourly readings" value={fmtInt(ds.overview.rows_clean)} hint={`${ds.overview.start} → ${ds.overview.end}`} />
        <StatCard label="Mean PM2.5" value={`${fmt(h.mean_pm25, 0)} µg/m³`} hint="WHO 24-h guideline: 15" tone="bad" />
        <StatCard label="Median PM2.5" value={`${fmt(h.median_pm25, 0)} µg/m³`} hint={`skewness ${fmt(h.skew, 2)}`} />
        <StatCard label="Hours above 150 µg/m³" value={`${fmt(h.pct_unhealthy, 1)}%`} hint="Unhealthy or worse" tone="warn" />
        <StatCard label="Weather-only R²" value={fmt(h.r2_full, 3)} hint="OLS, hourly" />
        <StatCard label="Best daily forecast" value={`RMSE ${fmt(h.best_daily_rmse, 0)}`} hint={`naive: ${fmt(h.naive_daily_rmse, 0)} · ${h.best_daily_model}`} tone="good" />
      </StatGrid>

      <Section title="Problem statement" subtitle="What the study tries to answer and why the dataset suits every module of the course.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="shadow-none lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Executive summary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">{ins.executive_summary}</CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Research questions</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
                <li>How is PM2.5 distributed and how does it vary by season, wind and hour?</li>
                <li>Which weather variables are associated with pollution, and how strongly?</li>
                <li>Are the differences between groups (season, weekend, year) statistically significant?</li>
                <li>How much variance can a regression on weather explain, and does it generalise?</li>
                <li>Which days are anomalous, and can severe days be classified despite class imbalance?</li>
                <li>Is the series stationary, what are its components, and how well can it be forecast?</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Data science process" subtitle="The pipeline that produced every number on this site. Python computes, Next.js presents.">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map(([step, text], i) => (
            <Card key={step} className="gap-2 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="font-mono text-[11px]">STEP {i + 1}</CardDescription>
                <CardTitle className="text-sm">{step}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-xs leading-relaxed text-muted-foreground">{text}</CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Dataset at a glance">
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Weekly mean PM2.5, 2010–2014" description="Five winters, five summers. Spikes are multi-day smog episodes; January 2013 is the worst on record." className="lg:col-span-2">
            <AreaSeries data={viz.weekly_series} xKey="date" series={[{ key: "pm25", label: "PM2.5 (µg/m³)", color: "#2563eb" }]} xFormat="monthYearShort" height={260} xTicks={10} />
          </ChartCard>
          <ChartCard title="Share of hours by EPA category" description="Based on US EPA PM2.5 breakpoints applied to hourly values.">
            <Donut data={ds.categorical.aqi} nameKey="key" valueKey="count" colors={AQI_COLORS} height={260} />
          </ChartCard>
        </div>
        <ChartCard title="Mean PM2.5 by wind direction" description="Wind is the single clearest driver: north-westerly flow from Mongolia clears the air, calm or south-easterly air traps it over the city.">
          <CategoryBars data={viz.wind_bar} xKey="label" yKey="mean_pm25" colors={WIND_COLORS} colorKey="key" yLabel="µg/m³" height={220} refY={75} refLabel="national 24-h limit" />
        </ChartCard>
      </Section>

      <Section title="Modules" subtitle="Each page applies one part of the syllabus to the dataset, shows the formulas, the computed numbers and the charts.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NAV.flatMap((g) => g.items)
            .filter((i) => i.href !== "/")
            .map((item) => (
              <Link key={item.href} href={item.href} className="group">
                <Card className="h-full gap-1 py-4 shadow-none transition-colors group-hover:bg-muted/40">
                  <CardHeader className="flex flex-row items-center gap-3 px-4 pb-0">
                    <span className="flex size-8 items-center justify-center rounded-md border bg-background">
                      <item.icon className="size-4" />
                    </span>
                    <div>
                      <CardDescription className="font-mono text-[10px]">MODULE {item.module}</CardDescription>
                      <CardTitle className="text-sm">{item.name}</CardTitle>
                    </div>
                    <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardHeader>
                </Card>
              </Link>
            ))}
        </div>
      </Section>

      <Note tone="info" title="How to read the site">
        Every analysis page follows the same order: the concept and formula, the computed result on this dataset, a chart, and a one-line interpretation. Values marked p are two-sided p-values unless stated; the significance level is α = 0.05 throughout.
      </Note>
    </PageShell>
  );
}
