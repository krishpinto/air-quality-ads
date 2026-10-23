import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { DataTable, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmt, fmtInt } from "@/lib/format";

type Ins = {
  executive_summary: string;
  findings: Array<{ module: string; title: string; detail: string; stat: string }>;
  model_comparison: Array<{ task: string; model: string; metric: string; value: number; secondary: string }>;
  limitations: string[];
  recommendations: string[];
  headline: { mean_pm25: number; median_pm25: number; skew: number; hours: number; days: number; pct_unhealthy: number; r2_full: number; best_daily_model: string; best_daily_rmse: number; naive_daily_rmse: number; smote_recall_gain: number };
};

const MODULE_COLORS: Record<string, string> = {
  Descriptive: "bg-blue-50 text-blue-800 border-blue-200",
  Correlation: "bg-violet-50 text-violet-800 border-violet-200",
  Inference: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Regression: "bg-amber-50 text-amber-800 border-amber-200",
  Validation: "bg-teal-50 text-teal-800 border-teal-200",
  Anomaly: "bg-rose-50 text-rose-800 border-rose-200",
  "Time series": "bg-sky-50 text-sky-800 border-sky-200",
  Forecasting: "bg-orange-50 text-orange-800 border-orange-200",
};

export default async function Page() {
  const d = await loadData<Ins>("insights");
  const h = d.headline;
  return (
    <PageShell
      module="11"
      title="Insights, limitations & recommendations"
      description="What five years of hourly data say, in one place. Every number below is produced by the pipeline and appears on the module pages; this page is the synthesis."
      concepts={["Executive summary", "Key findings", "Model comparison", "Limitations", "Recommendations"]}
    >
      <StatGrid cols={6}>
        <StatCard label="Hours analysed" value={fmtInt(h.hours)} hint={`${fmtInt(h.days)} days`} />
        <StatCard label="Mean / median" value={`${fmt(h.mean_pm25, 0)} / ${fmt(h.median_pm25, 0)}`} hint="µg/m³ · right-skewed" />
        <StatCard label="Unhealthy or worse" value={`${fmt(h.pct_unhealthy, 1)}%`} hint="of hours above 150 µg/m³" tone="bad" />
        <StatCard label="Weather-only R²" value={fmt(h.r2_full, 2)} hint="linear, hourly" />
        <StatCard label="Daily forecast RMSE" value={`${fmt(h.naive_daily_rmse, 0)} → ${fmt(h.best_daily_rmse, 0)}`} hint={`naive → ${h.best_daily_model}`} tone="good" />
        <StatCard label="SMOTE recall gain" value={`+${fmt(100 * h.smote_recall_gain, 0)} pts`} hint="severe-day classifier" tone="good" />
      </StatGrid>

      <Section title="Executive summary">
        <Card className="shadow-none">
          <CardContent className="text-[15px] leading-relaxed">{d.executive_summary}</CardContent>
        </Card>
      </Section>

      <Section title="Key findings by module" subtitle="One card per result, with the statistic that supports it.">
        <div className="grid gap-3 md:grid-cols-2">
          {d.findings.map((f, i) => (
            <Card key={i} className="gap-2 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={`rounded-md text-[10px] ${MODULE_COLORS[f.module] ?? ""}`}>{f.module}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">{f.stat}</span>
                </div>
                <CardTitle className="text-sm">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-xs leading-relaxed text-muted-foreground">{f.detail}</CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Model comparison" subtitle="Best score per task, all evaluated on data the model did not train on (2014).">
        <DataTable
          rows={d.model_comparison}
          columns={[
            { key: "task", header: "Task", className: "font-medium whitespace-nowrap" },
            { key: "model", header: "Model" },
            { key: "metric", header: "Metric" },
            { key: "value", header: "Value", align: "right", render: (r) => <span className="font-semibold">{fmt(r.value, r.metric.includes("RMSE") ? 1 : 3)}</span> },
            { key: "secondary", header: "Also" },
          ]}
        />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Limitations" subtitle="Things that constrain how far the conclusions reach.">
          <Card className="shadow-none">
            <CardContent>
              <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground">
                {d.limitations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </Section>
        <Section title="Recommendations" subtitle="What someone running an air-quality programme should take from this.">
          <Card className="shadow-none">
            <CardContent>
              <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground">
                {d.recommendations.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </Section>
      </div>

      <Section title="How the syllabus maps onto the pages">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Data exploration", "Dataset · Descriptive · Visualization · Correlation", "Types, cleaning, central tendency & dispersion, shape, tabulation, chart choice, Pearson/Spearman."],
            ["Probability & inference", "Probability & inference", "Normal/Poisson/Binomial, CLT, CIs, z/t/paired tests, ANOVA + Tukey, χ², Type I/II & power."],
            ["Modelling", "Regression · Validation", "Simple & multiple OLS, dummies, diagnostics, hold-out, k-fold, stratified, LOOCV, bootstrap, learning curve."],
            ["Anomalies", "Anomaly detection", "z/MAD/IQR, Mahalanobis, k-NN, LOF, Isolation Forest, class imbalance, SMOTE, precision/recall/ROC."],
            ["Time series", "Time series", "Components, MA, SES/Holt/Holt-Winters, trend tests, decomposition, ADF/KPSS, ACF/PACF, ARIMA."],
            ["Forecasting", "Forecasting", "Chronological split, baselines, HW/ARIMA/SARIMA, walk-forward, ARIMAX, intervals, MAE/RMSE/MAPE/MASE."],
          ].map(([a, b, c]) => (
            <Card key={a} className="gap-1 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="text-[11px]">{b}</CardDescription>
                <CardTitle className="text-sm">{a}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-xs leading-relaxed text-muted-foreground">{c}</CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Note tone="info" title="Reproducibility">
        Raw CSV → <code>pipeline/01_dataset.py … 11_insights.py</code> → <code>web/public/data/*.json</code> → this site. Re-running the eleven scripts regenerates every number; nothing on these pages is typed by hand.
      </Note>
    </PageShell>
  );
}
