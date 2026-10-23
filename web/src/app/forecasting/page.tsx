import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, FormulaCard, KV, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { BarSeries, LineSeries } from "@/components/charts/series";
import { CategoryBars } from "@/components/charts/scatter";
import { BandLines } from "@/components/charts/xy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Formula } from "@/components/formula";
import { fmt, fmtInt, fmtP } from "@/lib/format";

type Metric = { model: string; mae: number; rmse: number; mape: number; mase: number; bias: number; mase_seasonal?: number };
type Fc = {
  monthly: { n_train: number; n_test: number; train_start: string; train_end: string; test_start: string; test_end: string; models: string[]; table: Metric[]; series: Array<Record<string, unknown>>; history: Array<{ date: string; actual: number }>; horizon: Array<Record<string, number>>; arima_order: [number, number, number]; hw_params: Record<string, number> };
  daily: { n_train: number; n_test: number; split: string; models: string[]; table: Metric[]; series: Array<Record<string, unknown>>; history: Array<{ date: string; actual: number }>; arimax_params: Array<{ term: string; coef: number; p: number }>; walk_forward_note: string };
  residuals: { model: string; mean: number; sd: number; series: Array<{ date: string; resid: number }>; coverage_95: number };
  metric_defs: Array<{ name: string; formula: string; meaning: string }>;
};

export default async function Page() {
  const d = await loadData<Fc>("forecasting");
  const m = d.monthly, dy = d.daily;
  const arimaKey = `ARIMA(${m.arima_order.join(",")})`;
  const monthlyRows = [...m.history.map((h) => ({ date: h.date, actual: h.actual })), ...m.series];
  const dailyRows = [...dy.history.map((h) => ({ date: h.date, actual: h.actual })), ...dy.series];
  const bestM = m.table[0], bestD = dy.table[0];
  const naiveD = dy.table.find((t) => t.model === "Naive")!;
  const wfKey = "ARIMA(2,1,2) walk-forward", staticKey = "ARIMA(2,1,2) static", arxKey = "ARIMAX(1,0,1) + weather";
  return (
    <PageShell
      module="10"
      title="Forecasting"
      description="Predicting the future with a strict chronological split: models see only the past, and are scored on data they never saw. Two horizons: monthly means for 2014 (12 steps ahead, trained on 48 months) and daily means for November–December 2014 (61 days). Baselines (naive, seasonal naive, mean, drift) are included because a model that cannot beat them is useless."
      concepts={["Chronological train/test split", "Baselines: naive, seasonal naive, drift", "Exponential smoothing forecasts", "ARIMA / SARIMA forecasts", "Walk-forward one-step", "ARIMAX with exogenous regressors", "Prediction intervals", "MAE / RMSE / MAPE / MASE"]}
    >
      <StatGrid cols={4}>
        <StatCard label="Best monthly model" value={bestM.model} hint={`RMSE ${fmt(bestM.rmse, 1)} · MASE ${fmt(bestM.mase, 2)}`} tone="good" />
        <StatCard label="Best daily model" value={bestD.model} hint={`RMSE ${fmt(bestD.rmse, 1)} · MASE ${fmt(bestD.mase, 2)}`} tone="good" />
        <StatCard label="Daily naive RMSE" value={fmt(naiveD.rmse, 1)} hint="the bar to beat" />
        <StatCard label="95% interval coverage (walk-forward)" value={`${d.residuals.coverage_95}%`} hint="share of test days inside the band" />
      </StatGrid>

      <Section title="Error metrics" subtitle="All four are reported for every model. MASE is the most honest: it is the MAE divided by the MAE of the in-sample naive forecast, so MASE < 1 means 'better than naive'.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {d.metric_defs.map((md) => (
            <FormulaCard key={md.name} title={md.name} tex={md.formula}>
              {md.meaning}
            </FormulaCard>
          ))}
        </div>
      </Section>

      <Section title="Monthly forecasts for 2014" subtitle={`Train ${m.train_start} → ${m.train_end} (${m.n_train} months), test ${m.test_start} → ${m.test_end} (${m.n_test} months). Twelve steps ahead with no updating.`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormulaCard title="Naive" tex={"\\hat{y}_{T+h} = y_T"} />
          <FormulaCard title="Seasonal naive" tex={"\\hat{y}_{T+h} = y_{T+h-12}"} />
          <FormulaCard title="Drift" tex={"\\hat{y}_{T+h} = y_T + h\\,\\frac{y_T-y_1}{T-1}"} />
          <FormulaCard title="Holt-Winters" tex={"\\hat{y}_{T+h} = \\ell_T + h\\,b_T + s_{T+h-m}"} where={[["\\alpha, \\beta, \\gamma", `${fmt(m.hw_params.smoothing_level, 3)}, ${fmt(m.hw_params.smoothing_trend, 3)}, ${fmt(m.hw_params.smoothing_seasonal, 3)}`]]} />
        </div>
        <Tabs defaultValue="hw">
          <TabsList className="h-auto flex-wrap"><TabsTrigger value="hw">Holt-Winters</TabsTrigger><TabsTrigger value="sarima">SARIMA</TabsTrigger><TabsTrigger value="arima">{arimaKey}</TabsTrigger><TabsTrigger value="base">Baselines</TabsTrigger></TabsList>
          <TabsContent value="hw">
            <ChartCard title="Holt-Winters forecast with 95% simulation interval" description="Last 24 training months plus the 12 forecast months.">
              <BandLines data={monthlyRows} xKey="date" lines={[{ key: "actual", label: "Actual", color: "#111827", width: 2, dots: true }, { key: "Holt-Winters", label: "Holt-Winters", color: "#16a34a", width: 2, dots: true }]} band={{ lo: "hw_lo", hi: "hw_hi", color: "#16a34a" }} xFormat="monthYearShort" height={320} splitAt={m.history[m.history.length - 1].date} yLabel="µg/m³" />
            </ChartCard>
          </TabsContent>
          <TabsContent value="sarima">
            <ChartCard title="SARIMA(1,0,0)(1,1,0)[12] forecast with 95% interval">
              <BandLines data={monthlyRows} xKey="date" lines={[{ key: "actual", label: "Actual", color: "#111827", width: 2, dots: true }, { key: "SARIMA(1,0,0)(1,1,0)[12]", label: "SARIMA", color: "#7c3aed", width: 2, dots: true }]} band={{ lo: "sarima_lo", hi: "sarima_hi", color: "#7c3aed" }} xFormat="monthYearShort" height={320} splitAt={m.history[m.history.length - 1].date} yLabel="µg/m³" />
            </ChartCard>
          </TabsContent>
          <TabsContent value="arima">
            <ChartCard title={`${arimaKey} forecast with 95% interval`} description="A non-seasonal ARIMA reverts to the mean within a few months: it has no seasonal state to carry, which is why it loses to Holt-Winters here.">
              <BandLines data={monthlyRows} xKey="date" lines={[{ key: "actual", label: "Actual", color: "#111827", width: 2, dots: true }, { key: arimaKey, label: arimaKey, color: "#2563eb", width: 2, dots: true }]} band={{ lo: "arima_lo", hi: "arima_hi", color: "#2563eb" }} xFormat="monthYearShort" height={320} splitAt={m.history[m.history.length - 1].date} yLabel="µg/m³" />
            </ChartCard>
          </TabsContent>
          <TabsContent value="base">
            <ChartCard title="Baseline forecasts">
              <LineSeries data={m.series} xKey="date" series={[{ key: "actual", label: "Actual", color: "#111827", strokeWidth: 2 }, { key: "Naive", label: "Naive", color: "#94a3b8", stroke: "dashed" }, { key: "Seasonal naive", label: "Seasonal naive", color: "#f97316" }, { key: "Mean", label: "Mean", color: "#64748b", stroke: "dashed" }, { key: "Drift", label: "Drift", color: "#0d9488", stroke: "dashed" }, { key: "SES", label: "SES", color: "#2563eb", stroke: "dashed" }]} xFormat="monthYearShort" height={320} legend xTicks={12} />
            </ChartCard>
          </TabsContent>
        </Tabs>
        <ChartCard title="Monthly model comparison (sorted by RMSE)" description="MASE uses the in-sample naive scale; the seasonal variant uses the lag-12 naive.">
          <DataTable
            rows={m.table.map((t, i) => ({ ...t, rank: i + 1 }))}
            columns={[
              { key: "rank", header: "#", align: "center" },
              { key: "model", header: "Model", className: "font-medium whitespace-nowrap", render: (r) => <span>{r.model}{r.rank === 1 && <Badge className="ml-2 rounded-md text-[10px]">best</Badge>}</span> },
              { key: "mae", header: "MAE", align: "right", render: (r) => fmt(r.mae, 1) },
              { key: "rmse", header: "RMSE", align: "right", render: (r) => <span className="font-semibold">{fmt(r.rmse, 1)}</span> },
              { key: "mape", header: "MAPE %", align: "right", render: (r) => fmt(r.mape, 1) },
              { key: "mase", header: "MASE", align: "right", render: (r) => <span className={r.mase < 1 ? "text-emerald-700" : "text-rose-700"}>{fmt(r.mase, 3)}</span> },
              { key: "mase_seasonal", header: "MASE (seasonal)", align: "right", render: (r) => fmt(r.mase_seasonal, 3) },
              { key: "bias", header: "Bias", align: "right", render: (r) => fmt(r.bias, 1) },
            ]}
          />
        </ChartCard>
        <ChartCard title="Absolute error by forecast horizon" description="Errors for months 1–12 ahead. Seasonal models stay flat; the non-seasonal ARIMA drifts off once it has reverted to the mean.">
          <BarSeries data={m.horizon} xKey="h" series={[{ key: "Seasonal naive", label: "Seasonal naive", color: "#f97316" }, { key: "Holt-Winters", label: "Holt-Winters", color: "#16a34a" }, { key: arimaKey, label: arimaKey, color: "#2563eb" }, { key: "SARIMA(1,0,0)(1,1,0)[12]", label: "SARIMA", color: "#7c3aed" }]} height={240} legend variant="default" yLabel="|error|" />
        </ChartCard>
      </Section>

      <Section title="Daily forecasts for November–December 2014" subtitle={`Train up to ${dy.split} (${fmtInt(dy.n_train)} days), test the next ${dy.n_test} days. Three ways to use ARIMA: a static 61-step forecast, a walk-forward one-step forecast that is updated with each observed day, and ARIMAX that also sees the day's weather.`}>
        <div className="grid gap-4 md:grid-cols-3">
          <FormulaCard title="Static multi-step" tex={"\\hat{y}_{T+h|T}, \\quad h = 1..61"} where={[["", "converges to the mean; the interval widens with h"]]} />
          <FormulaCard title="Walk-forward one-step" tex={"\\hat{y}_{t+1|t}, \\quad t = T, T+1, \\dots"} where={[["", "state updated with yₜ each day, parameters fixed (no refit)"]]} />
          <FormulaCard title="ARIMAX" tex={"y_t = \\beta^\\top x_t + \\frac{\\theta(B)}{\\phi(B)}\\varepsilon_t"} where={[["x_t", "dew point, temperature, pressure, wind speed of day t"]]} />
        </div>
        <Tabs defaultValue="wf">
          <TabsList className="h-auto flex-wrap"><TabsTrigger value="wf">Walk-forward ARIMA</TabsTrigger><TabsTrigger value="arx">ARIMAX + weather</TabsTrigger><TabsTrigger value="static">Static ARIMA</TabsTrigger><TabsTrigger value="all">All models</TabsTrigger></TabsList>
          <TabsContent value="wf">
            <ChartCard title="One-step-ahead ARIMA(2,1,2) with 95% interval" description={dy.walk_forward_note}>
              <BandLines data={dailyRows} xKey="date" lines={[{ key: "actual", label: "Actual", color: "#111827", width: 1.8 }, { key: wfKey, label: "Walk-forward forecast", color: "#2563eb", width: 2 }]} band={{ lo: "wf_lo", hi: "wf_hi", color: "#2563eb" }} xFormat="dayMonth" height={320} splitAt={dy.split} yLabel="µg/m³" />
            </ChartCard>
          </TabsContent>
          <TabsContent value="arx">
            <ChartCard title="ARIMAX(1,0,1) with the day's weather as regressors" description="Assumes a perfect weather forecast. Even so, it captures the episodes far better than any univariate model, because it knows when the wind drops.">
              <BandLines data={dailyRows} xKey="date" lines={[{ key: "actual", label: "Actual", color: "#111827", width: 1.8 }, { key: arxKey, label: "ARIMAX", color: "#16a34a", width: 2 }]} band={{ lo: "arx_lo", hi: "arx_hi", color: "#16a34a" }} xFormat="dayMonth" height={320} splitAt={dy.split} yLabel="µg/m³" />
              <DataTable rows={dy.arimax_params} columns={[{ key: "term", header: "Term", className: "font-mono" }, { key: "coef", header: "Coef", align: "right", render: (r) => fmt(r.coef, 3) }, { key: "p", header: "p", align: "right", render: (r) => fmtP(r.p) }]} />
            </ChartCard>
          </TabsContent>
          <TabsContent value="static">
            <ChartCard title="Static 61-step ARIMA(2,1,2) forecast" description="After a few days the forecast is just the mean and the interval covers everything: multi-step univariate forecasting of daily pollution is not informative.">
              <BandLines data={dailyRows} xKey="date" lines={[{ key: "actual", label: "Actual", color: "#111827", width: 1.8 }, { key: staticKey, label: "Static forecast", color: "#f97316", width: 2 }]} band={{ lo: "static_lo", hi: "static_hi", color: "#f97316" }} xFormat="dayMonth" height={320} splitAt={dy.split} yLabel="µg/m³" />
            </ChartCard>
          </TabsContent>
          <TabsContent value="all">
            <ChartCard title="Every daily model on the test window">
              <LineSeries data={dy.series} xKey="date" series={[{ key: "actual", label: "Actual", color: "#111827", strokeWidth: 2 }, { key: wfKey, label: "Walk-forward", color: "#2563eb" }, { key: arxKey, label: "ARIMAX", color: "#16a34a" }, { key: staticKey, label: "Static ARIMA", color: "#f97316", stroke: "dashed" }, { key: "Naive", label: "Naive", color: "#94a3b8", stroke: "dashed" }, { key: "Mean (last 90 d)", label: "Mean (90 d)", color: "#64748b", stroke: "dashed" }, { key: "Holt-Winters (7)", label: "Holt-Winters (7)", color: "#7c3aed", stroke: "dashed" }]} xFormat="dayMonth" height={340} legend xTicks={10} animate={false} />
            </ChartCard>
          </TabsContent>
        </Tabs>
        <ChartCard title="Daily model comparison (sorted by RMSE)">
          <DataTable
            rows={dy.table.map((t, i) => ({ ...t, rank: i + 1 }))}
            columns={[
              { key: "rank", header: "#", align: "center" },
              { key: "model", header: "Model", className: "font-medium whitespace-nowrap", render: (r) => <span>{r.model}{r.rank === 1 && <Badge className="ml-2 rounded-md text-[10px]">best</Badge>}</span> },
              { key: "mae", header: "MAE", align: "right", render: (r) => fmt(r.mae, 1) },
              { key: "rmse", header: "RMSE", align: "right", render: (r) => <span className="font-semibold">{fmt(r.rmse, 1)}</span> },
              { key: "mape", header: "MAPE %", align: "right", render: (r) => fmt(r.mape, 0) },
              { key: "mase", header: "MASE", align: "right", render: (r) => <span className={r.mase < 1 ? "text-emerald-700" : "text-rose-700"}>{fmt(r.mase, 3)}</span> },
              { key: "bias", header: "Bias", align: "right", render: (r) => fmt(r.bias, 1) },
            ]}
          />
          <p className="text-xs text-muted-foreground">MAPE is huge for every daily model because several test days have very low actual PM2.5 (a 20 µg/m³ error on a 10 µg/m³ day is 200%). This is exactly why MASE and RMSE are reported alongside it.</p>
        </ChartCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Walk-forward residuals" description={`Mean ${fmt(d.residuals.mean, 1)} (≈ unbiased), SD ${fmt(d.residuals.sd, 1)}. The big misses are the first day of each episode - the one-step model cannot see it coming.`}>
            <CategoryBars data={d.residuals.series.map((r) => ({ date: r.date.slice(5), resid: r.resid }))} xKey="date" yKey="resid" yLabel="actual − forecast" height={220} fallback="#64748b" />
          </ChartCard>
          <ChartCard title="Why the naive forecast is so bad here" description="The last training day (31 Oct 2014) was heavily polluted. A naive forecast repeats it for 61 days, so it is wrong by ~100 µg/m³ on every clean day: the persistence assumption fails when the series mean-reverts within days.">
            <KV cols={1} items={[["Naive RMSE", fmt(naiveD.rmse, 1)], ["Naive bias", fmt(naiveD.bias, 1)], ["Walk-forward RMSE", fmt(dy.table.find((t) => t.model === wfKey)!.rmse, 1)], ["ARIMAX RMSE", fmt(dy.table.find((t) => t.model === arxKey)!.rmse, 1)], ["Interval coverage (walk-forward)", `${d.residuals.coverage_95}%`]]} />
          </ChartCard>
        </div>
      </Section>

      <Note tone="good" title="What the forecasting module shows">
        Monthly: the annual cycle is the only reliable structure, so seasonal models (Holt-Winters, seasonal naive, SARIMA) beat everything else and the non-seasonal ARIMA reverts to the mean. Daily: pollution has a memory of a few days, so a one-step model updated every day halves the naive error (MASE {fmt(dy.table.find((t) => t.model === wfKey)!.mase, 2)}), and adding tomorrow&apos;s weather (ARIMAX) helps further (MASE {fmt(bestD.mase, 2)}). Multi-step daily forecasts without weather are not useful beyond two or three days.
        <div className="mt-2"><Formula tex={"\\text{MASE} < 1 \\iff \\text{the model beats the naive forecast in-sample scale}"} /></div>
      </Note>
    </PageShell>
  );
}
