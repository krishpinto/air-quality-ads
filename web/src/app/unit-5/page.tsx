import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, KV, Note, StatCard, StatGrid } from "@/components/blocks";
import { ClassCheck, FormulaBlock, Interpretation, Result, SubSection, UnitSection, What, Worked } from "@/components/syllabus";
import { ScatterPlot } from "@/components/charts/scatter";
import { BandLines } from "@/components/charts/xy";
import { ConfusionMatrix } from "@/components/charts/grids";
import { HistWithLines } from "@/components/unit-5/hist-lines";
import { loadData } from "@/lib/data";
import { fmt, fmtInt, pct, shortDate } from "@/lib/format";
import { C } from "@/lib/colors";

/* ------------------------------------------------------------------ types (mirror unit5.json) */
type Day = { date: string; cnt: number; temp_c: number; hum_pct: number; wind_kmh: number; weather: string; day_type: string; cause: string; what: string };
type ZRow = Day & { x: number; dev: number; z: number; flagged?: boolean };
type HumRow = { date: string; x: number; dev: number; z: number; flagged: boolean; cause: string };
type Bin = { x0: number; x1: number; mid: number; count: number; density: number };
type Metrics = {
  tn: number; fp: number; fn: number; tp: number; predicted_positive: number; accuracy: number; precision: number; recall: number; f1: number; auc_pr: number;
  coef: Record<string, number>; intercept: number;
};
type Unit5 = {
  meta: { n_days: number; start: string; end: string; sandy_date: string; seed: number };
  s51: {
    definition: string;
    causes: Array<{ cause: string; meaning: string; here: string }>;
    events: Array<Day & { z_cnt: number }>;
    raw_humidity: { date: string; hum_raw: number; hum_raw_pct: number; temp_c: number; wind_kmh: number; weathersit: number; cnt: number; hum_fixed_pct: number };
    series: Array<{ date: string; cnt: number; marked: number | null }>;
  };
  s52: {
    families: Array<{ family: string; idea: string; far: string; threshold: string; variables: string; finds_sandy: boolean; sandy_note: string }>;
    flagged: { z_cnt: number; iqr_cnt: number; z_wind: number; z_hum_raw: number; knn_top: number; lof_ge_2: number };
  };
  s53: {
    z_cnt: { n: number; mean: number; sd: number; lo: number; hi: number; n_flagged: number; top: ZRow[] };
    z_wind: { n: number; mean: number; sd: number; hi: number; n_flagged: number; top: ZRow[] };
    z_hum_raw: { n: number; mean: number; sd: number; lo: number; n_flagged: number; top: HumRow[] };
    iqr_cnt: { q1: number; q3: number; iqr: number; lower_fence: number; upper_fence: number; min: number; max: number; n_below: number; n_above: number; n_flagged: number };
    hist_cnt: Bin[];
  };
  s54: {
    k: number;
    standardise: { temp_mean: number; temp_sd: number; cnt_mean: number; cnt_sd: number; sandy: { temp_c: number; cnt: number; zt: number; zc: number } };
    top: Array<Day & { zt: number; zc: number; score: number; rank: number }>;
    sandy: { rank: number; score: number; worked: Array<{ date: string; cnt: number; temp_c: number; zt: number; zc: number; dx: number; dy: number; dist: number }> };
    points: Array<{ x: number; y: number; date: string; score: number; group: string }>;
    toy: Array<{ point: string; x: number; y: number; neighbours: string; score: number; slide: number }>;
    score_mean: number; score_median: number;
  };
  s55: {
    k: number;
    toy: {
      points: Array<{ point: string; x: number; y: number }>;
      distance_matrix: Array<{ point: string; a: number; b: number; c: number; d: number }>;
      distance_examples: Array<{ pair: string; calc: string; value: number }>;
      kdist: Array<{ point: string; distances: string; sorted: string; N2: string; kdist: number }>;
      reach: Array<{ p: string; o: string; kdist_o: number; dist_po: number; reach: number }>;
      lrd: Array<{ point: string; sum_reach: string; lrd_calc: string; lrd: number }>;
      lof: Array<{ point: string; N2: string; lrd: number; avg_lrd: number; lof: number; lof_exact: number; slide_lof: number; slide_lrd: number; result: string }>;
    };
    top: Array<Day & { kdist: number; lrd: number; avg_lrd: number; lof: number; rank: number }>;
    sandy: { kdist: number; sum_reach: number; lrd: number; avg_lrd: number; lof: number; rank: number; neighbour_lrd_min: number; neighbour_lrd_max: number };
    points: Array<{ x: number; y: number; date: string; lof: number; label: string }>;
    n_ge_2: number; n_ge_1_5: number; n_lt_1: number; lof_median: number; lof_max: number; lof_min: number; sklearn_max_abs_diff: number | null;
  };
  s56: {
    threshold: number; features: string[]; k: number; seed: number;
    counts: { train: { majority: number; minority: number; ratio: number; minority_share: number; n: number }; test: { majority: number; minority: number; n: number }; all: { majority: number; minority: number } };
    examples: Array<{ parent_date: string; parent: number[]; neighbour_date: string; neighbour: number[]; lam: number; diff: number[]; new: number[] }>;
    after: { majority: number; minority: number; synthetic: number; n: number };
    scatter: Array<{ x: number; y: number; group: string }>;
    without: Metrics; with: Metrics; majority_only_accuracy: number;
  };
  headline: Record<string, number | string>;
};

/* ------------------------------------------------------------------ helpers */
const FEATURE_LABEL: Record<string, string> = { temp_c: "temp (°C)", hum_pct: "hum (%)", wind_kmh: "wind (km/h)", workingday: "workingday", yr: "yr" };

/** LOF → colour: ≈1 grey-blue, rising to rose as the point gets sparser than its neighbours. */
function lofColor(v: number): string {
  const t = Math.min(1, Math.max(0, (v - 1) / 1.5));
  const r = Math.round(100 + (225 - 100) * t), g = Math.round(116 + (29 - 116) * t), b = Math.round(139 + (72 - 139) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

const dayCols = [
  { key: "date", header: "Date", render: (r: Day) => shortDate(r.date) },
  { key: "cnt", header: "cnt", align: "right" as const, render: (r: Day) => fmtInt(r.cnt) },
  { key: "temp_c", header: "temp (°C)", align: "right" as const, render: (r: Day) => fmt(r.temp_c, 1) },
  { key: "weather", header: "Weather" },
];

export default async function Unit5Page() {
  const d = await loadData<Unit5>("unit5");
  const { s51, s52, s53, s54, s55, s56, meta } = d;
  const sandyZ = s53.z_cnt.top.find((r) => r.date === meta.sandy_date);
  const knnTop1 = s54.top[0];
  const lofTop1 = s55.top[0];
  const toyD = s55.toy.lof[3];
  const irene = s51.events.length > 0 ? knnTop1 : undefined;

  const lofPoints = s55.points.map((p) => ({ ...p, color: lofColor(p.lof) }));

  return (
    <PageShell
      module="5"
      title="Anomaly detection"
      description={`Finding the unusual days among the ${fmtInt(meta.n_days)} daily rental counts. One-variable statistical rules first, then distance and density methods on two variables together, then SMOTE for the supervised case where the rare class is the interesting one.`}
      concepts={["Outliers and causes", "z-score |z| > 3", "1.5 × IQR fences", "k-NN distance (Manhattan)", "k-distance, reach-dist, lrd, LOF", "SMOTE", "Logistic regression", "Precision, recall, F1, AUC-PR"]}
    >
      <Note tone="info" title="The story of this unit">
        Hurricane Sandy ({shortDate(meta.sandy_date)}) produced the lowest day in the data: {fmtInt(sandyZ?.cnt ?? 0)} rentals. Yet on cnt alone its z-score is only {fmt(sandyZ?.z ?? 0, 2)}, so the |z| &gt; 3 rule flags {s53.z_cnt.n_flagged} days and the 1.5 × IQR rule flags {s53.iqr_cnt.n_flagged} days. The distribution of rentals is simply wide. When we look at rentals <em>together with temperature</em>, a mild {fmt(s54.standardise.sandy.temp_c, 0)} °C day with {fmtInt(s54.standardise.sandy.cnt)} rentals is far from every neighbour: the k-NN distance ranks it {s54.sandy.rank}
        {s54.sandy.rank === 1 ? "st" : s54.sandy.rank === 2 ? "nd" : s54.sandy.rank === 3 ? "rd" : "th"} of {fmtInt(meta.n_days)} and LOF gives it {fmt(s55.sandy.lof, 2)} (rank {s55.sandy.rank}). The days ranked above it are also storms.
      </Note>

      {/* ============================================================ 5.1 */}
      <UnitSection number="5.1" title="Outliers and causes of outliers" intro="What an outlier is, why they occur, and which causes appear in this dataset.">
        <What>
          {s51.definition} Before deleting or correcting an outlier we must ask <em>why</em> it is there, because the right action depends on the cause: an error is corrected, a real rare event is kept and studied.
        </What>
        <Worked title="The usual causes of outliers, and whether each one occurs in the bike data.">
          <DataTable
            rows={s51.causes}
            columns={[
              { key: "cause", header: "Cause", className: "font-medium whitespace-nowrap" },
              { key: "meaning", header: "Meaning" },
              { key: "here", header: "In this dataset" },
            ]}
          />
        </Worked>
        <Worked title={<>The sensor-error row as it stands in the raw file, before the Unit 1 fix (humidity is stored as a fraction of 1).</>}>
          <KV
            cols={4}
            items={[
              ["dteday", s51.raw_humidity.date],
              ["hum (raw)", `${s51.raw_humidity.hum_raw.toFixed(3)} = ${fmt(s51.raw_humidity.hum_raw_pct, 0)} %`],
              ["temp", `${fmt(s51.raw_humidity.temp_c, 1)} °C`],
              ["windspeed", `${fmt(s51.raw_humidity.wind_kmh, 1)} km/h`],
              ["weathersit", `${s51.raw_humidity.weathersit} (light rain / snow)`],
              ["cnt", fmtInt(s51.raw_humidity.cnt)],
              ["Fixed in Unit 1 to", `${fmt(s51.raw_humidity.hum_fixed_pct, 1)} % (mean of the neighbouring days)`],
            ]}
          />
        </Worked>
        <Worked title="The known-cause days, with their z-score on cnt (computed in 5.3). None of them reaches |z| = 3.">
          <DataTable
            rows={s51.events}
            columns={[
              ...dayCols,
              { key: "hum_pct", header: "hum (%)", align: "right", render: (r) => fmt(r.hum_pct, 0) },
              { key: "wind_kmh", header: "wind (km/h)", align: "right", render: (r) => fmt(r.wind_kmh, 1) },
              { key: "z_cnt", header: "z on cnt", align: "right", render: (r) => fmt(r.z_cnt, 2) },
              { key: "cause", header: "Cause", className: "whitespace-nowrap" },
              { key: "what", header: "What happened" },
            ]}
          />
        </Worked>
        <ChartCard title="Daily rentals with the known-cause days marked" description={`${fmtInt(meta.n_days)} days, ${shortDate(meta.start)} to ${shortDate(meta.end)}. Red dots: the five days in the table above.`}>
          <BandLines
            data={s51.series}
            xKey="date"
            lines={[{ key: "cnt", label: "Rentals per day", color: C.blue, width: 1.1 }]}
            markers={{ key: "marked", label: "Known-cause day", color: C.rose }}
            xFormat="monthYearShort"
            yLabel="cnt"
            height={300}
          />
        </ChartCard>
        <Result
          items={[
            { label: "Sensor error", value: "1 day", hint: `${shortDate(s51.raw_humidity.date)}, humidity 0 %` },
            { label: "Genuine rare event", value: "1 day", hint: `${shortDate(meta.sandy_date)}, Sandy, cnt = ${fmtInt(sandyZ?.cnt ?? 0)}` },
            { label: "Natural variation", value: `${s51.events.filter((e) => e.cause === "Natural variation").length} days`, hint: "snowstorm, rainy 26 Dec" },
          ]}
        />
        <Interpretation>
          The humidity-0 % day is an impossible value, so it is an error and was corrected in Unit 1. Hurricane Sandy is a real event, so the row stays: an anomaly detector should <em>find</em> it, not delete it. The rest of this unit asks which methods find it.
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 5.2 */}
      <UnitSection number="5.2" title="Anomaly detection techniques" intro="Three families of methods, the supervised / unsupervised distinction, and a comparison table filled from the results of 5.3 to 5.5.">
        <What>
          Anomaly detection techniques fall into three families. <strong>Statistical (distribution-based)</strong> methods assume a distribution for one variable and flag values too far from its centre. <strong>Distance-based</strong> methods call a point an outlier when its nearest neighbours are far away. <strong>Density-based</strong> methods (LOF) call a point an outlier when its neighbourhood is much sparser than the neighbourhoods of its neighbours. All three are <strong>unsupervised</strong>: they need no labels, they only score each point. A <strong>supervised</strong> approach instead learns from labelled examples of the rare class; that needs labels, and labels are also the only way to <em>evaluate</em> a detector (how many of the true anomalies did it find?). Section 5.6 takes that route.
        </What>
        <Worked title="Comparison of the three families, with the Sandy column filled in from 5.3 to 5.5.">
          <DataTable
            rows={s52.families}
            columns={[
              { key: "family", header: "Method", className: "font-medium whitespace-nowrap" },
              { key: "idea", header: "Idea" },
              { key: "far", header: 'What "far" means' },
              { key: "threshold", header: "Needs a threshold?" },
              { key: "variables", header: "Variables" },
              { key: "finds_sandy", header: "Finds Sandy?", render: (r) => (r.finds_sandy ? <span className="font-medium text-emerald-700">Yes</span> : <span className="font-medium text-rose-700">No</span>) },
              { key: "sandy_note", header: "Sandy's score", className: "whitespace-nowrap" },
            ]}
          />
        </Worked>
        <Result
          items={[
            { label: "|z| > 3 on cnt", value: `${s52.flagged.z_cnt} flagged` },
            { label: "1.5 × IQR on cnt", value: `${s52.flagged.iqr_cnt} flagged` },
            { label: "k-NN distance", value: `top ${s52.flagged.knn_top} ranked`, hint: "no fixed cutoff" },
            { label: "LOF ≥ 2", value: `${s52.flagged.lof_ge_2} days`, hint: "twice as sparse as neighbours" },
          ]}
        />
        <Interpretation>
          A one-variable rule needs a fixed threshold and misses Sandy; the distance and density methods rank days instead of thresholding and put Sandy near the top. The table also shows the price: ranking methods need us to decide how far down the list to look.
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 5.3 */}
      <UnitSection number="5.3" title="Outlier detection using statistics" intro="The z-score rule and the inter-quartile-range rule, each applied one variable at a time.">
        <SubSection title="z-score rule">
          <What>
            The z-score measures how many standard deviations a value lies from the mean. A value with |z| &gt; 3 is more than three standard deviations away; for a normal distribution only 0.3 % of values are that far, so such a value is flagged as an outlier. μ and σ are computed from the data with ÷N, as in Unit 2.
          </What>
          <FormulaBlock
            tex={[String.raw`z = \frac{x - \mu}{\sigma}, \qquad \sigma = \sqrt{\frac{\sum (x - \mu)^2}{N}}`, String.raw`\text{flag if } |z| > 3 \iff x < \mu - 3\sigma \;\text{ or }\; x > \mu + 3\sigma`]}
            where={[
              ["x", "the observed value"],
              ["\\mu", "mean of the variable"],
              ["\\sigma", "standard deviation (÷N)"],
              ["N", `number of days = ${fmtInt(s53.z_cnt.n)}`],
            ]}
          />
          <Worked title={<>On <strong>cnt</strong>: μ = {fmt(s53.z_cnt.mean, 2)}, σ = {fmt(s53.z_cnt.sd, 2)}, so the limits are μ − 3σ = {fmt(s53.z_cnt.lo, 1)} and μ + 3σ = {fmt(s53.z_cnt.hi, 1)}. The five most extreme days, none beyond ±3:</>}>
            <DataTable
              rows={s53.z_cnt.top}
              columns={[
                { key: "date", header: "Date", render: (r) => shortDate(r.date) },
                { key: "x", header: "x = cnt", align: "right", render: (r) => fmtInt(r.x) },
                { key: "dev", header: "x − μ", align: "right", render: (r) => fmt(r.dev, 1) },
                { key: "z", header: "z = (x − μ)/σ", align: "right", render: (r) => fmt(r.z, 3) },
                { key: "flag", header: "|z| > 3?", render: (r) => (Math.abs(r.z) > 3 ? "Yes" : "No") },
                { key: "what", header: "What happened", render: (r) => r.what || "–" },
              ]}
            />
          </Worked>
          <Worked title={<>On <strong>wind_kmh</strong>: μ = {fmt(s53.z_wind.mean, 2)} km/h, σ = {fmt(s53.z_wind.sd, 2)} km/h, upper limit μ + 3σ = {fmt(s53.z_wind.hi, 1)} km/h. The windiest days:</>}>
            <DataTable
              rows={s53.z_wind.top}
              columns={[
                { key: "date", header: "Date", render: (r) => shortDate(r.date) },
                { key: "x", header: "x = wind (km/h)", align: "right", render: (r) => fmt(r.x, 1) },
                { key: "dev", header: "x − μ", align: "right", render: (r) => fmt(r.dev, 2) },
                { key: "z", header: "z", align: "right", render: (r) => fmt(r.z, 3) },
                { key: "flagged", header: "|z| > 3?", render: (r) => (r.flagged ? <span className="font-medium text-rose-700">Yes</span> : "No") },
                { key: "cnt", header: "cnt that day", align: "right", render: (r) => fmtInt(r.cnt) },
              ]}
            />
          </Worked>
          <Worked title={<>On the <strong>raw humidity</strong> (before the Unit 1 fix): μ = {fmt(s53.z_hum_raw.mean, 2)} %, σ = {fmt(s53.z_hum_raw.sd, 2)} %, lower limit μ − 3σ = {fmt(s53.z_hum_raw.lo, 1)} %. The most extreme days:</>}>
            <DataTable
              rows={s53.z_hum_raw.top}
              columns={[
                { key: "date", header: "Date", render: (r) => shortDate(r.date) },
                { key: "x", header: "x = hum (%)", align: "right", render: (r) => fmt(r.x, 1) },
                { key: "dev", header: "x − μ", align: "right", render: (r) => fmt(r.dev, 2) },
                { key: "z", header: "z", align: "right", render: (r) => fmt(r.z, 3) },
                { key: "flagged", header: "|z| > 3?", render: (r) => (r.flagged ? <span className="font-medium text-rose-700">Yes</span> : "No") },
                { key: "cause", header: "Cause", render: (r) => r.cause || "–" },
              ]}
            />
          </Worked>
          <Result
            items={[
              { label: "cnt, |z| > 3", value: `${s53.z_cnt.n_flagged} days`, hint: `most extreme: ${shortDate(s53.z_cnt.top[0].date)}, z = ${fmt(s53.z_cnt.top[0].z, 2)}` },
              { label: "wind_kmh, |z| > 3", value: `${s53.z_wind.n_flagged} days`, hint: `max z = ${fmt(s53.z_wind.top[0].z, 2)}` },
              { label: "raw humidity, |z| > 3", value: `${s53.z_hum_raw.n_flagged} days`, hint: `0 % day: z = ${fmt(s53.z_hum_raw.top[0].z, 2)}` },
            ]}
          />
          <Interpretation>
            The z-score rule works where one variable has a clear centre and a clear scale: it catches the impossible 0 % humidity (z = {fmt(s53.z_hum_raw.top[0].z, 2)}) and the windiest days. On rentals it flags nothing, because Sandy&apos;s z = {fmt(sandyZ?.z ?? 0, 2)} is inside ±3: the spread of rentals (σ ≈ {fmtInt(s53.z_cnt.sd)}) is so wide that even the lowest day is not three σ away.
          </Interpretation>
        </SubSection>

        <SubSection title="Inter-quartile-range (IQR) rule">
          <What>
            The IQR rule uses the quartiles instead of the mean and σ, so it is not pulled by the extreme values themselves. Any value below the lower fence Q₁ − 1.5·IQR or above the upper fence Q₃ + 1.5·IQR is an outlier; these are the whisker limits of the box plot from Unit 2.
          </What>
          <FormulaBlock
            tex={[String.raw`IQR = Q_3 - Q_1`, String.raw`\text{lower fence} = Q_1 - 1.5 \cdot IQR, \qquad \text{upper fence} = Q_3 + 1.5 \cdot IQR`]}
            where={[
              ["Q_1", "first quartile (25 % of days below)"],
              ["Q_3", "third quartile (75 % of days below)"],
            ]}
          />
          <Worked title="On cnt:">
            <KV
              cols={3}
              items={[
                ["Q₁", fmtInt(s53.iqr_cnt.q1)],
                ["Q₃", fmtInt(s53.iqr_cnt.q3)],
                ["IQR = Q₃ − Q₁", fmtInt(s53.iqr_cnt.iqr)],
                ["Lower fence = Q₁ − 1.5·IQR", `${fmtInt(s53.iqr_cnt.q1)} − ${fmt(1.5 * s53.iqr_cnt.iqr, 0)} = ${fmtInt(s53.iqr_cnt.lower_fence)}`],
                ["Upper fence = Q₃ + 1.5·IQR", `${fmtInt(s53.iqr_cnt.q3)} + ${fmt(1.5 * s53.iqr_cnt.iqr, 0)} = ${fmtInt(s53.iqr_cnt.upper_fence)}`],
                ["Minimum / maximum of cnt", `${fmtInt(s53.iqr_cnt.min)} / ${fmtInt(s53.iqr_cnt.max)}`],
                ["Days below the lower fence", fmtInt(s53.iqr_cnt.n_below)],
                ["Days above the upper fence", fmtInt(s53.iqr_cnt.n_above)],
              ]}
            />
          </Worked>
          <ChartCard title="Histogram of daily rentals with the ±3σ limits and the IQR fences" description="Every bar lies inside both pairs of lines: neither rule flags a single day.">
            <HistWithLines
              bins={s53.hist_cnt}
              xMin={-1600}
              xMax={10800}
              xLabel="cnt (rentals per day)"
              lines={[
                { x: s53.z_cnt.lo, label: `μ − 3σ = ${fmtInt(s53.z_cnt.lo)}`, color: C.rose },
                { x: s53.iqr_cnt.lower_fence, label: `Q₁ − 1.5·IQR = ${fmtInt(s53.iqr_cnt.lower_fence)}`, color: C.violet, dashed: true },
                { x: s53.z_cnt.hi, label: `μ + 3σ = ${fmtInt(s53.z_cnt.hi)}`, color: C.rose },
                { x: s53.iqr_cnt.upper_fence, label: `Q₃ + 1.5·IQR = ${fmtInt(s53.iqr_cnt.upper_fence)}`, color: C.violet, dashed: true },
              ]}
            />
          </ChartCard>
          <Result
            items={[
              { label: "IQR rule on cnt", value: `${s53.iqr_cnt.n_flagged} days flagged`, hint: `fences ${fmtInt(s53.iqr_cnt.lower_fence)} and ${fmtInt(s53.iqr_cnt.upper_fence)}` },
            ]}
          />
          <Interpretation>
            The lower fence is negative, below any possible count, and the upper fence is above the maximum. The distribution of rentals is wide, so a one-variable rule does not flag Sandy; we need to look at rentals together with the weather.
          </Interpretation>
        </SubSection>
      </UnitSection>

      {/* ============================================================ 5.4 */}
      <UnitSection number="5.4" title="Outlier detection using a distance-based method" intro={`The k-nearest-neighbour distance on two variables together, temperature and rentals, with k = ${s54.k} and the Manhattan distance of the class LOF example.`}>
        <What>
          A distance-based method scores each point by how far away its neighbours are. The score used here is the distance to the k-th nearest neighbour: a normal day has {s54.k} similar days close by, so its score is small; an unusual day has to reach far for its {s54.k}th neighbour. The two variables are first <strong>standardised</strong> (z-scores) because they have different units: °C and rentals per day. Without that, one rental would count the same as one degree and temperature would not matter at all.
        </What>
        <FormulaBlock
          tex={[
            String.raw`z_{temp} = \frac{temp - \bar{temp}}{\sigma_{temp}}, \qquad z_{cnt} = \frac{cnt - \overline{cnt}}{\sigma_{cnt}}`,
            String.raw`dist(p, q) = |x_1 - x_2| + |y_1 - y_2|`,
            String.raw`\text{score}(p) = k\text{-distance}(p) = \text{distance from } p \text{ to its } k\text{-th nearest neighbour}, \quad k = ` + s54.k,
          ]}
          where={[
            ["(x, y)", "a day as the point (z_temp, z_cnt)"],
            ["dist", "Manhattan distance, as in the class LOF example"],
          ]}
          note={`Standardisation: temp mean ${fmt(s54.standardise.temp_mean, 2)} °C, σ ${fmt(s54.standardise.temp_sd, 2)}; cnt mean ${fmt(s54.standardise.cnt_mean, 2)}, σ ${fmt(s54.standardise.cnt_sd, 2)} (÷N).`}
        />
        <Worked title={<>Sandy as the point p: temp = {fmt(s54.standardise.sandy.temp_c, 1)} °C → z = {fmt(s54.standardise.sandy.zt, 3)}; cnt = {fmtInt(s54.standardise.sandy.cnt)} → z = {fmt(s54.standardise.sandy.zc, 3)}. Its {s54.k} nearest neighbours, with every term of the distance:</>}>
          <DataTable
            rows={s54.sandy.worked}
            columns={[
              { key: "date", header: "Neighbour o", render: (r) => shortDate(r.date) },
              { key: "temp_c", header: "temp (°C)", align: "right", render: (r) => fmt(r.temp_c, 1) },
              { key: "cnt", header: "cnt", align: "right", render: (r) => fmtInt(r.cnt) },
              { key: "zt", header: "z_temp", align: "right", render: (r) => fmt(r.zt, 3) },
              { key: "zc", header: "z_cnt", align: "right", render: (r) => fmt(r.zc, 3) },
              { key: "dx", header: "|x₁ − x₂|", align: "right", render: (r) => fmt(r.dx, 3) },
              { key: "dy", header: "|y₁ − y₂|", align: "right", render: (r) => fmt(r.dy, 3) },
              { key: "dist", header: "dist(p, o)", align: "right", render: (r) => <span className="font-medium">{fmt(r.dist, 3)}</span> },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            The {s54.k}th row is the {s54.k}th nearest neighbour, so score(Sandy) = {fmt(s54.sandy.score, 3)}. The same is done for all {fmtInt(meta.n_days)} days and the scores are ranked. Typical score: median {fmt(s54.score_median, 3)}.
          </p>
        </Worked>
        <Worked title={`The ten days with the largest k-NN distance (k = ${s54.k}).`}>
          <DataTable
            rows={s54.top}
            columns={[
              { key: "rank", header: "Rank", align: "right" },
              { key: "date", header: "Date", render: (r) => shortDate(r.date) },
              { key: "cnt", header: "cnt", align: "right", render: (r) => fmtInt(r.cnt) },
              { key: "temp_c", header: "temp (°C)", align: "right", render: (r) => fmt(r.temp_c, 1) },
              { key: "weather", header: "Weather" },
              { key: "day_type", header: "Day type" },
              { key: "score", header: `Score (dist to ${s54.k}th NN)`, align: "right", render: (r) => <span className={r.date === meta.sandy_date ? "font-semibold" : ""}>{fmt(r.score, 3)}</span> },
              { key: "what", header: "What happened", render: (r) => r.what || "–" },
            ]}
          />
        </Worked>
        <ChartCard title="Temperature vs rentals, top-10 by k-NN distance highlighted" description="Each dot is one day. The highlighted days sit away from the cloud: cold or rainy days with few rentals, or very hot days.">
          <ScatterPlot points={s54.points} groups={{ "Other days": C.gray, "Top-10 by k-NN distance": C.rose }} xLabel="temp (°C)" yLabel="cnt" height={320} size={22} opacity={0.75} />
        </ChartCard>
        <ClassCheck title="The score is the k-distance from the class LOF slide. For a(0,0), b(0,1), c(1,1), d(3,0) with k = 2 and Manhattan distance the slide gives 2-distance = 2, 1, 2, 3.">
          <DataTable
            rows={s54.toy}
            columns={[
              { key: "point", header: "Point" },
              { key: "x", header: "x", align: "right" },
              { key: "y", header: "y", align: "right" },
              { key: "neighbours", header: "N₂(p)" },
              { key: "score", header: "Our 2-distance", align: "right", render: (r) => fmt(r.score, 0) },
              { key: "slide", header: "Slide", align: "right" },
            ]}
          />
        </ClassCheck>
        <Result
          items={[
            { label: "Sandy's k-NN rank", value: `${s54.sandy.rank} of ${fmtInt(meta.n_days)}`, hint: `score ${fmt(s54.sandy.score, 3)}` },
            { label: "Rank 1", value: shortDate(knnTop1.date), hint: `${knnTop1.what} (score ${fmt(knnTop1.score, 3)})` },
            { label: "Median score", value: fmt(s54.score_median, 3), hint: "a typical day" },
          ]}
        />
        <Interpretation>
          Sandy ranks {s54.sandy.rank}
          {s54.sandy.rank === 1 ? "st" : s54.sandy.rank === 2 ? "nd" : s54.sandy.rank === 3 ? "rd" : "th"} of {fmtInt(meta.n_days)} days, with a score about {fmt(s54.sandy.score / s54.score_median, 1)} times the median: the one-variable rules missed it, the two-variable distance finds it. The two days ranked above it, {shortDate(knnTop1.date)} and {shortDate(s54.top[1].date)}, are also storms ({irene?.what.split(":")[0]}; Tropical Storm Lee). Warm days with very few rentals are far from every neighbour, because on a warm day the city normally rides.
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 5.5 */}
      <UnitSection number="5.5" title="Outlier detection using a density-based method: Local Outlier Factor (LOF)" intro="The four LOF formulas in the notation of the class slides, the class example reproduced step by step, then LOF on the standardised (temperature, rentals) data.">
        <What>
          A distance score alone fails when the data has regions of different density: a point at the edge of a sparse region has far neighbours but is not unusual <em>for that region</em>. LOF compares the density around a point with the density around its neighbours. If the point&apos;s neighbourhood is about as dense as its neighbours&apos; neighbourhoods, LOF ≈ 1 and the point is normal; if it is much sparser, LOF ≫ 1 and the point is an outlier.
        </What>
        <FormulaBlock
          tex={[
            String.raw`k\text{-distance}(p) = \text{distance from } p \text{ to its } k\text{-th nearest neighbour}; \quad N_k(p) = \text{the } k \text{ nearest neighbours of } p`,
            String.raw`\text{reach-dist}_k(p, o) = \max\big(k\text{-distance}(o),\; dist(p, o)\big)`,
            String.raw`lrd(p) = \frac{|N_k(p)|}{\sum_{o \in N_k(p)} \text{reach-dist}_k(p, o)}`,
            String.raw`LOF(p) = \frac{\text{average } lrd \text{ of } N_k(p)}{lrd(p)} = \frac{\frac{1}{|N_k(p)|}\sum_{o \in N_k(p)} lrd(o)}{lrd(p)}`,
          ]}
          where={[
            ["dist(p, o)", "Manhattan distance |x₁ − x₂| + |y₁ − y₂|"],
            ["o", "a neighbour of p; note reach-dist uses the k-distance of the neighbour o, not of p"],
            ["lrd", "local reachability density: neighbours per unit of reach distance"],
            ["|N_k(p)|", "= k (ties keep exactly k neighbours, as on the slide)"],
          ]}
          note="LOF ≈ 1 → normal (density like the neighbours). LOF ≫ 1 → outlier: the point is about LOF times sparser than its neighbours. LOF < 1 → denser than its neighbours, still normal."
        />

        <ClassCheck title="The class example: a(0,0), b(0,1), c(1,1), d(3,0), k = 2, Manhattan distance. Every intermediate table below is produced by our own numpy implementation of the four formulas; the slide's values are shown beside ours.">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <ChartCard title="The four points" description="a, b, c form a dense cluster; d is isolated.">
              <ScatterPlot points={s55.toy.points.map((p) => ({ x: p.x, y: p.y, label: p.point, color: p.point === "d" ? C.rose : C.blue }))} xLabel="x" yLabel="y" height={190} size={70} opacity={0.9} xDomain={[-0.5, 3.5]} yDomain={[-0.5, 1.5]} />
            </ChartCard>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 1a: distance table, dist(p, q) = |x₁ − x₂| + |y₁ − y₂|</p>
              <DataTable
                rows={s55.toy.distance_matrix}
                columns={[
                  { key: "point", header: "", className: "font-medium" },
                  { key: "a", header: "a", align: "right" },
                  { key: "b", header: "b", align: "right" },
                  { key: "c", header: "c", align: "right" },
                  { key: "d", header: "d", align: "right" },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                {s55.toy.distance_examples.map((e, i) => (
                  <span key={e.pair}>
                    {i > 0 && " · "}
                    {e.pair} = {e.calc} = {e.value}
                  </span>
                ))}
              </p>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 1b: sort the distances, take the k = 2 nearest; k-distance = the 2nd one</p>
          <DataTable
            rows={s55.toy.kdist}
            columns={[
              { key: "point", header: "Point", className: "font-medium" },
              { key: "distances", header: "Distances" },
              { key: "sorted", header: "Sorted" },
              { key: "N2", header: "N₂(p)" },
              { key: "kdist", header: "2-distance(p)", align: "right" },
            ]}
          />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 2: reach-dist(p, o) = max(k-distance(o), dist(p, o))</p>
          <DataTable
            rows={s55.toy.reach}
            rowKey={(r) => `${r.p}${r.o}`}
            columns={[
              { key: "pair", header: "p → o", render: (r) => `${r.p} → ${r.o}` },
              { key: "kdist_o", header: "k-distance(o)", align: "right" },
              { key: "dist_po", header: "dist(p, o)", align: "right" },
              { key: "reach", header: "max = reach-dist", align: "right", render: (r) => `max(${r.kdist_o}, ${r.dist_po}) = ${r.reach}` },
            ]}
          />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 3: lrd(p) = |N₂(p)| / Σ reach-dist, with |N₂(p)| = 2</p>
          <DataTable
            rows={s55.toy.lrd}
            columns={[
              { key: "point", header: "Point", className: "font-medium" },
              { key: "sum_reach", header: "Σ reach-dist" },
              { key: "lrd_calc", header: "lrd = 2 / Σ" },
              { key: "lrd", header: "lrd value", align: "right", render: (r) => fmt(r.lrd, 3) },
            ]}
          />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 4: LOF(p) = average lrd of N₂(p) / lrd(p)</p>
          <DataTable
            rows={s55.toy.lof}
            columns={[
              { key: "point", header: "Point", className: "font-medium" },
              { key: "N2", header: "N₂(p)" },
              { key: "lrd", header: "lrd(p)", align: "right", render: (r) => fmt(r.lrd, 3) },
              { key: "avg_lrd", header: "Avg lrd of N₂(p)", align: "right", render: (r) => fmt(r.avg_lrd, 3) },
              { key: "lof", header: "Our LOF", align: "right", render: (r) => <span className="font-semibold">{fmt(r.lof, 2)}</span> },
              { key: "slide_lof", header: "Slide LOF", align: "right", render: (r) => fmt(r.slide_lof, 2) },
              { key: "result", header: "Result", render: (r) => (r.result === "Outlier" ? <span className="font-medium text-rose-700">Outlier</span> : "Normal") },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            d: LOF ≈ {fmt(toyD.lof, 2)}, about {fmt(toyD.lof, 0)} times sparser than its neighbours, the top-1 outlier. a, b, c: LOF close to 1, normal. Ranking d &gt; b &gt; a = c, exactly as on the slide. (LOF is computed from the unrounded lrd values; (7/12)/(2/3) = {fmt(s55.toy.lof[0].lof_exact, 3)} prints as {fmt(s55.toy.lof[0].lof, 2)}.)
          </p>
        </ClassCheck>

        <Worked title={<>LOF with k = {s55.k} on the standardised (z_temp, z_cnt) points of all {fmtInt(meta.n_days)} days, Manhattan distance, same code as the class check. Sandy step by step:</>}>
          <KV
            cols={3}
            items={[
              [`${s55.k}-distance(Sandy)`, fmt(s55.sandy.kdist, 3)],
              ["Σ reach-dist over N₂₀", fmt(s55.sandy.sum_reach, 3)],
              [`lrd(Sandy) = ${s55.k} / Σ`, fmt(s55.sandy.lrd, 3)],
              ["lrd of its neighbours", `${fmt(s55.sandy.neighbour_lrd_min, 3)} to ${fmt(s55.sandy.neighbour_lrd_max, 3)}`],
              ["Average lrd of N₂₀(Sandy)", fmt(s55.sandy.avg_lrd, 3)],
              ["LOF(Sandy) = avg lrd / lrd", <span key="l" className="font-semibold">{fmt(s55.sandy.lof, 3)}</span>],
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Sandy&apos;s neighbours are themselves in a fairly dense part of the cloud (lrd around {fmt(s55.sandy.avg_lrd, 2)}), while Sandy&apos;s own density is {fmt(s55.sandy.lrd, 2)}: it is about {fmt(s55.sandy.lof, 1)} times sparser than its neighbours.
            {s55.sklearn_max_abs_diff !== null && ` Cross-check: scikit-learn's LocalOutlierFactor (k = ${s55.k}, metric = "manhattan") gives the same ${fmtInt(meta.n_days)} values (largest difference ${s55.sklearn_max_abs_diff}).`}
          </p>
        </Worked>
        <Worked title={`The ten days with the highest LOF (k = ${s55.k}).`}>
          <DataTable
            rows={s55.top}
            columns={[
              { key: "rank", header: "Rank", align: "right" },
              { key: "date", header: "Date", render: (r) => shortDate(r.date) },
              { key: "cnt", header: "cnt", align: "right", render: (r) => fmtInt(r.cnt) },
              { key: "temp_c", header: "temp (°C)", align: "right", render: (r) => fmt(r.temp_c, 1) },
              { key: "weather", header: "Weather" },
              { key: "kdist", header: `${s55.k}-distance`, align: "right", render: (r) => fmt(r.kdist, 3) },
              { key: "lrd", header: "lrd(p)", align: "right", render: (r) => fmt(r.lrd, 3) },
              { key: "avg_lrd", header: "Avg lrd of Nₖ(p)", align: "right", render: (r) => fmt(r.avg_lrd, 3) },
              { key: "lof", header: "LOF", align: "right", render: (r) => <span className={r.date === meta.sandy_date ? "font-semibold" : ""}>{fmt(r.lof, 3)}</span> },
              { key: "what", header: "What happened", render: (r) => r.what || "–" },
            ]}
          />
        </Worked>
        <ChartCard title="Temperature vs rentals, coloured by LOF" description={`Grey-blue ≈ 1 (normal), rose = high LOF. Median LOF ${fmt(s55.lof_median, 2)}; ${s55.n_lt_1} days are below 1 (denser than their neighbours), ${s55.n_ge_1_5} days are at or above 1.5 and ${s55.n_ge_2} at or above 2.`}>
          <ScatterPlot points={lofPoints} xLabel="temp (°C)" yLabel="cnt" height={320} size={22} opacity={0.8} />
        </ChartCard>
        <Result
          items={[
            { label: "LOF(Sandy)", value: fmt(s55.sandy.lof, 2), hint: `rank ${s55.sandy.rank} of ${fmtInt(meta.n_days)}` },
            { label: "Highest LOF", value: fmt(lofTop1.lof, 2), hint: `${shortDate(lofTop1.date)}, ${lofTop1.what.split(":")[0]}` },
            { label: "Days with LOF ≥ 2", value: `${s55.n_ge_2}`, hint: "like d in the class example" },
            { label: "Median LOF", value: fmt(s55.lof_median, 2), hint: "≈ 1, normal" },
          ]}
        />
        <Interpretation>
          LOF(Sandy) ≈ {fmt(s55.sandy.lof, 2)}: Sandy is about {fmt(s55.sandy.lof, 0)} times sparser than its neighbours, like d on the slide, and ranks {s55.sandy.rank}
          {s55.sandy.rank === 1 ? "st" : s55.sandy.rank === 2 ? "nd" : s55.sandy.rank === 3 ? "rd" : "th"} of {fmtInt(meta.n_days)}. Most days have LOF close to 1 (median {fmt(s55.lof_median, 2)}) and are normal. The top of the LOF list is again weather: Hurricane Irene, the 2011 heat wave, the January cold snap; LOF ranks the hot and cold days higher than the k-NN distance did because the edges of the temperature range are sparse, so a point there needs to be unusual <em>relative to its sparse neighbours</em> to score high, and these days are.
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 5.6 */}
      <UnitSection number="5.6" title="SMOTE (Synthetic Minority Over-sampling Technique)" intro={`The supervised view: label every day as high-demand (cnt > ${fmtInt(s56.threshold)}) or not, see the class imbalance, balance the training set with SMOTE, and train a logistic regression with and without it.`}>
        <What>
          When the interesting cases are rare, a labelled dataset is <strong>imbalanced</strong>: many normal days, few high-demand days. A classifier trained on it tends to predict the majority class for everything, because that is already right most of the time; it then has high accuracy but finds almost none of the rare days. SMOTE fixes the training set by creating <em>synthetic</em> minority examples: for a minority point it picks one of its k = {s56.k} nearest minority neighbours and places a new point somewhere on the line segment between them. The classifier then sees as many high-demand days as normal days.
        </What>
        <FormulaBlock
          tex={[String.raw`x_{new} = x_i + \lambda \,(x_{zi} - x_i), \qquad \lambda \sim U(0, 1)`]}
          where={[
            ["x_i", "a minority (high-demand) training day"],
            ["x_{zi}", `one of its k = ${s56.k} nearest minority neighbours, chosen at random`],
            ["\\lambda", "a random number between 0 and 1: 0 gives xᵢ itself, 1 gives the neighbour"],
          ]}
          note={`Inputs x = (${s56.features.map((f) => FEATURE_LABEL[f]).join(", ")}). Repeated until the minority class has as many rows as the majority. Random seed ${s56.seed}.`}
        />
        <Worked title="Class counts. Only the training rows are resampled; the test rows stay exactly as they are, otherwise the evaluation would be on invented days.">
          <DataTable
            rows={[
              { set: "Training rows (Jan 2011 – Jun 2012)", majority: s56.counts.train.majority, minority: s56.counts.train.minority, n: s56.counts.train.n, ratio: `${fmt(s56.counts.train.ratio, 1)} : 1`, share: pct(s56.counts.train.minority_share) },
              { set: "Training rows after SMOTE", majority: s56.after.majority, minority: s56.after.minority, n: s56.after.n, ratio: "1 : 1", share: pct(s56.after.minority / s56.after.n) },
              { set: "Test rows (Jul – Dec 2012), untouched", majority: s56.counts.test.majority, minority: s56.counts.test.minority, n: s56.counts.test.n, ratio: `${fmt(s56.counts.test.majority / s56.counts.test.minority, 1)} : 1`, share: pct(s56.counts.test.minority / s56.counts.test.n) },
            ]}
            columns={[
              { key: "set", header: "Rows", className: "font-medium" },
              { key: "majority", header: "Normal (0)", align: "right", render: (r) => fmtInt(r.majority as number) },
              { key: "minority", header: `High-demand (1), cnt > ${fmtInt(s56.threshold)}`, align: "right", render: (r) => fmtInt(r.minority as number) },
              { key: "n", header: "Total", align: "right", render: (r) => fmtInt(r.n as number) },
              { key: "ratio", header: "Majority : minority", align: "right" },
              { key: "share", header: "Minority share", align: "right" },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            The test half-year is the busy second half of 2012, so it has far more high-demand days ({fmtInt(s56.counts.test.minority)} of {fmtInt(s56.counts.test.n)}) than the training period ({fmtInt(s56.counts.train.minority)} of {fmtInt(s56.counts.train.n)}, all in spring 2012). That is exactly the situation where a majority-only classifier fails.
          </p>
        </Worked>
        <Worked title={`Five synthetic rows made with the formula, with their parents and λ (own code, seed ${s56.seed}). Columns: ${s56.features.map((f) => FEATURE_LABEL[f]).join(", ")}.`}>
          <DataTable
            rows={s56.examples.map((e, i) => ({ ...e, i: i + 1 }))}
            columns={[
              { key: "i", header: "#", align: "right" },
              { key: "parent_date", header: "xᵢ (parent)", render: (r) => shortDate(r.parent_date) },
              { key: "parent", header: "xᵢ values", render: (r) => r.parent.map((v) => fmt(v, 1)).join(" · ") },
              { key: "neighbour_date", header: "x_zi (neighbour)", render: (r) => shortDate(r.neighbour_date) },
              { key: "neighbour", header: "x_zi values", render: (r) => r.neighbour.map((v) => fmt(v, 1)).join(" · ") },
              { key: "diff", header: "x_zi − xᵢ", render: (r) => r.diff.map((v) => fmt(v, 1)).join(" · ") },
              { key: "lam", header: "λ", align: "right", render: (r) => fmt(r.lam, 3) },
              { key: "new", header: "x_new = xᵢ + λ(x_zi − xᵢ)", render: (r) => <span className="font-medium">{r.new.map((v) => fmt(v, 1)).join(" · ")}</span> },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            Every column is interpolated, including the 0/1 columns workingday and yr, so a synthetic day can have workingday = 0.4. That is how plain SMOTE works; it is a known limitation. The full resampling ({fmtInt(s56.after.synthetic)} synthetic rows) is done by imblearn&apos;s SMOTE with the same k and seed.
          </p>
        </Worked>
        <ChartCard title="Training days: temperature vs humidity, real and synthetic high-demand days" description="Synthetic points lie on the segments between real high-demand days, so they fill the same warm, moderately humid region rather than inventing new conditions.">
          <ScatterPlot points={s56.scatter} groups={{ "Real: normal day": C.gray, "Synthetic high-demand (SMOTE)": C.orange, "Real: high-demand day": C.blue }} xLabel="temp (°C)" yLabel="hum (%)" height={320} size={20} opacity={0.7} />
        </ChartCard>
        <Result
          items={[
            { label: "Training rows before SMOTE", value: `${fmtInt(s56.counts.train.majority)} : ${fmtInt(s56.counts.train.minority)}`, hint: `${fmt(s56.counts.train.ratio, 1)} normal days per high-demand day` },
            { label: "After SMOTE", value: `${fmtInt(s56.after.majority)} : ${fmtInt(s56.after.minority)}`, hint: `${fmtInt(s56.after.synthetic)} synthetic rows added` },
          ]}
        />
        <Interpretation>
          SMOTE does not copy the {fmtInt(s56.counts.train.minority)} high-demand days; it creates {fmtInt(s56.after.synthetic)} new points between them, so the classifier sees a balanced training set of {fmtInt(s56.after.n)} rows that still describes only warm, moderately humid, mostly 2012 conditions.
        </Interpretation>

        <SubSection title="Classifier: logistic regression without and with SMOTE">
          <What>
            Logistic regression (named in the Unit 1 task table) is a classifier that models the probability of the class-1 label as a function of the inputs, p = 1 / (1 + e^−(b₀ + b₁x₁ + … )), and predicts high-demand when p &gt; 0.5. Inputs: {s56.features.map((f) => FEATURE_LABEL[f]).join(", ")}, standardised with the training mean and σ because of their different units. The same model is fitted twice, on the original training rows and on the SMOTE training rows, and both are evaluated on the {fmtInt(s56.counts.test.n)} untouched test days.
          </What>
          <Worked title="Fitted coefficients on the standardised inputs (one unit = one σ of that input).">
            <DataTable
              rows={s56.features.map((f) => ({ f, label: FEATURE_LABEL[f], without: s56.without.coef[f], with: s56.with.coef[f] }))}
              columns={[
                { key: "label", header: "Input", className: "font-medium" },
                { key: "without", header: "Coefficient, without SMOTE", align: "right", render: (r) => fmt(r.without, 3) },
                { key: "with", header: "Coefficient, with SMOTE", align: "right", render: (r) => fmt(r.with, 3) },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              Intercept b₀: {fmt(s56.without.intercept, 3)} without SMOTE, {fmt(s56.with.intercept, 3)} with. The strongly negative intercept without SMOTE is the imbalance itself: with only {pct(s56.counts.train.minority_share)} positive rows, the model starts from &quot;probably not high-demand&quot;.
            </p>
          </Worked>
        </SubSection>
      </UnitSection>

      {/* ============================================================ Self-learning */}
      <UnitSection number="5.6 (self-learning)" title="Evaluating the classifier: confusion matrix, precision, recall, F1, AUC-PR" selfLearning intro={`Both models on the ${fmtInt(s56.counts.test.n)} test days (Jul – Dec 2012), which contain ${fmtInt(s56.counts.test.minority)} real high-demand days.`}>
        <What>
          The confusion matrix counts the four outcomes of a classifier: true positives (high-demand days found), false negatives (missed), false positives (false alarms) and true negatives. <strong>Precision</strong> is the share of predicted high-demand days that really were; <strong>recall</strong> is the share of real high-demand days that were found; <strong>F1</strong> is their harmonic mean. <strong>AUC-PR</strong> is the area under the precision–recall curve obtained by moving the probability cutoff from 1 down to 0; it summarises the ranking of the test days by predicted probability, independent of the 0.5 cutoff.
        </What>
        <FormulaBlock
          tex={[
            String.raw`\text{precision} = \frac{TP}{TP + FP}, \qquad \text{recall} = \frac{TP}{TP + FN}`,
            String.raw`F_1 = \frac{2 \cdot \text{precision} \cdot \text{recall}}{\text{precision} + \text{recall}}, \qquad \text{accuracy} = \frac{TP + TN}{TP + TN + FP + FN}`,
          ]}
          where={[
            ["TP", "high-demand days predicted high-demand"],
            ["FN", "high-demand days predicted normal (missed)"],
            ["FP", "normal days predicted high-demand (false alarms)"],
            ["TN", "normal days predicted normal"],
          ]}
        />
        <Worked title="Confusion matrices on the test days.">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Without SMOTE" description={`Predicted high-demand on ${fmtInt(s56.without.predicted_positive)} of ${fmtInt(s56.counts.test.n)} days.`}>
              <ConfusionMatrix tn={s56.without.tn} fp={s56.without.fp} fn={s56.without.fn} tp={s56.without.tp} posLabel="High-demand" negLabel="Normal" />
            </ChartCard>
            <ChartCard title="With SMOTE" description={`Predicted high-demand on ${fmtInt(s56.with.predicted_positive)} of ${fmtInt(s56.counts.test.n)} days.`}>
              <ConfusionMatrix tn={s56.with.tn} fp={s56.with.fp} fn={s56.with.fn} tp={s56.with.tp} posLabel="High-demand" negLabel="Normal" />
            </ChartCard>
          </div>
        </Worked>
        <Worked title="The metrics, computed from the two matrices.">
          <DataTable
            rows={[
              { metric: "Precision = TP / (TP + FP)", without: `${s56.without.tp} / ${s56.without.tp + s56.without.fp} = ${fmt(s56.without.precision, 3)}`, with: `${s56.with.tp} / ${s56.with.tp + s56.with.fp} = ${fmt(s56.with.precision, 3)}` },
              { metric: "Recall = TP / (TP + FN)", without: `${s56.without.tp} / ${s56.without.tp + s56.without.fn} = ${fmt(s56.without.recall, 3)}`, with: `${s56.with.tp} / ${s56.with.tp + s56.with.fn} = ${fmt(s56.with.recall, 3)}` },
              { metric: "F1", without: fmt(s56.without.f1, 3), with: fmt(s56.with.f1, 3) },
              { metric: "Accuracy", without: fmt(s56.without.accuracy, 3), with: fmt(s56.with.accuracy, 3) },
              { metric: "AUC-PR", without: fmt(s56.without.auc_pr, 3), with: fmt(s56.with.auc_pr, 3) },
            ]}
            columns={[
              { key: "metric", header: "Metric", className: "font-medium" },
              { key: "without", header: "Without SMOTE", align: "right" },
              { key: "with", header: "With SMOTE", align: "right" },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            For scale: predicting &quot;normal&quot; for every test day would give accuracy {fmt(s56.majority_only_accuracy, 3)} and recall 0.
          </p>
        </Worked>
        <StatGrid cols={4}>
          <StatCard label="Recall without SMOTE" value={pct(s56.without.recall)} hint={`${s56.without.tp} of ${s56.counts.test.minority} high-demand days found`} tone="bad" />
          <StatCard label="Recall with SMOTE" value={pct(s56.with.recall)} hint={`${s56.with.tp} of ${s56.counts.test.minority} found`} tone="good" />
          <StatCard label="False alarms without / with" value={`${s56.without.fp} / ${s56.with.fp}`} hint="normal days predicted high-demand" tone="warn" />
          <StatCard label="F1 without / with" value={`${fmt(s56.without.f1, 2)} / ${fmt(s56.with.f1, 2)}`} />
        </StatGrid>
        <Interpretation>
          SMOTE raises recall for high-demand days from {pct(s56.without.recall)} to {pct(s56.with.recall)}: the balanced model finds {s56.with.tp} of the {s56.counts.test.minority} real high-demand days instead of {s56.without.tp}. The cost is false alarms, which rise from {s56.without.fp} to {s56.with.fp}: a bigger share of the test days is now called high-demand ({fmtInt(s56.with.predicted_positive)} instead of {fmtInt(s56.without.predicted_positive)}), so precision stays well below recall at {pct(s56.with.precision)}.
          {s56.with.precision > s56.without.precision && ` Here precision also went up (from ${pct(s56.without.precision)}), because the model without SMOTE predicted so few positives that even those were mostly wrong.`} AUC-PR barely changes ({fmt(s56.without.auc_pr, 2)} vs {fmt(s56.with.auc_pr, 2)}): SMOTE mainly moves the decision cutoff, it does not change how well the model ranks the days.
        </Interpretation>
      </UnitSection>
    </PageShell>
  );
}
