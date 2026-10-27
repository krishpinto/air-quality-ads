import { ReactNode } from "react";
import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { UnitSection, SubSection, What, FormulaBlock, Worked, Result, Interpretation, ClassCheck } from "@/components/syllabus";
import { ChartCard, DataTable, KV, Note, type Column } from "@/components/blocks";
import { BandLines } from "@/components/charts/xy";
import { Tex } from "@/components/formula";
import { fmt, fmtInt } from "@/lib/format";
import { C } from "@/lib/colors";

/* ------------------------------------------------------------------ JSON type */
type Taxonomy = { family: string; leaves: Array<{ name: string; used: boolean }> };
type Month = { t: number; date: string; y: number; split: string; label: string };
type DecRow = { t: number; label: string; y: number; calc: string | null; T: number | null; detrended: number | null; detrended_calc: string | null };
type Seasonal = {
  table: Array<{ year: string; Q1: number | null; Q2: number | null; Q3: number | null; Q4: number | null }>;
  totals: number[];
  counts: number[];
  averages: number[];
  sum_of_averages: number;
  adjustment: number;
  adjustment_text: string;
  indices: number[];
  indices_sum: number;
  target_sum: number;
};
type TrendPerQ = { first_t: number; first_label: string; first_T: number; last_t: number; last_label: string; last_T: number; quarters_between: number; calc: string; value: number };
type DecForecast = { label: string; t: number; quarter: number; quarters_ahead: number; ahead_calc: string; increase: number; increase_calc: string; trend: number; trend_calc: string; index: number; forecast: number; forecast_calc: string };
type Decomp = { mode: "additive" | "multiplicative"; rows: DecRow[]; seasonal: Seasonal; trend_per_quarter: TrendPerQ; forecasts: DecForecast[] };
type Fc = { t: number; F: number; calc: string | null };
type EvalRow = { t: number; date: string; y: number; F: number; e: number; abs_e: number; e2: number; ape: number; naive: number | null };
type Metrics = { MAE: number; RMSE: number; MAPE: number; MASE: number };
type Evaluation = { label: string; rows: EvalRow[]; n: number; sums: { e: number; abs_e: number; e2: number; ape: number; naive: number }; metrics: Metrics; calcs: Record<keyof Metrics, string> };
type Adf = { name: string; n: number; statistic: number; critical_5pct: number; stationary: boolean; p_value: number };

type Unit6 = {
  meta: { n_months: number; n_train: number; n_test: number; n_quarters: number; test_start: string };
  taxonomy: Taxonomy[];
  components: Array<{ name: string; desc: string }>;
  component_facts: { first: Month; last: Month; peak: Month; low: Month; mean_year_a: number; mean_year_b: number; year_a: string; year_b: string };
  models: { additive_example: string; multiplicative_example: string };
  decomposition: {
    series: Array<{ t: number; label: string; year: number; quarter: number; y: number }>;
    additive: Decomp;
    multiplicative: Decomp;
    fit: { year_a: string; year_b: string; swing_a: number; swing_b: number; level_a: number; level_b: number; swing_growth_pct: number; level_growth_pct: number; better: "additive" | "multiplicative" };
    chart: Array<{ label: string; y: number | null; T: number | null; additive: number | null; multiplicative: number | null }>;
  };
  class_check_sales: {
    data: Array<{ t: number; label: string; y: number }>;
    trend: number[];
    slide_trend: number[];
    additive: { indices: number[]; slide_indices: number[]; trend_per_quarter: number; slide_trend_per_quarter: number; forecasts: Array<{ label: string; value: number }>; slide_forecasts: Array<{ label: string; value: number }> };
    multiplicative: { indices: number[]; slide_indices: number[]; forecasts: Array<{ label: string; value: number }>; slide_forecasts: Array<{ label: string; value: number }> };
  };
  methods: {
    monthly: Month[];
    n_train: number;
    n_test: number;
    test_t: number[];
    naive_train: { n: number; n_diffs: number; sum_abs_diff: number; mae: number; calc: string; rows: Array<{ t: number; y: number; y_prev: number; abs_diff: number }> };
    average: { forecasts: Fc[] };
    ma3: { forecasts: Fc[] };
    ma12: { forecasts: Fc[] };
    regression: {
      n: number;
      rows: Array<{ x: number; y: number; xy: number; x2: number }>;
      sums: { x: number; y: number; xy: number; x2: number };
      a: number;
      b: number;
      a_calc: string;
      b_calc: string;
      equation: string;
      fitted: Array<{ x: number; y: number; fit: number }>;
      forecasts: Fc[];
    };
    arima: { adf: Adf[]; d: number; p: number; q: number; order: string; aic: number; grid: Array<{ p: number; d: number; q: number; aic: number }>; params: Record<string, number>; fitted: Array<number | null>; forecasts: number[] };
    evaluation: Record<string, Evaluation>;
    comparison: Array<{ key: string; method: string } & Metrics>;
    best: { key: string; method: string; reason: string };
    worst: { key: string; method: string; reason: string };
    reasons: Record<string, string>;
    chart: Array<Record<string, unknown>>;
  };
  class_check_methods: {
    average: { data: number[]; F7: number; slide_F7: number; metrics: Metrics; slide_metrics: Metrics };
    ma3: { F7: number; slide_F7: number; metrics: Metrics; slide_metrics: Metrics };
    regression: { a: number; b: number; slide_a: number; slide_b: number; F6: number; slide_F6: number; metrics: Metrics; slide_metrics: Metrics };
  };
  headline: { best_method: string };
};

/* ------------------------------------------------------------------ small helpers */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const dash = (v: number | null | undefined, digits = 2) => (v === null || v === undefined ? "—" : fmt(v, digits));
const signed = (v: number, digits = 2) => (v > 0 ? `+${fmt(v, digits)}` : fmt(v, digits));
const pctOf = (v: number) => `${(100 * v).toFixed(2)} %`;
const QS = ["Q1", "Q2", "Q3", "Q4"] as const;

function Calc({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12px] text-muted-foreground">{children}</span>;
}

/** The teacher's decomposition tables (Step 1 trend + detrending). */
function TrendTable({ dec, op }: { dec: Decomp; op: "−" | "÷" }) {
  const cols: Column<DecRow>[] = [
    { key: "t", header: "t", align: "right" },
    { key: "label", header: "Quarter" },
    { key: "y", header: "Y", align: "right", render: (r) => fmtInt(r.y) },
    { key: "calc", header: "Centred 2×4 moving average", render: (r) => (r.calc ? <Calc>{r.calc}</Calc> : <span className="text-muted-foreground">—</span>) },
    { key: "T", header: "T", align: "right", render: (r) => dash(r.T) },
    { key: "detrended_calc", header: `Y ${op} T`, render: (r) => (r.detrended_calc ? <Calc>{r.detrended_calc}</Calc> : <span className="text-muted-foreground">—</span>) },
    { key: "detrended", header: op === "−" ? "Detrended" : "Ratio", align: "right", render: (r) => (r.detrended === null ? "—" : fmt(r.detrended, op === "−" ? 2 : 4)) },
  ];
  return <DataTable columns={cols} rows={dec.rows} rowKey={(r) => String(r.t)} />;
}

/** Step 2: seasonal table (rows = years, columns = Q1..Q4) with Total and Average rows, then the adjustment. */
function SeasonalTable({ s, mode }: { s: Seasonal; mode: "additive" | "multiplicative" }) {
  const nd = mode === "additive" ? 2 : 4;
  type Row = { label: string; Q1: number | null; Q2: number | null; Q3: number | null; Q4: number | null; sum?: number | null; bold?: boolean };
  const rows: Row[] = [
    ...s.table.map((r) => ({ label: r.year, Q1: r.Q1, Q2: r.Q2, Q3: r.Q3, Q4: r.Q4 })),
    { label: "Total", Q1: s.totals[0], Q2: s.totals[1], Q3: s.totals[2], Q4: s.totals[3] },
    { label: "Average (raw index)", Q1: s.averages[0], Q2: s.averages[1], Q3: s.averages[2], Q4: s.averages[3], sum: s.sum_of_averages, bold: true },
    { label: mode === "additive" ? `Adjustment (subtract ${fmt(s.adjustment, 4)})` : `Adjustment (divide by ${fmt(s.adjustment, 4)})`, Q1: s.adjustment, Q2: s.adjustment, Q3: s.adjustment, Q4: s.adjustment },
    { label: "Seasonal index S", Q1: s.indices[0], Q2: s.indices[1], Q3: s.indices[2], Q4: s.indices[3], sum: s.indices_sum, bold: true },
  ];
  const cols: Column<Row>[] = [
    { key: "label", header: "", render: (r) => <span className={r.bold ? "font-semibold" : undefined}>{r.label}</span> },
    ...QS.map<Column<Row>>((q) => ({ key: q, header: q, align: "right", render: (r) => <span className={r.bold ? "font-semibold" : undefined}>{r[q] === null ? "—" : fmt(r[q], nd)}</span> })),
    { key: "sum", header: "Sum", align: "right", render: (r) => (r.sum === undefined || r.sum === null ? "" : <span className="font-semibold">{fmt(r.sum, nd)}</span>) },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(r) => r.label} />;
}

/** Step 4: forecast table, one row per 2013 quarter, with the arithmetic. */
function ForecastTable({ dec, op }: { dec: Decomp; op: "+" | "×" }) {
  const cols: Column<DecForecast>[] = [
    { key: "label", header: "Quarter" },
    { key: "t", header: "t", align: "right" },
    { key: "ahead_calc", header: "Quarters from last T", render: (r) => <Calc>{r.ahead_calc}</Calc> },
    { key: "increase_calc", header: "Increase", render: (r) => <Calc>{r.increase_calc}</Calc> },
    { key: "trend_calc", header: "Trend", render: (r) => <Calc>{r.trend_calc}</Calc> },
    { key: "index", header: "S", align: "right", render: (r) => fmt(r.index, op === "+" ? 2 : 4) },
    { key: "forecast_calc", header: `Forecast = Trend ${op} S`, render: (r) => <Calc>{r.forecast_calc}</Calc> },
    { key: "forecast", header: "Forecast", align: "right", render: (r) => <span className="font-semibold">{fmtInt(Math.round(r.forecast))}</span> },
  ];
  return <DataTable columns={cols} rows={dec.forecasts} rowKey={(r) => r.label} />;
}

/** One-step forecasts of the 6 test months with the arithmetic (6.2). */
function ForecastRows({ fcs, months, showCalc = true }: { fcs: Fc[]; months: Month[]; showCalc?: boolean }) {
  type Row = { t: number; label: string; y: number; F: number; e: number; calc: string | null };
  const rows: Row[] = fcs.map((f) => {
    const m = months.find((x) => x.t === f.t)!;
    return { t: f.t, label: m.label, y: m.y, F: f.F, e: m.y - f.F, calc: f.calc };
  });
  const cols: Column<Row>[] = [
    { key: "t", header: "t", align: "right" },
    { key: "label", header: "Month" },
    { key: "y", header: "y(t)", align: "right", render: (r) => fmtInt(r.y) },
    ...(showCalc ? [{ key: "calc", header: "Forecast F(t)", render: (r: Row) => (r.calc ? <Calc>{r.calc}</Calc> : <span className="text-muted-foreground">from the fitted model</span>) } as Column<Row>] : []),
    { key: "F", header: "F(t)", align: "right", render: (r) => fmt(r.F, 2) },
    { key: "e", header: "e(t) = y(t) − F(t)", align: "right", render: (r) => signed(r.e) },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(r) => String(r.t)} />;
}

/** The teacher's evaluation table: t | y | F | e | |e| | e² | |e| ÷ y | Naive error, Sum row. */
function EvalTable({ ev }: { ev: Evaluation }) {
  type Row = EvalRow & { label: string; isSum?: boolean };
  const rows: Row[] = [
    ...ev.rows.map((r) => ({ ...r, label: monthLabel(r.date) })),
    { t: 0, date: "", label: "Sum", y: 0, F: 0, e: ev.sums.e, abs_e: ev.sums.abs_e, e2: ev.sums.e2, ape: ev.sums.ape, naive: ev.sums.naive, isSum: true },
  ];
  const b = (r: Row, v: ReactNode) => <span className={r.isSum ? "font-semibold" : undefined}>{v}</span>;
  const cols: Column<Row>[] = [
    { key: "t", header: "t", align: "right", render: (r) => (r.isSum ? "" : r.t) },
    { key: "label", header: "Month", render: (r) => b(r, r.label) },
    { key: "y", header: "y(t)", align: "right", render: (r) => (r.isSum ? "" : fmtInt(r.y)) },
    { key: "F", header: "F(t)", align: "right", render: (r) => (r.isSum ? "" : fmt(r.F, 2)) },
    { key: "e", header: "e(t)", align: "right", render: (r) => b(r, signed(r.e)) },
    { key: "abs_e", header: "|e(t)|", align: "right", render: (r) => b(r, fmt(r.abs_e, 2)) },
    { key: "e2", header: "e(t)²", align: "right", render: (r) => b(r, fmt(r.e2, 2)) },
    { key: "ape", header: "|e(t)| ÷ y(t)", align: "right", render: (r) => b(r, pctOf(r.ape)) },
    { key: "naive", header: "Naive error |y(t) − y(t−1)|", align: "right", render: (r) => b(r, r.naive === null ? "—" : fmt(r.naive, 2)) },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(r) => (r.isSum ? "sum" : String(r.t))} />;
}

function MetricBoxes({ ev }: { ev: Evaluation }) {
  return (
    <Result
      items={[
        { label: "MAE", value: fmt(ev.metrics.MAE, 2), hint: ev.calcs.MAE },
        { label: "RMSE", value: fmt(ev.metrics.RMSE, 2), hint: ev.calcs.RMSE },
        { label: "MAPE", value: `${fmt(ev.metrics.MAPE, 2)} %`, hint: ev.calcs.MAPE },
        { label: "MASE", value: fmt(ev.metrics.MASE, 3), hint: ev.calcs.MASE },
      ]}
    />
  );
}

function MetricCompare({ title, ours, slide }: { title: string; ours: Metrics; slide: Metrics }) {
  type Row = { metric: string; ours: number; slide: number };
  const rows: Row[] = (["MAE", "RMSE", "MAPE", "MASE"] as const).map((k) => ({ metric: k, ours: ours[k], slide: slide[k] }));
  const cols: Column<Row>[] = [
    { key: "metric", header: title },
    { key: "ours", header: "Our code", align: "right", render: (r) => fmt(r.ours, r.metric === "MASE" ? 3 : 2) },
    { key: "slide", header: "Slide", align: "right", render: (r) => fmt(r.slide, r.metric === "MASE" ? 3 : 2) },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(r) => r.metric} />;
}

/* ------------------------------------------------------------------ page */
export default async function Unit6() {
  const d = await loadData<Unit6>("unit6");
  const m = d.methods;
  const months = m.monthly;
  const cf = d.component_facts;
  const dec = d.decomposition;
  const add = dec.additive;
  const mul = dec.multiplicative;
  const fit = dec.fit;
  const reg = m.regression;
  const ari = m.arima;
  const sales = d.class_check_sales;
  const ccm = d.class_check_methods;
  const trainMonths = months.filter((x) => x.split === "train");
  const testMonths = months.filter((x) => x.split === "test");
  const firstTest = testMonths[0];
  const lastTrain = trainMonths[trainMonths.length - 1];
  const jun11 = months.find((x) => x.date.startsWith("2011-06"))!;
  const jul11 = months.find((x) => x.date.startsWith("2011-07"))!;
  const addFirstTrend = add.rows.find((r) => r.T !== null)!;
  const addTrendRows = add.rows.filter((r) => r.T !== null);
  const addS = add.seasonal;
  const mulS = mul.seasonal;
  const qBelow = addS.indices.map((v, i) => ({ q: QS[i], v })).filter((x) => x.v < 0);
  const qAbove = addS.indices.map((v, i) => ({ q: QS[i], v })).filter((x) => x.v >= 0);
  const bestFit = fit.better;
  const otherFit = bestFit === "additive" ? "multiplicative" : "additive";
  const avgF = m.average.forecasts;
  const ma3F = m.ma3.forecasts;
  const evalKeys = ["average", "ma3", "ma12", "regression", "arima"];
  const comparison = m.comparison;
  const allMaseAboveOne = comparison.every((c) => c.MASE > 1);
  const adfLevel = ari.adf[0];
  const adfDiff = ari.adf[1];
  const peakTest = testMonths.reduce((a, b) => (b.y > a.y ? b : a));
  const lastTest = testMonths[testMonths.length - 1];

  const regCols: Column<{ x: number | string; y: number; xy: number; x2: number; isSum?: boolean }>[] = [
    { key: "x", header: "x (= t)", align: "right", render: (r) => <span className={r.isSum ? "font-semibold" : undefined}>{typeof r.x === "number" ? r.x : r.x}</span> },
    { key: "y", header: "y (rentals per day)", align: "right", render: (r) => <span className={r.isSum ? "font-semibold" : undefined}>{fmtInt(r.y)}</span> },
    { key: "xy", header: "xy", align: "right", render: (r) => <span className={r.isSum ? "font-semibold" : undefined}>{fmtInt(r.xy)}</span> },
    { key: "x2", header: "x²", align: "right", render: (r) => <span className={r.isSum ? "font-semibold" : undefined}>{fmtInt(r.x2)}</span> },
  ];
  const regRows = [...reg.rows.map((r) => ({ ...r })), { x: `Σ (n = ${reg.n})`, y: reg.sums.y, xy: reg.sums.xy, x2: reg.sums.x2, isSum: true }];

  const gridCols: Column<{ p: number; d: number; q: number; aic: number }>[] = [
    { key: "order", header: "Order (p, d, q)", render: (r) => `(${r.p}, ${r.d}, ${r.q})` },
    { key: "aic", header: "AIC on the training months", align: "right", render: (r) => <span className={r.p === ari.p && r.q === ari.q ? "font-semibold" : undefined}>{fmt(r.aic, 2)}</span> },
  ];

  const compCols: Column<{ key: string; method: string } & Metrics>[] = [
    { key: "method", header: "Method", render: (r) => <span className={r.key === m.best.key ? "font-semibold" : undefined}>{r.method}</span> },
    { key: "MAE", header: "MAE", align: "right", render: (r) => fmt(r.MAE, 2) },
    { key: "RMSE", header: "RMSE", align: "right", render: (r) => fmt(r.RMSE, 2) },
    { key: "MAPE", header: "MAPE", align: "right", render: (r) => `${fmt(r.MAPE, 2)} %` },
    { key: "MASE", header: "MASE", align: "right", render: (r) => fmt(r.MASE, 3) },
  ];

  return (
    <PageShell
      module="6"
      title="Time series forecasting"
      description={`The ${d.meta.n_months} monthly means of rentals per day (and the ${d.meta.n_quarters} quarterly means) treated as a time series: its components, classical decomposition into trend + seasonal index with a forecast for 2013, then the average method, moving averages, least-squares regression on the time index and ARIMA forecasting the ${d.meta.n_test} test months from the ${d.meta.n_train} training months, each judged with MAE, RMSE, MAPE and MASE in the layout used in class.`}
      concepts={["Taxonomy of methods", "Trend / seasonality / cyclical / irregular", "Additive and multiplicative decomposition", "Centred 2×4 moving average", "Seasonal indices", "Average method", "Moving average", "Least-squares regression on t", "ARIMA(p, d, q)", "MAE · RMSE · MAPE · MASE"]}
    >
      {/* =============================================================== 6.1 */}
      <UnitSection
        number="6.1"
        title="Taxonomy of forecasting methods and time-series decomposition"
        intro="A time series is an arrangement of the statistical data in accordance with the time of occurrence. Time series analysis is used to find the underlying trend, forecast it into the future, find the seasonal variation around the trend and apply it to the trend forecast season by season."
      >
        <SubSection title="Taxonomy of time-series forecasting methods">
          <What>
            Forecasting methods fall into four families. The ones used on this page are highlighted; the others were only named in class.
          </What>
          <Worked>
            <div className="grid gap-3 md:grid-cols-2">
              {d.taxonomy.map((fam) => (
                <div key={fam.family} className="rounded-md border px-3 py-2">
                  <div className="text-sm font-medium">{fam.family}</div>
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {fam.leaves.map((l) => (
                      <li key={l.name} className="flex items-center gap-2">
                        <span className="text-muted-foreground">└</span>
                        <span className={l.used ? "rounded bg-primary/10 px-1.5 font-medium text-primary" : "text-muted-foreground"}>{l.name}</span>
                        {l.used && <span className="text-[11px] text-muted-foreground">used here</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Worked>
          <Interpretation>
            We use classical decomposition (6.1), moving averages (6.2) and ARIMA (6.2), and the least-squares regression line on time from the regression family. Exponential smoothing, STS, X11 and neural networks were only named in class and are not used.
          </Interpretation>
        </SubSection>

        <SubSection title="Components of a time series">
          <What>
            <div className="space-y-1">
              {d.components.map((c) => (
                <div key={c.name}>
                  <span className="font-medium">{c.name}:</span> {c.desc}
                </div>
              ))}
            </div>
          </What>
          <Worked title={`The ${months.length} monthly means (rentals per day), train | test split at ${monthLabel(d.meta.test_start)}.`}>
            <ChartCard title="Monthly mean rentals per day" description="Point at the components: the line climbs from year to year (trend), rises every summer and falls every winter (seasonality), and wobbles month to month (irregular).">
              <BandLines data={months} xKey="date" xFormat="monthYearShort" lines={[{ key: "y", label: "Rentals per day", color: C.blue, dots: true, width: 2 }]} splitAt={d.meta.test_start} yLabel="rentals / day" height={280} />
            </ChartCard>
          </Worked>
          <Result
            items={[
              { label: `Trend: mean ${cf.year_a} → ${cf.year_b}`, value: `${fmtInt(cf.mean_year_a)} → ${fmtInt(cf.mean_year_b)}` },
              { label: "Seasonality: low → peak", value: `${cf.low.label} ${fmtInt(cf.low.y)} → ${cf.peak.label} ${fmtInt(cf.peak.y)}` },
            ]}
          />
          <Interpretation>
            Trend: the series shows a long-term increase, the {cf.year_b} months average {fmtInt(cf.mean_year_b)} rentals per day against {fmtInt(cf.mean_year_a)} in {cf.year_a}. Seasonality: a regular pattern repeating every year, low in January and high in late summer ({cf.peak.label} is the peak at {fmtInt(cf.peak.y)}). Cyclical variations need many years to show and cannot be seen in two years of data. Irregularity: the random wobble that neither trend nor season explains, for example {jul11.label} ({fmtInt(jul11.y)}) dipping below {jun11.label} ({fmtInt(jun11.y)}).
          </Interpretation>
        </SubSection>

        <SubSection title="Additive vs multiplicative decomposition">
          <What>
            Decomposition breaks a time series into separate components, trend (T), seasonality (S) and what is left over, the residual (R). Each component is estimated separately, then combined to describe or forecast the series.
          </What>
          <FormulaBlock
            tex={["\\text{Additive:}\\quad Y(t) = T(t) + S(t) + R(t)", "\\text{Multiplicative:}\\quad Y(t) = T(t) \\times S(t) \\times R(t)"]}
            where={[
              ["T(t)", "trend, the long-term direction, estimated with a moving average"],
              ["S(t)", "seasonal index, the repeating pattern of each quarter"],
              ["R(t)", "residual, what is left: Y − T − S (additive) or Y ÷ (T × S) (multiplicative)"],
            ]}
            note={
              <>
                Use the additive model when the seasonal swing stays the same size whether the level is rising or falling, e.g. {d.models.additive_example}. Use the multiplicative model when the seasonal swing grows with the level of the series, e.g. {d.models.multiplicative_example}.
              </>
            }
          />
          <Worked title="Classical decomposition steps, as in class.">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Estimate the trend T with a centred moving average.</li>
              <li>Detrend (Y − T or Y ÷ T), then average by season to get the seasonal component S.</li>
              <li>Residual R = what is left: Y − T − S (additive) or Y ÷ (T × S) (multiplicative).</li>
            </ol>
          </Worked>
        </SubSection>

        {/* ---------------------------------------------------------- additive */}
        <SubSection title={`Additive decomposition on the ${dec.series.length} quarterly means`}>
          <What>
            The quarterly series is the mean rentals per day in each quarter, t = 1..{dec.series.length} ({dec.series[0].label} … {dec.series[dec.series.length - 1].label}), rounded to whole rentals so every piece of arithmetic below is exact. Like the class example the decomposition is done in-sample on all {dec.series.length} quarters and the forecast is for the next year, 2013 Q1–Q4.
          </What>
          <FormulaBlock
            tex={[
              "T(t) = \\dfrac{\\tfrac{1}{2}Y(t-2) + Y(t-1) + Y(t) + Y(t+1) + \\tfrac{1}{2}Y(t+2)}{4}",
              "\\text{Detrended} = Y(t) - T(t)",
              "\\text{Trend per quarter} = \\dfrac{\\text{last } T - \\text{first } T}{\\text{quarters between them}}",
              "\\text{Forecast} = \\text{Trend} + \\text{Seasonal index}",
            ]}
            note="An even season length (4) needs the 2×4 average so the result is centred on t. The first and last two quarters get no trend value. Seasonal indices must sum to 0: subtract (sum ÷ 4) from each raw average."
          />
          <Worked title={`Step 1 — centred 2×4 moving-average trend for t = ${addFirstTrend.t}..${addTrendRows[addTrendRows.length - 1].t}, then detrend Y − T.`}>
            <TrendTable dec={add} op="−" />
          </Worked>
          <Worked title="Step 2 — seasonal indices: arrange the detrended values by year × quarter, total, average, then adjust so the indices sum to 0.">
            <SeasonalTable s={addS} mode="additive" />
            <p className="text-sm">
              Sum of the four averages = {fmt(addS.sum_of_averages, 4)}. {addS.adjustment_text} The adjusted indices sum to {fmt(addS.indices_sum, 4)}.
            </p>
            <p className="text-sm">
              Meaning: {qBelow.map((x) => `${x.q} runs below trend by ${fmtInt(Math.round(Math.abs(x.v)))}`).join(", ")}; {qAbove.map((x) => `${x.q} runs above trend by ${fmtInt(Math.round(x.v))}`).join(", ")} rentals per day.
            </p>
          </Worked>
          <Worked title="Step 3 — trend per quarter: how fast does the trend grow?">
            <KV
              cols={1}
              items={[
                [`First trend point (${add.trend_per_quarter.first_label}, t = ${add.trend_per_quarter.first_t})`, fmt(add.trend_per_quarter.first_T, 2)],
                [`Last trend point (${add.trend_per_quarter.last_label}, t = ${add.trend_per_quarter.last_t})`, fmt(add.trend_per_quarter.last_T, 2)],
                ["Trend per quarter", <Calc key="c">{add.trend_per_quarter.calc} = {fmt(add.trend_per_quarter.value, 2)}</Calc>],
              ]}
            />
            <p className="text-sm">
              Between t = {add.trend_per_quarter.first_t} and t = {add.trend_per_quarter.last_t} there are {add.trend_per_quarter.quarters_between} quarters. The deseasonalised rentals rise by {fmt(add.trend_per_quarter.value, 2)} per day each quarter.
            </p>
          </Worked>
          <Worked title={`Step 4 — forecast = trend + seasonal index for 2013 Q1–Q4, counting the quarters from the last trend value (${add.trend_per_quarter.last_label}, T = ${fmt(add.trend_per_quarter.last_T, 2)}).`}>
            <ForecastTable dec={add} op="+" />
          </Worked>
          <Result items={add.forecasts.map((f) => ({ label: `Additive forecast ${f.label}`, value: fmtInt(Math.round(f.forecast)), hint: "rentals per day" }))} />
          <Interpretation>
            The additive model says the trend adds {fmt(add.trend_per_quarter.value, 0)} rentals per day every quarter and each quarter then sits a fixed amount above or below that trend: {QS.map((q, i) => `${q} ${signed(addS.indices[i], 0)}`).join(", ")}.
          </Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- multiplicative */}
        <SubSection title="Multiplicative decomposition on the same quarters">
          <What>
            Same trend, same steps. The only differences: detrend by division (Y ÷ T), the seasonal indices must sum to 4 (divide each raw average by sum ÷ 4), and the forecast is trend × index.
          </What>
          <FormulaBlock
            tex={["\\text{Detrended ratio} = \\dfrac{Y(t)}{T(t)}", "\\text{Forecast} = \\text{Trend} \\times \\text{Seasonal index}"]}
            note="Seasonal indices must sum to 4 (the number of seasons): divide each raw average by (sum ÷ 4)."
          />
          <Worked title="Step 1 — the same centred 2×4 trend, then the ratio Y ÷ T.">
            <TrendTable dec={mul} op="÷" />
          </Worked>
          <Worked title="Step 2 — seasonal indices adjusted to sum to 4.">
            <SeasonalTable s={mulS} mode="multiplicative" />
            <p className="text-sm">
              Sum of the four averages = {fmt(mulS.sum_of_averages, 4)}. {mulS.adjustment_text} The adjusted indices sum to {fmt(mulS.indices_sum, 4)}.
            </p>
            <p className="text-sm">
              Meaning: {QS.map((q, i) => `${q} is ${fmt(100 * mulS.indices[i], 1)} % of trend`).join(", ")}.
            </p>
          </Worked>
          <Worked title="Step 3 — trend per quarter is unchanged (same T values).">
            <Calc>
              {mul.trend_per_quarter.calc} = {fmt(mul.trend_per_quarter.value, 2)} per quarter
            </Calc>
          </Worked>
          <Worked title="Step 4 — forecast = trend × seasonal index for 2013 Q1–Q4.">
            <ForecastTable dec={mul} op="×" />
          </Worked>
          <Result items={mul.forecasts.map((f) => ({ label: `Multiplicative forecast ${f.label}`, value: fmtInt(Math.round(f.forecast)), hint: "rentals per day" }))} />
          <Interpretation>
            The multiplicative model scales the trend by the index: the seasonal swing grows as the trend grows, so its 2013 summer forecasts sit {mul.forecasts[2].forecast > add.forecasts[2].forecast ? "above" : "below"} the additive ones and its winter forecasts {mul.forecasts[0].forecast < add.forecasts[0].forecast ? "below" : "above"} them.
          </Interpretation>
        </SubSection>

        <SubSection title="Which model fits this series?">
          <Worked title="Does the seasonal swing grow with the level? Compare the Q1 → Q3 swing of each year with the level of each year.">
            <KV
              items={[
                [`${fit.year_a}: Q3 − Q1 swing`, fmtInt(fit.swing_a)],
                [`${fit.year_b}: Q3 − Q1 swing`, fmtInt(fit.swing_b)],
                [`${fit.year_a}: level (mean of 4 quarters)`, fmt(fit.level_a, 1)],
                [`${fit.year_b}: level (mean of 4 quarters)`, fmt(fit.level_b, 1)],
                ["Swing growth", `${signed(fit.swing_growth_pct, 1)} %`],
                ["Level growth", `${signed(fit.level_growth_pct, 1)} %`],
              ]}
            />
            <ChartCard title="Quarterly means, centred trend and the two 2013 forecasts" description="Y for 2011–2012, the centred 2×4 trend T (defined for the middle four quarters and extrapolated into 2013), and the additive and multiplicative forecasts for 2013 Q1–Q4.">
              <BandLines
                data={dec.chart}
                xKey="label"
                lines={[
                  { key: "y", label: "Y (actual)", color: C.blue, dots: true, width: 2 },
                  { key: "T", label: "T (centred 2×4 MA, extrapolated)", color: C.slate, dashed: true, dots: true },
                  { key: "additive", label: "Additive forecast", color: C.green, dots: true },
                  { key: "multiplicative", label: "Multiplicative forecast", color: C.orange, dots: true },
                ]}
                yLabel="rentals / day"
                height={300}
              />
            </ChartCard>
          </Worked>
          <Result label="Better-fitting model" value={bestFit} hint={`swing ${signed(fit.swing_growth_pct, 1)} % vs level ${signed(fit.level_growth_pct, 1)} %`} />
          <Interpretation>
            {bestFit === "additive"
              ? `The swing grew only ${signed(fit.swing_growth_pct, 1)} % (${fmtInt(fit.swing_a)} → ${fmtInt(fit.swing_b)}) while the level rose ${signed(fit.level_growth_pct, 1)} %: the seasonal swing stays about the same size, so the additive model fits this series better than the ${otherFit} one.`
              : `The swing grew ${signed(fit.swing_growth_pct, 1)} % (${fmtInt(fit.swing_a)} → ${fmtInt(fit.swing_b)}), about as fast as the level (${signed(fit.level_growth_pct, 1)} %): the seasonal swing grows with the level, so the multiplicative model fits this series better than the ${otherFit} one.`}{" "}
            With only two years the seasonal table has one value per quarter, so these indices are rougher than the class example with three years.
          </Interpretation>
        </SubSection>

        <ClassCheck title="The slide's 12-quarter sales series (Y1: 18, 20, 34, 44 · Y2: 22, 20, 38, 48 · Y3: 18, 20, 42, 56) through the same functions. Y4Q2 is t = 14 and Y5Q3 is t = 19.">
          <div className="grid gap-3 lg:grid-cols-3">
            <DataTable
              columns={[
                { key: "t", header: "t", align: "right" },
                { key: "ours", header: "T (ours)", align: "right", render: (r) => fmt(r.ours, 1) },
                { key: "slide", header: "T (slide)", align: "right", render: (r) => fmt(r.slide, 1) },
              ] as Column<{ t: number; ours: number; slide: number }>[]}
              rows={sales.trend.map((v, i) => ({ t: i + 3, ours: v, slide: sales.slide_trend[i] }))}
              rowKey={(r) => String(r.t)}
            />
            <DataTable
              columns={[
                { key: "q", header: "Additive index" },
                { key: "ours", header: "Ours", align: "right", render: (r) => fmt(r.ours, 4) },
                { key: "slide", header: "Slide", align: "right", render: (r) => fmt(r.slide, 4) },
              ] as Column<{ q: string; ours: number; slide: number }>[]}
              rows={[
                ...QS.map((q, i) => ({ q, ours: sales.additive.indices[i], slide: sales.additive.slide_indices[i] })),
                { q: "Trend / quarter", ours: sales.additive.trend_per_quarter, slide: sales.additive.slide_trend_per_quarter },
                ...sales.additive.forecasts.map((f, i) => ({ q: `Forecast ${f.label}`, ours: f.value, slide: sales.additive.slide_forecasts[i].value })),
              ]}
              rowKey={(r) => r.q}
            />
            <DataTable
              columns={[
                { key: "q", header: "Multiplicative index" },
                { key: "ours", header: "Ours", align: "right", render: (r) => fmt(r.ours, 3) },
                { key: "slide", header: "Slide", align: "right", render: (r) => fmt(r.slide, 3) },
              ] as Column<{ q: string; ours: number; slide: number }>[]}
              rows={[
                ...QS.map((q, i) => ({ q, ours: sales.multiplicative.indices[i], slide: sales.multiplicative.slide_indices[i] })),
                ...sales.multiplicative.forecasts.map((f, i) => ({ q: `Forecast ${f.label}`, ours: f.value, slide: sales.multiplicative.slide_forecasts[i].value })),
              ]}
              rowKey={(r) => r.q}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The multiplicative forecasts differ from the slide in the second decimal ({fmt(sales.multiplicative.forecasts[0].value, 2)} vs {fmt(sales.multiplicative.slide_forecasts[0].value, 2)}) only because the slide rounds the index to three decimals (0.628) before multiplying; our code keeps full precision.
          </p>
        </ClassCheck>
      </UnitSection>

      {/* =============================================================== 6.2 */}
      <UnitSection
        number="6.2"
        title="Smoothing methods, regression on time and ARIMA"
        intro={`In smoothing based approaches an observation is a function of the past few observations. All four methods below forecast the ${m.n_test} test months (${firstTest.label} … ${lastTest.label}) from the ${m.n_train} training months. The average method and the moving averages forecast one step ahead, so every new actual month joins the past values as the slide does; the regression line and ARIMA are fitted once on the training months and project all ${m.n_test} months ahead.`}
      >
        <SubSection title="Notation">
          <KV
            items={[
              [<Tex key="t">t = 1, 2, \ldots, n</Tex>, "time periods (months here)"],
              [<Tex key="y">y_1, y_2, \ldots, y_n</Tex>, "observed data for each period (mean rentals per day)"],
              [<Tex key="F">F_t</Tex>, "forecast for period t (h = 1 step ahead)"],
              [<Tex key="e">e_t = y_t - F_t</Tex>, "forecast error; positive means the forecast was too low"],
            ]}
          />
        </SubSection>

        {/* ---------------------------------------------------------- average */}
        <SubSection title="Average method">
          <What>Forecast = average of all past observations. Every new point is added, so old data never leaves the average. This makes it slow to react.</What>
          <FormulaBlock tex={["F(t) = \\dfrac{y(1) + y(2) + \\cdots + y(t-1)}{t-1}", "e(t) = y(t) - F(t)"]} />
          <Worked title={`One step ahead for the ${m.n_test} test months; F(${avgF[0].t}) is the mean of the ${m.n_train} training months, F(${avgF[1].t}) adds the actual ${firstTest.label}, and so on.`}>
            <ForecastRows fcs={avgF} months={months} />
          </Worked>
          <Result label={`F(${avgF[0].t}) for ${firstTest.label}`} value={fmt(avgF[0].F, 2)} hint={`actual ${fmtInt(firstTest.y)}, error ${signed(firstTest.y - avgF[0].F)}`} />
          <Interpretation>
            Every error is positive: the forecast is too low in every test month. The series is rising, and the mean of all past months is weighed down by the low months of {cf.year_a} (as low as {fmtInt(cf.low.y)} in {cf.low.label}), so the average method under-forecasts badly here.
          </Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- moving average */}
        <SubSection title="Moving average method (k = 3)">
          <What>The average method keeps every old value, so it is slow to react when the data changes. Fix: use only the last k = 3 values; older values drop out of the window. Limitation: no forecast for the first k points, and k must be chosen.</What>
          <FormulaBlock tex={["F(t) = \\dfrac{y(t-1) + y(t-2) + y(t-3)}{3}", "e(t) = y(t) - F(t)"]} />
          <Worked title={`One step ahead: F(${ma3F[0].t}) uses the last three training months, F(${ma3F[1].t}) uses ${trainMonths[trainMonths.length - 2].label}, ${lastTrain.label} and the actual ${firstTest.label}.`}>
            <ForecastRows fcs={ma3F} months={months} />
          </Worked>
          <Result label={`F(${ma3F[0].t}) for ${firstTest.label}`} value={fmt(ma3F[0].F, 2)} hint={`actual ${fmtInt(firstTest.y)}, error ${signed(firstTest.y - ma3F[0].F)}`} />
          <Interpretation>
            With only the last three months in the window the forecast follows the level the series has just reached, so the errors are much smaller than the average method. It still lags by about a month: when the autumn fall begins the window still holds the summer months. A 12-month window (k = 12, the whole previous year) is shown in the comparison table of 6.3 only; it averages the low {cf.year_a} months back in.
          </Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- regression on t */}
        <SubSection title="Time-series analysis using linear regression (least-square method)">
          <What>
            Fit a straight line through the training months with the time index as x (x = t = 1..{reg.n}) and the monthly mean as y, then read the forecast off the line at t = {reg.forecasts[0].t}..{reg.forecasts[reg.forecasts.length - 1].t}. Steps: collect the data, plot it, calculate the slope and intercept with the least-square formulas, fit the line, make the prediction.
          </What>
          <FormulaBlock
            tex={["y' = ax + b", "a = \\dfrac{n\\sum xy - (\\sum x)(\\sum y)}{n\\sum x^2 - (\\sum x)^2}", "b = \\dfrac{\\sum y - a\\sum x}{n}"]}
            where={[
              ["a", "slope (rentals per day gained per month of growth)"],
              ["b", "intercept (the line's value at x = 0)"],
              ["n", `number of training months (${reg.n})`],
            ]}
            note="Lettering warning: in Unit 6 the teacher writes a for the slope and b for the intercept (y′ = ax + b). This is the reverse of Unit 4, where Y = a + bX has a as the intercept and b as the slope. Same line, swapped letters."
          />
          <Worked title={`The least-square table on the ${reg.n} training months.`}>
            <DataTable columns={regCols} rows={regRows} rowKey={(r) => String(r.x)} />
            <div className="space-y-1 text-sm">
              <div>
                a = <Calc>{reg.a_calc}</Calc>
              </div>
              <div>
                b = <Calc>{reg.b_calc}</Calc>
              </div>
            </div>
          </Worked>
          <Worked title={`Forecasts on the line y′ = ${fmt(reg.a, 2)}x + ${fmt(reg.b, 2)} for the ${m.n_test} test months.`}>
            <ForecastRows fcs={reg.forecasts} months={months} />
          </Worked>
          <Result
            items={[
              { label: "Slope a", value: fmt(reg.a, 2), hint: "rentals per day gained per month" },
              { label: "Intercept b", value: fmt(reg.b, 2), hint: "line value at x = 0" },
              { label: "Regression line", value: reg.equation },
            ]}
          />
          <Interpretation>
            The slope says the series gains about {fmt(reg.a, 0)} rentals per day for every month of growth. The line carries that growth into the test months, so unlike the average method it does not under-forecast the level; but a straight line has no seasonal term, so it keeps rising through the autumn while the actual months fall from {peakTest.label} ({fmtInt(peakTest.y)}) to {lastTest.label} ({fmtInt(lastTest.y)}).
          </Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- ARIMA */}
        <SubSection title="ARIMA(p, d, q)">
          <What>
            <div className="space-y-1">
              <div>
                <span className="font-medium">AR (p):</span> autoregression, the value is regressed on its own p past values.
              </div>
              <div>
                <span className="font-medium">I (d):</span> integrated, the series is differenced d times (y(t) − y(t−1)) until it is stationary, i.e. until it has no trend.
              </div>
              <div>
                <span className="font-medium">MA (q):</span> moving average, the value is regressed on the q past forecast errors.
              </div>
              <div className="text-muted-foreground">ARIMA was only named in class (under the regression family); it is fitted here with the statsmodels library and the order is chosen by two plain rules below.</div>
            </div>
          </What>
          <FormulaBlock
            tex={["y'_t = c + \\phi_1 y'_{t-1} + \\cdots + \\phi_p y'_{t-p} + \\theta_1 e_{t-1} + \\cdots + \\theta_q e_{t-q} + e_t", "y'_t = \\text{the series after differencing } d \\text{ times}"]}
            where={[
              ["\\phi_i", "AR coefficients (weights on past values)"],
              ["\\theta_j", "MA coefficients (weights on past errors)"],
              ["\\text{AIC}", "Akaike information criterion: lower is better, it penalises extra terms"],
            ]}
          />
          <Note tone="warn" title="Self-learning: choosing d with a stationarity check (ADF test)">
            <p>
              A series is stationary when its mean does not drift over time. The augmented Dickey–Fuller (ADF) test has H₀: the series is not stationary. Calculated ADF statistic vs tabulated 5 % critical value; if the calculated value is below (more negative than) the critical value, H₀ is rejected and the series is stationary.
            </p>
            <DataTable
              className="mt-2 bg-background"
              columns={[
                { key: "name", header: "Series" },
                { key: "n", header: "n", align: "right" },
                { key: "statistic", header: "Calculated ADF", align: "right", render: (r) => fmt(r.statistic, 3) },
                { key: "critical_5pct", header: "Tabulated (5 %)", align: "right", render: (r) => fmt(r.critical_5pct, 3) },
                { key: "stationary", header: "Conclusion", render: (r) => (r.stationary ? "H₀ rejected → stationary" : "H₀ accepted → not stationary") },
              ] as Column<Adf>[]}
              rows={ari.adf}
              rowKey={(r) => r.name}
            />
            <p className="mt-2">
              The training months in levels are not stationary (calculated {fmt(adfLevel.statistic, 3)} is above the tabulated {fmt(adfLevel.critical_5pct, 3)}), so we difference once: d = {ari.d}. {adfDiff.stationary ? `After one difference the series is stationary (${fmt(adfDiff.statistic, 3)} is below ${fmt(adfDiff.critical_5pct, 3)}).` : `After one difference the test still accepts H₀ (${fmt(adfDiff.statistic, 3)} vs ${fmt(adfDiff.critical_5pct, 3)}); with only ${adfDiff.n} differences the test has little power, and differencing an 18-month series twice would leave almost nothing to fit, so we stop at d = 1, the small order the class rule allows.`}
            </p>
          </Note>
          <Worked title={`Choosing (p, q) ≤ 2 with d = ${ari.d}: fit every order on the ${m.n_train} training months and keep the lowest AIC.`}>
            <DataTable columns={gridCols} rows={ari.grid} rowKey={(r) => `${r.p}${r.d}${r.q}`} />
            <p className="text-sm">
              Lowest AIC = {fmt(ari.aic, 2)} → {ari.order}. Fitted coefficients: {Object.entries(ari.params).map(([k, v]) => `${k} = ${fmt(v, 4)}`).join(", ")}.
            </p>
          </Worked>
          <Worked title={`${ari.order} fitted on the training months, then forecast ${m.n_test} steps ahead.`}>
            <ForecastRows fcs={m.evaluation.arima.rows.map((r) => ({ t: r.t, F: r.F, calc: null }))} months={months} showCalc={false} />
            <ChartCard title={`${ari.order}: fitted values on the training months and the forecast for the test months`} description="The fitted line is the model's one-step prediction of each training month from the months before it; the forecast is projected from the last training month.">
              <BandLines
                data={m.chart}
                xKey="date"
                xFormat="monthYearShort"
                lines={[
                  { key: "y", label: "Actual", color: C.blue, dots: true, width: 2 },
                  { key: "arima_fit", label: "Fitted (training)", color: C.violet, dashed: true },
                  { key: "arima", label: `${ari.order} forecast`, color: C.violet, dots: true },
                ]}
                splitAt={d.meta.test_start}
                yLabel="rentals / day"
                height={280}
              />
            </ChartCard>
          </Worked>
          <Result label="Chosen order" value={ari.order} hint={`AIC ${fmt(ari.aic, 2)}, d from the ADF check, (p, q) from the lowest AIC`} />
          <Interpretation>
            With d = {ari.d} the model works on month-to-month changes, so it starts from the last training level ({lastTrain.label}, {fmtInt(lastTrain.y)}) and carries the recent momentum forward{ari.p > 0 ? ` through the AR(${ari.p}) term` : ""}. Like the regression line it has no seasonal term, so it cannot turn down when the autumn months fall.
          </Interpretation>
        </SubSection>

        <ClassCheck title="The slide's examples through the same functions: average and moving-average on y = 20, 22, 21, 25, 24, 26 (forecast t = 7), and the least-square line on x = 1..5, y = 12, 19, 29, 37, 45 (estimate month 6). The slide's MASE for the two smoothing examples divides by the naive error of the same rows, so the check does the same.">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-2">
              <KV cols={1} items={[["Average method F(7)", `${fmt(ccm.average.F7, 2)} (slide ${fmt(ccm.average.slide_F7, 2)})`]]} />
              <MetricCompare title="Average method" ours={ccm.average.metrics} slide={ccm.average.slide_metrics} />
            </div>
            <div className="space-y-2">
              <KV cols={1} items={[["Moving average F(7)", `${fmt(ccm.ma3.F7, 2)} (slide ${fmt(ccm.ma3.slide_F7, 2)})`]]} />
              <MetricCompare title="Moving average k = 3" ours={ccm.ma3.metrics} slide={ccm.ma3.slide_metrics} />
            </div>
            <div className="space-y-2">
              <KV
                cols={1}
                items={[
                  ["a (slope)", `${fmt(ccm.regression.a, 1)} (slide ${fmt(ccm.regression.slide_a, 1)})`],
                  ["b (intercept)", `${fmt(ccm.regression.b, 1)} (slide ${fmt(ccm.regression.slide_b, 1)})`],
                  ["Month 6", `${fmt(ccm.regression.F6, 1)} (slide ${fmt(ccm.regression.slide_F6, 1)})`],
                ]}
              />
              <MetricCompare title="Regression (in-sample)" ours={ccm.regression.metrics} slide={ccm.regression.slide_metrics} />
            </div>
          </div>
        </ClassCheck>
      </UnitSection>

      {/* =============================================================== 6.3 */}
      <UnitSection number="6.3" title="Performance evaluation" intro={`Every method is judged on the same ${m.n_test} test months with the four metrics from class, laid out in the teacher's table: t | y | F | e | |e| | e² | |e| ÷ y | Naive error, then a Sum row and the four boxed metrics.`}>
        <SubSection title="The four metrics">
          <What>
            <div className="space-y-1">
              <div>
                <span className="font-medium">MAE</span> measures the average magnitude of errors in a set of predictions, without considering their direction (treats all errors equally).
              </div>
              <div>
                <span className="font-medium">RMSE</span> is the square root of the average of squared differences between predicted and actual values.
              </div>
              <div>
                <span className="font-medium">MAPE</span> measures errors as a percentage of the actual values, making it scale-independent and easy to compare across different datasets.
              </div>
              <div>
                <span className="font-medium">MASE</span> (Hyndman and Koehler) scales the model’s MAE against the in-sample MAE of a simple naïve forecast. MASE &lt; 1 means the model performs better than the naïve baseline; MASE &gt; 1 means it performs worse.
              </div>
            </div>
          </What>
          <FormulaBlock
            tex={[
              "\\text{MAE} = \\frac{1}{n}\\sum_{t=1}^{n} |e_t|",
              "\\text{RMSE} = \\sqrt{\\text{MSE}} = \\sqrt{\\frac{1}{n}\\sum_{t=1}^{n} e_t^2}",
              "\\text{MAPE} = \\frac{100\\%}{n}\\sum_{t=1}^{n} \\left|\\frac{e_t}{y_t}\\right|",
              "\\text{MASE} = \\frac{\\text{MAE}}{\\text{MAE}_{\\text{in-sample, naïve}}} = \\frac{\\frac{1}{n}\\sum_{t=1}^{n}|e_t|}{\\frac{1}{n-1}\\sum_{j=2}^{n}|y_j - y_{j-1}|}",
            ]}
            where={[
              ["n", `number of forecast months (${m.n_test})`],
              ["e_t = y_t - F_t", "forecast error"],
              ["|y_j - y_{j-1}|", "naïve error, the change from the previous month"],
            ]}
            note={`The MASE denominator is the naïve MAE in-sample, i.e. on the ${m.n_train} training months: the average month-to-month change a forecaster would make by simply repeating last month. The "Naive error" column in each table shows the same quantity on the test months for reference, as the slide does.`}
          />
          <Worked title={`The in-sample naïve MAE on the ${m.naive_train.n} training months (${m.naive_train.n_diffs} differences): the MASE denominator shared by every method.`}>
            <DataTable
              columns={[
                { key: "t", header: "j", align: "right" },
                { key: "y_prev", header: "y(j − 1)", align: "right", render: (r) => fmtInt(r.y_prev) },
                { key: "y", header: "y(j)", align: "right", render: (r) => fmtInt(r.y) },
                { key: "abs_diff", header: "|y(j) − y(j−1)|", align: "right", render: (r) => fmtInt(r.abs_diff) },
              ] as Column<{ t: number; y: number; y_prev: number; abs_diff: number }>[]}
              rows={m.naive_train.rows}
              rowKey={(r) => String(r.t)}
            />
            <p className="text-sm">
              Σ|y(j) − y(j−1)| = {fmtInt(m.naive_train.sum_abs_diff)}; naïve MAE = <Calc>{m.naive_train.calc}</Calc>.
            </p>
          </Worked>
          <Result label="In-sample naïve MAE (training months)" value={fmt(m.naive_train.mae, 2)} hint="MASE denominator" />
          <Interpretation>A method with MASE below 1 beats simply repeating last month; above 1 it does worse than that naïve rule.</Interpretation>
        </SubSection>

        {evalKeys.map((k) => {
          const ev = m.evaluation[k];
          return (
            <SubSection key={k} title={`Evaluation: ${ev.label}`}>
              <Worked title={`The ${ev.n} test months.`}>
                <EvalTable ev={ev} />
              </Worked>
              <MetricBoxes ev={ev} />
              <Interpretation>
                On average the {ev.label.toLowerCase()} misses the actual month by {fmt(ev.metrics.MAE, 0)} rentals per day (about {fmt(ev.metrics.MAPE, 1)} %). {ev.metrics.MASE < 1 ? `MASE ${fmt(ev.metrics.MASE, 2)} < 1: it beats the naïve forecast.` : `MASE ${fmt(ev.metrics.MASE, 2)} > 1: it does worse than simply repeating last month.`} {m.reasons[k].charAt(0).toUpperCase() + m.reasons[k].slice(1)}
              </Interpretation>
            </SubSection>
          );
        })}

        <SubSection title="Comparison of all methods">
          <Worked title={`All methods on the same ${m.n_test} test months. The decomposition forecasts are for 2013 quarters and were evaluated in-sample like the class example, so they are not in this table.`}>
            <DataTable columns={compCols} rows={comparison} rowKey={(r) => r.key} />
            <ChartCard title="Test months: actual and every forecast" description="The training months are shown for context; the forecasts start at the train | test line.">
              <BandLines
                data={m.chart}
                xKey="date"
                xFormat="monthYearShort"
                lines={[
                  { key: "y", label: "Actual", color: C.blue, dots: true, width: 2.2 },
                  { key: "average", label: "Average method", color: C.gray, dots: true },
                  { key: "ma3", label: "Moving average k = 3", color: C.green, dots: true },
                  { key: "ma12", label: "Moving average k = 12", color: C.teal, dashed: true, dots: true },
                  { key: "regression", label: "Regression on t", color: C.orange, dots: true },
                  { key: "arima", label: ari.order, color: C.violet, dots: true },
                ]}
                splitAt={d.meta.test_start}
                yLabel="rentals / day"
                height={320}
              />
            </ChartCard>
          </Worked>
          <Result
            items={[
              { label: "Best method (lowest MAE)", value: m.best.method, hint: `MAE ${fmt(m.evaluation[m.best.key].metrics.MAE, 2)}, MASE ${fmt(m.evaluation[m.best.key].metrics.MASE, 3)}` },
              { label: "Worst method", value: m.worst.method, hint: `MAE ${fmt(m.evaluation[m.worst.key].metrics.MAE, 2)}` },
            ]}
          />
          <Interpretation>
            {m.best.method} is best because {m.best.reason} {m.worst.method} is worst because {m.worst.reason} Methods with no trend term (the average and the 12-month moving average) under-forecast a growing series; the regression line on t and ARIMA with d = 1 track the growth but have no seasonal term, so they overshoot once the autumn fall begins.{" "}
            {allMaseAboveOne ? `Every MASE is above 1: on these ${m.n_test} months none of the methods beats simply repeating last month, because the test period contains the turn from the summer peak to the winter low, which only a seasonal method (like the decomposition of 6.1) can anticipate.` : "A MASE below 1 means that method beats simply repeating last month."}
          </Interpretation>
        </SubSection>
      </UnitSection>
    </PageShell>
  );
}
