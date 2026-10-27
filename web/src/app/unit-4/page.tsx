import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, KV, Note } from "@/components/blocks";
import { ClassCheck, FormulaBlock, HypothesisTest, Interpretation, Result, SubSection, UnitSection, What, Worked } from "@/components/syllabus";
import { Tex } from "@/components/formula";
import { ScatterPlot } from "@/components/charts/scatter";
import { Histogram } from "@/components/charts/series";
import { fmt, fmtInt } from "@/lib/format";

/* ------------------------------------------------------------------ types for unit4.json */
type Measures = { n: number; mae: number; mse: number; rmse: number; r2: number; mape: number; sse: number; sst: number; sum_abs_e: number; sum_ape: number };
type SimpleSums = { n: number; sum_x: number; sum_y: number; sum_x2: number; sum_xy: number; x_mean: number; y_mean: number; b_numerator: number; b_denominator: number; b: number; a: number };
type NormalEq = { eq1: { lhs: number; n: number; sum_x: number }; eq2: { lhs: number; sum_x: number; sum_x2: number }; multiplier: number; eq3: { lhs: number; sum_x: number; b_coef: number }; diff_lhs: number; diff_b_coef: number; b: number; a: number };
type Decision = "reject" | "accept";
type Coef = { name: string; b: number; se: number; t: number; p: number; decision: Decision };
type Design = { label: string; predictors: string[]; k: number; n: number; coef: Coef[]; r2: number; adj_r2: number; f_calc: number; f_tab: number; df_error: number; t_tab: number; train: Measures; test: Measures };
type TTest = { b: number; sum_x2: number; denominator: number; se: number; t: number; p: number; decision: Decision };
type Pt = { x: number; y: number; date?: string };
type Sums9 = { sum_y: number; sum_x1: number; sum_x2: number; sum_y2: number; sum_x1sq: number; sum_x2sq: number; sum_x1x2: number; sum_x1y: number; sum_x2y: number };
type Dev = { x1x1: number; x2x2: number; x1y: number; x2y: number; x1x2: number; yy: number };

type Unit4 = {
  meta: { n_train: number; n_test: number; train_start: string; train_end: string; test_start: string; test_end: string; alpha: number; seed: number };
  s41: {
    x_label: string; y_label: string;
    sample: { rows: Array<{ date: string; x: number; y: number; x2: number; xy: number }>; sums: SimpleSums; normal_equations: NormalEq };
    full: SimpleSums;
    scatter: Pt[]; line: Pt[];
    predict: { x: number; yhat: number };
    two_lines: { byx: number; bxy: number; product: number; r_unit2: number; r_unit2_sq: number; degree: string };
    x_min: number; x_max: number;
  };
  s42: {
    sample_residuals: Array<{ date: string; x: number; y: number; yhat: number; e: number; abs_e: number; e2: number; ape: number }>;
    sample_measures: Measures; train: Measures; test: Measures; test_min_y: { date: string; y: number };
  };
  s43: {
    n: number; k: number; sums: Sums9; dev: Dev; means: { y: number; x1: number; x2: number };
    b1_numerator: number; b2_numerator: number; denominator: number; b1: number; b2: number; b0: number;
    explained_ss: number; total_ss: number; sse: number; r2: number; r2_alt: number; adj_r2: number; r12: number;
    x1_label: string; x2_label: string; predict: { x1: number; x2: number; yhat: number };
    train: Measures; test: Measures; crosscheck: { b0: number; b1: number; b2: number; r2: number };
  };
  s44: { simple_temp: { a: number; b: number }; simple_hum: { a: number; b: number }; partial: { b1: number; b2: number }; r12: number; r12_numerator: number; r12_x1x1: number; r12_x2x2: number; r_hum_cnt: number };
  s45: {
    f: { df_regression: number; df_error: number; df_total: number; f_calc: number; f_tab: number; decision: Decision; p: number };
    anova: Array<{ source: string; df: number; ss: number; ms: number | null; f: number | null }>;
    designs: Design[]; best_label: string; yr_coef: number; train_mean_2011: number; train_mean_2012: number;
  };
  s46: {
    two_predictor: { df: number; sse: number; mse: number; root_mse: number; r12: number; r12_sq: number; one_minus_r12_sq: number; t_tab: number; b1: TTest; b2: TTest };
    four_predictor: Design;
  };
  residuals: {
    sd: number; spread: Array<{ band: string; fitted_from: number; fitted_to: number; mean_e: number; sd_e: number; n: number }>;
    lag1_r: number; within_1sd_pct: number; within_2sd_pct: number; min_e: number; max_e: number; r12: number;
    resid_vs_fitted: Pt[]; pred_vs_actual: Pt[]; hist: Array<{ x0: number; x1: number; mid: number; count: number; density: number; normal: number }>;
  };
  class_check: {
    rows: Array<{ y: number; x1: number; x2: number }>;
    ours: { b1: number; b2: number; b0: number; pred_74_14: number; r2: number; f: number; f_tab: number; se_b1: number; t1: number; se_b2: number; t2: number; t_tab: number; r12: number; dev: Dev; sums: Sums9 };
    slide: { b1: number; b2: number; b0: number; pred_74_14: number; r2: number; f: number; f_tab: number; se_b1: number; t1: number; se_b2: number; t2: number; t_tab: number; r12: number; se_b2_printed: number; t2_printed: number };
  };
  headline: {
    simple: { a: number; b: number; r2: number; test_mae: number; test_mape: number };
    two_predictor: { b0: number; b1: number; b2: number; r2: number; adj_r2: number; f: number; f_tab: number; t1: number; t2: number; t_tab: number; test_mae: number; test_mape: number };
    best_design: { label: string; r2: number; adj_r2: number; test_mae: number; test_mape: number };
  };
};

/* ------------------------------------------------------------------ small helpers */
const n0 = (x: number | null | undefined) => fmt(x, 0);
const n2 = (x: number | null | undefined) => fmt(x, 2);
const n4 = (x: number | null | undefined) => fmt(x, 4);
const sign = (x: number) => (x < 0 ? "−" : "+");
const abs = (x: number) => Math.abs(x);
const PRED_LABEL: Record<string, string> = { temp_c: "Temperature (°C)", hum_pct: "Humidity (%)", wind_kmh: "Wind speed (km/h)", yr: "Year (0 = 2011, 1 = 2012)", "b₀ (intercept)": "b₀ (intercept)" };

/** One line of a sums table: label, symbol, value. */
type SumRow = { label: string; sym: string; value: string };
const sumCols = [
  { key: "label", header: "Quantity" },
  { key: "sym", header: "Symbol", render: (row: SumRow) => <Tex>{row.sym}</Tex> },
  { key: "value", header: "Value", align: "right" as const },
];

export default async function Unit4Page() {
  const d = await loadData<Unit4>("unit4");
  const { meta, s41, s42, s43, s44, s45, s46, residuals: res, class_check: cc, headline: h } = d;
  const sm = s41.sample.sums;
  const ne = s41.sample.normal_equations;
  const f = s41.full;
  const tt = s46.two_predictor;
  const designC = s45.designs[2];
  const measureRows = [
    { key: "mae", name: "MAE", unit: "rentals", tex: String.raw`\text{MAE} = \frac{1}{n}\sum|Y - \hat Y|`, def: "the average absolute difference between actual and predicted values, in the same unit as Y" },
    { key: "mse", name: "MSE", unit: "rentals²", tex: String.raw`\text{MSE} = \frac{1}{n}\sum(Y - \hat Y)^2`, def: "the average of squared differences; squaring penalises larger mistakes more strongly" },
    { key: "rmse", name: "RMSE", unit: "rentals", tex: String.raw`\text{RMSE} = \sqrt{\frac{1}{n}\sum(Y - \hat Y)^2}`, def: "the square root of MSE, back in the original unit of Y" },
    { key: "r2", name: "R²", unit: "", tex: String.raw`R^2 = 1 - \frac{\sum(Y - \hat Y)^2}{\sum(Y - \bar Y)^2}`, def: "the proportion of variance in Y explained by the model" },
    { key: "mape", name: "MAPE", unit: "%", tex: String.raw`\text{MAPE} = \frac{100}{n}\sum\left|\frac{Y - \hat Y}{Y}\right|`, def: "the error as a percentage of the actual values; unreliable when actual values are close to zero" },
  ] as const;

  return (
    <PageShell
      module="4"
      title="Regression analysis"
      description={`Regression measures the nature and extent of the relationship between two or more variables so that we can make predictions. Here Y is the number of bike rentals per day and the predictors are the weather. Every model is fitted on the ${fmtInt(meta.n_train)} training days (${meta.train_start} to ${meta.train_end}) and reported in-sample, as in class; the MAE and MAPE on the ${meta.n_test} test days (${meta.test_start} to ${meta.test_end}) link back to the hold-out defined in Unit 1.`}
      concepts={["Y = a + bX", "Intercept and slope", "Normal equations", "Least squares", "R², MAE, MAPE", "Multiple regression", "Partial coefficients", "F-test", "t-test", "Residual analysis"]}
    >
      <Note tone="info" title="Notation used on this page">
        Simple regression: <Tex>{String.raw`Y = a + bX`}</Tex> with <Tex>a</Tex> = intercept and <Tex>b</Tex> = slope. Multiple regression: <Tex>{String.raw`\hat Y = b_0 + b_1 X_1 + b_2 X_2`}</Tex> for the fitted
        equation. Hypotheses are written with <Tex>\beta</Tex> (the population coefficient) and tested with the estimate <Tex>b</Tex>. Upper-case <Tex>X, Y</Tex> are raw values; lower-case{" "}
        <Tex>x, y</Tex> are deviations from the mean. All sums are over the <Tex>{`n = ${meta.n_train}`}</Tex> training days.
      </Note>

      {/* ============================================================ 4.1 */}
      <UnitSection number="4.1" title="Mathematical and statistical equation — meaning of intercept and slope" intro="Simple linear regression models the relationship between two variables by fitting a straight line to the observed data. X (independent) is used to predict; Y (dependent) is what we try to predict.">
        <What>
          The regression line is the best-fitted straight line through the points. It shows the calculated value of Y for each possible value of X. The intercept <Tex>a</Tex> is the value of Y when X = 0, where the line crosses the Y-axis. The slope <Tex>b</Tex> tells us how much Y changes when X increases by 1 unit. Here Y = {s41.y_label.toLowerCase()} (cnt) and X = {s41.x_label.toLowerCase()} (temp_c).
        </What>
        <FormulaBlock
          tex={[
            String.raw`Y = a + bX`,
            String.raw`\text{Normal equations:}\quad \sum Y = na + b\sum X, \qquad \sum XY = a\sum X + b\sum X^2`,
            String.raw`b = \frac{n\sum XY - \sum X\sum Y}{n\sum X^2 - (\sum X)^2}, \qquad a = \frac{\sum Y - b\sum X}{n}`,
          ]}
          where={[["a", "intercept (predicted Y when X = 0)"], ["b", "slope (change in predicted Y per 1-unit change in X)"], ["n", "number of data pairs"], [String.raw`\sum X, \sum Y, \sum X^2, \sum XY`, "sums from the data table"]]}
          note="The least squares method gives the two normal equations; solving them together gives a and b."
        />
        <Worked title={`Step 1 — the mechanics on 10 training days (sampled with seed ${meta.seed}), laid out exactly like the class table.`}>
          <DataTable
            columns={[
              { key: "date", header: "Day" },
              { key: "x", header: "X (°C)", align: "right", render: (r) => n2(r.x) },
              { key: "y", header: "Y (rentals)", align: "right", render: (r) => fmtInt(r.y) },
              { key: "x2", header: "X²", align: "right", render: (r) => n2(r.x2) },
              { key: "xy", header: "XY", align: "right", render: (r) => n2(r.xy) },
            ]}
            rows={[
              ...s41.sample.rows,
              { date: "Σ", x: sm.sum_x, y: sm.sum_y, x2: sm.sum_x2, xy: sm.sum_xy },
            ]}
          />
          <div className="space-y-1 text-sm">
            <p>n = {sm.n}, ΣX = {n2(sm.sum_x)}, ΣY = {fmtInt(sm.sum_y)}, ΣX² = {n2(sm.sum_x2)}, ΣXY = {n2(sm.sum_xy)}.</p>
            <p>Normal equation (i): {fmtInt(ne.eq1.lhs)} = {ne.eq1.n}a + {n2(ne.eq1.sum_x)}b.</p>
            <p>Normal equation (ii): {n2(ne.eq2.lhs)} = {n2(ne.eq2.sum_x)}a + {n2(ne.eq2.sum_x2)}b.</p>
            <p>Multiply (i) by ΣX/n = {n4(ne.multiplier)} so the a-terms match → (iii): {n2(ne.eq3.lhs)} = {n2(ne.eq3.sum_x)}a + {n2(ne.eq3.b_coef)}b.</p>
            <p>(ii) − (iii): {n2(ne.diff_lhs)} = {n2(ne.diff_b_coef)}b → <strong>b = {n4(ne.b)}</strong>. Substitute in (i): a = ({fmtInt(sm.sum_y)} − {n4(ne.b)} × {n2(sm.sum_x)}) / {sm.n} → <strong>a = {n4(ne.a)}</strong>.</p>
            <p>Check with the Σ-form: b = [{sm.n} × {n2(sm.sum_xy)} − {n2(sm.sum_x)} × {fmtInt(sm.sum_y)}] / [{sm.n} × {n2(sm.sum_x2)} − ({n2(sm.sum_x)})²] = {n2(sm.b_numerator)} / {n2(sm.b_denominator)} = {n4(sm.b)}. On 10 days the line is Ŷ = {n2(sm.a)} + {n2(sm.b)}X.</p>
          </div>
        </Worked>
        <Worked title={`Step 2 — the same formulas on all ${fmtInt(f.n)} training days (only the sums are shown; the table has ${fmtInt(f.n)} rows).`}>
          <DataTable<SumRow>
            columns={sumCols}
            rows={[
              { label: "Number of days", sym: "n", value: fmtInt(f.n) },
              { label: "Sum of temperatures", sym: String.raw`\sum X`, value: n2(f.sum_x) },
              { label: "Sum of rentals", sym: String.raw`\sum Y`, value: fmtInt(f.sum_y) },
              { label: "Sum of squared temperatures", sym: String.raw`\sum X^2`, value: n2(f.sum_x2) },
              { label: "Sum of products", sym: String.raw`\sum XY`, value: n2(f.sum_xy) },
              { label: "Numerator of b", sym: String.raw`n\sum XY - \sum X\sum Y`, value: n2(f.b_numerator) },
              { label: "Denominator of b", sym: String.raw`n\sum X^2 - (\sum X)^2`, value: n2(f.b_denominator) },
              { label: "Slope", sym: "b", value: n4(f.b) },
              { label: "Intercept", sym: String.raw`a = (\sum Y - b\sum X)/n`, value: n4(f.a) },
            ]}
          />
          <ChartCard title="Daily rentals vs temperature, training days, with the fitted line" description={`Ŷ = ${n2(f.a)} + ${n2(f.b)} X. Each point is one training day; the vertical gap from a point to the line is its error of prediction.`}>
            <ScatterPlot points={s41.scatter} line={s41.line} xLabel={s41.x_label} yLabel={s41.y_label} height={300} size={18} opacity={0.45} />
          </ChartCard>
        </Worked>
        <Result items={[{ label: "Intercept a", value: n2(f.a), hint: "rentals" }, { label: "Slope b", value: n2(f.b), hint: "rentals per °C" }, { label: "Regression equation", value: `Ŷ = ${n2(f.a)} + ${n2(f.b)} X` }]} />
        <Interpretation>
          <p>Intercept: when X = 0 °C, the predicted value of Y is {n0(f.a)} rentals. The coldest training day is {n2(s41.x_min)} °C, so 0 °C sits at the cold edge of the data; the intercept is where the line starts, not a day we expect to see often.</p>
          <p>Slope: for every 1 °C increase in temperature, predicted rentals increase by {n2(f.b)} units.</p>
          <p>Prediction: when X = {s41.predict.x} °C, the model predicts Y = {n2(f.a)} + {n2(f.b)} × {s41.predict.x} = {n0(s41.predict.yhat)} rentals.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Two regression lines: b<sub>yx</sub> = {n4(s41.two_lines.byx)} predicts Y from X; b<sub>xy</sub> = {fmt(s41.two_lines.bxy, 6)} predicts X from Y. Their product b<sub>xy</sub> × b<sub>yx</sub> = {n4(s41.two_lines.product)} = r², and the Unit-2 r (actual-mean method, training days) is {n4(s41.two_lines.r_unit2)}, whose square is {n4(s41.two_lines.r_unit2_sq)} — the same number. r is positive, so both coefficients are positive ({s41.two_lines.degree} correlation).
          </p>
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 4.2 */}
      <UnitSection number="4.2" title="Error term — measures for model fit: R², MAE, MAPE" intro="Actual Y values and predicted Y values are often different. This difference is called the residual (error). The least squares method finds the line that minimises the sum of squared errors.">
        <What>
          The error of prediction is the difference between the value of a point and its predicted value on the line: <Tex>{String.raw`e = Y - \hat Y`}</Tex> (actual − predicted). We square the errors so that errors above and below the line do not cancel out. The five measures on the slide summarise how far the predictions are from the actual values.
        </What>
        <FormulaBlock
          tex={[String.raw`e = Y - \hat Y, \qquad \text{Objective: minimise } \sum (Y - a - bX)^2`, ...measureRows.map((m) => m.tex)]}
          where={measureRows.map((m) => [`\\text{${m.name}}`, m.def])}
        />
        <Worked title="The residual table for the same 10 sampled days, using the full-training-set line Ŷ = a + bX.">
          <DataTable
            columns={[
              { key: "date", header: "Day" },
              { key: "x", header: "X (°C)", align: "right", render: (r) => n2(r.x) },
              { key: "y", header: "Y", align: "right", render: (r) => fmtInt(r.y) },
              { key: "yhat", header: "Ŷ", align: "right", render: (r) => fmt(r.yhat, 1) },
              { key: "e", header: "e = Y − Ŷ", align: "right", render: (r) => fmt(r.e, 1) },
              { key: "abs_e", header: "|e|", align: "right", render: (r) => fmt(r.abs_e, 1) },
              { key: "e2", header: "e²", align: "right", render: (r) => n0(r.e2) },
              { key: "ape", header: "|e| / Y", align: "right", render: (r) => n4(r.ape) },
            ]}
            rows={[
              ...s42.sample_residuals,
              { date: "Σ", x: NaN, y: NaN, yhat: NaN, e: NaN, abs_e: s42.sample_measures.sum_abs_e, e2: s42.sample_measures.sse, ape: s42.sample_measures.sum_ape },
            ]}
          />
          <p className="text-sm">
            On these 10 days: MAE = {n2(s42.sample_measures.sum_abs_e)} / 10 = {n2(s42.sample_measures.mae)}; MSE = {n0(s42.sample_measures.sse)} / 10 = {n0(s42.sample_measures.mse)}; RMSE = √MSE = {n2(s42.sample_measures.rmse)}; MAPE = 100 × {n4(s42.sample_measures.sum_ape)} / 10 = {n2(s42.sample_measures.mape)} %; R² = 1 − {n0(s42.sample_measures.sse)} / {n0(s42.sample_measures.sst)} = {n4(s42.sample_measures.r2)}.
          </p>
          <p className="text-sm text-muted-foreground">The same five measures on all {fmtInt(meta.n_train)} training days (in-sample, as the teacher reports them) and on the {meta.n_test} test days the model never saw (the Unit-1 hold-out):</p>
          <DataTable
            columns={[
              { key: "name", header: "Measure" },
              { key: "train", header: `In-sample (n = ${meta.n_train})`, align: "right" },
              { key: "test", header: `Test period (n = ${meta.n_test})`, align: "right" },
              { key: "unit", header: "Unit" },
            ]}
            rows={measureRows.map((m) => ({ name: m.name, train: m.key === "r2" ? n4(s42.train[m.key]) : n2(s42.train[m.key]), test: m.key === "r2" ? n4(s42.test[m.key]) : n2(s42.test[m.key]), unit: m.unit }))}
          />
        </Worked>
        <Result items={[{ label: "R² (in-sample)", value: n4(s42.train.r2) }, { label: "MAE (in-sample)", value: n0(s42.train.mae), hint: "rentals" }, { label: "MAPE (in-sample)", value: `${n2(s42.train.mape)} %` }, { label: "MAE (test)", value: n0(s42.test.mae), hint: "rentals" }, { label: "MAPE (test)", value: `${n2(s42.test.mape)} %` }]} />
        <Interpretation>
          <p>R² = {n4(s42.train.r2)} means that {fmt(100 * s42.train.r2, 1)} % of the variation in daily rentals is explained by temperature. In simple words, the model is {fmt(100 * s42.train.r2, 0)} % good — temperature alone leaves most of the variation unexplained.</p>
          <p>On the training days the model is off by {n0(s42.train.mae)} rentals on an average day (MAE). On the test days the error grows to {n0(s42.test.mae)} rentals, because the second half of 2012 had more riders than the line learned from 2011–mid 2012 predicts.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            MAPE becomes unreliable when actual values are close to zero: the test period contains {s42.test_min_y.date} with only {s42.test_min_y.y} rentals (Hurricane Sandy), and that one day pushes the test MAPE to {n2(s42.test.mape)} %. The test R² is below 0 because R² compares the model with the mean of the period it is scored on; on the test period, whose mean is far above the training mean, the line does worse than that period&apos;s own mean. R² is an in-sample measure of fit; MAE is the fairer out-of-sample yardstick.
          </p>
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 4.3 */}
      <UnitSection number="4.3" title="Multiple linear regression" intro="When the study variable depends on more than one explanatory variable we use multiple linear regression. We can use it to find out which factor has the highest influence on the predicted output.">
        <What>
          <Tex>{String.raw`Y = \beta_0 + \beta_1 X_1 + \beta_2 X_2 + \varepsilon`}</Tex>: each independent variable <Tex>X_i</Tex> contributes an effect <Tex>\beta_i</Tex> to the predicted value of Y, combined with an intercept <Tex>\beta_0</Tex> and a random error <Tex>\varepsilon</Tex> (what the model cannot explain). Here X₁ = {s43.x1_label.toLowerCase()} and X₂ = {s43.x2_label.toLowerCase()}, two predictors so the class formulas apply directly.
        </What>
        <FormulaBlock
          tex={[
            String.raw`\hat Y = b_0 + b_1 X_1 + b_2 X_2`,
            String.raw`b_1 = \frac{(\sum x_2^2)(\sum x_1 y) - (\sum x_1 x_2)(\sum x_2 y)}{(\sum x_1^2)(\sum x_2^2) - (\sum x_1 x_2)^2}, \qquad b_2 = \frac{(\sum x_1^2)(\sum x_2 y) - (\sum x_1 x_2)(\sum x_1 y)}{(\sum x_1^2)(\sum x_2^2) - (\sum x_1 x_2)^2}`,
            String.raw`b_0 = \bar Y - b_1 \bar X_1 - b_2 \bar X_2`,
            String.raw`\sum x_1^2 = \sum X_1^2 - \tfrac{(\sum X_1)^2}{n},\;\; \sum x_2^2 = \sum X_2^2 - \tfrac{(\sum X_2)^2}{n},\;\; \sum x_1 y = \sum X_1 Y - \tfrac{\sum X_1 \sum Y}{n},\;\; \sum x_2 y = \sum X_2 Y - \tfrac{\sum X_2 \sum Y}{n},\;\; \sum x_1 x_2 = \sum X_1 X_2 - \tfrac{\sum X_1 \sum X_2}{n}`,
            String.raw`R^2 = \frac{R^2\sum y^2}{\sum y^2}, \quad R^2\sum y^2 = b_1 \sum x_1 y + b_2 \sum x_2 y, \quad \sum y^2 = \sum Y^2 - \tfrac{(\sum Y)^2}{n}; \qquad \text{Adjusted } R^2 = 1 - (1 - R^2)\frac{n-1}{n-k-1}`,
          ]}
          where={[[String.raw`x_1, x_2, y`, "deviation scores (raw value − mean)"], [String.raw`R^2\sum y^2`, "the explained sum of squares (the slide's name for it)"], ["k", "number of predictors (2)"]]}
        />
        <Worked title={`Step 1a — the nine raw sums over the ${fmtInt(s43.n)} training days.`}>
          <DataTable<SumRow>
            columns={sumCols}
            rows={[
              { label: "Sum of Y", sym: String.raw`\sum Y`, value: fmtInt(s43.sums.sum_y) },
              { label: "Sum of X₁ (temperature)", sym: String.raw`\sum X_1`, value: n2(s43.sums.sum_x1) },
              { label: "Sum of X₂ (humidity)", sym: String.raw`\sum X_2`, value: n2(s43.sums.sum_x2) },
              { label: "Sum of Y²", sym: String.raw`\sum Y^2`, value: fmtInt(s43.sums.sum_y2) },
              { label: "Sum of X₁²", sym: String.raw`\sum X_1^2`, value: n2(s43.sums.sum_x1sq) },
              { label: "Sum of X₂²", sym: String.raw`\sum X_2^2`, value: n2(s43.sums.sum_x2sq) },
              { label: "Sum of X₁X₂", sym: String.raw`\sum X_1 X_2`, value: n2(s43.sums.sum_x1x2) },
              { label: "Sum of X₁Y", sym: String.raw`\sum X_1 Y`, value: n2(s43.sums.sum_x1y) },
              { label: "Sum of X₂Y", sym: String.raw`\sum X_2 Y`, value: n2(s43.sums.sum_x2y) },
            ]}
          />
        </Worked>
        <Worked title="Step 1b — the regression sums (deviation scores) from the raw sums.">
          <DataTable<SumRow>
            columns={sumCols}
            rows={[
              { label: `ΣX₁² − (ΣX₁)²/n = ${n2(s43.sums.sum_x1sq)} − (${n2(s43.sums.sum_x1)})²/${s43.n}`, sym: String.raw`\sum x_1^2`, value: n2(s43.dev.x1x1) },
              { label: `ΣX₂² − (ΣX₂)²/n = ${n2(s43.sums.sum_x2sq)} − (${n2(s43.sums.sum_x2)})²/${s43.n}`, sym: String.raw`\sum x_2^2`, value: n2(s43.dev.x2x2) },
              { label: `ΣX₁Y − ΣX₁ΣY/n = ${n2(s43.sums.sum_x1y)} − ${n2(s43.sums.sum_x1)} × ${fmtInt(s43.sums.sum_y)}/${s43.n}`, sym: String.raw`\sum x_1 y`, value: n2(s43.dev.x1y) },
              { label: `ΣX₂Y − ΣX₂ΣY/n = ${n2(s43.sums.sum_x2y)} − ${n2(s43.sums.sum_x2)} × ${fmtInt(s43.sums.sum_y)}/${s43.n}`, sym: String.raw`\sum x_2 y`, value: n2(s43.dev.x2y) },
              { label: `ΣX₁X₂ − ΣX₁ΣX₂/n = ${n2(s43.sums.sum_x1x2)} − ${n2(s43.sums.sum_x1)} × ${n2(s43.sums.sum_x2)}/${s43.n}`, sym: String.raw`\sum x_1 x_2`, value: n2(s43.dev.x1x2) },
              { label: `ΣY² − (ΣY)²/n = ${fmtInt(s43.sums.sum_y2)} − (${fmtInt(s43.sums.sum_y)})²/${s43.n}`, sym: String.raw`\sum y^2`, value: n2(s43.dev.yy) },
            ]}
          />
        </Worked>
        <Worked title="Step 1c — the coefficients, Step 2 — a prediction, Step 3 — goodness of fit.">
          <div className="space-y-1 text-sm">
            <p>Denominator (shared): (Σx₁²)(Σx₂²) − (Σx₁x₂)² = {n2(s43.dev.x1x1)} × {n2(s43.dev.x2x2)} − ({n2(s43.dev.x1x2)})² = {n2(s43.denominator)}.</p>
            <p>b₁ = [{n2(s43.dev.x2x2)} × {n2(s43.dev.x1y)} − {n2(s43.dev.x1x2)} × ({n2(s43.dev.x2y)})] / {n2(s43.denominator)} = {n2(s43.b1_numerator)} / {n2(s43.denominator)} = <strong>{n4(s43.b1)}</strong>.</p>
            <p>b₂ = [{n2(s43.dev.x1x1)} × ({n2(s43.dev.x2y)}) − {n2(s43.dev.x1x2)} × {n2(s43.dev.x1y)}] / {n2(s43.denominator)} = {n2(s43.b2_numerator)} / {n2(s43.denominator)} = <strong>{n4(s43.b2)}</strong>.</p>
            <p>Means: Ȳ = {fmtInt(s43.sums.sum_y)}/{s43.n} = {n2(s43.means.y)}; X̄₁ = {n2(s43.means.x1)}; X̄₂ = {n2(s43.means.x2)}. b₀ = {n2(s43.means.y)} − {n4(s43.b1)} × {n2(s43.means.x1)} − ({n4(s43.b2)}) × {n2(s43.means.x2)} = <strong>{n4(s43.b0)}</strong>.</p>
            <p>Model: Ŷ = {n2(s43.b0)} + {n2(s43.b1)} X₁ {sign(s43.b2)} {n2(abs(s43.b2))} X₂.</p>
            <p>Estimate for unknown values: X₁ = {s43.predict.x1} °C, X₂ = {s43.predict.x2} % → Ŷ = {n2(s43.b0)} + {n2(s43.b1)} × {s43.predict.x1} {sign(s43.b2)} {n2(abs(s43.b2))} × {s43.predict.x2} ≈ <strong>{n0(s43.predict.yhat)}</strong> rentals.</p>
            <p>Goodness of fit: Σy² = {n2(s43.total_ss)}; explained SS = b₁Σx₁y + b₂Σx₂y = {n4(s43.b1)} × {n2(s43.dev.x1y)} + ({n4(s43.b2)}) × ({n2(s43.dev.x2y)}) = {n2(s43.explained_ss)}; R² = {n2(s43.explained_ss)} / {n2(s43.total_ss)} = <strong>{n4(s43.r2)}</strong>. By the 4.2 form, 1 − SSE/SST = 1 − {n2(s43.sse)} / {n2(s43.total_ss)} = {n4(s43.r2_alt)} — the same number.</p>
            <p>Adjusted R² = 1 − (1 − {n4(s43.r2)}) × ({s43.n} − 1)/({s43.n} − {s43.k} − 1) = <strong>{n4(s43.adj_r2)}</strong>.</p>
          </div>
          <DataTable
            columns={[
              { key: "name", header: "Measure" },
              { key: "train", header: `In-sample (n = ${meta.n_train})`, align: "right" },
              { key: "test", header: `Test period (n = ${meta.n_test})`, align: "right" },
            ]}
            rows={[
              { name: "MAE (rentals)", train: n0(s43.train.mae), test: n0(s43.test.mae) },
              { name: "MAPE (%)", train: n2(s43.train.mape), test: n2(s43.test.mape) },
            ]}
          />
        </Worked>
        <Result items={[{ label: "Fitted equation", value: `Ŷ = ${n2(s43.b0)} + ${n2(s43.b1)} X₁ ${sign(s43.b2)} ${n2(abs(s43.b2))} X₂` }, { label: "R²", value: n4(s43.r2) }, { label: "Adjusted R²", value: n4(s43.adj_r2) }, { label: "MAE (test)", value: n0(s43.test.mae), hint: "rentals" }]} />
        <Interpretation>
          <p>Holding humidity constant, each 1 °C increase in temperature raises predicted rentals by ≈ {n2(s43.b1)} units. Holding temperature constant, each 1 % increase in humidity lowers predicted rentals by ≈ {n2(abs(s43.b2))} units.</p>
          <p>About {fmt(100 * s43.r2, 1)} % of the variation in daily rentals is explained jointly by temperature and humidity — the model is {fmt(100 * s43.r2, 0)} % good, better than the {fmt(100 * s42.train.r2, 0)} % of temperature alone. Adjusted R² ({n4(s43.adj_r2)}) barely drops below R², so the second predictor earned its place.</p>
          <p className="mt-1 text-xs text-muted-foreground">Cross-check: statsmodels OLS on the same training days gives b₀ = {n4(s43.crosscheck.b0)}, b₁ = {n4(s43.crosscheck.b1)}, b₂ = {n4(s43.crosscheck.b2)}, R² = {n4(s43.crosscheck.r2)} — identical to the hand computation from the sums.</p>
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 4.4 */}
      <UnitSection number="4.4" title="Partial regression coefficients" intro="How much does each variable matter, with the others held fixed?">
        <What>
          Each partial regression coefficient <Tex>b_i</Tex> measures the change in Y for a one-unit increase in <Tex>X_i</Tex> while keeping all other predictors constant. This isolates the effect of each variable, removing the influence of the others. A simple slope and a partial slope can differ when the predictors are correlated, because alone a variable takes credit for the effect of the one it overlaps with.
        </What>
        <FormulaBlock
          tex={[String.raw`\text{Simple: } Y = a + bX_i \qquad\text{vs}\qquad \text{Partial: } \hat Y = b_0 + b_1 X_1 + b_2 X_2`, String.raw`r_{12} = \frac{\sum x_1 x_2}{\sqrt{(\sum x_1^2)(\sum x_2^2)}}`]}
          where={[["b", "slope when the predictor is used alone"], ["b_i", "partial coefficient: effect of X_i with the other predictor held constant"], ["r_{12}", "correlation between the two predictors (the overlap)"]]}
        />
        <Worked title="Side by side: each predictor used alone (simple regression, 4.1 formulas) and in the two-predictor model (4.3).">
          <DataTable
            columns={[
              { key: "pred", header: "Predictor" },
              { key: "simple", header: "Simple slope b (alone)", align: "right" },
              { key: "partial", header: "Partial coefficient (other held constant)", align: "right" },
              { key: "change", header: "Change", align: "right" },
            ]}
            rows={[
              { pred: "Temperature (°C)", simple: n2(s44.simple_temp.b), partial: n2(s44.partial.b1), change: `${sign(s44.partial.b1 - s44.simple_temp.b)}${n2(abs(s44.partial.b1 - s44.simple_temp.b))}` },
              { pred: "Humidity (%)", simple: n2(s44.simple_hum.b), partial: n2(s44.partial.b2), change: `${sign(s44.partial.b2 - s44.simple_hum.b)}${n2(abs(s44.partial.b2 - s44.simple_hum.b))}` },
            ]}
          />
          <p className="text-sm">
            Rentals on humidity alone: Ŷ = {n2(s44.simple_hum.a)} {sign(s44.simple_hum.b)} {n2(abs(s44.simple_hum.b))} X₂ (its Unit-2 correlation with rentals is only r = {n4(s44.r_hum_cnt)}). Correlation between the predictors: r₁₂ = {n2(s44.r12_numerator)} / √({n2(s44.r12_x1x1)} × {n2(s44.r12_x2x2)}) = <strong>{n4(s44.r12)}</strong>.
          </p>
        </Worked>
        <Result items={[{ label: "Humidity: simple slope", value: n2(s44.simple_hum.b), hint: "rentals per 1 %" }, { label: "Humidity: partial b₂", value: n2(s44.partial.b2), hint: "rentals per 1 %, temperature fixed" }, { label: "r₁₂ (temp, hum)", value: n4(s44.r12) }]} />
        <Interpretation>
          <p>Holding temperature constant, each 1 % rise in humidity changes predicted rentals by {n2(s44.partial.b2)} units. Holding humidity constant, each 1 °C rise in temperature changes predicted rentals by +{n2(s44.partial.b1)} units.</p>
          <p>Humidity&apos;s effect looks small on its own ({n2(s44.simple_hum.b)} per 1 %) but is clearly larger once temperature is held fixed ({n2(s44.partial.b2)}): warm days are also slightly more humid (r₁₂ = {n4(s44.r12)} &gt; 0), so used alone, humidity&apos;s negative effect is partly masked by the warmth that comes with it. The partial coefficient keeps only what humidity adds beyond temperature.</p>
          <p className="mt-1 text-xs text-muted-foreground">Two cautions from class: do not compare raw sizes across units ({n2(abs(s44.partial.b1))} per °C vs {n2(abs(s44.partial.b2))} per % does not mean temperature &quot;matters more&quot;); and a coefficient shows association in the data, not proof that warming a day causes the extra rentals.</p>
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 4.5 */}
      <UnitSection number="4.5" title="Testing the overall significance of the model: F-test first" intro="To test whether the entire model is statistically significant we use the F-test. It asks whether the predictors jointly explain variation in Y better than predicting with the sample mean alone.">
        <What>
          The total variation is split as SST = SSR + SSE: the regression sum of squares (explained by the model) plus the error sum of squares (unexplained). Each is divided by its degrees of freedom to give a mean square, and F = MSR / MSE. If H₀ is accepted by the F-test there is no need to test the individual b&apos;s — therefore one must use the F-test first.
        </What>
        <FormulaBlock
          tex={[
            String.raw`H_0:\ \beta_1 = \beta_2 = 0 \qquad H_a:\ \text{at least one } \beta_i \neq 0`,
            String.raw`\begin{array}{l|c|c|c|c} \text{Source} & \text{d.f.} & \text{SS} & \text{MS} & F \\\hline \text{Regression} & k & R^2\sum y^2 & R^2\sum y^2 / k & \text{MSR}/\text{MSE} \\ \text{Error} & n-k-1 & (1-R^2)\sum y^2 & (1-R^2)\sum y^2/(n-k-1) & \\ \text{Total} & n-1 & \sum y^2 & & \end{array}`,
            String.raw`F = \frac{\text{MSR}}{\text{MSE}} = \frac{(n-k-1)\,R^2}{k\,(1-R^2)}`,
          ]}
          where={[["k", "number of predictors"], ["n", "number of observations"], [String.raw`R^2\sum y^2`, "SSR, the explained sum of squares from 4.3"]]}
        />
        <Worked title="The regression ANOVA table for Ŷ = b₀ + b₁(temperature) + b₂(humidity).">
          <DataTable
            columns={[
              { key: "source", header: "Source of variation" },
              { key: "df", header: "d.f.", align: "right" },
              { key: "ss", header: "SS", align: "right", render: (r) => n2(r.ss) },
              { key: "ms", header: "MS", align: "right", render: (r) => (r.ms === null ? "—" : n2(r.ms)) },
              { key: "f", header: "F-ratio", align: "right", render: (r) => (r.f === null ? "—" : fmt(r.f, 3)) },
            ]}
            rows={s45.anova}
          />
          <p className="text-sm">
            SSR = R²Σy² = {n4(s43.r2)} × {n2(s43.total_ss)} = {n2(s45.anova[0].ss)}; SSE = (1 − R²)Σy² = {n2(s45.anova[1].ss)}; MSR = SSR / {s45.f.df_regression} = {n2(s45.anova[0].ms)}; MSE = SSE / {s45.f.df_error} = {n2(s45.anova[1].ms)}; F = {n2(s45.anova[0].ms)} / {n2(s45.anova[1].ms)} = {fmt(s45.f.f_calc, 3)}.
          </p>
          <HypothesisTest
            h0={<span>β₁ = β₂ = 0 — neither temperature nor humidity contributes to rentals</span>}
            h1={<span>at least one βᵢ ≠ 0 — at least one predictor significantly explains rentals</span>}
            statistic={<span>F = MSR / MSE with d.f. ({s45.f.df_regression}, {s45.f.df_error})</span>}
            calculated={`F = ${fmt(s45.f.f_calc, 3)}`}
            tabulated={`F(${s45.f.df_regression}, ${s45.f.df_error}) at 5 % = ${fmt(s45.f.f_tab, 3)}`}
            decision={s45.f.decision}
            conclusion={s45.f.decision === "reject" ? `Calculated F ${fmt(s45.f.f_calc, 2)} ≫ table F ${fmt(s45.f.f_tab, 2)} → the regression model is overall statistically significant: temperature and humidity jointly explain a significant portion of the variation in rentals. We proceed to test the individual coefficients (4.6).` : `Calculated F < table F → the model is not significant. Stop; do not test the individual coefficients.`}
          />
        </Worked>
        <Result items={[{ label: "Calculated F", value: fmt(s45.f.f_calc, 2) }, { label: "Tabulated F", value: fmt(s45.f.f_tab, 2), hint: `F(${s45.f.df_regression}, ${s45.f.df_error}), α = 0.05` }, { label: "Decision", value: s45.f.decision === "reject" ? "Reject H₀" : "Accept H₀" }]} />
        <Interpretation>
          <p>Flowchart rule from class: fit → predict → R² → F-test → &quot;Is H₀ rejected?&quot; If no, the model is not significant — stop. If yes, go on to the t-tests for each coefficient. Here H₀ is {s45.f.decision === "reject" ? "rejected, so we continue to 4.6" : "accepted, so we stop"}.</p>
          <p className="mt-1 text-xs text-muted-foreground">p-value of the F-test: {s45.f.p < 0.0001 ? "< 0.0001" : fmt(s45.f.p, 4)} (for reference only; the decision above is made by comparing with the table value).</p>
        </Interpretation>

        <SubSection title="Exploring alternative model designs (LO 4.5)">
          <p className="text-sm">
            Compare candidate models on adjusted R² and error. Three designs, all fitted on the same training days: A = temperature only (4.1); B = temperature + humidity (4.3); C = B plus wind speed and the year (yr = 0 for 2011, 1 for 2012 — a 0/1 input like &quot;found food&quot; in the turtle example).
          </p>
          <DataTable
            columns={[
              { key: "label", header: "Design" },
              { key: "k", header: "k", align: "right" },
              { key: "r2", header: "R²", align: "right", render: (r) => n4(r.r2) },
              { key: "adj_r2", header: "Adjusted R²", align: "right", render: (r) => n4(r.adj_r2) },
              { key: "mae_train", header: "MAE in-sample", align: "right" },
              { key: "mae_test", header: "MAE test", align: "right" },
              { key: "mape_test", header: "MAPE test (%)", align: "right" },
              { key: "f", header: "F (calc / table)", align: "right" },
            ]}
            rows={s45.designs.map((g) => ({ label: g.label, k: g.k, r2: g.r2, adj_r2: g.adj_r2, mae_train: n0(g.train.mae), mae_test: n0(g.test.mae), mape_test: n2(g.test.mape), f: `${fmt(g.f_calc, 1)} / ${fmt(g.f_tab, 2)}` }))}
          />
          <p className="text-sm">
            <strong>{s45.best_label}</strong> is the best design: adjusted R² rises to {n4(designC.adj_r2)} because the year variable captures the growth of the service between 2011 (mean {n0(s45.train_mean_2011)} rentals a day in training) and 2012 ({n0(s45.train_mean_2012)}): its coefficient says a 2012 day has ≈ {n0(s45.yr_coef)} more rentals than a 2011 day with the same weather. That same growth is why the test MAE falls from {n0(s45.designs[1].test.mae)} to {n0(designC.test.mae)}.
          </p>
          <p className="text-xs text-muted-foreground">Designs A and B are the hand computations above; design C has four predictors, beyond the two-predictor class formulas, so it is fitted with statsmodels OLS (same least-squares method). R² still rises with every added variable; adjusted R² is the fair comparison.</p>
        </SubSection>
      </UnitSection>

      {/* ============================================================ 4.6 */}
      <UnitSection number="4.6" title="Testing individual regression coefficients: t-tests" intro="When H₀ is rejected by the F-test we check whether each coefficient is statistically significant using a t-test. A non-zero estimate is not enough: bᵢ is a sample value, and a non-zero sample value does not guarantee that the population coefficient differs from zero.">
        <What>
          For each predictor Xᵢ: H₀: βᵢ = 0 (the predictor has no effect on Y), Hₐ: βᵢ ≠ 0 (two-tailed). The t-statistic is the coefficient&apos;s distance from zero measured in standard errors. If |calculated t| &gt; tabulated t we reject H₀ and Xᵢ is statistically significant; otherwise Xᵢ might not be useful in the model (but do not claim it is definitely zero).
        </What>
        <FormulaBlock
          tex={[
            String.raw`SE(b_1) = \frac{\sqrt{\sum (Y - \hat Y)^2 / (n-k-1)}}{\sqrt{\sum x_1^2\,(1 - r_{12}^2)}}, \qquad SE(b_2) = \frac{\sqrt{\sum (Y - \hat Y)^2 / (n-k-1)}}{\sqrt{\sum x_2^2\,(1 - r_{12}^2)}}`,
            String.raw`t = \frac{b_i}{SE(b_i)}, \qquad \text{d.f.} = n - k - 1`,
          ]}
          where={[[String.raw`\sum (Y - \hat Y)^2`, "residual sum of squares SSE from the ANOVA table"], ["r_{12}", "correlation between the two predictors (4.4)"], ["k", "number of predictors (2)"]]}
        />
        <Worked title="The pieces of SE(b₁) and SE(b₂) for the two-predictor model.">
          <DataTable<SumRow>
            columns={sumCols}
            rows={[
              { label: "Residual sum of squares", sym: String.raw`\sum (Y - \hat Y)^2`, value: n2(tt.sse) },
              { label: "Degrees of freedom", sym: "n - k - 1", value: `${meta.n_train} − 2 − 1 = ${tt.df}` },
              { label: "Mean square error", sym: String.raw`\sum (Y - \hat Y)^2 / (n-k-1)`, value: n2(tt.mse) },
              { label: "Its square root (numerator of SE)", sym: String.raw`\sqrt{\text{MSE}}`, value: n4(tt.root_mse) },
              { label: "Predictor correlation", sym: "r_{12}", value: `${n4(tt.r12)} → 1 − r₁₂² = ${n4(tt.one_minus_r12_sq)}` },
              { label: "Denominator for b₁", sym: String.raw`\sqrt{\sum x_1^2 (1 - r_{12}^2)}`, value: `√(${n2(tt.b1.sum_x2)} × ${n4(tt.one_minus_r12_sq)}) = ${n4(tt.b1.denominator)}` },
              { label: "Denominator for b₂", sym: String.raw`\sqrt{\sum x_2^2 (1 - r_{12}^2)}`, value: `√(${n2(tt.b2.sum_x2)} × ${n4(tt.one_minus_r12_sq)}) = ${n4(tt.b2.denominator)}` },
              { label: "SE(b₁), t₁", sym: String.raw`SE(b_1),\; t_1`, value: `${n4(tt.root_mse)} / ${n4(tt.b1.denominator)} = ${n4(tt.b1.se)};  t = ${n4(tt.b1.b)} / ${n4(tt.b1.se)} = ${fmt(tt.b1.t, 3)}` },
              { label: "SE(b₂), t₂", sym: String.raw`SE(b_2),\; t_2`, value: `${n4(tt.root_mse)} / ${n4(tt.b2.denominator)} = ${n4(tt.b2.se)};  t = ${n4(tt.b2.b)} / ${n4(tt.b2.se)} = ${fmt(tt.b2.t, 3)}` },
            ]}
          />
          <div className="grid gap-3 lg:grid-cols-2">
            <HypothesisTest
              h0={<span>β₁ = 0 — temperature has no effect on rentals, humidity held constant</span>}
              h1={<span>β₁ ≠ 0 (two-tailed)</span>}
              statistic={<span>t = b₁ / SE(b₁) = {n4(tt.b1.b)} / {n4(tt.b1.se)}, d.f. = {tt.df}</span>}
              calculated={`t = ${fmt(tt.b1.t, 3)}`}
              tabulated={`t(${tt.df}, 0.05) = ${fmt(tt.t_tab, 3)}`}
              decision={tt.b1.decision}
              conclusion={tt.b1.decision === "reject" ? `|t| = ${fmt(abs(tt.b1.t), 2)} > ${fmt(tt.t_tab, 3)} → temperature is statistically significant: it is significantly associated with rentals, holding humidity constant.` : `|t| ≤ ${fmt(tt.t_tab, 3)} → temperature might not be useful in the model.`}
            />
            <HypothesisTest
              h0={<span>β₂ = 0 — humidity has no effect on rentals, temperature held constant</span>}
              h1={<span>β₂ ≠ 0 (two-tailed)</span>}
              statistic={<span>t = b₂ / SE(b₂) = {n4(tt.b2.b)} / {n4(tt.b2.se)}, d.f. = {tt.df}</span>}
              calculated={`t = ${fmt(tt.b2.t, 3)}`}
              tabulated={`t(${tt.df}, 0.05) = ${fmt(tt.t_tab, 3)}`}
              decision={tt.b2.decision}
              conclusion={tt.b2.decision === "reject" ? `|t| = ${fmt(abs(tt.b2.t), 2)} > ${fmt(tt.t_tab, 3)} → humidity is statistically significant: it is significantly associated with rentals, holding temperature constant.` : `|t| ≤ ${fmt(tt.t_tab, 3)} → humidity might not be useful in the model; do not claim β₂ is definitely zero.`}
            />
          </div>
        </Worked>
        <Result items={[{ label: "t₁ (temperature)", value: fmt(tt.b1.t, 2), hint: `SE = ${n4(tt.b1.se)}` }, { label: "t₂ (humidity)", value: fmt(tt.b2.t, 2), hint: `SE = ${n4(tt.b2.se)}` }, { label: "Tabulated t", value: fmt(tt.t_tab, 3), hint: `d.f. = ${tt.df}, α = 0.05, two-tailed` }]} />
        <Interpretation>
          <p>Both predictors pass the t-test, so both stay in the model: each is significantly associated with rentals holding the other constant. Statistical significance ≠ practical importance — with {fmtInt(meta.n_train)} days even a small effect becomes &quot;significant&quot;; whether {n2(abs(s43.b2))} fewer rentals per 1 % humidity matters is a question about the business, not about the t-table.</p>
          <p className="mt-1 text-xs text-muted-foreground">p-values: temperature {tt.b1.p < 0.0001 ? "< 0.0001" : fmt(tt.b1.p, 4)}, humidity {tt.b2.p < 0.0001 ? "< 0.0001" : fmt(tt.b2.p, 4)} (reference only).</p>
        </Interpretation>

        <SubSection title="Which predictors matter in the four-predictor design (C)?">
          <DataTable
            columns={[
              { key: "name", header: "Coefficient", render: (r) => PRED_LABEL[String(r.name)] ?? String(r.name) },
              { key: "b", header: "bᵢ", align: "right", render: (r) => n2(r.b) },
              { key: "se", header: "SE(bᵢ)", align: "right", render: (r) => n2(r.se) },
              { key: "t", header: "t = bᵢ / SE", align: "right", render: (r) => fmt(r.t, 2) },
              { key: "tab", header: "Tabulated t", align: "right", render: () => fmt(designC.t_tab, 3) },
              { key: "decision", header: "Conclusion", render: (r) => (r.decision === "reject" ? "Reject H₀ — significant" : "Accept H₀ — not significant") },
            ]}
            rows={s46.four_predictor.coef}
          />
          <p className="text-xs text-muted-foreground">
            Design C: d.f. = {designC.df_error}, tabulated t = {fmt(designC.t_tab, 3)} at 5 % (two-tailed). The SE and t values here are library-computed (statsmodels OLS), because the class SE formula covers exactly two predictors. All four predictors are significant; the year effect (≈ {n0(s45.yr_coef)} rentals) has the largest t after temperature.
          </p>
        </SubSection>
      </UnitSection>

      {/* ============================================================ self-learning */}
      <UnitSection number="4.S" title="Residual analysis" selfLearning intro="The t-test cheat sheet lists five assumptions behind regression but never checks them. Here we look at the residuals e = Y − Ŷ of the two-predictor model to see whether each assumption looks reasonable. No formal tests — only the pictures and a few plain numbers.">
        <What>
          Residual = actual − predicted. If the model is right, the residuals should look like random noise: scattered around zero with no pattern, with the same spread everywhere, roughly bell-shaped, and unrelated to each other. The assumptions as stated in class: linearity; independent errors; constant variance (homoscedasticity); approximately normal errors; no severe multicollinearity.
        </What>
        <FormulaBlock tex={[String.raw`e = Y - \hat Y, \qquad \hat Y = b_0 + b_1 X_1 + b_2 X_2`]} note="The plots use all training days; σ of the residuals is computed with ÷N as in Unit 2." />
        <Worked title="Three pictures of the residuals.">
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Residual vs fitted" description="Each point is one day: predicted rentals on the x-axis, its error on the y-axis. We want a flat cloud around zero.">
              <ScatterPlot points={res.resid_vs_fitted} xLabel="Fitted Ŷ" yLabel="Residual e" height={240} size={14} opacity={0.45} refY={0} />
            </ChartCard>
            <ChartCard title="Histogram of residuals" description={`Bars: the residuals. Curve: a normal distribution with mean 0 and σ = ${n0(res.sd)}.`}>
              <Histogram bins={res.hist} height={240} label="Residuals" xFormat="int" />
            </ChartCard>
            <ChartCard title="Predicted vs actual" description="Points on the dashed 45° line are perfect predictions; the vertical gap to the line is the error.">
              <ScatterPlot points={res.pred_vs_actual} xLabel="Predicted Ŷ" yLabel="Actual Y" height={240} size={14} opacity={0.45} diagonal />
            </ChartCard>
          </div>
          <DataTable
            columns={[
              { key: "band", header: "Fitted values" },
              { key: "range", header: "Ŷ from – to", align: "right" },
              { key: "n", header: "Days", align: "right" },
              { key: "mean_e", header: "Mean residual", align: "right" },
              { key: "sd_e", header: "σ of residuals", align: "right" },
            ]}
            rows={res.spread.map((s) => ({ band: s.band, range: `${n0(s.fitted_from)} – ${n0(s.fitted_to)}`, n: s.n, mean_e: n0(s.mean_e), sd_e: n0(s.sd_e) }))}
          />
        </Worked>
        <Result items={[{ label: "σ of residuals", value: n0(res.sd), hint: "rentals" }, { label: "Within ±1σ / ±2σ", value: `${fmt(res.within_1sd_pct, 1)} % / ${fmt(res.within_2sd_pct, 1)} %`, hint: "normal: 68.2 % / 95.4 %" }, { label: "r(eₜ, eₜ₋₁)", value: n2(res.lag1_r), hint: "today's vs yesterday's residual" }, { label: "r₁₂ (temp, hum)", value: n4(res.r12) }]} />
        <Interpretation>
          <DataTable
            columns={[
              { key: "assumption", header: "Assumption (as stated in class)" },
              { key: "obs", header: "What the plots show" },
            ]}
            rows={[
              { assumption: "Linearity", obs: `The mean residual is ${n0(res.spread[0].mean_e)} in the low third of fitted values, ${n0(res.spread[1].mean_e)} in the middle and ${n0(res.spread[2].mean_e)} in the high third — the cloud bends slightly (under-prediction in the middle), so a straight line is a fair but not perfect description.` },
              { assumption: "Independent errors", obs: `Days are in time order and today's residual is strongly related to yesterday's (r = ${n2(res.lag1_r)}): a day the model under-predicts is usually followed by another. The errors are not independent — the growth and seasons the model leaves out carry over from day to day (Unit 6 deals with that).` },
              { assumption: "Constant variance", obs: `σ of the residuals grows from ${n0(res.spread[0].sd_e)} in the low third to ${n0(res.spread[2].sd_e)} in the high third: the spread widens as the fitted value rises, so constant variance is doubtful.` },
              { assumption: "Approximately normal errors", obs: `${fmt(res.within_1sd_pct, 1)} % of residuals lie within ±1σ and ${fmt(res.within_2sd_pct, 1)} % within ±2σ, close to the 68.2 % / 95.4 % of a normal curve; the histogram is roughly bell-shaped with residuals from ${n0(res.min_e)} to ${n0(res.max_e)}.` },
              { assumption: "No severe multicollinearity", obs: `The two predictors are only weakly correlated (r₁₂ = ${n4(res.r12)}), far from the "near-copies" the class warned about, so the partial coefficients are not fighting over shared information.` },
            ]}
          />
        </Interpretation>
      </UnitSection>

      {/* ============================================================ class check */}
      <ClassCheck title="The teacher's 8-row (Y, X₁, X₂) example from the Module deck, run through the same functions as the bike data (mlr_two → f_test → t_tests).">
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <DataTable
            columns={[
              { key: "y", header: "Y", align: "right" },
              { key: "x1", header: "X₁", align: "right" },
              { key: "x2", header: "X₂", align: "right" },
            ]}
            rows={cc.rows}
          />
          <div className="space-y-2">
            <p className="text-sm">Sums: ΣY = {fmtInt(cc.ours.sums.sum_y)}, ΣX₁ = {fmtInt(cc.ours.sums.sum_x1)}, ΣX₂ = {fmtInt(cc.ours.sums.sum_x2)}, ΣY² = {fmtInt(cc.ours.sums.sum_y2)}, ΣX₁² = {fmtInt(cc.ours.sums.sum_x1sq)}, ΣX₂² = {fmtInt(cc.ours.sums.sum_x2sq)}, ΣX₁X₂ = {fmtInt(cc.ours.sums.sum_x1x2)}, ΣX₁Y = {fmtInt(cc.ours.sums.sum_x1y)}, ΣX₂Y = {fmtInt(cc.ours.sums.sum_x2y)}. Deviation sums: Σx₁² = {fmt(cc.ours.dev.x1x1, 3)}, Σx₂² = {fmt(cc.ours.dev.x2x2, 3)}, Σx₁y = {fmt(cc.ours.dev.x1y, 1)}, Σx₂y = {fmt(cc.ours.dev.x2y, 1)}, Σx₁x₂ = {fmt(cc.ours.dev.x1x2, 3)}, Σy² = {fmt(cc.ours.dev.yy, 0)}.</p>
            <DataTable
              columns={[
                { key: "q", header: "Quantity" },
                { key: "ours", header: "Our code", align: "right" },
                { key: "slide", header: "Slide", align: "right" },
              ]}
              rows={[
                { q: "b₁", ours: n4(cc.ours.b1), slide: n4(cc.slide.b1) },
                { q: "b₂", ours: n4(cc.ours.b2), slide: n4(cc.slide.b2) },
                { q: "b₀", ours: n4(cc.ours.b0), slide: n4(cc.slide.b0) },
                { q: "Ŷ at X₁ = 74, X₂ = 14", ours: fmt(cc.ours.pred_74_14, 3), slide: fmt(cc.slide.pred_74_14, 3) },
                { q: "R²", ours: n4(cc.ours.r2), slide: n4(cc.slide.r2) },
                { q: "F (calculated)", ours: n2(cc.ours.f), slide: n2(cc.slide.f) },
                { q: "F(2, 5) tabulated", ours: n2(cc.ours.f_tab), slide: n2(cc.slide.f_tab) },
                { q: "r₁₂", ours: n4(cc.ours.r12), slide: n2(cc.slide.r12) },
                { q: "SE(b₁)", ours: fmt(cc.ours.se_b1, 3), slide: fmt(cc.slide.se_b1, 3) },
                { q: "t₁", ours: fmt(cc.ours.t1, 3), slide: fmt(cc.slide.t1, 3) },
                { q: "SE(b₂)", ours: fmt(cc.ours.se_b2, 3), slide: `${fmt(cc.slide.se_b2, 3)} (printed ${fmt(cc.slide.se_b2_printed, 3)})` },
                { q: "t₂", ours: fmt(cc.ours.t2, 2), slide: `${fmt(cc.slide.t2, 2)} (printed ${fmt(cc.slide.t2_printed, 3)})` },
                { q: "t(5, 0.05) tabulated", ours: fmt(cc.ours.t_tab, 3), slide: fmt(cc.slide.t_tab, 3) },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Everything matches to rounding. For b₂ the slide pasted b₁&apos;s numbers (SE {fmt(cc.slide.se_b2_printed, 3)}, t {fmt(cc.slide.t2_printed, 3)}) under the b₂ heading by mistake; the correct value uses Σx₂² = {fmt(cc.ours.dev.x2x2, 3)}, which gives t ≈ {fmt(cc.slide.t2, 2)} — the number the slide&apos;s own conclusion uses (the slide rounds r₁₂ to {n2(cc.slide.r12)}, we keep {n4(cc.ours.r12)}, hence {fmt(cc.ours.se_b2, 3)} vs {fmt(cc.slide.se_b2, 3)}). Same conclusions: model significant (F), X₁ significant, X₂ not significant.
            </p>
          </div>
        </div>
      </ClassCheck>

      <Note tone="good" title="Headline numbers from this unit">
        <KV
          cols={2}
          items={[
            ["Simple model Ŷ = a + bX (temperature)", `a = ${n2(h.simple.a)}, b = ${n2(h.simple.b)}, R² = ${n4(h.simple.r2)}`],
            ["Two-predictor model", `b₀ = ${n2(h.two_predictor.b0)}, b₁ = ${n2(h.two_predictor.b1)}, b₂ = ${n2(h.two_predictor.b2)}, R² = ${n4(h.two_predictor.r2)}, adj. R² = ${n4(h.two_predictor.adj_r2)}`],
            ["F-test / t-tests (two predictors)", `F = ${fmt(h.two_predictor.f, 1)} vs ${fmt(h.two_predictor.f_tab, 2)}; t₁ = ${fmt(h.two_predictor.t1, 2)}, t₂ = ${fmt(h.two_predictor.t2, 2)} vs ${fmt(h.two_predictor.t_tab, 3)}`],
            [`Best design (${h.best_design.label})`, `R² = ${n4(h.best_design.r2)}, adj. R² = ${n4(h.best_design.adj_r2)}, test MAE = ${n0(h.best_design.test_mae)}`],
            ["Test-period MAE / MAPE (two predictors)", `${n0(h.two_predictor.test_mae)} rentals / ${n2(h.two_predictor.test_mape)} %`],
            ["Test-period MAE / MAPE (simple)", `${n0(h.simple.test_mae)} rentals / ${n2(h.simple.test_mape)} %`],
          ]}
        />
      </Note>
    </PageShell>
  );
}
