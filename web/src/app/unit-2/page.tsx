import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { UnitSection, SubSection, What, FormulaBlock, Worked, Result, Interpretation, ClassCheck } from "@/components/syllabus";
import { ChartCard, DataTable, KV, Note } from "@/components/blocks";
import { Tex } from "@/components/formula";
import { Histogram, LineSeries, BarSeries, ComposedSeries } from "@/components/charts/series";
import { ScatterPlot, CategoryBars } from "@/components/charts/scatter";
import { BoxPlot, Heatmap } from "@/components/charts/grids";
import { Donut } from "@/components/charts/donut";
import { GroupedTable, type GroupedRow } from "@/components/unit-2/grouped-table";
import { TwoWayTable, type TwoWay } from "@/components/unit-2/two-way-table";
import { BubbleChart, type Bubble } from "@/components/unit-2/bubble-chart";
import { ScatterMatrix, type MatrixPair } from "@/components/unit-2/scatter-matrix";
import { C, SEASON_COLORS } from "@/lib/colors";
import { fmt, fmtInt } from "@/lib/format";

/* ------------------------------------------------------------------ types for unit2.json */
type Positional = { pos: number; idx: number; L: number; cf_prev: number; f: number; i: number; value: number };
type Grouped = {
  N: number;
  i: number;
  k: number;
  A: number;
  modal_idx: number;
  rows: GroupedRow[];
  sums: { f: number; fm: number; fd: number; fd2: number; f_dev2: number; f_dev3: number; f_dev4: number };
  mean: { direct: number; step: number; A: number; sum_fd_over_N: number };
  median: Positional;
  mode: { value: number; L: number; f0: number; f1: number; f2: number; delta1: number; delta2: number; i: number; empirical: number; order: string[] };
  quartiles: { q1: Positional; q3: Positional; iqr: number; qd: number; coef_qd: number };
  sigma: { value: number; sum_fd2_over_N: number; sum_fd_over_N_sq: number; inside_root: number };
  skewness: { pearson: number; pearson_median_form: number; bowley: number; absolute: number };
  moments: { mu2: number; mu3: number; mu4: number; beta2: number; beta1: number; sqrt_mu2: number };
  raw: { L: number; S: number; range: number; coef_range: number; range_classes: number; coef_range_classes: number; mean: number; median: number; sigma: number };
};
type Sturges = { N: number; log10_N: number; k_raw: number; k: number; L: number; S: number; i_raw: number; i: number; start: number; n_classes: number; end: number };
type Pair = { n: number; x_mean: number; y_mean: number; sum_x2: number; sum_y2: number; sum_xy: number; r: number; x: string; x_label: string; degree: string; root: number };
type Bin = { x0: number; x1: number; mid: number; count: number; density: number; normal?: number };
type Dist = { mu: number; sigma: number; n: number; bins: Bin[]; rule: Array<{ k: number; lower: number; upper: number; days: number; actual_pct: number; expected_pct: number }> };
type BoxItem = {
  key: string; n: number; min: number; q1: number; median: number; q3: number; max: number; mean: number; iqr: number;
  lower_fence: number; upper_fence: number; whisker_low: number; whisker_high: number; outliers: number; outlier_values: number[];
  pos_q1: number; pos_q3: number; median_position: number | null; left_whisker: number; right_whisker: number; reading: string;
};
type Unit2 = {
  meta: { n_days: number; start: string; end: string };
  types: Array<{ attribute: string; label: string; kind: string; level: string; discrete: string; why: string; n_distinct: number; examples: string[] }>;
  properties: Array<{ property: string; question: string; check: string; value: string }>;
  classification: {
    chronological: Array<{ year: number; mean_cnt: number; days: number }>;
    geographical: string;
    qualitative_weather: Array<{ group: string; mean_cnt: number; days: number }>;
    qualitative_day_type: Array<{ group: string; mean_cnt: number; days: number }>;
  };
  sturges: Sturges;
  sturges_temp: Sturges;
  freq_table: GroupedRow[];
  tabulation: TwoWay;
  diagrams: {
    simple_bar: Array<{ group: string; mean_cnt: number }>;
    subdivided_bar: Array<{ season: string; casual: number; registered: number; total: number; casual_pct: number; registered_pct: number }>;
    pie: { N: number; slices: Array<{ group: string; days: number; pct: number; angle: number }>; angle_total: number };
  };
  graphs: { monthly_line: Array<{ date: string; label: string; cnt: number }>; polygon: Array<{ label: string; m: number; f: number }>; apex: { label: string; m: number; f: number }; line_min: number; line_max: number };
  cnt: Grouped;
  temp: Grouped;
  class_checks: {
    pearson: { slide: { mode: number; mean: number; sigma: number; sk: number }; ours: { mode: number; mean: number; sigma: number; sk: number }; A: number; N: number; sum_fd: number; sum_fd2: number };
    kurtosis: { slide: { mean: number; mu2: number; mu4: number; beta2: number }; ours: { mean: number; mu2: number; mu4: number; beta2: number } };
    bowley: { slide: { median: number; q1: number; q3: number; sk: number }; ours: { median: number; q1: number; q3: number; sk: number } };
  };
  multivariate: {
    mean_vector: Array<{ var: string; label: string; mean: number }>;
    pairs: Pair[];
    direct: { N: number; sum_x: number; sum_y: number; sum_x2: number; sum_y2: number; sum_xy: number; numerator: number; den_x: number; den_y: number; r: number };
    reasons: Array<{ reason: string; pair: string; r: number; text: string }>;
    types: Array<{ type: string; basis: string; example: string }>;
    curve: Array<{ label: string; m: number; days: number; mean_cnt: number }>;
    extra_r: { cnt_hum: number; cnt_wind: number; temp_wind: number };
  };
  viz: {
    sqrt_rule: { n: number; sqrt_n: number; bins: number; sturges_bins: number };
    hist_sqrt: Bin[];
    dist_cnt: Dist;
    dist_temp: Dist;
    box: { items: BoxItem[]; all: { n: number; q1: number; q3: number; iqr: number; lower_fence: number; upper_fence: number; outliers: number; pos_q1: number; pos_q3: number } };
    scatter: Array<{ x: number; y: number; group: string; label: string }>;
    matrix: { vars: string[]; labels: Record<string, string>; pairs: MatrixPair[] };
    bubble: Bubble[];
    heat: { rows: string[]; cols: string[]; cells: Array<{ row: string; col: string; value: number }>; best: { row: string; col: string; value: number }; worst: { row: string; col: string; value: number } };
  };
  headline: { mean: number; median: number; mode: number; sigma: number; sk_pearson: number; sk_bowley: number; beta2: number; r_temp: number; order: string[] };
};

const SEASON: Record<string, string> = { Winter: SEASON_COLORS.Winter, Spring: SEASON_COLORS.Spring, Summer: SEASON_COLORS.Summer, Fall: SEASON_COLORS.Autumn };
const YEAR: Record<string, string> = { "2011": C.slate, "2012": C.blue };
const sgn = (v: number, d = 3) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;
const skewWord = (sk: number) => (Math.abs(sk) < 0.05 ? "≈ 0 → almost symmetrical" : sk > 0 ? "> 0 → positively skewed, long tail to the right" : "< 0 → negatively skewed, long tail to the left");
const kurtWord = (b2: number) => (Math.abs(b2 - 3) < 0.05 ? "β₂ = 3 → Mesokurtic, same peakedness as the normal curve" : b2 > 3 ? "β₂ > 3 → Leptokurtic, more peaked than normal (narrow, tall peak)" : "β₂ < 3 → Platykurtic, flatter than normal (broad, flat top)");

export default async function Unit2Page() {
  const d = await loadData<Unit2>("unit2");
  const g = d.cnt;
  const t = d.temp;
  const st = d.sturges;
  const mv = d.multivariate;
  const temp = mv.pairs[0];
  const med = g.median;
  const q1 = g.quartiles.q1;
  const q3 = g.quartiles.q3;
  const modalRow = g.rows[g.modal_idx];
  const medianRow = g.rows[med.idx];
  const order = g.mode.order; // ascending
  const tOrder = t.mode.order;
  const n1 = d.viz.dist_cnt.rule[0];

  return (
    <PageShell
      module="2"
      title="Data exploration using descriptive statistics"
      description={`Step 2-A of the process: explore before you pre-process. The ${fmtInt(d.meta.n_days)} daily rental counts (${d.meta.start} to ${d.meta.end}) are classified, tabulated and drawn, then every univariate measure is computed from one frequency table by the step-deviation method exactly as in class. Temperature is the contrast variable; Karl Pearson's r links the two.`}
      concepts={["Types of data", "Properties of data", "Classification", "Tabulation", "Diagrams & graphs", "Mean · Median · Mode", "Range · Q.D. · σ", "Skewness", "Kurtosis", "Central data point", "Karl Pearson's r", "Histogram", "Box plot", "Distribution chart", "Scatter · Bubble"]}
    >
      {/* ================================================================ 2.1 */}
      <UnitSection number="2.1" title="Types of data, properties of data" intro="Before any formula, decide what kind of value each column holds. The level of measurement decides which calculations are allowed.">
        <What>
          Data is either <strong>qualitative</strong> (categorical: nominal or ordinal) or <strong>quantitative</strong> (numerical: discrete or continuous). The four levels of measurement are Nominal (named), Ordinal (named + ordered),
          Interval (named + ordered + proportionate interval between values) and Ratio (all of that + an absolute zero). Each level builds on the one before it.
        </What>
        <FormulaBlock
          tex={["\\text{Nominal} \\;\\subset\\; \\text{Ordinal} \\;\\subset\\; \\text{Interval} \\;\\subset\\; \\text{Ratio}"]}
          where={[
            ["\\text{Nominal}", "put data in categories only (equality check)"],
            ["\\text{Ordinal}", "+ arrange in order"],
            ["\\text{Interval}", "+ subtract values (differences are meaningful)"],
            ["\\text{Ratio}", "+ determine if one value is a multiple of another (true zero)"],
          ]}
        />
        <Worked title="Every attribute that goes forward from Unit 1, classified. The number of distinct values and the range come from the data.">
          <DataTable
            rows={d.types}
            rowKey={(r) => r.attribute}
            columns={[
              { key: "label", header: "Attribute", render: (r) => <span className="font-medium">{r.label}</span> },
              { key: "attribute", header: "Column", render: (r) => <span className="font-mono text-xs">{r.attribute}</span> },
              { key: "kind", header: "Qualitative / quantitative" },
              { key: "level", header: "Level" },
              { key: "discrete", header: "Discrete / continuous" },
              { key: "n_distinct", header: "Distinct values", align: "right" },
              { key: "examples", header: "Range / examples", render: (r) => <span className="text-xs text-muted-foreground">{r.examples.join(" … ")}</span> },
              { key: "why", header: "Why", render: (r) => <span className="text-xs text-muted-foreground">{r.why}</span> },
            ]}
          />
        </Worked>
        <Result
          items={[
            { label: "Quantitative attributes", value: d.types.filter((x) => x.kind === "Quantitative").length, hint: "can enter the formulas of 2.3" },
            { label: "Qualitative attributes", value: d.types.filter((x) => x.kind === "Qualitative").length, hint: "only counted, never measured" },
            { label: "Ratio", value: d.types.filter((x) => x.level === "Ratio").length },
            { label: "Interval", value: d.types.filter((x) => x.level === "Interval").length },
            { label: "Ordinal", value: d.types.filter((x) => x.level === "Ordinal").length },
            { label: "Nominal", value: d.types.filter((x) => x.level === "Nominal").length },
          ]}
        />
        <Interpretation>
          The main variable <strong>cnt</strong> is quantitative, ratio and discrete: it is a count with a true zero, so mean, σ and ratios (“twice as many rentals”) are all meaningful. Temperature is interval: we may say “5 °C warmer”, never “twice as warm”, because 0 °C is not the absence of temperature. Season, weather situation and day type are qualitative; they can only be counted, so they appear as the groups in the tables and diagrams of 2.2, never inside a formula.
        </Interpretation>

        <SubSection title="Properties of data — the quality checklist" className="pt-2">
          <What>Five characteristics decide whether data can be trusted: accuracy, completeness, reliability, relevance and timeliness. Each is a question to ask of the dataset.</What>
          <Worked title="The teacher's five questions, answered for this dataset with the number that supports each answer.">
            <DataTable
              rows={d.properties}
              rowKey={(r) => r.property}
              columns={[
                { key: "property", header: "Characteristic", render: (r) => <span className="font-medium">{r.property}</span> },
                { key: "question", header: "How it's measured", render: (r) => <span className="text-xs text-muted-foreground">{r.question}</span> },
                { key: "check", header: "Applied to our data", render: (r) => <span className="text-xs">{r.check}</span> },
                { key: "value", header: "Evidence", align: "right", render: (r) => <span className="font-mono text-xs">{r.value}</span> },
              ]}
            />
          </Worked>
          <Result items={[{ label: "Missing cells", value: d.properties[1].value }, { label: "Contradictions found", value: d.properties[2].value }, { label: "Age of the data", value: d.properties[4].value }]} />
          <Interpretation>The data is accurate, complete and (after the one humidity fix in Unit 1) reliable. Its weakness is timeliness: it describes 2011–2012, so every conclusion on this site is about how demand behaved then, not a live report.</Interpretation>
        </SubSection>
      </UnitSection>

      {/* ================================================================ 2.2 */}
      <UnitSection number="2.2" title="Classification, tabulation, diagrammatic and graphic representation" intro="Classification first, then tabulation, then pictures: the raw 731 rows become a frequency table that the rest of the unit computes from.">
        <SubSection title="Classification">
          <What>
            Classification is the grouping of related facts into classes sharing a common characteristic, like sorting post-office letters by destination city. The four types are <strong>geographical</strong> (by area), <strong>chronological</strong> (by time), <strong>qualitative</strong> (by an attribute that is present or absent) and <strong>quantitative</strong> (by magnitude, which gives a frequency distribution).
          </What>
          <Worked title="The four types of classification, applied to this dataset.">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chronological — by year</div>
                <KV cols={1} items={d.classification.chronological.map((r) => [`${r.year} (${r.days} days)`, `${fmtInt(r.mean_cnt)} rentals / day`])} />
              </div>
              <div className="rounded-lg border p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Geographical — by area</div>
                <p className="text-sm text-muted-foreground">{d.classification.geographical}</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qualitative — by weather situation (manifold: also by day type)</div>
                <KV cols={1} items={[...d.classification.qualitative_weather, ...d.classification.qualitative_day_type].map((r) => [`${r.group} (${r.days} days)`, `${fmtInt(r.mean_cnt)} rentals / day`])} />
              </div>
              <div className="rounded-lg border p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quantitative — by magnitude of cnt</div>
                <p className="text-sm text-muted-foreground">The continuous frequency distribution built below: {st.k} exclusive classes of width {fmtInt(st.i)}. Every formula in 2.3 uses this table.</p>
              </div>
            </div>
          </Worked>
          <Interpretation>Qualitative classes are counted (463 clear days, 247 misty, 21 rainy); quantitative classes are measured and therefore need class limits, a class interval and a mid-point, which is what Sturges&apos; rule decides next.</Interpretation>
        </SubSection>

        <SubSection title="The frequency distribution of cnt (quantitative classification)">
          <What>A frequency distribution groups raw data into classes and records the number of cases, the frequency, in each class. Sturges&apos; rule fixes the number of classes; the class interval is the range divided by that number. The exclusive method is used for a continuous variable: the item equal to the upper limit goes to the next class.</What>
          <FormulaBlock
            tex={["k = 1 + 3.322\\,\\log_{10} N", "i = \\frac{L - S}{k}", "m = \\frac{\\text{Upper limit} + \\text{Lower limit}}{2}"]}
            where={[
              ["N", "number of observations"],
              ["k", "number of classes"],
              ["L,\\ S", "largest and smallest item"],
              ["i", "class interval (width), rounded to a convenient number"],
              ["m", "mid-point, taken to represent the whole class"],
            ]}
          />
          <Worked title="Sturges' rule on the 731 daily counts, then the tally.">
            <KV
              cols={2}
              items={[
                [<span key="n">N</span>, fmtInt(st.N)],
                [<span key="l">log₁₀ N</span>, fmt(st.log10_N, 4)],
                [<span key="k">k = 1 + 3.322 × {fmt(st.log10_N, 4)}</span>, `${fmt(st.k_raw, 2)} ≈ ${st.k} classes`],
                [<span key="ls">L − S</span>, `${fmtInt(st.L)} − ${fmtInt(st.S)} = ${fmtInt(st.L - st.S)}`],
                [<span key="i">i = (L − S) / k = {fmtInt(st.L - st.S)} / {st.k}</span>, `${fmt(st.i_raw, 1)} → rounded to ${fmtInt(st.i)}`],
                [<span key="c">Classes (exclusive, starting at {st.start})</span>, `${st.start}–${fmtInt(st.i)}, ${fmtInt(st.i)}–${fmtInt(2 * st.i)}, …, ${fmtInt(st.end - st.i)}–${fmtInt(st.end)} (${st.n_classes} classes)`],
              ]}
            />
            <GroupedTable
              rows={d.freq_table}
              columns={[
                { key: "label", header: "Class (rentals per day)" },
                { key: "m", header: <span>Mid-point <Tex>m</Tex></span>, format: "int" },
                { key: "tally", header: <span>Tally → <Tex>f</Tex></span>, format: "int" },
                { key: "cf", header: <Tex>cf</Tex>, format: "int" },
                { key: "rel_pct", header: "Relative frequency %", format: 2 },
              ]}
              sums={{ tally: g.N, rel_pct: 100 }}
              highlight={{ modal: true }}
              marks={{ modal: "modal class (highest f)" }}
            />
          </Worked>
          <Result items={[{ label: "Classes k", value: st.k }, { label: "Class interval i", value: fmtInt(st.i) }, { label: "N = Σf", value: fmtInt(g.N) }, { label: "Modal class", value: modalRow.label, hint: `f = ${modalRow.f}` }]} />
          <Interpretation>
            The class {modalRow.label} holds the most days ({modalRow.f}, {fmt(modalRow.rel_pct, 1)} %). Frequencies rise to that class and fall after it with a long run of days between 6,400 and 8,000, which already hints at a flat-topped rather than peaked shape. The mid-point m stands in for every day of its class from here on.
          </Interpretation>
        </SubSection>

        <SubSection title="Tabulation">
          <What>Tabulation is the systematic arrangement of statistical data in rows and columns to simplify presentation and aid comparison. A good table has seven parts: table number, title, caption (column headings), stub (row headings), body, headnote and footnotes. A two-way table is formed when either the stub or the caption is split into two coordinate parts.</What>
          <Worked title="One two-way table: stub = year, caption = season, body = mean rentals per day, with a Total column and a Total row. The seven parts are labelled.">
            <TwoWayTable t={d.tabulation} />
          </Worked>
          <Result items={[{ label: "Grand mean", value: `${fmtInt(d.tabulation.total_row.total)} / day` }, { label: "2011 → 2012", value: `${fmtInt(d.tabulation.rows[0].total)} → ${fmtInt(d.tabulation.rows[1].total)}` }, { label: "Lowest cell", value: `${d.tabulation.rows[0].stub} Winter: ${fmtInt(d.tabulation.rows[0].cells[0])}` }, { label: "Highest cell", value: `${d.tabulation.rows[1].stub} Summer: ${fmtInt(d.tabulation.rows[1].cells[2])}` }]} />
          <Interpretation>Reading across the caption: Summer is highest in both years and Winter lowest. Reading down the stub: every season grew from 2011 to 2012, the Total column shows the year mean rose from {fmtInt(d.tabulation.rows[0].total)} to {fmtInt(d.tabulation.rows[1].total)}. One table shows two classifications at once, which a list of numbers cannot.</Interpretation>
        </SubSection>

        <SubSection title="Diagrammatic representation">
          <What>
            Diagrams are grouped by the number of dimensions used to represent data. <strong>One-dimensional (bar) diagrams</strong>: only the length of the bar matters — simple, sub-divided, multiple, percentage, deviation, broken. <strong>Two-dimensional (area) diagrams</strong>: length and width both matter — rectangles, squares, circles / pie. In a pie diagram each sector&apos;s angle is its percentage × 3.6°.
          </What>
          <FormulaBlock tex={["\\text{Angle of a sector} = \\text{Percentage} \\times 3.6^{\\circ} = \\frac{\\text{Percentage}}{100} \\times 360^{\\circ}"]} />
          <Worked title="Four diagrams from the classified data.">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Simple bar diagram (one-dimensional)" description="Mean rentals per day by weather situation. One variable, one classification, only the bar length matters.">
                <CategoryBars data={d.diagrams.simple_bar} xKey="group" yKey="mean_cnt" yLabel="Mean rentals / day" yFormat="int" height={220} colors={{ Clear: C.amber, "Mist / cloudy": C.slate, "Light rain / snow": C.blue }} />
              </ChartCard>
              <ChartCard title="Sub-divided bar diagram" description="Mean rentals per day by season, split into casual and registered riders (largest component at the base).">
                <BarSeries data={d.diagrams.subdivided_bar} xKey="season" series={[{ key: "registered", label: "Registered", color: C.blue }, { key: "casual", label: "Casual", color: C.orange }]} stack="stacked" legend height={220} yFormat="int" />
              </ChartCard>
              <ChartCard title="Percentage bar diagram" description="The same bars scaled so every bar is 100 %: the share of casual riders by season.">
                <BarSeries data={d.diagrams.subdivided_bar} xKey="season" series={[{ key: "registered_pct", label: "Registered %", color: C.blue }, { key: "casual_pct", label: "Casual %", color: C.orange }]} stack="stacked" legend height={220} yFormat="pct" yDomain={[0, 100]} />
              </ChartCard>
              <ChartCard title="Pie diagram (two-dimensional)" description="Share of the 731 days by weather situation; sectors largest first, clockwise.">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <Donut data={d.diagrams.pie.slices} nameKey="group" valueKey="days" inner={0} height={200} colors={{ Clear: C.amber, "Mist / cloudy": C.slate, "Light rain / snow": C.blue }} />
                  <DataTable
                    rows={d.diagrams.pie.slices}
                    rowKey={(r) => r.group}
                    columns={[
                      { key: "group", header: "Weather" },
                      { key: "days", header: "Days", align: "right" },
                      { key: "pct", header: "%", align: "right", render: (r) => fmt(r.pct, 2) },
                      { key: "angle", header: "% × 3.6°", align: "right", render: (r) => `${fmt(r.angle, 1)}°` },
                    ]}
                  />
                </div>
              </ChartCard>
            </div>
          </Worked>
          <Result items={[{ label: "Clear vs rain / snow", value: `${fmtInt(d.diagrams.simple_bar[0].mean_cnt)} vs ${fmtInt(d.diagrams.simple_bar[2].mean_cnt)}` }, { label: "Casual share, Winter → Spring", value: `${fmt(d.diagrams.subdivided_bar[0].casual_pct, 1)} % → ${fmt(d.diagrams.subdivided_bar[1].casual_pct, 1)} %` }, { label: "Sum of angles", value: `${fmt(d.diagrams.pie.angle_total, 1)}°` }]} />
          <Interpretation>The simple bar says rain cuts demand to roughly a third of a clear day. The sub-divided bar says registered riders make up most of every season; the percentage bar says the casual share roughly doubles from Winter to Spring and Summer. The pie says most days are clear, so the rain effect, though large per day, touches few days.</Interpretation>
        </SubSection>

        <SubSection title="Graphic representation">
          <What>
            Graphs are of two kinds: <strong>graphs of time series</strong> (time on the X-axis, also called historigrams) and <strong>graphs of frequency distributions</strong> (histogram, frequency polygon, ogive). The Y-axis of a line graph begins at zero; if it does not, the scale is broken with a wavy line, a false baseline. A histogram is a set of vertical bars whose areas are proportional to the frequencies; the bars touch. The frequency polygon joins the mid-points of the bar tops; the apex, dropped perpendicular to the X-axis, gives the mode.
          </What>
          <Worked title="The monthly series and the frequency distribution of 2.2 drawn as graphs.">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Line graph of a time series (historigram)" description="Mean rentals per day in each of the 24 months. Time on X, dots joined by straight lines, Y-axis starting at zero (no false baseline).">
                <LineSeries data={d.graphs.monthly_line} xKey="date" xFormat="monthYearShort" series={[{ key: "cnt", label: "Mean rentals / day", color: C.blue, dots: true }]} curve="linear" yDomain={[0, "auto"]} yFormat="int" height={240} xTicks={8} />
              </ChartCard>
              <ChartCard title="Histogram and frequency polygon" description={`The ${st.k} Sturges classes as touching bars; the polygon joins the mid-points. Apex at ${d.graphs.apex.label} (f = ${d.graphs.apex.f}) → the mode lies in that class.`}>
                <ComposedSeries data={d.graphs.polygon.map((p) => ({ label: p.label, f: p.f, polygon: p.f }))} xKey="label" series={[{ key: "f", label: "Frequency f", color: C.blue, asBar: true }, { key: "polygon", label: "Frequency polygon", color: C.rose, dots: true }]} curve="linear" legend height={240} yFormat="int" />
              </ChartCard>
            </div>
          </Worked>
          <Result items={[{ label: "Lowest month", value: `${fmtInt(d.graphs.line_min)} / day` }, { label: "Highest month", value: `${fmtInt(d.graphs.line_max)} / day` }, { label: "Apex of polygon", value: d.graphs.apex.label, hint: "→ mode is in this class" }]} />
          <Interpretation>The historigram shows a rising trend with a yearly cycle (low in winter, high in late summer), which is the shape Unit 6 will decompose. The histogram with its polygon shows a single apex at {d.graphs.apex.label}: the mode of 2.3 must come out inside that class.</Interpretation>
        </SubSection>
      </UnitSection>

      {/* ================================================================ 2.3 */}
      <UnitSection number="2.3" title="Univariate exploration" intro="Measures of central tendency, spread and distribution for a continuous series, all computed from the one frequency table above by the step-deviation method with A = mid-point of the modal class.">
        <Worked title={<span>The worked table used by every formula below: A = {fmtInt(g.A)} (mid-point of the modal class), i = {fmtInt(g.i)}, d′ = (m − A) / i. Modal class in amber, median class in blue.</span>}>
          <GroupedTable
            rows={g.rows}
            columns={[
              { key: "label", header: "Class" },
              { key: "m", header: <Tex>m</Tex>, format: "int" },
              { key: "f", header: <Tex>f</Tex>, format: "int" },
              { key: "d", header: <Tex>{"d' = (m - A)/i"}</Tex>, format: "int" },
              { key: "fd", header: <Tex>{"fd'"}</Tex>, format: "int" },
              { key: "fd2", header: <Tex>{"fd'^2"}</Tex>, format: "int" },
              { key: "cf", header: <Tex>cf</Tex>, format: "int" },
            ]}
            sums={{ f: g.sums.f, fd: g.sums.fd, fd2: g.sums.fd2 }}
            highlight={{ modal: true, median: true }}
            marks={{ modal: "modal class, A = m", median: "median class (cf ≥ N/2)" }}
          />
        </Worked>

        {/* ---------------------------------------------------------- mean */}
        <SubSection title="Arithmetic mean">
          <What>The arithmetic mean condenses the whole series into one representative value. For a continuous series the mid-point m stands for the class; the step-deviation method measures each m from an assumed mean A in units of the class interval.</What>
          <FormulaBlock
            tex={["\\bar{X} = \\frac{\\sum fm}{N} \\quad\\text{(direct)}", "\\bar{X} = A + \\frac{\\sum fd'}{N} \\times i,\\qquad d' = \\frac{m - A}{i} \\quad\\text{(step deviation)}"]}
            where={[["A", "assumed mean, here the mid-point of the modal class"], ["i", "class interval"], ["N", "Σf, total frequency"]]}
          />
          <Worked title="Both methods on the table above; they must agree.">
            <KV
              cols={1}
              items={[
                [<span key="a">Direct: X̄ = Σfm / N = {fmtInt(g.sums.fm)} / {g.N}</span>, fmt(g.mean.direct, 2)],
                [<span key="b">Step deviation: X̄ = A + (Σfd′ / N) × i = {fmtInt(g.A)} + ({fmtInt(g.sums.fd)} / {g.N}) × {fmtInt(g.i)} = {fmtInt(g.A)} + {fmt(g.mean.sum_fd_over_N, 4)} × {fmtInt(g.i)}</span>, fmt(g.mean.step, 2)],
                [<span key="c">Check: mean of the {g.N} raw values (ungrouped)</span>, fmt(g.raw.mean, 2)],
              ]}
            />
          </Worked>
          <Result items={[{ label: "Mean (grouped)", value: `${fmt(g.mean.step, 2)} rentals / day` }, { label: "Mean (ungrouped)", value: fmt(g.raw.mean, 2), hint: `differs by ${fmt(Math.abs(g.mean.step - g.raw.mean), 1)}` }]} />
          <Interpretation>The direct and step-deviation formulas give the same {fmt(g.mean.step, 2)}: the step method only shifts and rescales, it does not change the answer. Grouping loses a little, the ungrouped mean is {fmt(g.raw.mean, 2)}, because every day is replaced by its class mid-point. On an average day about {fmtInt(g.mean.step)} bicycles were rented.</Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- median */}
        <SubSection title="Median">
          <What>The median is the middle value: it splits the ordered data into two equal halves, a positional average. Key rule for a continuous series: the rank is N/2, not (N + 1)/2, because the median divides the area of the curve into two equal halves.</What>
          <FormulaBlock
            tex={["\\text{Median} = L + \\frac{N/2 - cf}{f} \\times i"]}
            where={[["L", "lower limit of the median class"], ["cf", "cumulative frequency of the class preceding the median class"], ["f", "frequency of the median class"], ["i", "class interval"]]}
          />
          <Worked title={`N/2 = ${fmt(med.pos, 1)}; the first cf equal to or above it is ${medianRow.cf}, so the median class is ${medianRow.label} (highlighted in blue above).`}>
            <KV
              cols={1}
              items={[
                [<span key="a">L, cf (previous class), f, i</span>, `${fmtInt(med.L)}, ${fmtInt(med.cf_prev)}, ${fmtInt(med.f)}, ${fmtInt(med.i)}`],
                [<span key="b">Median = {fmtInt(med.L)} + (({fmt(med.pos, 1)} − {fmtInt(med.cf_prev)}) / {fmtInt(med.f)}) × {fmtInt(med.i)}</span>, fmt(med.value, 2)],
                [<span key="c">Check: median of the raw values</span>, fmt(g.raw.median, 2)],
              ]}
            />
          </Worked>
          <Result label="Median (grouped)" value={`${fmt(med.value, 2)} rentals / day`} hint={`ungrouped: ${fmt(g.raw.median, 0)}`} />
          <Interpretation>Half of the {g.N} days had fewer than {fmtInt(med.value)} rentals and half had more. The median sits {fmt(Math.abs(g.mean.step - med.value), 0)} {g.mean.step > med.value ? "below" : "above"} the mean, a first sign that the two sides of the distribution are not quite equal.</Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- mode */}
        <SubSection title="Mode">
          <What>The mode is the value that occurs most frequently, the point where the frequency curve reaches its maximum height. In a continuous series it is found inside the modal class from the frequencies on either side of it.</What>
          <FormulaBlock
            tex={["M_0 = L + \\frac{\\Delta_1}{\\Delta_1 + \\Delta_2} \\times i,\\qquad \\Delta_1 = |f_1 - f_0|,\\quad \\Delta_2 = |f_1 - f_2|", "\\text{Karl Pearson's empirical relation:}\\quad \\text{Mode} = 3\\,\\text{Median} - 2\\,\\text{Mean}"]}
            where={[["L", "lower limit of the modal class"], ["f_1", "frequency of the modal class"], ["f_0,\\ f_2", "frequencies of the preceding and succeeding classes"]]}
          />
          <Worked title={`Modal class ${modalRow.label} (f₁ = ${g.mode.f1}, the highest frequency; highlighted in amber above).`}>
            <KV
              cols={1}
              items={[
                [<span key="a">Δ₁ = |f₁ − f₀| = |{fmtInt(g.mode.f1)} − {fmtInt(g.mode.f0)}|</span>, fmtInt(g.mode.delta1)],
                [<span key="b">Δ₂ = |f₁ − f₂| = |{fmtInt(g.mode.f1)} − {fmtInt(g.mode.f2)}|</span>, fmtInt(g.mode.delta2)],
                [<span key="c">M₀ = {fmtInt(g.mode.L)} + ({fmtInt(g.mode.delta1)} / ({fmtInt(g.mode.delta1)} + {fmtInt(g.mode.delta2)})) × {fmtInt(g.mode.i)}</span>, fmt(g.mode.value, 2)],
                [<span key="d">Empirical: 3 × Median − 2 × Mean = 3 × {fmt(med.value, 2)} − 2 × {fmt(g.mean.step, 2)}</span>, fmt(g.mode.empirical, 2)],
              ]}
            />
          </Worked>
          <Result items={[{ label: "Mode (formula)", value: `${fmt(g.mode.value, 2)} rentals / day` }, { label: "Mode (empirical relation)", value: fmt(g.mode.empirical, 2), hint: `differs by ${fmt(Math.abs(g.mode.value - g.mode.empirical), 0)}` }, { label: "Order of the averages", value: order.join(" < ") }]} />
          <Interpretation>
            The most typical day had about {fmtInt(g.mode.value)} rentals. The formula mode and the empirical mode agree to within {fmt(Math.abs(g.mode.value - g.mode.empirical), 0)}, so the distribution is only moderately skewed, which is the condition for the empirical relation. The order {order.join(" < ")} is the teacher&apos;s pattern for a {order[0] === "Mode" ? "positively skewed (right-skewed) distribution: a few very high days pull the mean up" : "negatively skewed (left-skewed) distribution: a few very low days pull the mean down"}; but the three averages lie within {fmt(Math.abs(g.mean.step - g.mode.value), 0)} of each other, so the skew is slight.
          </Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- spread */}
        <SubSection title="Measures of spread: Range, Quartile Deviation, Standard Deviation">
          <What>Averages alone can mislead: two series can share a mean and differ completely in spread. Dispersion is the degree to which the data spread about an average. Range and quartile deviation are positional measures; the standard deviation is calculated from every item and is by far the most important. Absolute measures carry the unit; the coefficients are relative and unit-free.</What>
          <FormulaBlock
            tex={[
              "\\text{Range} = L - S,\\qquad \\text{Coefficient of Range} = \\frac{L - S}{L + S}",
              "Q_k = L + \\frac{kN/4 - cf}{f} \\times i,\\qquad \\text{IQR} = Q_3 - Q_1,\\qquad Q.D. = \\frac{Q_3 - Q_1}{2},\\qquad \\text{Coefficient of } Q.D. = \\frac{Q_3 - Q_1}{Q_3 + Q_1}",
              "\\sigma = \\sqrt{\\frac{\\sum fd'^2}{N} - \\left(\\frac{\\sum fd'}{N}\\right)^2} \\times i \\quad\\text{(step deviation, } \\div N\\text{)}",
            ]}
            where={[["k", "1 for Q₁, 3 for Q₃"], ["L,\\ cf,\\ f", "of the quartile class: lower limit, cf of the previous class, frequency"], ["\\sigma", "root mean square deviation about the mean"]]}
          />
          <Worked title="Range from the two extreme items; quartiles from the cf column (kN/4 ranks); σ from the Σfd′ and Σfd′² sums of the table.">
            <KV
              cols={1}
              items={[
                [<span key="r1">Range = L − S = {fmtInt(g.raw.L)} − {fmtInt(g.raw.S)}</span>, fmtInt(g.raw.range)],
                [<span key="r2">Coefficient of Range = ({fmtInt(g.raw.L)} − {fmtInt(g.raw.S)}) / ({fmtInt(g.raw.L)} + {fmtInt(g.raw.S)})</span>, fmt(g.raw.coef_range, 4)],
                [<span key="r3">(With class limits, as for a continuous series: {fmtInt(st.end)} − {st.start} = {fmtInt(g.raw.range_classes)}, coefficient {fmt(g.raw.coef_range_classes, 2)})</span>, ""],
                [<span key="q1">Q₁: N/4 = {fmt(q1.pos, 2)} → class {g.rows[q1.idx].label}; Q₁ = {fmtInt(q1.L)} + (({fmt(q1.pos, 2)} − {fmtInt(q1.cf_prev)}) / {fmtInt(q1.f)}) × {fmtInt(q1.i)}</span>, fmt(q1.value, 2)],
                [<span key="q3">Q₃: 3N/4 = {fmt(q3.pos, 2)} → class {g.rows[q3.idx].label}; Q₃ = {fmtInt(q3.L)} + (({fmt(q3.pos, 2)} − {fmtInt(q3.cf_prev)}) / {fmtInt(q3.f)}) × {fmtInt(q3.i)}</span>, fmt(q3.value, 2)],
                [<span key="iqr">IQR = Q₃ − Q₁ = {fmt(q3.value, 2)} − {fmt(q1.value, 2)}</span>, fmt(g.quartiles.iqr, 2)],
                [<span key="qd">Q.D. = (Q₃ − Q₁) / 2</span>, fmt(g.quartiles.qd, 2)],
                [<span key="cqd">Coefficient of Q.D. = (Q₃ − Q₁) / (Q₃ + Q₁) = {fmt(g.quartiles.iqr, 2)} / {fmt(q3.value + q1.value, 2)}</span>, fmt(g.quartiles.coef_qd, 4)],
                [<span key="s1">Σfd′² / N = {fmtInt(g.sums.fd2)} / {g.N}</span>, fmt(g.sigma.sum_fd2_over_N, 4)],
                [<span key="s2">(Σfd′ / N)² = ({fmtInt(g.sums.fd)} / {g.N})²</span>, fmt(g.sigma.sum_fd_over_N_sq, 4)],
                [<span key="s3">σ = √({fmt(g.sigma.sum_fd2_over_N, 4)} − {fmt(g.sigma.sum_fd_over_N_sq, 4)}) × {fmtInt(g.i)} = √{fmt(g.sigma.inside_root, 4)} × {fmtInt(g.i)}</span>, fmt(g.sigma.value, 2)],
                [<span key="s4">Check: σ of the raw values (÷N)</span>, fmt(g.raw.sigma, 2)],
              ]}
            />
          </Worked>
          <Result
            items={[
              { label: "Range", value: fmtInt(g.raw.range), hint: `coefficient ${fmt(g.raw.coef_range, 3)}` },
              { label: "Q₁ · Q₃", value: `${fmtInt(q1.value)} · ${fmtInt(q3.value)}` },
              { label: "Q.D.", value: fmt(g.quartiles.qd, 1), hint: `coefficient ${fmt(g.quartiles.coef_qd, 3)}` },
              { label: "σ (grouped)", value: fmt(g.sigma.value, 2), hint: `ungrouped ${fmt(g.raw.sigma, 2)}` },
            ]}
          />
          <Interpretation>
            The range uses only two points: the quietest day ({fmtInt(g.raw.S)}) and the busiest ({fmtInt(g.raw.L)}), and the coefficient of {fmt(g.raw.coef_range, 2)} is close to 1 only because S is so small. The middle 50 % of days lie between {fmtInt(q1.value)} and {fmtInt(q3.value)}; a Q.D. of {fmtInt(g.quartiles.qd)} against a median of {fmtInt(med.value)} (coefficient {fmt(g.quartiles.coef_qd, 2)}) is a large Q.D., so there is wide variation among the central data, not high uniformity. σ = {fmtInt(g.sigma.value)}: a typical day departs from the mean by about {fmtInt(g.sigma.value)} rentals, which is {fmt((100 * g.sigma.value) / g.mean.step, 0)} % of the mean. Daily demand is far from homogeneous.
          </Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- skewness */}
        <SubSection title="Skewness">
          <What>
            Skewness is the lack of symmetry: it tells the direction and extent of asymmetry. In a symmetrical distribution Mean = Median = Mode. Tests of skewness: (i) mean, median and mode do not coincide; (ii) the plotted data does not form a bell-shaped curve; (iii) the two halves cut vertically through the centre are not equal; (iv) the sum of positive deviations from the median is not equal to the sum of negative deviations; (v) the quartiles are not equidistant from the median. Karl Pearson&apos;s coefficient uses the mode (or, when the mode is ill-defined, the median); Bowley&apos;s uses only the quartiles and is bounded between −1 and +1.
          </What>
          <FormulaBlock
            tex={[
              "Sk_p = \\frac{\\bar{X} - \\text{Mode}}{\\sigma} \\quad\\text{(default form)}",
              "Sk_p = \\frac{3(\\bar{X} - \\text{Median})}{\\sigma} \\quad\\text{(when the mode is ill-defined / bimodal)}",
              "Sk_B = \\frac{Q_3 + Q_1 - 2\\,\\text{Median}}{Q_3 - Q_1}",
            ]}
            note="Sk = 0 → symmetrical; Sk > 0 → positively skewed (long tail to the right); Sk < 0 → negatively skewed (long tail to the left). The sign gives the direction, the size gives the extent."
          />
          <Worked title="The tests of skewness applied, then the three coefficients from the numbers already computed.">
            <DataTable
              rows={[
                { test: "Mean, median, mode coincide?", value: `${fmt(g.mean.step, 0)} · ${fmt(med.value, 0)} · ${fmt(g.mode.value, 0)}`, verdict: "no: three different values, but very close" },
                { test: "Bell-shaped histogram?", value: `apex ${d.graphs.apex.label}, long run 6,400–8,000`, verdict: "no: flat top, not a bell" },
                { test: "Quartiles equidistant from the median?", value: `Q₃ − Med = ${fmt(q3.value - med.value, 0)}, Med − Q₁ = ${fmt(med.value - q1.value, 0)}`, verdict: q3.value - med.value > med.value - q1.value ? "no: Q₃ is farther → slight positive skew" : "no: Q₁ is farther → slight negative skew" },
              ]}
              rowKey={(r) => r.test}
              columns={[
                { key: "test", header: "Test of skewness" },
                { key: "value", header: "On our data", render: (r) => <span className="font-mono text-xs">{r.value}</span> },
                { key: "verdict", header: "Verdict" },
              ]}
            />
            <KV
              cols={1}
              items={[
                [<span key="a">Absolute Sk = X̄ − Mode = {fmt(g.mean.step, 2)} − {fmt(g.mode.value, 2)}</span>, fmt(g.skewness.absolute, 2)],
                [<span key="b">Skₚ = (X̄ − Mode) / σ = {fmt(g.skewness.absolute, 2)} / {fmt(g.sigma.value, 2)}</span>, fmt(g.skewness.pearson, 4)],
                [<span key="c">Skₚ (median form) = 3 (X̄ − Median) / σ = 3 × ({fmt(g.mean.step, 2)} − {fmt(med.value, 2)}) / {fmt(g.sigma.value, 2)}</span>, fmt(g.skewness.pearson_median_form, 4)],
                [<span key="d">Sk_B = (Q₃ + Q₁ − 2 Median) / (Q₃ − Q₁) = ({fmt(q3.value, 2)} + {fmt(q1.value, 2)} − 2 × {fmt(med.value, 2)}) / {fmt(g.quartiles.iqr, 2)}</span>, fmt(g.skewness.bowley, 4)],
              ]}
            />
          </Worked>
          <Result items={[{ label: "Karl Pearson Skₚ", value: sgn(g.skewness.pearson, 4) }, { label: "Skₚ (median form)", value: sgn(g.skewness.pearson_median_form, 4) }, { label: "Bowley Sk_B", value: sgn(g.skewness.bowley, 4) }]} />
          <Interpretation>
            Skₚ = {sgn(g.skewness.pearson, 3)}: Sk {skewWord(g.skewness.pearson)}. Bowley gives the same sign ({sgn(g.skewness.bowley, 3)}). Both are far below 1, the practical ceiling, so daily rentals are almost symmetrical with only a very mild pull toward the high side. The default (X̄ − Mode)/σ form is used here because the mode is well defined: one class clearly has the highest frequency. The median form is the fallback for a bimodal or ill-defined mode; we meet that case with temperature below.
          </Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- kurtosis */}
        <SubSection title="Kurtosis">
          <What>Kurtosis measures the peakedness or flatness of a distribution near the mode, relative to the normal curve. It is built from moments about the mean: μ₂ is the variance, μ₄ the fourth moment. β₂ = 3 Mesokurtic (same peakedness as normal), β₂ &gt; 3 Leptokurtic (narrow, tall peak, more peaked than normal), β₂ &lt; 3 Platykurtic (broad, flat top, less peaked than normal).</What>
          <FormulaBlock
            tex={["\\mu_2 = \\frac{\\sum f(m - \\bar{X})^2}{N},\\qquad \\mu_4 = \\frac{\\sum f(m - \\bar{X})^4}{N},\\qquad \\beta_2 = \\frac{\\mu_4}{\\mu_2^{\\,2}}", "\\beta_1 = \\frac{\\mu_3^{\\,2}}{\\mu_2^{\\,3}} \\quad\\text{(moment measure of skewness, from the formula sheet)}"]}
            where={[["m - \\bar{X}", "deviation of the class mid-point from the grouped mean"], ["\\mu_3", "Σf(m − X̄)³ / N"]]}
          />
          <Worked title={`Moments table about X̄ = ${fmt(g.mean.direct, 2)}; the big numbers are shown in scientific notation.`}>
            <GroupedTable
              rows={g.rows}
              columns={[
                { key: "label", header: "Class" },
                { key: "m", header: <Tex>m</Tex>, format: "int" },
                { key: "f", header: <Tex>f</Tex>, format: "int" },
                { key: "dev", header: <Tex>{"m - \\bar{X}"}</Tex>, format: 2 },
                { key: "f_dev2", header: <Tex>{"f(m - \\bar{X})^2"}</Tex>, format: "sci" },
                { key: "f_dev3", header: <Tex>{"f(m - \\bar{X})^3"}</Tex>, format: "sci" },
                { key: "f_dev4", header: <Tex>{"f(m - \\bar{X})^4"}</Tex>, format: "sci" },
              ]}
              sums={{ f: g.sums.f, f_dev2: g.sums.f_dev2, f_dev3: g.sums.f_dev3, f_dev4: g.sums.f_dev4 }}
            />
            <KV
              cols={1}
              items={[
                [<span key="a">μ₂ = Σf(m − X̄)² / N = {g.sums.f_dev2.toExponential(3)} / {g.N}</span>, fmt(g.moments.mu2, 2)],
                [<span key="b">√μ₂ (must equal σ)</span>, `${fmt(g.moments.sqrt_mu2, 2)} = σ ✓`],
                [<span key="c">μ₃ = Σf(m − X̄)³ / N</span>, g.moments.mu3.toExponential(3)],
                [<span key="d">μ₄ = Σf(m − X̄)⁴ / N = {g.sums.f_dev4.toExponential(3)} / {g.N}</span>, g.moments.mu4.toExponential(3)],
                [<span key="e">β₂ = μ₄ / μ₂² = {g.moments.mu4.toExponential(3)} / ({fmt(g.moments.mu2, 2)})²</span>, fmt(g.moments.beta2, 4)],
                [<span key="f">β₁ = μ₃² / μ₂³</span>, fmt(g.moments.beta1, 6)],
              ]}
            />
          </Worked>
          <Result items={[{ label: "β₂", value: fmt(g.moments.beta2, 3), hint: "compare with 3" }, { label: "β₁", value: fmt(g.moments.beta1, 5), hint: "≈ 0 → nearly symmetrical" }]} />
          <Interpretation>{kurtWord(g.moments.beta2)}. Daily rentals have lighter tails and a broader top than a normal curve with the same mean and σ: days are spread fairly evenly across 1,600–8,000 rather than piling up near the centre. β₁ ≈ {fmt(g.moments.beta1, 3)} confirms, by the moment route, that the distribution is nearly symmetrical.</Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- contrast: temp_c */}
        <SubSection title="Contrast: the same measures for temperature (°C)">
          <What>The same code path on a second variable with its own Sturges classes, to see what the numbers look like when the shape is different.</What>
          <Worked title={`Sturges: k = ${d.sturges_temp.k}, i = (${fmt(d.sturges_temp.L, 1)} − ${fmt(d.sturges_temp.S, 1)}) / ${d.sturges_temp.k} = ${fmt(d.sturges_temp.i_raw, 2)} → rounded to the convenient width ${d.sturges_temp.i} (${d.sturges_temp.n_classes} classes); A = ${t.A}.`}>
            <GroupedTable
              rows={t.rows}
              columns={[
                { key: "label", header: "Class (°C)" },
                { key: "m", header: <Tex>m</Tex>, format: 1 },
                { key: "f", header: <Tex>f</Tex>, format: "int" },
                { key: "d", header: <Tex>{"d'"}</Tex>, format: "int" },
                { key: "fd", header: <Tex>{"fd'"}</Tex>, format: "int" },
                { key: "fd2", header: <Tex>{"fd'^2"}</Tex>, format: "int" },
                { key: "cf", header: <Tex>cf</Tex>, format: "int" },
              ]}
              sums={{ f: t.sums.f, fd: t.sums.fd, fd2: t.sums.fd2 }}
              highlight={{ modal: true, median: true }}
              marks={{ modal: "modal class", median: "median class" }}
            />
            <DataTable
              rows={[
                { measure: "Mean (step deviation)", cnt: fmt(g.mean.step, 2), temp: fmt(t.mean.step, 2) },
                { measure: "Median", cnt: fmt(med.value, 2), temp: fmt(t.median.value, 2) },
                { measure: "Mode", cnt: fmt(g.mode.value, 2), temp: fmt(t.mode.value, 2) },
                { measure: "Order of the averages", cnt: order.join(" < "), temp: tOrder.join(" < ") },
                { measure: "σ", cnt: fmt(g.sigma.value, 2), temp: fmt(t.sigma.value, 2) },
                { measure: "Q₁ · Q₃ · Q.D.", cnt: `${fmt(q1.value, 0)} · ${fmt(q3.value, 0)} · ${fmt(g.quartiles.qd, 0)}`, temp: `${fmt(t.quartiles.q1.value, 1)} · ${fmt(t.quartiles.q3.value, 1)} · ${fmt(t.quartiles.qd, 1)}` },
                { measure: "Skₚ = (X̄ − Mode)/σ", cnt: sgn(g.skewness.pearson, 3), temp: sgn(t.skewness.pearson, 3) },
                { measure: "Skₚ = 3(X̄ − Median)/σ", cnt: sgn(g.skewness.pearson_median_form, 3), temp: sgn(t.skewness.pearson_median_form, 3) },
                { measure: "Sk_B (Bowley)", cnt: sgn(g.skewness.bowley, 3), temp: sgn(t.skewness.bowley, 3) },
                { measure: "β₂", cnt: fmt(g.moments.beta2, 3), temp: fmt(t.moments.beta2, 3) },
              ]}
              rowKey={(r) => r.measure}
              columns={[
                { key: "measure", header: "Measure", render: (r) => <span className="font-medium">{r.measure}</span> },
                { key: "cnt", header: "cnt (rentals / day)", align: "right", render: (r) => <span className="font-mono">{r.cnt}</span> },
                { key: "temp", header: "temp_c (°C)", align: "right", render: (r) => <span className="font-mono">{r.temp}</span> },
              ]}
            />
          </Worked>
          <Result items={[{ label: "Temperature: mean · median", value: `${fmt(t.mean.step, 1)} · ${fmt(t.median.value, 1)} °C` }, { label: "Skₚ (mode form)", value: sgn(t.skewness.pearson, 3) }, { label: "Skₚ (median form)", value: sgn(t.skewness.pearson_median_form, 3) }, { label: "β₂", value: fmt(t.moments.beta2, 3) }]} />
          <Interpretation>
            Temperature is symmetric about its centre: mean and median are both {fmt(t.median.value, 1)} °C and Bowley&apos;s Sk_B = {sgn(t.skewness.bowley, 3)}. But its mode is ill-defined: the two classes {t.rows[t.modal_idx].label} and {t.rows[2].label} have almost the same frequency ({t.rows[t.modal_idx].f} and {t.rows[2].f}, one for each warm and cold half of the year). The default Skₚ = (X̄ − Mode)/σ then gives a misleading {sgn(t.skewness.pearson, 2)}, while the median form gives {sgn(t.skewness.pearson_median_form, 3)}, which is the honest answer. This is exactly when the teacher says to switch to 3(X̄ − Median)/σ. β₂ = {fmt(t.moments.beta2, 2)} &lt; 3: a seasonal variable is even flatter than rentals, a broad plateau rather than a peak.
          </Interpretation>
        </SubSection>

        {/* ---------------------------------------------------------- class checks */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ClassCheck title={`Karl Pearson, continuous series (profits 70–150, N = ${d.class_checks.pearson.N}, A = ${d.class_checks.pearson.A}, i = 10): the same grouped function reproduces the slide. Σfd′ = ${d.class_checks.pearson.sum_fd}, Σfd′² = ${d.class_checks.pearson.sum_fd2}.`}>
            <DataTable
              rows={[
                { k: "Mode", slide: fmt(d.class_checks.pearson.slide.mode, 2), ours: fmt(d.class_checks.pearson.ours.mode, 2) },
                { k: "Mean", slide: fmt(d.class_checks.pearson.slide.mean, 2), ours: fmt(d.class_checks.pearson.ours.mean, 2) },
                { k: "σ", slide: fmt(d.class_checks.pearson.slide.sigma, 3), ours: fmt(d.class_checks.pearson.ours.sigma, 3) },
                { k: "Skₚ", slide: fmt(d.class_checks.pearson.slide.sk, 3), ours: fmt(d.class_checks.pearson.ours.sk, 3) },
              ]}
              rowKey={(r) => r.k}
              columns={[{ key: "k", header: "" }, { key: "slide", header: "Slide", align: "right" }, { key: "ours", header: "Our code", align: "right" }]}
            />
          </ClassCheck>
          <ClassCheck title="Kurtosis, continuous series (classes 0–50 by 10, f = 1, 3, 8, 3, 1, N = 16).">
            <DataTable
              rows={[
                { k: "X̄", slide: fmt(d.class_checks.kurtosis.slide.mean, 1), ours: fmt(d.class_checks.kurtosis.ours.mean, 1) },
                { k: "μ₂", slide: fmt(d.class_checks.kurtosis.slide.mu2, 1), ours: fmt(d.class_checks.kurtosis.ours.mu2, 1) },
                { k: "μ₄", slide: fmtInt(d.class_checks.kurtosis.slide.mu4), ours: fmtInt(d.class_checks.kurtosis.ours.mu4) },
                { k: "β₂", slide: fmt(d.class_checks.kurtosis.slide.beta2, 3), ours: fmt(d.class_checks.kurtosis.ours.beta2, 3) },
              ]}
              rowKey={(r) => r.k}
              columns={[{ key: "k", header: "" }, { key: "slide", header: "Slide", align: "right" }, { key: "ours", header: "Our code", align: "right" }]}
            />
          </ClassCheck>
          <ClassCheck title="Bowley, weights of 589 students (open-end classes taken as 89.5–99.5 and 199.5–209.5).">
            <DataTable
              rows={[
                { k: "Median", slide: fmt(d.class_checks.bowley.slide.median, 2), ours: fmt(d.class_checks.bowley.ours.median, 2) },
                { k: "Q₁", slide: fmt(d.class_checks.bowley.slide.q1, 2), ours: fmt(d.class_checks.bowley.ours.q1, 2) },
                { k: "Q₃", slide: fmt(d.class_checks.bowley.slide.q3, 2), ours: fmt(d.class_checks.bowley.ours.q3, 2) },
                { k: "Sk_B", slide: fmt(d.class_checks.bowley.slide.sk, 3), ours: fmt(d.class_checks.bowley.ours.sk, 3) },
              ]}
              rowKey={(r) => r.k}
              columns={[{ key: "k", header: "" }, { key: "slide", header: "Slide", align: "right" }, { key: "ours", header: "Our code", align: "right" }]}
            />
          </ClassCheck>
        </div>
      </UnitSection>

      {/* ================================================================ 2.4 */}
      <UnitSection number="2.4" title="Multivariate exploration" intro="More than one variable at a time: where the centre of the whole dataset is, and how rentals move with the weather.">
        <SubSection title="Central data point">
          <What>A single point that represents the overall centre or typical location of a dataset, considering all variables together: the average point in multi-dimensional space. If the variables are (Height, Weight, Age) the central data point is (Mean Height, Mean Weight, Mean Age).</What>
          <FormulaBlock tex={["\\text{Central data point} = (\\bar{X}_1,\\ \\bar{X}_2,\\ \\ldots,\\ \\bar{X}_p)"]} where={[["\\bar{X}_j", "arithmetic mean of the j-th variable over the same N days"]]} />
          <Worked title="The mean of each of the four numeric variables over the 731 days.">
            <DataTable rows={mv.mean_vector} rowKey={(r) => r.var} columns={[{ key: "label", header: "Variable" }, { key: "var", header: "Column", render: (r) => <span className="font-mono text-xs">{r.var}</span> }, { key: "mean", header: "Mean", align: "right", render: (r) => fmt(r.mean, 2) }]} />
          </Worked>
          <Result label="The average day" value={`(${mv.mean_vector.map((m) => fmt(m.mean, 1)).join(", ")})`} hint="(rentals, °C, % humidity, km/h)" />
          <Interpretation>The average day had about {fmtInt(mv.mean_vector[0].mean)} rentals at {fmt(mv.mean_vector[1].mean, 1)} °C, {fmt(mv.mean_vector[2].mean, 0)} % humidity and {fmt(mv.mean_vector[3].mean, 1)} km/h of wind. Every real day deviates from this point; how far, and in which direction, is what correlation (here) and anomaly detection (Unit 5) measure.</Interpretation>
        </SubSection>

        <SubSection title="Correlation: meaning, causation and forms">
          <What>Correlation is a statistical descriptive measure of the strength of a linear relationship between two variables. Causation always implies correlation, but correlation does NOT imply causation: a correlation may arise by pure chance, through a common third variable, or by mutual influence. Correlation is classified by direction (positive / negative), by the number of variables (simple / partial / multiple) and by the constancy of the ratio of change (linear / non-linear).</What>
          <Worked title="The three reasons and the three classifications, each with a pair from this dataset (r by the actual-mean method).">
            <DataTable
              rows={mv.reasons}
              rowKey={(r) => r.reason}
              columns={[
                { key: "reason", header: "Why a correlation may arise", render: (r) => <span className="font-medium">{r.reason}</span> },
                { key: "pair", header: "Pair from our data" },
                { key: "r", header: "r", align: "right", render: (r) => <span className="font-mono">{sgn(r.r, 3)}</span> },
                { key: "text", header: "Reading", render: (r) => <span className="text-xs">{r.text}</span> },
              ]}
            />
            <DataTable
              rows={mv.types}
              rowKey={(r) => r.type}
              columns={[
                { key: "type", header: "Classification", render: (r) => <span className="font-medium">{r.type}</span> },
                { key: "basis", header: "Based on" },
                { key: "example", header: "Example from our data", render: (r) => <span className="text-xs">{r.example}</span> },
              ]}
            />
            <ChartCard title="Why rentals vs temperature is not perfectly linear" description="Mean rentals per day in each temperature class of the contrast table: the ratio of change is not constant at the hot end.">
              <CategoryBars data={mv.curve} xKey="label" yKey="mean_cnt" yLabel="Mean rentals / day" yFormat="int" height={200} fallback={C.orange} />
            </ChartCard>
          </Worked>
          <Interpretation>Weather can cause rentals; rentals cannot cause weather, so the direction of any model (Unit 4) is fixed before a single r is computed. The casual–registered pair shows the third-variable trap: they are correlated only because both follow the temperature.</Interpretation>
        </SubSection>

        <SubSection title="Karl Pearson's coefficient of correlation">
          <What>Karl Pearson&apos;s product-moment coefficient r measures the degree of linear relationship. r always lies between −1 and +1: +1 perfect positive, −1 perfect negative, 0 no relationship. Degrees: 0.75 to 0.99 high, 0 to 0.5 low (the sign gives the direction). Method 1 takes deviations from the actual mean; Method 2 (direct) uses the raw sums and needs no deviations.</What>
          <FormulaBlock
            tex={[
              "r = \\frac{\\sum xy}{\\sqrt{\\sum x^2 \\cdot \\sum y^2}},\\qquad x = X - \\bar{X},\\quad y = Y - \\bar{Y} \\quad\\text{(Method 1, actual mean)}",
              "r = \\frac{N\\sum XY - \\sum X\\,\\sum Y}{\\sqrt{N\\sum X^2 - (\\sum X)^2}\\;\\sqrt{N\\sum Y^2 - (\\sum Y)^2}} \\quad\\text{(Method 2, direct)}",
            ]}
            where={[["X", "the weather variable"], ["Y", "cnt, rentals per day"], ["N", "number of pairs = 731 days"]]}
          />
          <Worked title="Method 1 for cnt against each weather variable (the sums Σx², Σy², Σxy are over all 731 days; Σy² is the same in every row because Y is always cnt).">
            <DataTable
              rows={mv.pairs}
              rowKey={(r) => r.x}
              columns={[
                { key: "x_label", header: "X", render: (r) => <span className="font-medium">{r.x_label}</span> },
                { key: "n", header: "N", align: "right" },
                { key: "x_mean", header: "X̄", align: "right", render: (r) => fmt(r.x_mean, 2) },
                { key: "y_mean", header: "Ȳ", align: "right", render: (r) => fmt(r.y_mean, 1) },
                { key: "sum_x2", header: "Σx²", align: "right", render: (r) => fmt(r.sum_x2, 1) },
                { key: "sum_y2", header: "Σy²", align: "right", render: (r) => r.sum_y2.toExponential(4) },
                { key: "sum_xy", header: "Σxy", align: "right", render: (r) => fmt(r.sum_xy, 1) },
                { key: "root", header: "√(Σx²·Σy²)", align: "right", render: (r) => fmt(r.root, 1) },
                { key: "r", header: "r", align: "right", render: (r) => <span className="font-mono font-semibold">{sgn(r.r, 4)}</span> },
                { key: "degree", header: "Degree", render: (r) => <span className="text-xs">{r.degree}</span> },
              ]}
            />
            <div className="rounded-lg border p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method 2 (direct) for the temperature pair, to show it gives the same r</div>
              <KV
                cols={2}
                items={[
                  ["N", fmtInt(mv.direct.N)],
                  ["ΣX (temperature)", fmt(mv.direct.sum_x, 2)],
                  ["ΣY (rentals)", fmtInt(mv.direct.sum_y)],
                  ["ΣX²", fmt(mv.direct.sum_x2, 2)],
                  ["ΣY²", mv.direct.sum_y2.toExponential(4)],
                  ["ΣXY", fmt(mv.direct.sum_xy, 2)],
                  ["NΣXY − ΣXΣY", mv.direct.numerator.toExponential(4)],
                  ["√(NΣX² − (ΣX)²)", fmt(mv.direct.den_x, 2)],
                  ["√(NΣY² − (ΣY)²)", fmt(mv.direct.den_y, 2)],
                  ["r", <span key="r" className="font-mono font-semibold">{sgn(mv.direct.r, 4)}</span>],
                ]}
              />
            </div>
          </Worked>
          <Result items={[{ label: "r (temperature)", value: sgn(temp.r, 4), hint: temp.degree }, { label: "r (feels-like)", value: sgn(mv.pairs[1].r, 4), hint: mv.pairs[1].degree }, { label: "r (humidity)", value: sgn(mv.pairs[2].r, 4), hint: mv.pairs[2].degree }, { label: "r (wind)", value: sgn(mv.pairs[3].r, 4), hint: mv.pairs[3].degree }]} />
          <Interpretation>
            Temperature is the strongest: r = {sgn(temp.r, 3)}, a moderate degree of positive correlation (above the 0.5 low band, below the 0.75 high band): warmer days see more rentals, but temperature alone does not fix the count. Feels-like temperature is almost the same number because it is built from temperature. Wind ({sgn(mv.pairs[3].r, 3)}) and humidity ({sgn(mv.pairs[2].r, 3)}) are low-degree negative: a little less riding when it is windy or damp. Both methods give r = {sgn(mv.direct.r, 4)} for temperature, as they must.
          </Interpretation>
        </SubSection>
      </UnitSection>

      {/* ================================================================ 2.5 */}
      <UnitSection number="2.5" title="Data visualization" intro="A single number can never reveal the full shape of a distribution: visualize before trusting r. Univariate charts show one attribute; multivariate charts show two to four.">
        <SubSection title="Univariate: histogram">
          <What>A histogram shows the frequency distribution of a variable by grouping values into intervals (bins); bars are drawn adjacent to each other, without gaps. Rule of thumb for the number of bins: bins ≈ √n (or ∛n).</What>
          <FormulaBlock tex={["\\text{bins} \\approx \\sqrt{n} = \\sqrt{" + d.viz.sqrt_rule.n + "} \\approx " + d.viz.sqrt_rule.bins]} note={`Compare: Sturges' rule gave k = ${d.viz.sqrt_rule.sturges_bins} classes in 2.2. Too few bins lose detail; too many add noise.`} />
          <Worked title="The same 731 counts with √n bins (left) and with the Sturges classes of 2.2 (right).">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title={`Histogram, ${d.viz.sqrt_rule.bins} bins (√n rule)`} description={`Bin width ≈ ${fmtInt(d.viz.hist_sqrt[0].x1 - d.viz.hist_sqrt[0].x0)} rentals.`}>
                <Histogram bins={d.viz.hist_sqrt} mode="count" showNormal={false} label="Days" height={220} xFormat="int" />
              </ChartCard>
              <ChartCard title={`Histogram, ${d.viz.sqrt_rule.sturges_bins} classes (Sturges)`} description="The frequency distribution every 2.3 formula was computed from.">
                <ComposedSeries data={d.graphs.polygon.map((p) => ({ label: p.label, f: p.f }))} xKey="label" series={[{ key: "f", label: "Days", color: C.blue, asBar: true }]} height={220} yFormat="int" />
              </ChartCard>
            </div>
          </Worked>
          <Result items={[{ label: "√n bins", value: d.viz.sqrt_rule.bins }, { label: "Sturges classes", value: d.viz.sqrt_rule.sturges_bins }]} />
          <Interpretation>Both pictures tell the same story, a broad hump from about 1,600 to 8,000 with no second peak and no long tail, but the 27-bin histogram shows the dip near 2,400–3,200 and the secondary bump near 7,200–8,000 that the 11 coarse classes smooth away. Neither shows a bell: the flat top is the platykurtic shape β₂ measured.</Interpretation>
        </SubSection>

        <SubSection title="Univariate: quartile chart (box plot)">
          <What>A box plot shows the distribution and skewness of numerical data through the five-number summary: minimum, Q₁, median, Q₃, maximum. The box is the interquartile range; points beyond Q₁ − 1.5 × IQR or Q₃ + 1.5 × IQR are outliers and are plotted individually; the whiskers end at the nearest non-outlier. Reading skew: median closer to Q₁ with a long right whisker → positive skew; median closer to Q₃ with a long left whisker → negative skew.</What>
          <FormulaBlock
            tex={["\\text{IQR} = Q_3 - Q_1,\\qquad \\text{Lower limit} = Q_1 - 1.5 \\times \\text{IQR},\\qquad \\text{Upper limit} = Q_3 + 1.5 \\times \\text{IQR}", "Q_1 = \\text{size of } \\tfrac{N+1}{4}\\text{th item},\\qquad Q_3 = \\text{size of } \\tfrac{3(N+1)}{4}\\text{th item} \\quad\\text{(individual series)}"]}
            note="Outliers: data < Lower limit and data > Upper limit."
          />
          <Worked title="cnt by season: the quartiles of each group by the (N + 1)/4 rule, the fences and the outlier count.">
            <BoxPlot items={d.viz.box.items.map((b) => ({ key: b.key, n: b.n, whisker_low: b.whisker_low, q1: b.q1, median: b.median, q3: b.q3, whisker_high: b.whisker_high, mean: b.mean, min: b.min, max: b.max, outliers: b.outliers }))} colors={SEASON} min={0} unit="" />
            <DataTable
              rows={d.viz.box.items}
              rowKey={(r) => r.key}
              columns={[
                { key: "key", header: "Season", render: (r) => <span className="font-medium">{r.key}</span> },
                { key: "n", header: "N", align: "right" },
                { key: "pos", header: "Q₁ · Q₃ positions", align: "right", render: (r) => `${fmt(r.pos_q1, 2)} · ${fmt(r.pos_q3, 2)}` },
                { key: "min", header: "Min", align: "right", render: (r) => fmtInt(r.min) },
                { key: "q1", header: "Q₁", align: "right", render: (r) => fmtInt(r.q1) },
                { key: "median", header: "Median", align: "right", render: (r) => fmtInt(r.median) },
                { key: "q3", header: "Q₃", align: "right", render: (r) => fmtInt(r.q3) },
                { key: "max", header: "Max", align: "right", render: (r) => fmtInt(r.max) },
                { key: "iqr", header: "IQR", align: "right", render: (r) => fmtInt(r.iqr) },
                { key: "lower_fence", header: "Q₁ − 1.5·IQR", align: "right", render: (r) => fmtInt(r.lower_fence) },
                { key: "upper_fence", header: "Q₃ + 1.5·IQR", align: "right", render: (r) => fmtInt(r.upper_fence) },
                { key: "outliers", header: "Outliers", align: "right", render: (r) => (r.outliers ? `${r.outliers} (${r.outlier_values.map((v) => fmtInt(v)).join(", ")})` : "0") },
                { key: "reading", header: "Box-plot reading", render: (r) => <span className="text-xs">{r.reading}</span> },
              ]}
            />
          </Worked>
          <Result items={[{ label: "Outliers by season", value: d.viz.box.items.map((b) => `${b.key} ${b.outliers}`).join(" · ") }, { label: "Outliers, all 731 days", value: d.viz.box.all.outliers, hint: `fences ${fmtInt(d.viz.box.all.lower_fence)} to ${fmtInt(d.viz.box.all.upper_fence)}` }]} />
          <Interpretation>
            Winter is the only lopsided box: its median sits close to Q₁ and the right whisker is long, a positive skew, because a few mild winter days were busy. The other three seasons are roughly symmetric. Only {d.viz.box.items.reduce((s, b) => s + b.outliers, 0)} days fall outside their season&apos;s fences, among them the {fmtInt(d.viz.box.items[3].min)}-rental day in Fall (Hurricane Sandy, 2012-10-29); on the whole series the fences are so wide that no day is an outlier, which is why Unit 5 needs more than a one-variable rule.
          </Interpretation>
        </SubSection>

        <SubSection title="Univariate: distribution chart (normal curve)">
          <What>A distribution chart, also called a normal distribution or density curve, is the smooth curve of the probability distribution of continuous data, characterised by the mean μ (the centre) and the standard deviation σ (the spread). Empirical rule: 68.2 % of the data within ±1σ, 95.4 % within ±2σ, 99.7 % within ±3σ.</What>
          <FormulaBlock
            tex={["f(x) = \\frac{1}{\\sqrt{2\\pi\\sigma^2}}\\; e^{-\\frac{(x - \\mu)^2}{2\\sigma^2}}"]}
            where={[["\\mu", "mean of the series"], ["\\sigma", "standard deviation of the series (÷N)"], ["e,\\ \\pi", "2.718, 3.1416"]]}
            note="The slide prints the exponent without the minus sign; with the minus sign the curve falls away from μ on both sides, as it must."
          />
          <Worked title="The normal curve with the same μ and σ drawn over the density histogram, for rentals and for temperature, and the empirical rule checked against the actual share of days.">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Rentals per day" description={`μ = ${fmt(d.viz.dist_cnt.mu, 1)}, σ = ${fmt(d.viz.dist_cnt.sigma, 1)}, ${d.viz.sqrt_rule.bins} bins.`}>
                <Histogram bins={d.viz.dist_cnt.bins} mode="density" showNormal label="Observed density" height={220} xFormat="int" />
                <DataTable
                  rows={d.viz.dist_cnt.rule}
                  rowKey={(r) => String(r.k)}
                  columns={[
                    { key: "k", header: "Band", render: (r) => `μ ± ${r.k}σ` },
                    { key: "range", header: "From … to", render: (r) => `${fmtInt(r.lower)} … ${fmtInt(r.upper)}` },
                    { key: "days", header: "Days inside", align: "right" },
                    { key: "actual_pct", header: "Actual %", align: "right", render: (r) => fmt(r.actual_pct, 1) },
                    { key: "expected_pct", header: "Normal %", align: "right", render: (r) => fmt(r.expected_pct, 1) },
                  ]}
                />
              </ChartCard>
              <ChartCard title="Temperature (°C)" description={`μ = ${fmt(d.viz.dist_temp.mu, 2)}, σ = ${fmt(d.viz.dist_temp.sigma, 2)}, ${d.viz.sqrt_rule.bins} bins.`}>
                <Histogram bins={d.viz.dist_temp.bins} mode="density" showNormal label="Observed density" height={220} xFormat="1dp" />
                <DataTable
                  rows={d.viz.dist_temp.rule}
                  rowKey={(r) => String(r.k)}
                  columns={[
                    { key: "k", header: "Band", render: (r) => `μ ± ${r.k}σ` },
                    { key: "range", header: "From … to", render: (r) => `${fmt(r.lower, 1)} … ${fmt(r.upper, 1)}` },
                    { key: "days", header: "Days inside", align: "right" },
                    { key: "actual_pct", header: "Actual %", align: "right", render: (r) => fmt(r.actual_pct, 1) },
                    { key: "expected_pct", header: "Normal %", align: "right", render: (r) => fmt(r.expected_pct, 1) },
                  ]}
                />
              </ChartCard>
            </div>
          </Worked>
          <Result items={[{ label: "Rentals within ±1σ", value: `${fmt(n1.actual_pct, 1)} %`, hint: "normal: 68.2 %" }, { label: "Temperature within ±1σ", value: `${fmt(d.viz.dist_temp.rule[0].actual_pct, 1)} %`, hint: "normal: 68.2 %" }, { label: "Rentals within ±2σ", value: `${fmt(d.viz.dist_cnt.rule[1].actual_pct, 1)} %`, hint: "normal: 95.4 %" }]} />
          <Interpretation>Neither variable follows the normal curve closely. Only {fmt(n1.actual_pct, 1)} % of days fall within ±1σ of the mean rentals instead of 68.2 %, and {fmt(d.viz.dist_cnt.rule[1].actual_pct, 1)} % within ±2σ instead of 95.4 %: fewer days near the centre, more at moderate distance, none far out, which is the flat-topped, light-tailed shape of a platykurtic distribution. Temperature is the same but more so. Unit 3 will still use the normal curve for means of samples, where the central limit theorem makes it apply.</Interpretation>
        </SubSection>

        <SubSection title="Multivariate: scatter plot, scatter matrix, bubble chart">
          <What>A scatter plot displays the relationship between two continuous variables; an increasing pattern is positive correlation, a decreasing one negative, a cloud none; it also reveals clusters and outliers. A scatter matrix arranges all pairwise scatter plots of n variables in an n × n grid. A bubble chart is an advanced scatter plot where bubble size represents a third variable and colour a class label, so 3–4 attributes are seen at once.</What>
          <Worked title="The three multivariate charts on this data.">
            <ChartCard title="Scatter plot: rentals vs temperature, coloured by season" description={`731 days; r = ${sgn(temp.r, 3)}. Each point is one day.`}>
              <ScatterPlot points={d.viz.scatter} groups={SEASON} xLabel="Temperature (°C)" yLabel="Rentals per day" height={320} size={18} opacity={0.6} />
            </ChartCard>
            <ChartCard title="Scatter matrix: rentals, temperature, humidity, wind" description="4 × 4 grid: scatter plots below the diagonal, Karl Pearson's r for the same pair above it.">
              <ScatterMatrix vars={d.viz.matrix.vars} labels={d.viz.matrix.labels} pairs={d.viz.matrix.pairs} />
            </ChartCard>
            <ChartCard title="Bubble chart: one bubble per month" description="x = mean temperature, y = mean rentals per day, bubble area = mean wind speed, colour = year.">
              <BubbleChart points={d.viz.bubble} xLabel="Mean temperature (°C)" yLabel="Mean rentals per day" sizeLabel="wind km/h" colors={YEAR} />
            </ChartCard>
          </Worked>
          <Result items={[{ label: "Strongest pair in the matrix", value: `rentals · temperature ${sgn(temp.r, 3)}` }, { label: "Weather pairs", value: `temp · humidity ${sgn(d.viz.matrix.pairs.find((p) => p.row === "temp_c" && p.col === "hum_pct")?.r ?? 0, 3)}, temp · wind ${sgn(mv.extra_r.temp_wind, 3)}` }]} />
          <Interpretation>The scatter plot shows the upward band with the seasons stacked along it: winter days sit bottom-left, summer days top-right, which is the correlation of 2.4 made visible, and the one isolated point at the bottom (a warm day with {fmtInt(d.viz.box.items[3].min)} rentals) is the outlier the box plot found. The matrix confirms that the weather variables are nearly independent of each other, so each adds something different to a model. The bubble chart adds time: the 2012 bubbles sit above the 2011 bubbles at the same temperature, the growth from the two-way table; bubble size shows the windy winter months.</Interpretation>
        </SubSection>
      </UnitSection>

      <UnitSection number="2.5-SL" title="Heat map of mean rentals by month and day of week" selfLearning intro="A heat map is a table whose cells are coloured by their value, so a two-way classification can be read at a glance.">
        <What>Each cell is the mean rentals per day for one month × one day of the week over the two years; darker means busier. It is the two-way table of 2.2 drawn as colour instead of numbers alone.</What>
        <Worked title="12 months × 7 weekdays, mean cnt in each cell.">
          <Heatmap rows={d.viz.heat.rows} cols={d.viz.heat.cols} cells={d.viz.heat.cells} hue="blue" digits={0} rowLabel="Month" colLabel="Day of week" />
        </Worked>
        <Result items={[{ label: "Busiest cell", value: `${d.viz.heat.best.row} · ${d.viz.heat.best.col}: ${fmtInt(d.viz.heat.best.value)}` }, { label: "Quietest cell", value: `${d.viz.heat.worst.row} · ${d.viz.heat.worst.col}: ${fmtInt(d.viz.heat.worst.value)}` }]} />
        <Interpretation>The colour runs top-to-bottom far more than left-to-right: the month (the season) decides demand, the day of the week barely does, which agrees with the small working-day vs weekend gap in the qualitative classification.</Interpretation>
      </UnitSection>

      <Note title="What this unit hands forward">
        Headline numbers for the rest of the site: grouped mean {fmtInt(d.headline.mean)}, median {fmtInt(d.headline.median)}, mode {fmtInt(d.headline.mode)}, σ {fmtInt(d.headline.sigma)}, Skₚ {sgn(d.headline.sk_pearson, 3)}, Sk_B {sgn(d.headline.sk_bowley, 3)}, β₂ {fmt(d.headline.beta2, 2)}; r(rentals, temperature) = {sgn(d.headline.r_temp, 3)}. Unit 3 tests whether the group differences seen in the tables are significant; Unit 4 turns the correlation into a regression line.
      </Note>
    </PageShell>
  );
}
