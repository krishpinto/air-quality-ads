import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, Decision, FormulaCard, KV, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { AreaSeries, BarSeries, LineSeries } from "@/components/charts/series";
import { AcfChart, CategoryBars } from "@/components/charts/scatter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { fmt, fmtInt, fmtP } from "@/lib/format";

type Acf = { band: number; n: number; values: Array<{ lag: number; acf: number | null; pacf: number | null }> };
type TS = {
  overview: { daily: Array<{ date: string; pm25: number }>; monthly: Array<{ date: string; pm25: number; hazardous_hours: number; severe_days: number }>; yearly: Array<{ year: number; mean: number; median: number; p95: number; max: number }>; n_daily: number; n_monthly: number };
  moving_average: { series: Array<Record<string, unknown>>; smoothness: Array<{ window: number; std: number; pct_variance_removed: number }> };
  exp_smoothing: { series: Array<Record<string, unknown>>; params: Array<{ model: string; alpha: number | null; beta: number | null; gamma: number | null; sse: number; aic: number }>; alpha_sweep: Array<{ alpha: number; sse: number; rmse: number }> };
  trend: { slope_per_month: number; slope_per_year: number; intercept: number; r2: number; p: number; se: number; t: number; theil_sen_slope_per_year: number; theil_sen_ci_per_year: [number, number]; line: Array<{ date: string; trend: number }>; mann_kendall: { S: number; z: number; p: number } };
  decomposition: { additive: Array<Record<string, unknown>>; multiplicative: Array<Record<string, unknown>>; stl: Array<Record<string, unknown>>; seasonal_index: Array<{ month: string; index: number; mean: number }>; strength: { trend: number; seasonal: number }; variance_share: { seasonal: number; trend: number; residual: number }; weekly_index: Array<{ day: string; index: number }> };
  stationarity: { adf: Array<{ series: string; adf: number; p: number; lags: number; nobs: number; crit_1: number; crit_5: number; crit_10: number; stationary: boolean }>; kpss: Array<{ series: string; kpss: number; p: number; lags: number; crit_5: number; stationary: boolean }>; rolling: Array<Record<string, unknown>>; diff_series: Array<Record<string, unknown>> };
  acf_pacf: { monthly: Acf; monthly_diff: Acf; daily: Acf; daily_diff: Acf };
  arima: { best_order: [number, number, number]; grid: Array<{ order: string; aic: number; bic: number; llf: number }>; aic: number; bic: number; params: Array<{ term: string; coef: number; se: number; z: number; p: number }>; ljung_box: { stat: number; p: number; lags: number }; fitted: Array<Record<string, unknown>>; resid_acf: Acf; sarima: { order: string; aic: number; bic: number; params: Array<{ term: string; coef: number; se: number; p: number }>; ljung_box: { stat: number; p: number }; fitted: Array<{ date: string; fitted: number }> } };
};

export default async function Page() {
  const d = await loadData<TS>("timeseries");
  const monthlyWithTrend = d.overview.monthly.map((m, i) => ({ ...m, trend: d.trend.line[i]?.trend }));
  const sarimaMap = new Map(d.arima.sarima.fitted.map((f) => [f.date, f.fitted]));
  const arimaRows = d.arima.fitted.map((r) => ({ ...r, sarima: sarimaMap.get(String(r.date)) ?? null }));
  const o = d.arima.best_order;
  return (
    <PageShell
      module="9"
      title="Time-series analysis"
      description="PM2.5 as a sequence in time: its components (trend, seasonal, irregular), smoothing with moving averages and exponential smoothing, a linear trend test, classical and STL decomposition, stationarity tests (ADF, KPSS), autocorrelation (ACF/PACF) and an ARIMA model chosen by AIC. Daily data has 1,826 points; monthly data (60 points) is used where the annual cycle matters."
      concepts={["Components of a time series", "Moving average", "Exponential smoothing (SES, Holt, Holt-Winters)", "Trend analysis", "Seasonal decomposition", "Stationarity: ADF / KPSS", "Differencing", "ACF / PACF", "ARIMA"]}
    >
      <StatGrid cols={5}>
        <StatCard label="Daily / monthly points" value={`${fmtInt(d.overview.n_daily)} / ${d.overview.n_monthly}`} />
        <StatCard label="Linear trend" value={`${fmt(d.trend.slope_per_year, 2)} µg/m³ / yr`} hint={`p = ${fmtP(d.trend.p)} - not significant`} />
        <StatCard label="Seasonal strength (STL)" value={fmt(d.decomposition.strength.seasonal, 2)} hint="0 = none, 1 = pure seasonality" />
        <StatCard label="ADF, monthly level" value={`p = ${fmtP(d.stationarity.adf[0].p)}`} hint={d.stationarity.adf[0].stationary ? "stationary" : "unit root"} tone={d.stationarity.adf[0].stationary ? "good" : "warn"} />
        <StatCard label="Best ARIMA (AIC)" value={`(${o.join(",")})`} hint={`AIC ${fmt(d.arima.aic, 1)}`} />
      </StatGrid>

      <Section title="The series and its components" subtitle="A time series = trend (long-run direction) + seasonal (fixed-period cycle) + cyclical (irregular multi-year swings) + irregular (noise). Beijing PM2.5 has a strong annual seasonal component, a weak trend and a very large irregular component (smog episodes).">
        <ChartCard title="Daily mean PM2.5, 2010–2014" description="Every day. The spikes are multi-day episodes; the dense winters stand out.">
          <AreaSeries data={d.overview.daily} xKey="date" series={[{ key: "pm25", label: "Daily mean", color: "#2563eb" }]} xFormat="monthYearShort" height={260} xTicks={10} animate={false} />
        </ChartCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Monthly mean with fitted linear trend" description={`Slope ${fmt(d.trend.slope_per_month, 3)} µg/m³ per month (${fmt(d.trend.slope_per_year, 2)} per year), R² = ${fmt(d.trend.r2, 3)}.`}>
            <LineSeries data={monthlyWithTrend} xKey="date" series={[{ key: "pm25", label: "Monthly mean", color: "#2563eb" }, { key: "trend", label: "Linear trend", color: "#e11d48", stroke: "dashed" }]} xFormat="monthYearShort" height={240} xTicks={6} legend />
          </ChartCard>
          <ChartCard title="Yearly summary" description="Mean, median, 95th percentile and the single worst day per year.">
            <DataTable rows={d.overview.yearly} columns={[{ key: "year", header: "Year" }, { key: "mean", header: "Mean", align: "right", render: (r) => fmt(r.mean, 1) }, { key: "median", header: "Median", align: "right", render: (r) => fmt(r.median, 1) }, { key: "p95", header: "P95", align: "right", render: (r) => fmt(r.p95, 1) }, { key: "max", header: "Max day", align: "right", render: (r) => fmt(r.max, 0) }]} />
            <KV cols={1} items={[["Mann-Kendall trend test (monthly)", `S = ${d.trend.mann_kendall.S}, z = ${fmt(d.trend.mann_kendall.z, 2)}, p = ${fmtP(d.trend.mann_kendall.p)}`], ["Theil-Sen slope per year", `${fmt(d.trend.theil_sen_slope_per_year, 2)} [${fmt(d.trend.theil_sen_ci_per_year[0], 2)}, ${fmt(d.trend.theil_sen_ci_per_year[1], 2)}]`]]} />
          </ChartCard>
        </div>
        <FormulaCard title="Linear trend model" tex={"y_t = a + b\\,t + \\varepsilon_t, \\qquad H_0: b = 0, \\quad t = \\frac{\\hat{b}}{SE(\\hat{b})} = " + fmt(d.trend.t, 2) + ", \\quad p = " + fmtP(d.trend.p)} where={[["\\text{Mann-Kendall}", "non-parametric alternative: counts sign of all pairwise differences"], ["\\text{Theil-Sen}", "median of pairwise slopes - robust to the spikes"]]}>
          Neither test finds a significant trend over 2010-2014: the air did not get measurably better or worse in this window, once the annual cycle is accounted for.
        </FormulaCard>
      </Section>

      <Section title="Moving averages" subtitle="Average the last w days. Longer windows remove more of the irregular component but lag behind turning points.">
        <FormulaCard title="Simple moving average" tex={"MA_t^{(w)} = \\frac{1}{w}\\sum_{i=0}^{w-1} y_{t-i}, \\qquad \\text{centred: } \\frac{1}{w}\\sum_{i=-(w-1)/2}^{(w-1)/2} y_{t+i}"} />
        <ChartCard title="Daily PM2.5 with 7-, 30- and 90-day trailing moving averages">
          <LineSeries data={d.moving_average.series} xKey="date" series={[{ key: "pm25", label: "Daily", color: "#cbd5e1", strokeWidth: 1 }, { key: "ma7", label: "MA(7)", color: "#2563eb" }, { key: "ma30", label: "MA(30)", color: "#f97316" }, { key: "ma90", label: "MA(90)", color: "#e11d48", strokeWidth: 2.2 }]} xFormat="monthYearShort" height={300} xTicks={10} legend animate={false} />
        </ChartCard>
        <DataTable rows={d.moving_average.smoothness} columns={[{ key: "window", header: "Window (days)", align: "right" }, { key: "std", header: "SD of the smoothed series", align: "right", render: (r) => fmt(r.std, 1) }, { key: "pct_variance_removed", header: "Variance removed %", align: "right", render: (r) => fmt(r.pct_variance_removed, 1) }]} />
      </Section>

      <Section title="Exponential smoothing" subtitle="Weighted average where weights decay geometrically into the past. SES handles level; Holt adds a trend; Holt-Winters adds a seasonal component (period 12 on monthly data).">
        <div className="grid gap-4 md:grid-cols-3">
          <FormulaCard title="Simple (SES)" tex={"\\hat{y}_{t+1} = \\alpha y_t + (1-\\alpha)\\hat{y}_t"} where={[["\\alpha", "0 = ignore new data, 1 = naive"]]} />
          <FormulaCard title="Holt (level + trend)" tex={["\\ell_t = \\alpha y_t + (1-\\alpha)(\\ell_{t-1}+b_{t-1})", "b_t = \\beta(\\ell_t-\\ell_{t-1}) + (1-\\beta)b_{t-1}"]} />
          <FormulaCard title="Holt-Winters additive" tex={["\\ell_t = \\alpha(y_t - s_{t-m}) + (1-\\alpha)(\\ell_{t-1}+b_{t-1})", "s_t = \\gamma(y_t-\\ell_t) + (1-\\gamma)s_{t-m}"]} where={[["m", "12 months"]]} />
        </div>
        <ChartCard title="Fitted values on the monthly series" description="SES and Holt lag the seasonal swings; Holt-Winters follows them because it carries a seasonal state.">
          <LineSeries data={d.exp_smoothing.series} xKey="date" series={[{ key: "actual", label: "Actual", color: "#111827", strokeWidth: 2 }, { key: "ses_opt", label: "SES (α opt.)", color: "#2563eb" }, { key: "holt", label: "Holt", color: "#f97316" }, { key: "hw", label: "Holt-Winters", color: "#16a34a" }]} xFormat="monthYearShort" height={300} xTicks={6} legend />
        </ChartCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable rows={d.exp_smoothing.params} columns={[{ key: "model", header: "Model", className: "font-medium" }, { key: "alpha", header: "α", align: "right", render: (r) => fmt(r.alpha, 3) }, { key: "beta", header: "β", align: "right", render: (r) => fmt(r.beta, 3) }, { key: "gamma", header: "γ", align: "right", render: (r) => fmt(r.gamma, 3) }, { key: "sse", header: "SSE", align: "right", render: (r) => fmtInt(r.sse) }, { key: "aic", header: "AIC", align: "right", render: (r) => fmt(r.aic, 1) }]} />
          <ChartCard title="Effect of α on SES fit error" description="RMSE of one-step fitted values for different smoothing constants. The optimiser picks the α with the smallest SSE.">
            <CategoryBars data={d.exp_smoothing.alpha_sweep.map((a) => ({ alpha: `${a.alpha}`, rmse: a.rmse }))} xKey="alpha" yKey="rmse" yLabel="RMSE" height={200} fallback="#2563eb" />
          </ChartCard>
        </div>
      </Section>

      <Section title="Seasonal decomposition" subtitle="Split the monthly series into trend, seasonal and residual. Additive: y = T + S + R. Multiplicative: y = T × S × R. STL is a robust, flexible alternative.">
        <FormulaCard title="Classical decomposition (period m = 12)" tex={["T_t = \\text{centred } MA_{12}(y_t), \\qquad S_t = \\text{mean of } (y_t - T_t) \\text{ by month, centred}, \\qquad R_t = y_t - T_t - S_t"]} where={[["F_S", `seasonal strength = max(0, 1 − Var(R)/Var(S+R)) = ${fmt(d.decomposition.strength.seasonal, 2)}`], ["F_T", `trend strength = ${fmt(d.decomposition.strength.trend, 2)}`]]} />
        <Tabs defaultValue="additive">
          <TabsList className="h-auto flex-wrap"><TabsTrigger value="additive">Additive</TabsTrigger><TabsTrigger value="multiplicative">Multiplicative</TabsTrigger><TabsTrigger value="stl">STL (robust)</TabsTrigger></TabsList>
          {(["additive", "multiplicative", "stl"] as const).map((k) => (
            <TabsContent key={k} value={k} className="space-y-3">
              {k !== "stl" && <ChartCard title="Observed"><LineSeries data={d.decomposition[k]} xKey="date" series={[{ key: "observed", label: "Observed", color: "#111827" }]} xFormat="monthYearShort" height={150} xTicks={6} /></ChartCard>}
              <ChartCard title="Trend"><LineSeries data={d.decomposition[k]} xKey="date" series={[{ key: "trend", label: "Trend", color: "#2563eb" }]} xFormat="monthYearShort" height={150} xTicks={6} /></ChartCard>
              <ChartCard title="Seasonal"><LineSeries data={d.decomposition[k]} xKey="date" series={[{ key: "seasonal", label: "Seasonal", color: "#16a34a" }]} xFormat="monthYearShort" height={150} xTicks={6} yFormat={k === "multiplicative" ? "2dp" : "int"} /></ChartCard>
              <ChartCard title="Residual (irregular)"><BarSeries data={d.decomposition[k]} xKey="date" series={[{ key: "residual", label: "Residual", color: "#94a3b8" }]} xFormat="monthYearShort" height={150} xTicks={6} variant="default" radius={1} yFormat={k === "multiplicative" ? "2dp" : "int"} /></ChartCard>
            </TabsContent>
          ))}
        </Tabs>
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Seasonal index by month" description="Monthly mean ÷ overall mean. > 1 = worse than average. February and October–January peak; late spring and August are the cleanest.">
            <CategoryBars data={d.decomposition.seasonal_index} xKey="month" yKey="index" yLabel="index" height={220} fallback="#16a34a" refY={1} />
          </ChartCard>
          <ChartCard title="Weekly index (daily data)" description="Day-of-week mean ÷ overall mean: essentially flat, no weekly seasonality.">
            <CategoryBars data={d.decomposition.weekly_index} xKey="day" yKey="index" yLabel="index" height={220} fallback="#64748b" refY={1} />
          </ChartCard>
          <ChartCard title="Share of variance (additive)">
            <KV cols={1} items={[["Seasonal", `${fmt(d.decomposition.variance_share.seasonal, 1)}%`], ["Trend", `${fmt(d.decomposition.variance_share.trend, 1)}%`], ["Residual", `${fmt(d.decomposition.variance_share.residual, 1)}%`]]} />
            <p className="mt-2 text-xs text-muted-foreground">The residual dominates: most month-to-month variation is irregular (episodes), which caps how well any seasonal model can forecast.</p>
          </ChartCard>
        </div>
      </Section>

      <Section title="Stationarity" subtitle="ARIMA needs a stationary series (constant mean and variance, autocorrelation depending only on lag). ADF tests H₀: unit root (non-stationary); KPSS tests H₀: stationary. Differencing removes a unit root.">
        <div className="grid gap-4 md:grid-cols-2">
          <FormulaCard title="Augmented Dickey-Fuller" tex={["\\Delta y_t = \\alpha + \\beta t + \\gamma y_{t-1} + \\sum_{i=1}^{p}\\delta_i \\Delta y_{t-i} + \\varepsilon_t", "H_0: \\gamma = 0 \\ (\\text{unit root}), \\qquad H_1: \\gamma < 0"]} />
          <FormulaCard title="Differencing" tex={["\\Delta y_t = y_t - y_{t-1}, \\qquad \\Delta_{12} y_t = y_t - y_{t-12}"]} where={[["d", "number of differences in ARIMA(p, d, q)"]]} />
        </div>
        <ChartCard title="ADF test results">
          <DataTable rows={d.stationarity.adf} columns={[{ key: "series", header: "Series", className: "font-medium" }, { key: "adf", header: "ADF stat", align: "right", render: (r) => fmt(r.adf, 3) }, { key: "crit_5", header: "5% critical", align: "right", render: (r) => fmt(r.crit_5, 3) }, { key: "lags", header: "Lags", align: "right" }, { key: "p", header: "p", align: "right", render: (r) => fmtP(r.p) }, { key: "stationary", header: "", render: (r) => <Decision p={r.p} rejectText="stationary" failText="unit root" /> }]} />
        </ChartCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="KPSS test results (H₀ reversed: stationary)">
            <DataTable rows={d.stationarity.kpss} columns={[{ key: "series", header: "Series", className: "font-medium" }, { key: "kpss", header: "KPSS stat", align: "right", render: (r) => fmt(r.kpss, 3) }, { key: "crit_5", header: "5% critical", align: "right", render: (r) => fmt(r.crit_5, 3) }, { key: "p", header: "p", align: "right", render: (r) => fmtP(r.p) }, { key: "stationary", header: "", render: (r) => <Badge variant={r.stationary ? "default" : "destructive"} className="rounded-md text-[10px]">{r.stationary ? "stationary" : "not stationary"}</Badge> }]} />
            <Note tone="info">Monthly PM2.5 is already level-stationary (no unit root, no trend) - consistent with the flat trend test. The daily series is too. Differencing is therefore optional; the AIC search below is allowed to pick d = 0 or 1.</Note>
          </ChartCard>
          <ChartCard title="Monthly level vs first difference">
            <LineSeries data={d.stationarity.diff_series} xKey="date" series={[{ key: "level", label: "Level", color: "#2563eb" }, { key: "diff", label: "Δy", color: "#f97316" }]} xFormat="monthYearShort" height={240} xTicks={6} legend />
          </ChartCard>
        </div>
        <ChartCard title="Rolling 90-day mean and SD of daily PM2.5" description="A stationary series has roughly constant rolling statistics. Both oscillate with the seasons but show no drift.">
          <LineSeries data={d.stationarity.rolling} xKey="date" series={[{ key: "mean", label: "Rolling mean", color: "#2563eb" }, { key: "std", label: "Rolling SD", color: "#e11d48" }]} xFormat="monthYearShort" height={220} xTicks={10} legend animate={false} />
        </ChartCard>
      </Section>

      <Section title="Autocorrelation: ACF and PACF" subtitle="ACF(k) = correlation between yₜ and yₜ₋ₖ. PACF(k) = the same after removing the effect of shorter lags. Bars outside the red band are significant at 5%. Their shapes suggest ARIMA orders: PACF cut-off → AR(p), ACF cut-off → MA(q).">
        <FormulaCard title="Sample autocorrelation" tex={"r_k = \\frac{\\sum_{t=k+1}^{T}(y_t-\\bar{y})(y_{t-k}-\\bar{y})}{\\sum_{t=1}^{T}(y_t-\\bar{y})^2}, \\qquad \\text{band} = \\pm\\frac{1.96}{\\sqrt{T}}"} />
        <Tabs defaultValue="daily">
          <TabsList className="h-auto flex-wrap"><TabsTrigger value="daily">Daily</TabsTrigger><TabsTrigger value="daily_diff">Daily, differenced</TabsTrigger><TabsTrigger value="monthly">Monthly</TabsTrigger><TabsTrigger value="monthly_diff">Monthly, differenced</TabsTrigger></TabsList>
          {(["daily", "daily_diff", "monthly", "monthly_diff"] as const).map((k) => (
            <TabsContent key={k} value={k}>
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title={`ACF · ${k.replace("_", ", ")}`}><AcfChart values={d.acf_pacf[k].values} key="acf" band={d.acf_pacf[k].band} height={220} /></ChartCard>
                <ChartCard title={`PACF · ${k.replace("_", ", ")}`}><AcfChart values={d.acf_pacf[k].values} key="pacf" band={d.acf_pacf[k].band} height={220} /></ChartCard>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <Note tone="info">Daily PM2.5 has a slowly decaying ACF and a PACF that cuts off after lag 1–2: an AR signature, i.e. today is a good predictor of tomorrow but the memory fades within days. The monthly ACF shows the lag-12 seasonal bump.</Note>
      </Section>

      <Section title="ARIMA" subtitle="ARIMA(p, d, q): autoregressive order p, d differences, moving-average order q. 18 candidate orders were fitted to the monthly series and ranked by AIC; residuals are checked for remaining autocorrelation with the Ljung-Box test.">
        <FormulaCard title="ARIMA(p, d, q)" tex={["\\phi(B)(1-B)^d y_t = c + \\theta(B)\\varepsilon_t, \\qquad \\phi(B) = 1-\\phi_1 B - \\dots - \\phi_p B^p, \\quad \\theta(B) = 1+\\theta_1 B+\\dots+\\theta_q B^q", "AIC = 2k - 2\\ln L, \\qquad Q_{LB} = T(T+2)\\sum_{k=1}^{h}\\frac{r_k^2}{T-k} \\sim \\chi^2_{h-p-q}"]} where={[["B", "backshift operator, B yₜ = yₜ₋₁"], ["H_0 \\text{ (Ljung-Box)}", "residuals are white noise"]]} />
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <ChartCard title="Order selection by AIC (top 12)">
            <DataTable rows={d.arima.grid} columns={[{ key: "order", header: "(p,d,q)", className: "font-mono" }, { key: "aic", header: "AIC", align: "right", render: (r) => fmt(r.aic, 1) }, { key: "bic", header: "BIC", align: "right", render: (r) => fmt(r.bic, 1) }]} />
          </ChartCard>
          <div className="space-y-4">
            <ChartCard title={`Selected: ARIMA(${o.join(",")})`} description={`AIC ${fmt(d.arima.aic, 1)}, BIC ${fmt(d.arima.bic, 1)} · Ljung-Box(12) Q = ${fmt(d.arima.ljung_box.stat, 2)}, p = ${fmtP(d.arima.ljung_box.p)}`} right={<Decision p={d.arima.ljung_box.p} rejectText="residual autocorrelation" failText="residuals ≈ white noise" />}>
              <DataTable rows={d.arima.params} columns={[{ key: "term", header: "Term", className: "font-mono" }, { key: "coef", header: "Coef", align: "right", render: (r) => fmt(r.coef, 4) }, { key: "se", header: "SE", align: "right", render: (r) => fmt(r.se, 4) }, { key: "z", header: "z", align: "right", render: (r) => fmt(r.z, 2) }, { key: "p", header: "p", align: "right", render: (r) => fmtP(r.p) }]} />
            </ChartCard>
            <ChartCard title={`Seasonal ARIMA ${d.arima.sarima.order} for comparison`} description={`AIC ${fmt(d.arima.sarima.aic, 1)}, BIC ${fmt(d.arima.sarima.bic, 1)} · Ljung-Box p = ${fmtP(d.arima.sarima.ljung_box.p)}. The seasonal difference uses up 12 observations, so AICs are not directly comparable; the forecasting page judges them out of sample.`}>
              <DataTable rows={d.arima.sarima.params} columns={[{ key: "term", header: "Term", className: "font-mono" }, { key: "coef", header: "Coef", align: "right", render: (r) => fmt(r.coef, 4) }, { key: "se", header: "SE", align: "right", render: (r) => fmt(r.se, 4) }, { key: "p", header: "p", align: "right", render: (r) => fmtP(r.p) }]} />
            </ChartCard>
          </div>
        </div>
        <ChartCard title="In-sample fit" description="One-step-ahead fitted values. Both models track the level; neither anticipates the spikes.">
          <LineSeries data={arimaRows} xKey="date" series={[{ key: "actual", label: "Actual", color: "#111827", strokeWidth: 2 }, { key: "fitted", label: `ARIMA(${o.join(",")})`, color: "#2563eb" }, { key: "sarima", label: "SARIMA", color: "#16a34a", stroke: "dashed" }]} xFormat="monthYearShort" height={280} xTicks={6} legend />
        </ChartCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="ARIMA residuals"><BarSeries data={d.arima.fitted} xKey="date" series={[{ key: "resid", label: "Residual", color: "#94a3b8" }]} xFormat="monthYearShort" height={180} xTicks={6} variant="default" radius={1} /></ChartCard>
          <ChartCard title="ACF of ARIMA residuals" description="All bars inside the band = no structure left to model."><AcfChart values={d.arima.resid_acf.values} key="acf" band={d.arima.resid_acf.band} height={180} /></ChartCard>
        </div>
      </Section>
    </PageShell>
  );
}
