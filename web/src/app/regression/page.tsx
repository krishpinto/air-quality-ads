import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, Decision, FormulaCard, KV, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { Histogram, LineSeries } from "@/components/charts/series";
import { ScatterPlot, CategoryBars } from "@/components/charts/scatter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { fmt, fmtInt, fmtP } from "@/lib/format";
import { Tex } from "@/components/formula";

type Simple = { label: string; n: number; slope: number; intercept: number; slope_se: number; slope_t: number; slope_p: number; slope_ci: [number, number]; r: number; r2: number; adj_r2: number; F: number; F_p: number; resid_se: number; sxx: number; sxy: number; x_mean: number; y_mean: number; mae: number; rmse: number; mape: number; points: Array<{ x: number; y: number }>; line: Array<{ x: number; y: number; lo: number; hi: number }>; equation: string };
type Coef = { term: string; label: string; coef: number; se: number; t: number; p: number; ci_low: number; ci_high: number; beta_std: number | null; significant: boolean };
type Model = { name: string; n: number; k: number; r2: number; adj_r2: number; F: number; F_p: number; df_model: number; df_resid: number; aic: number; bic: number; resid_se: number; log_target: boolean; ss_total: number; ss_model: number; ss_resid: number; coefficients: Coef[]; vif: Array<{ term: string; label: string; vif: number }>; durbin_watson: number; jarque_bera: { stat: number; p: number; skew: number; kurtosis: number }; breusch_pagan: { stat: number; p: number }; metrics: { mae: number; rmse: number; mape: number; r2: number }; resid_vs_fitted: Array<{ fitted: number; resid: number }>; resid_hist: Array<Record<string, unknown>>; qq: Array<{ theoretical: number; sample: number }>; actual_vs_pred: Array<{ actual: number; pred: number }> };
type Reg = { simple: Record<string, Simple>; models: { weather: Model; full: Model; log: Model }; partial: Record<string, Array<{ x: number; y: number }>>; holdout: Array<{ model: string; n_train: number; n_test: number; train: { mae: number; rmse: number; mape: number; r2: number }; test: { mae: number; rmse: number; mape: number; r2: number } }>; nested: { F: number; p: number; df_diff: number; r2_a: number; r2_b: number }; reference_wind: string; n: number };

function ModelBlock({ m }: { m: Model }) {
  return (
    <div className="space-y-4">
      <StatGrid cols={6}>
        <StatCard label="R²" value={fmt(m.r2, 4)} hint={`adjusted ${fmt(m.adj_r2, 4)}`} />
        <StatCard label="F-test" value={fmt(m.F, 0)} hint={`df (${m.df_model}, ${fmtInt(m.df_resid)}), p ${fmtP(m.F_p)}`} />
        <StatCard label="RMSE" value={fmt(m.metrics.rmse, 1)} hint={`MAE ${fmt(m.metrics.mae, 1)} · MAPE ${fmt(m.metrics.mape, 0)}%`} />
        <StatCard label="AIC / BIC" value={fmt(m.aic, 0)} hint={`BIC ${fmt(m.bic, 0)} (lower is better)`} />
        <StatCard label="Durbin-Watson" value={fmt(m.durbin_watson, 3)} hint="2 = no autocorrelation" tone={m.durbin_watson < 1.5 ? "warn" : "good"} />
        <StatCard label="Residual normality" value={fmtP(m.jarque_bera.p)} hint={`JB skew ${fmt(m.jarque_bera.skew, 2)}, kurt ${fmt(m.jarque_bera.kurtosis, 1)}`} tone={m.jarque_bera.p < 0.05 ? "warn" : "good"} />
      </StatGrid>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <ChartCard title="Coefficient table" description={`Each coefficient is the change in ${m.log_target ? "log(1+PM2.5)" : "PM2.5 (µg/m³)"} per unit of the predictor, holding the others fixed. Wind dummies are relative to NW. β-std = standardised coefficient (per SD), comparable across predictors.`}>
          <DataTable
            rows={m.coefficients}
            columns={[
              { key: "label", header: "Term", className: "font-medium whitespace-nowrap" },
              { key: "coef", header: "Coef", align: "right", render: (r) => fmt(r.coef, 4) },
              { key: "se", header: "SE", align: "right", render: (r) => fmt(r.se, 4) },
              { key: "t", header: "t", align: "right", render: (r) => fmt(r.t, 2) },
              { key: "p", header: "p", align: "right", render: (r) => fmtP(r.p) },
              { key: "ci", header: "95% CI", align: "right", render: (r) => `[${fmt(r.ci_low, 3)}, ${fmt(r.ci_high, 3)}]` },
              { key: "beta_std", header: "β-std", align: "right", render: (r) => fmt(r.beta_std, 3) },
              { key: "sig", header: "", render: (r) => <Decision p={r.p} rejectText="significant" failText="n.s." /> },
            ]}
          />
        </ChartCard>
        <div className="space-y-4">
          <ChartCard title="Variance inflation factors" description="VIF > 5 signals multicollinearity. Dew point, temperature and pressure are entangled.">
            <DataTable rows={m.vif} columns={[{ key: "label", header: "Term" }, { key: "vif", header: "VIF", align: "right", render: (r) => <span className={r.vif > 5 ? "font-semibold text-amber-700" : ""}>{fmt(r.vif, 2)}</span> }]} />
          </ChartCard>
          <ChartCard title="ANOVA for the regression">
            <KV cols={1} items={[["SS model", fmtInt(m.ss_model)], ["SS residual", fmtInt(m.ss_resid)], ["SS total", fmtInt(m.ss_total)], ["R² = SS model / SS total", fmt(m.ss_model / m.ss_total, 4)], ["Residual SE", fmt(m.resid_se, 3)]]} />
          </ChartCard>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Residuals vs fitted" description="Should be a shapeless cloud around 0. The fan shape = heteroscedasticity (variance grows with the level).">
          <ScatterPlot points={m.resid_vs_fitted.map((p) => ({ x: p.fitted, y: p.resid }))} xLabel="Fitted" yLabel="Residual" height={230} refY={0} size={14} opacity={0.4} />
          <p className="mt-1 text-xs text-muted-foreground">Breusch-Pagan p {fmtP(m.breusch_pagan.p)} → {m.breusch_pagan.p < 0.05 ? "heteroscedastic" : "homoscedastic"}.</p>
        </ChartCard>
        <ChartCard title="Residual histogram" description="Compared with a normal curve.">
          <Histogram bins={m.resid_hist} height={230} color="#64748b" label="residuals" xFormat="int" />
        </ChartCard>
        <ChartCard title="Normal Q-Q plot of residuals" description="Points on the dashed line = normal residuals. Curving up at the right = heavy right tail.">
          <ScatterPlot points={m.qq.map((p) => ({ x: p.theoretical, y: p.sample }))} xLabel="Theoretical quantiles" yLabel="Sample quantiles" height={230} diagonal size={12} opacity={0.6} />
        </ChartCard>
      </div>
      <ChartCard title="Actual vs predicted (600 sampled hours)" description="A perfect model lies on the dashed 45° line. The model under-predicts the high-pollution hours badly: weather does not know about emissions.">
        <ScatterPlot points={m.actual_vs_pred.map((p) => ({ x: p.pred, y: p.actual }))} xLabel="Predicted PM2.5" yLabel="Actual PM2.5" height={280} diagonal size={14} opacity={0.4} />
      </ChartCard>
    </div>
  );
}

export default async function Page() {
  const d = await loadData<Reg>("regression");
  const s = d.simple.DEWP;
  const full = d.models.full;
  return (
    <PageShell
      module="6"
      title="Regression"
      description="Simple linear regression of PM2.5 on one weather variable, then multiple regression on six weather variables plus wind-direction dummies, with the full set of diagnostics: coefficient t-tests, F-test, R² and adjusted R², VIF for multicollinearity, Durbin-Watson for autocorrelation, residual normality and heteroscedasticity, error metrics and a chronological hold-out."
      concepts={["Simple linear regression", "Least squares", "Multiple regression", "Dummy variables", "R², adjusted R²", "t-test & F-test", "VIF", "Residual diagnostics", "MAE / RMSE / MAPE"]}
    >
      <StatGrid cols={4}>
        <StatCard label="Simple regression (dew point)" value={`R² = ${fmt(s.r2, 3)}`} hint={s.equation} />
        <StatCard label="Multiple regression (Model B)" value={`R² = ${fmt(full.r2, 3)}`} hint={`adj. ${fmt(full.adj_r2, 3)}, ${full.k} predictors`} />
        <StatCard label="Test-year R² (2014)" value={fmt(d.holdout[1].test.r2, 3)} hint={`train ${fmt(d.holdout[1].train.r2, 3)} - no overfitting`} />
        <StatCard label="Adding wind dummies" value={`F = ${fmt(d.nested.F, 0)}`} hint={`p ${fmtP(d.nested.p)}: R² ${fmt(d.nested.r2_a, 3)} → ${fmt(d.nested.r2_b, 3)}`} tone="good" />
      </StatGrid>

      <Section title="Simple linear regression" subtitle="One predictor. Least squares picks the line that minimises the sum of squared vertical distances.">
        <div className="grid gap-4 md:grid-cols-3">
          <FormulaCard title="Model and estimates" tex={["y = \\beta_0 + \\beta_1 x + \\varepsilon", "\\hat{\\beta}_1 = \\frac{S_{xy}}{S_{xx}} = \\frac{\\sum (x_i-\\bar{x})(y_i-\\bar{y})}{\\sum (x_i-\\bar{x})^2}, \\qquad \\hat{\\beta}_0 = \\bar{y} - \\hat{\\beta}_1\\bar{x}"]} />
          <FormulaCard title="Goodness of fit" tex={["R^2 = 1 - \\frac{SS_{res}}{SS_{tot}} = \\frac{SS_{reg}}{SS_{tot}}", "\\bar{R}^2 = 1 - (1-R^2)\\frac{n-1}{n-k-1}"]} where={[["k", "number of predictors"]]} />
          <FormulaCard title="Inference on the slope" tex={["t = \\frac{\\hat{\\beta}_1}{SE(\\hat{\\beta}_1)}, \\quad SE(\\hat{\\beta}_1) = \\frac{s_{res}}{\\sqrt{S_{xx}}}", "F = \\frac{SS_{reg}/k}{SS_{res}/(n-k-1)}"]} where={[["H_0", "β₁ = 0 (no linear relationship)"]]} />
        </div>
        <Tabs defaultValue="DEWP">
          <TabsList className="h-auto flex-wrap">{Object.keys(d.simple).map((k) => <TabsTrigger key={k} value={k}>{k}</TabsTrigger>)}</TabsList>
          {Object.entries(d.simple).map(([k, sm]) => (
            <TabsContent key={k} value={k}>
              <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
                <ChartCard title={`PM2.5 = ${fmt(sm.intercept, 2)} ${sm.slope >= 0 ? "+" : "−"} ${fmt(Math.abs(sm.slope), 3)} × ${k}`} description={`500 sampled hours; red line = least-squares fit with its 95% confidence band (the band is narrow because n = ${fmtInt(sm.n)}).`}>
                  <ScatterPlot points={sm.points} line={sm.line.map((p) => ({ x: p.x, y: p.y }))} band={sm.line.map((p) => ({ x: p.x, lo: p.lo, hi: p.hi }))} xLabel={sm.label} yLabel="PM2.5 (µg/m³)" height={320} size={16} opacity={0.4} />
                </ChartCard>
                <ChartCard title="Estimates" right={<Decision p={sm.slope_p} rejectText="slope ≠ 0" failText="slope = 0" />}>
                  <KV cols={1} items={[["n", fmtInt(sm.n)], ["Slope β₁", fmt(sm.slope, 4)], ["SE(β₁)", fmt(sm.slope_se, 4)], ["t", fmt(sm.slope_t, 2)], ["p", fmtP(sm.slope_p)], ["95% CI for β₁", `[${fmt(sm.slope_ci[0], 4)}, ${fmt(sm.slope_ci[1], 4)}]`], ["Intercept β₀", fmt(sm.intercept, 3)], ["r", fmt(sm.r, 4)], ["R²", fmt(sm.r2, 4)], ["F", fmt(sm.F, 1)], ["Residual SE", fmt(sm.resid_se, 2)], ["MAE / RMSE", `${fmt(sm.mae, 1)} / ${fmt(sm.rmse, 1)}`], ["MAPE", `${fmt(sm.mape, 1)}%`]]} />
                  <div className="mt-3 rounded-md border bg-muted/30 p-2 text-xs">
                    <Tex>{`\\hat\\beta_1 = \\frac{S_{xy}}{S_{xx}} = \\frac{${fmt(sm.sxy, 0)}}{${fmt(sm.sxx, 0)}} = ${fmt(sm.slope, 4)}`}</Tex>
                  </div>
                </ChartCard>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <Note tone="info" title="Interpretation">
          Each extra degree of dew point is associated with about {fmt(d.simple.DEWP.slope, 2)} µg/m³ more PM2.5; each extra unit of cumulated wind speed with {fmt(Math.abs(d.simple.Iws.slope), 2)} µg/m³ less. All slopes are highly significant because n is huge, but no single variable explains more than {fmt(100 * Math.max(...Object.values(d.simple).map((x) => x.r2)), 0)}% of the variance: a single weather variable is a poor predictor on its own.
        </Note>
      </Section>

      <Section title="Multiple linear regression" subtitle={`Three nested models on all ${fmtInt(d.n)} hours. Model A uses the six weather variables; Model B adds wind-direction dummies (reference = ${d.reference_wind}); Model C fits log(1+PM2.5) to handle the skew.`}>
        <FormulaCard title="Model B" tex={["\\text{PM}_{2.5} = \\beta_0 + \\beta_1\\,\\text{DEWP} + \\beta_2\\,\\text{TEMP} + \\beta_3\\,\\text{PRES} + \\beta_4\\,\\text{Iws} + \\beta_5\\,\\text{Ir} + \\beta_6\\,\\text{Is} + \\gamma_{NE} D_{NE} + \\gamma_{SE} D_{SE} + \\gamma_{cv} D_{cv} + \\varepsilon", "\\hat{\\boldsymbol\\beta} = (X^\\top X)^{-1}X^\\top y, \\qquad VIF_j = \\frac{1}{1-R_j^2}, \\qquad DW = \\frac{\\sum_t (e_t-e_{t-1})^2}{\\sum_t e_t^2}"]} where={[["D_{\\cdot}", "0/1 dummy for wind direction; γ = difference from NW"], ["R_j^2", "R² of predictor j regressed on the others"]]} />
        <Tabs defaultValue="full">
          <TabsList className="h-auto flex-wrap"><TabsTrigger value="weather">Model A: weather</TabsTrigger><TabsTrigger value="full">Model B: + wind</TabsTrigger><TabsTrigger value="log">Model C: log target</TabsTrigger></TabsList>
          {(["weather", "full", "log"] as const).map((k) => (
            <TabsContent key={k} value={k}><ModelBlock m={d.models[k]} /></TabsContent>
          ))}
        </Tabs>
      </Section>

      <Section title="Partial effects" subtitle="Predicted PM2.5 from Model B as one predictor varies and the others stay at their means (wind = NW).">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(d.partial).map(([k, pts]) => (
            <ChartCard key={k} title={k}>
              <LineSeries data={pts} xKey="x" series={[{ key: "y", label: "Predicted PM2.5", color: "#2563eb" }]} height={180} xFormat="int" xTicks={5} />
            </ChartCard>
          ))}
        </div>
      </Section>

      <Section title="Model comparison and chronological hold-out" subtitle="Train on 2010-2013, test on 2014. Train and test R² are close, so the models are not overfitting; they are simply limited by what weather can explain.">
        <DataTable
          rows={d.holdout}
          columns={[
            { key: "model", header: "Model", className: "font-medium" },
            { key: "n_train", header: "Train n", align: "right", render: (r) => fmtInt(r.n_train) },
            { key: "n_test", header: "Test n", align: "right", render: (r) => fmtInt(r.n_test) },
            { key: "tr_r2", header: "Train R²", align: "right", render: (r) => fmt(r.train.r2, 3) },
            { key: "te_r2", header: "Test R²", align: "right", render: (r) => <span className="font-semibold">{fmt(r.test.r2, 3)}</span> },
            { key: "te_mae", header: "Test MAE", align: "right", render: (r) => fmt(r.test.mae, 1) },
            { key: "te_rmse", header: "Test RMSE", align: "right", render: (r) => fmt(r.test.rmse, 1) },
            { key: "te_mape", header: "Test MAPE %", align: "right", render: (r) => fmt(r.test.mape, 1) },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Nested-model F-test: is Model B better than Model A?" right={<Decision p={d.nested.p} rejectText="B is better" failText="no improvement" />}>
            <KV cols={1} items={[["R² Model A", fmt(d.nested.r2_a, 4)], ["R² Model B", fmt(d.nested.r2_b, 4)], ["Extra parameters", `${d.nested.df_diff}`], ["F", fmt(d.nested.F, 2)], ["p", fmtP(d.nested.p)]]} />
            <div className="mt-2 rounded-md border bg-muted/30 p-2 text-xs"><Tex>{"F = \\frac{(SS_{res,A}-SS_{res,B})/q}{SS_{res,B}/(n-k_B-1)}"}</Tex></div>
          </ChartCard>
          <ChartCard title="Standardised coefficients, Model B" description="Which predictor matters most per standard deviation? Dew point (positive) and wind speed (negative) dominate.">
            <CategoryBars data={full.coefficients.filter((c) => c.term !== "const").map((c) => ({ term: c.label, beta: c.beta_std ?? 0 }))} xKey="term" yKey="beta" yLabel="β (per SD)" height={240} horizontal fallback="#7c3aed" />
          </ChartCard>
        </div>
        <Note tone="warn" title="What the diagnostics say">
          Durbin-Watson ≈ {fmt(full.durbin_watson, 2)} is far below 2: consecutive hours have correlated residuals, so the OLS standard errors (and the tiny p-values) are over-confident. Residuals are heteroscedastic and right-skewed; the log model (C) fixes most of the skew (JB skew {fmt(d.models.log.jarque_bera.skew, 2)} vs {fmt(full.jarque_bera.skew, 2)}) at the price of a slightly lower R² on the original scale. These are exactly the problems the time-series module is built to handle.
        </Note>
      </Section>
    </PageShell>
  );
}
