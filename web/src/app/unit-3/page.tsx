import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, KV, Note } from "@/components/blocks";
import { Histogram } from "@/components/charts/series";
import { CltSimulator } from "@/components/clt-simulator";
import { Formula, Tex } from "@/components/formula";
import { ClassCheck, FormulaBlock, HypothesisTest, Interpretation, Result, SubSection, UnitSection, What, Worked } from "@/components/syllabus";
import { Card, CardContent } from "@/components/ui/card";
import { fmtInt } from "@/lib/format";

/* ------------------------------------------------------------------ types for unit3.json */
type Bin = { x0: number; x1: number; mid: number; count: number; density: number; normal?: number };
type RuleRow = { k: number; lower: number; upper: number; inside: number; actual_pct: number; rule_pct: number; gap: number };
type NormalFit = { label: string; unit: string; n: number; mean: number; sigma: number; min: number; max: number; bins: Bin[]; rule: RuleRow[]; max_gap: number };
type PoissonRow = { x: string; observed: number; p: number; expected: number; term: string };
type Poisson = { n: number; lambda: number; sum: number; variance: number; ratio: number; rows: PoissonRow[]; max_count: number; counts: number[]; fit_ok: boolean };
type CltRow = { n: number; draws: number; mean_of_means: number; sd_of_means: number; se_theory: number; min_mean: number; max_mean: number };
type Clt = { N: number; mu: number; sigma: number; draws: number; sizes: number[]; population_bins: Bin[]; table: CltRow[]; chart: { n: number; bins: Bin[]; row: CltRow }; population: number[] };
type CiZ = { level: number; n: number; xbar: number; sigma: number; z: number; se: number; moe: number; lower: number; upper: number; width: number };
type CiT = { n: number; sum_x: number; xbar: number; sum_sq_dev: number; s2: number; s: number; df: number; t: number; se: number; moe: number; lower: number; upper: number; rows: Array<{ x: number; dev: number; dev2: number }> };
type Ci = { z: CiZ; levels: CiZ[]; t: CiT; t_dates: string[]; mu: number; contains_mu_z: boolean; contains_mu_t: boolean };
type Framework = { z_table: Array<{ alpha: number; two: number; right: number; left: number }>; t_examples: Array<{ df: number; t: number }> };
type Decision = "reject" | "accept";
type ZTest = { xbar: number; mu0: number; sd: number; sd_label: string; n: number; sqrt_n: number; se: number; z: number; abs_z: number; crit: number; alpha: number; decision: Decision; p: number; n_2011?: number; year_sample?: number; year_ref?: number };
type OneT = { n: number; sum_x: number; xbar: number; mu0: number; sum_sq_dev: number; s2: number; s: number; se: number; t: number; abs_t: number; df: number; crit: number; decision: Decision; p: number; rows: Array<{ label: string; x: number; dev: number; dev2: number }>; mu0_label?: string };
type IndRow = { x_label?: string; x?: number; dx?: number; dx2?: number; y_label?: string; y?: number; dy?: number; dy2?: number };
type IndT = { n1: number; n2: number; sum_x: number; sum_y: number; xbar: number; ybar: number; ssx: number; ssy: number; df: number; s2: number; s2_over_n1: number; s2_over_n2: number; inside: number; sqrt_inside: number; diff: number; t: number; abs_t: number; crit: number; decision: Decision; p: number; rows: IndRow[]; comparison?: string; x_name?: string; y_name?: string; daily_means?: { x: number; y: number } };
type PairT = { n: number; sum_d: number; dbar: number; sum_sq_dev: number; s2: number; s: number; se: number; t: number; abs_t: number; df: number; crit: number; decision: Decision; p: number; rows: Array<{ label: string; before: number; after: number; d: number; dd: number; dd2: number }> };
type Group = { group: string; n: number; sum: number; mean: number; dev: number; dev2: number; n_dev2: number; ss_within: number; values: number[] | null };
type OneWay = { k: number; n: number; groups: Group[]; grand_mean: number; sum_of_means: number; ss_between: number; df_between: number; ms_between: number; ss_within: number; df_within: number; ms_within: number; ss_total: number; df_total: number; f: number; crit: number; decision: Decision; p: number; overall_mean: number; factor?: string };
type TwoWay = { row_factor: string; col_factor: string; row_labels: string[]; col_labels: string[]; r: number; c: number; n: number; cells: Array<{ row: string; values: number[]; total: number; squares: number[] }>; col_totals: number[]; T: number; cf: number; sum_sq: number; ss_total: number; col_terms: number[]; row_terms: number[]; ss_cols: number; ss_rows: number; ss_res: number; df_cols: number; df_rows: number; df_res: number; df_total: number; ms_cols: number; ms_rows: number; ms_res: number; f_cols: number; f_rows: number; crit_cols: number; crit_rows: number; decision_cols: Decision; decision_rows: Decision; p_cols: number; p_rows: number };
type Unit3 = {
  meta: { N: number; mu: number; sigma: number; alpha: number; seed: number; months: number; quarters: number };
  distributions: { normal: { temp: NormalFit; cnt: NormalFit }; poisson: Poisson };
  clt: Clt;
  ci: Ci;
  framework: Framework;
  ztest: ZTest;
  ttests: { one_sample: OneT; independent: IndT; paired: PairT; accept: IndT };
  anova: { one_way: OneWay; two_way: TwoWay };
  class_checks: {
    wheat_one_way: { ours: OneWay; slide: { ss_between: number; ss_within: number; ms_between: number; ms_within: number; f: number; crit: number } };
    wheat_two_way: { ours: TwoWay; slide: { cf: number; ss_total: number; ss_cols: number; ss_rows: number; ss_res: number; f_cols: number; f_rows: number; crit_cols: number; crit_rows: number } };
    oceanographer: { ours: ZTest; slide: { z: number; crit: number; decision: Decision } };
    iq: { ours: OneT; ci: CiT; slide: { xbar: number; sum_sq_dev: number; s2: number; s: number; t: number; crit: number; lower: number; upper: number } };
  };
  headline: Record<string, number | string>;
};

/* ------------------------------------------------------------------ small formatting helpers (sums of squares are large) */
const num = (x: number | null | undefined, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? "–" : x.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));
const n0 = (x: number | null | undefined) => num(x, 0);
const Sub = ({ children }: { children: string }) => <span className="text-xs text-muted-foreground">{children}</span>;

/** The teacher's ANOVA table: Source | SS | d.f. | MS | F-ratio | 5 % F-limit. */
function AnovaTable({ rows }: { rows: Array<{ source: string; ss: string; df: string; ms: string; f: string; limit: string }> }) {
  return (
    <DataTable
      rows={rows}
      columns={[
        { key: "source", header: "Source of variation" },
        { key: "ss", header: "Sum of squares (SS)", align: "right" },
        { key: "df", header: "d.f.", align: "right" },
        { key: "ms", header: "Mean square (MS)", align: "right" },
        { key: "f", header: "F-ratio", align: "right" },
        { key: "limit", header: "5 % F-limit (from the F-table)", align: "right" },
      ]}
    />
  );
}

/** The teacher's two-column error boxes (3.5). */
function ErrorBox({ title, lines, tone }: { title: string; lines: string[]; tone: "rose" | "amber" }) {
  const cls = tone === "rose" ? "border-rose-200 bg-rose-50/60" : "border-amber-200 bg-amber-50/60";
  return (
    <Card className={`gap-0 py-3 shadow-none ${cls}`}>
      <CardContent className="space-y-1 px-4 text-sm">
        <div className="font-semibold">{title}</div>
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </CardContent>
    </Card>
  );
}

export default async function Unit3Page() {
  const d = await loadData<Unit3>("unit3");
  const { meta, distributions: dist, clt, ci, framework: fw, ztest: z, ttests: tt, anova, class_checks: cc } = d;
  const temp = dist.normal.temp;
  const cntFit = dist.normal.cnt;
  const po = dist.poisson;
  const one = anova.one_way;
  const two = anova.two_way;
  const alphaLabel = `α = ${meta.alpha} (5 %), two-tailed`;
  const cltRow30 = clt.chart.row;

  return (
    <PageShell
      module="3"
      title="Data exploration using inferential statistics"
      description={`Unit 2 described the ${fmtInt(meta.N)} days we have. This unit treats them as samples from a larger population of bike-share days and asks what we can infer about that population: which distribution the data follow, how sample means behave (central limit theorem), how sure we are about the population mean (confidence interval), and whether differences we see — between years, holidays, working days and seasons — are real or due to chance (Z-test, t-tests, ANOVA). Every test uses the five-step layout taught in class and compares the calculated statistic with the tabulated critical value at α = ${meta.alpha}.`}
      concepts={["Normal distribution", "Poisson distribution", "Central limit theorem", "Confidence interval", "Hypothesis testing", "Type-I / Type-II errors", "Z-test", "t-test", "One-way ANOVA", "Two-way ANOVA"]}
    >
      <Note tone="info" title="How this page is numbered">
        The syllabus for this unit is a single line: &ldquo;Overview of various forms of distributions: Normal, Poisson; Central limit theorem; Confidence interval; Hypothesis testing; Type-I and Type-II errors; Z-test; t-test; ANOVA (one-way, two-way)&rdquo;. The sections below are numbered 3.1 to 3.8 in that order. Random samples are drawn once with a fixed seed ({meta.seed}) so every number is reproducible.
      </Note>

      {/* ============================================================ 3.1 */}
      <UnitSection number="3.1" title="Forms of distributions: Normal and Poisson" intro="Two distributions were covered: the normal (bell-shaped, continuous) and the Poisson (counts of rare events). We check how well each describes a variable from our data.">
        <SubSection title="Normal distribution">
          <What>
            A continuous, symmetric, bell-shaped distribution fully described by its mean μ and standard deviation σ. Most data lie near the mean and the two tails are equal. It is the distribution the Z-test, the confidence interval and the central limit theorem rely on.
          </What>
          <FormulaBlock
            tex={["f(x) = \\frac{1}{\\sqrt{2\\pi\\sigma^{2}}}\\; e^{-\\frac{(x-\\mu)^{2}}{2\\sigma^{2}}}", "68.2\\% \\text{ of data within } \\pm 1\\sigma \\qquad 95.4\\% \\text{ within } \\pm 2\\sigma \\qquad 99.7\\% \\text{ within } \\pm 3\\sigma"]}
            where={[["x", "value of the variable"], ["\\mu", "mean (central value)"], ["\\sigma", "standard deviation (÷N, as in Unit 2)"], ["e", "Euler's constant ≈ 2.718"], ["\\pi", "3.1416"]]}
            note="The formula sheet prints the exponent without the minus sign; the correct density has −(x − μ)²/2σ² in the exponent, which is what is drawn below. For our series we first calculate μ and σ, then draw the curve."
          />
          <Worked title={`Daily temperature and daily rentals: histogram with the normal curve that has the same μ and σ, then the empirical-rule check (how many of the ${fmtInt(meta.N)} days fall inside μ ± kσ).`}>
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title={`${temp.label} (°C)`} description={`μ = ${num(temp.mean)} °C, σ = ${num(temp.sigma)} °C. Bars: observed density. Red: fitted normal curve.`}>
                <Histogram bins={temp.bins} height={220} label="Observed" xFormat="int" />
              </ChartCard>
              <ChartCard title={`${cntFit.label} (cnt)`} description={`μ = ${n0(cntFit.mean)}, σ = ${n0(cntFit.sigma)}. The same check on the target variable for comparison.`}>
                <Histogram bins={cntFit.bins} height={220} label="Observed" xFormat="int" />
              </ChartCard>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[temp, cntFit].map((f) => (
                <DataTable
                  key={f.label}
                  rows={f.rule}
                  columns={[
                    { key: "k", header: `${f.label}: range`, render: (r) => `μ ± ${r.k}σ = ${num(r.lower, f.unit === "°C" ? 1 : 0)} to ${num(r.upper, f.unit === "°C" ? 1 : 0)}` },
                    { key: "inside", header: "Days inside", align: "right", render: (r) => fmtInt(r.inside) },
                    { key: "actual_pct", header: "Actual %", align: "right", render: (r) => `${num(r.actual_pct, 1)} %` },
                    { key: "rule_pct", header: "Rule %", align: "right", render: (r) => `${num(r.rule_pct, 1)} %` },
                    { key: "gap", header: "Gap", align: "right", render: (r) => `${r.gap > 0 ? "+" : ""}${num(r.gap, 1)}` },
                  ]}
                />
              ))}
            </div>
          </Worked>
          <Result
            items={[
              { label: "Temperature: μ, σ", value: `${num(temp.mean, 1)} °C, ${num(temp.sigma, 1)} °C` },
              { label: "Temperature inside ±1σ / ±2σ / ±3σ", value: `${num(temp.rule[0].actual_pct, 1)} / ${num(temp.rule[1].actual_pct, 1)} / ${num(temp.rule[2].actual_pct, 1)} %`, hint: "rule: 68.2 / 95.4 / 99.7 %" },
              { label: "Rentals inside ±1σ / ±2σ / ±3σ", value: `${num(cntFit.rule[0].actual_pct, 1)} / ${num(cntFit.rule[1].actual_pct, 1)} / ${num(cntFit.rule[2].actual_pct, 1)} %` },
            ]}
          />
          <Interpretation>
            Both variables are roughly bell-shaped: the ±2σ and ±3σ counts match the rule within {num(Math.max(temp.rule[1].gap, cntFit.rule[1].gap, 0) + Math.abs(Math.min(temp.rule[1].gap, cntFit.rule[1].gap, 0)), 1)} points. The ±1σ band holds fewer days than the 68.2 % the rule expects ({num(temp.rule[0].actual_pct, 1)} % for temperature, {num(cntFit.rule[0].actual_pct, 1)} % for rentals), because both series are flatter than a true normal curve — a year has long warm and cold spells, not one central temperature. Near-normal is good enough for the Z and t methods that follow, which rest on the central limit theorem anyway.
          </Interpretation>
        </SubSection>

        <SubSection title="Poisson distribution">
          <What>
            A discrete distribution for the number of times a rare event happens in a fixed interval, when events occur independently at a constant average rate λ. Its mean and variance are both λ. Our rare event: a day with light rain or snow (weathersit = 3); the interval: one calendar month.
          </What>
          <FormulaBlock tex={["P(X = x) = \\frac{e^{-\\lambda}\\,\\lambda^{x}}{x!}, \\qquad x = 0, 1, 2, \\ldots", "\\text{Mean} = \\text{Variance} = \\lambda"]} where={[["\\lambda", "average number of events per interval = mean count"], ["x", "number of events observed in the interval"], ["e", "≈ 2.718"]]} />
          <Worked title={`Rain/snow days per month over the ${po.n} months. λ is the mean count; the expected number of months with x such days is ${po.n} × P(X = x).`}>
            <KV
              cols={3}
              items={[
                ["Months N", `${po.n}`],
                ["Σx (rain/snow days in total)", `${po.sum}`],
                ["λ = Σx / N", `${po.sum} / ${po.n} = ${num(po.lambda, 3)}`],
                ["Variance Σ(x − λ)² / N", num(po.variance, 3)],
                ["Variance / λ", num(po.ratio, 2)],
                ["Largest count in a month", `${po.max_count}`],
              ]}
            />
            <DataTable
              rows={po.rows}
              columns={[
                { key: "x", header: "x = rain/snow days in the month" },
                { key: "term", header: "P(X = x)", render: (r) => <Tex>{r.term.replace(/−/g, "-")}</Tex> },
                { key: "p", header: "= probability", align: "right", render: (r) => num(r.p, 4) },
                { key: "expected", header: `Expected months = ${po.n} × P`, align: "right", render: (r) => num(r.expected, 2) },
                { key: "observed", header: "Observed months", align: "right", render: (r) => `${r.observed}` },
              ]}
            />
          </Worked>
          <Result items={[{ label: "λ (mean count per month)", value: num(po.lambda, 3) }, { label: "Variance of the counts", value: num(po.variance, 3) }, { label: "Months with 0 rain/snow days: observed vs expected", value: `${po.rows[0].observed} vs ${num(po.rows[0].expected, 1)}` }]} />
          <Interpretation>
            For a Poisson variable the mean and the variance should be equal. Here λ = {num(po.lambda, 3)} and the variance is {num(po.variance, 3)} (ratio {num(po.ratio, 2)}), {po.fit_ok ? "close enough for the fit to be reasonable" : "far enough apart that the fit is doubtful"}: the expected and observed columns follow the same pattern (most months have 0 or 1 such days, 4 or more never happens), with only {po.n} months the small gaps are expected.
          </Interpretation>
        </SubSection>
      </UnitSection>

      {/* ============================================================ 3.2 */}
      <UnitSection number="3.2" title="Central limit theorem" intro="If you take many random samples from any population and calculate their averages, those averages form a normal, bell-shaped distribution — regardless of the population's original shape. The rule of thumb is n ≥ 30.">
        <What>
          If x̄ is the mean of a random sample of size n drawn from a population with mean μ and standard deviation σ, then — provided n is large (n ≥ 30) — the sampling distribution of x̄ is approximately normal with mean μ and standard error σ/√n. The standardised sample mean z approaches the standard normal distribution as n → ∞. The population here is all {fmtInt(clt.N)} daily rental counts; its mean and σ are known exactly, so we can check the theorem by simulation, as the teacher did with a Poisson population.
        </What>
        <FormulaBlock tex={["\\text{S.E.}(\\bar{x}) = \\frac{\\sigma}{\\sqrt{n}}", "z = \\frac{\\bar{x} - \\mu}{\\sigma / \\sqrt{n}}"]} where={[["\\bar{x}", "mean of one sample of size n"], ["\\mu", "population mean"], ["\\sigma", "population standard deviation (÷N)"], ["n", "sample size"]]} />
        <Worked title={`Population: the ${fmtInt(clt.N)} daily counts (μ = ${n0(clt.mu)}, σ = ${n0(clt.sigma)}). Draw ${fmtInt(clt.draws)} samples of n = ${clt.chart.n} days with replacement, average each, and plot the ${fmtInt(clt.draws)} averages. Then repeat for n = ${clt.sizes.join(", ")}.`}>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Step 1: the population" description={`Histogram of the ${fmtInt(clt.N)} daily counts. Wide and flat-topped, not a tidy bell.`}>
              <Histogram bins={clt.population_bins} height={220} label="Days" mode="count" showNormal={false} xFormat="int" color="#64748b" />
            </ChartCard>
            <ChartCard title={`Steps 2–4: ${fmtInt(clt.draws)} sample means, n = ${clt.chart.n}`} description={`Each bar counts how many sample means fell in that range. Red: the normal curve with mean μ = ${n0(clt.mu)} and S.E. = σ/√${clt.chart.n} = ${num(cltRow30.se_theory, 1)}.`}>
              <Histogram bins={clt.chart.bins} height={220} label="Sample means" xFormat="int" color="#7c3aed" />
            </ChartCard>
          </div>
          <DataTable
            rows={clt.table}
            columns={[
              { key: "n", header: "Sample size n" },
              { key: "draws", header: "Samples drawn", align: "right", render: (r) => fmtInt(r.draws) },
              { key: "mean_of_means", header: "Mean of the sample means", align: "right", render: (r) => num(r.mean_of_means, 1) },
              { key: "mu", header: "Population μ", align: "right", render: () => num(clt.mu, 1) },
              { key: "sd_of_means", header: "SD of the sample means (observed)", align: "right", render: (r) => num(r.sd_of_means, 1) },
              { key: "se_theory", header: "σ/√n (theory)", align: "right", render: (r) => num(r.se_theory, 1) },
              { key: "range", header: "Smallest – largest sample mean", align: "right", render: (r) => `${n0(r.min_mean)} – ${n0(r.max_mean)}` },
            ]}
          />
        </Worked>
        <Result items={[{ label: `Mean of the ${fmtInt(clt.draws)} sample means (n = ${clt.chart.n})`, value: num(cltRow30.mean_of_means, 1), hint: `μ = ${num(clt.mu, 1)}` }, { label: "SD of the sample means", value: num(cltRow30.sd_of_means, 1), hint: `σ/√${clt.chart.n} = ${num(cltRow30.se_theory, 1)}` }]} />
        <Interpretation>
          The averages pile up in a bell shape centred on μ even though the population is not bell-shaped. Their spread matches σ/√n for every n ({num(clt.table[0].sd_of_means, 0)} vs {num(clt.table[0].se_theory, 0)} at n = {clt.table[0].n}, {num(cltRow30.sd_of_means, 0)} vs {num(cltRow30.se_theory, 0)} at n = {cltRow30.n}, {num(clt.table[2].sd_of_means, 0)} vs {num(clt.table[2].se_theory, 0)} at n = {clt.table[2].n}): four times the sample size halves the standard error. This is why the confidence interval and the Z-test below can use σ/√n.
        </Interpretation>
        <ChartCard title="The teacher's demo, interactive" description="Drag the sample size n. Below 30 the picture is rough; at 30 it is already bell-shaped; at 100 the means hug μ. The population and μ, σ are the same ones used above.">
          <CltSimulator population={clt.population} mu={clt.mu} sigma={clt.sigma} />
        </ChartCard>
      </UnitSection>

      {/* ============================================================ 3.3 */}
      <UnitSection number="3.3" title="Confidence interval" intro="A method for estimating an unknown population parameter with a range of possible values, along with a stated level of confidence that the range contains the true value.">
        <What>
          A point estimate is a single number (&ldquo;the average is {n0(ci.z.xbar)} rentals&rdquo;); an interval estimate is a range plus a confidence level (&ldquo;we are 95 % confident it lies between {n0(ci.z.lower)} and {n0(ci.z.upper)}&rdquo;). It is built on the CLT: the margin of error uses the same standard error σ/√n. When σ is unknown and the sample is small (n &lt; 30) we use the t-distribution with n − 1 degrees of freedom instead of z.
        </What>
        <FormulaBlock tex={["\\text{CI} = \\bar{x} \\pm z \\cdot \\frac{\\sigma}{\\sqrt{n}}", "\\text{CI} = \\bar{x} \\pm t_{0.05} \\cdot \\frac{s}{\\sqrt{n}} \\quad (\\sigma \\text{ unknown}, n < 30,\\ \\text{d.f.} = n-1)"]} where={[["\\bar{x}", "sample mean (point estimate)"], ["z", "critical value for the confidence level: 90 % → 1.645, 95 % → 1.96, 99 % → 2.576"], ["\\sigma / \\sqrt{n}", "standard error of the mean"], ["s", "sample standard deviation, s² = Σ(x − x̄)²/(n − 1)"]]} />
        <SubSection title={`(a) A random sample of n = ${ci.z.n} days, 95 % confidence, z`}>
          <Worked title={`One random sample of ${ci.z.n} days was drawn from the ${fmtInt(meta.N)} days. σ is the population σ of the daily counts (we know it because we hold the full two years). The slide's four-line layout:`}>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>
                Gather the sample statistics: x̄ = {n0(ci.z.xbar)} rentals, σ = {n0(ci.z.sigma)}, n = {ci.z.n}, z (95 %) = {num(ci.z.z, 2)}
              </li>
              <li>
                Compute the standard error: σ/√n = {n0(ci.z.sigma)} / √{ci.z.n} = {num(ci.z.se, 2)}
              </li>
              <li>
                Compute the margin of error: z × SE = {num(ci.z.z, 2)} × {num(ci.z.se, 2)} = {num(ci.z.moe, 2)}
              </li>
              <li>
                Build the interval: CI = {n0(ci.z.xbar)} ± {num(ci.z.moe, 2)} = ({num(ci.z.lower, 2)}, {num(ci.z.upper, 2)})
              </li>
            </ol>
          </Worked>
          <Result items={[{ label: "95 % CI for the mean daily rentals (n = 50)", value: `${n0(ci.z.lower)} – ${n0(ci.z.upper)}`, hint: `x̄ ± ${n0(ci.z.moe)}` }]} />
          <Interpretation>
            We are 95 % confident that the true average daily rentals for all days falls between {n0(ci.z.lower)} and {n0(ci.z.upper)}. Because this is a teaching dataset we can check: the actual population mean is {n0(ci.mu)}, which {ci.contains_mu_z ? "does lie inside the interval" : "lies outside the interval — this is one of the 5 % of samples whose interval misses"}.
          </Interpretation>
        </SubSection>
        <SubSection title={`(b) A random sample of n = ${ci.t.n} days, 95 % confidence, t with d.f. = ${ci.t.df}`}>
          <Worked title={`Here σ is treated as unknown and n < 30, so s is computed from the sample with ÷(n − 1) and t replaces z — exactly like the I.Q. example in class.`}>
            <DataTable
              rows={ci.t.rows.map((r, i) => ({ ...r, date: ci.t_dates[i] }))}
              columns={[
                { key: "date", header: "Day" },
                { key: "x", header: "x (rentals)", align: "right", render: (r) => n0(r.x) },
                { key: "dev", header: "x − x̄", align: "right", render: (r) => num(r.dev, 1) },
                { key: "dev2", header: "(x − x̄)²", align: "right", render: (r) => n0(r.dev2) },
              ]}
            />
            <KV
              cols={2}
              items={[
                ["Σx", n0(ci.t.sum_x)],
                ["x̄ = Σx / n", `${n0(ci.t.sum_x)} / ${ci.t.n} = ${num(ci.t.xbar, 1)}`],
                ["Σ(x − x̄)²", n0(ci.t.sum_sq_dev)],
                ["s² = Σ(x − x̄)² / (n − 1)", `${n0(ci.t.sum_sq_dev)} / ${ci.t.df} = ${n0(ci.t.s2)}`],
                ["s = √s²", num(ci.t.s, 2)],
                [`Tabulated t(${ci.t.df}, 0.05)`, num(ci.t.t, 3)],
                ["s / √n", `${num(ci.t.s, 2)} / √${ci.t.n} = ${num(ci.t.se, 2)}`],
                ["t × s/√n", `${num(ci.t.t, 3)} × ${num(ci.t.se, 2)} = ${num(ci.t.moe, 2)}`],
              ]}
            />
            <Formula tex={`\\bar{x} \\pm t_{0.05}\\,\\frac{s}{\\sqrt{n}} = ${num(ci.t.xbar, 1)} \\pm ${num(ci.t.t, 3)} \\times \\frac{${num(ci.t.s, 2)}}{\\sqrt{${ci.t.n}}} = ${num(ci.t.xbar, 1)} \\pm ${num(ci.t.moe, 2)} = ${n0(ci.t.lower)} \\text{ and } ${n0(ci.t.upper)}`} />
          </Worked>
          <Result items={[{ label: `95 % confidence limits (n = ${ci.t.n}, t)`, value: `${n0(ci.t.lower)} – ${n0(ci.t.upper)}`, hint: `width ${n0(ci.t.upper - ci.t.lower)} vs ${n0(ci.z.width)} for n = ${ci.z.n}` }]} />
          <Interpretation>
            The 95 % confidence limits within which the mean daily rentals of samples of {ci.t.n} days will lie are ({n0(ci.t.lower)}, {n0(ci.t.upper)}). The interval is much wider than the n = {ci.z.n} one because the sample is smaller and t ({num(ci.t.t, 3)}) is larger than z ({num(ci.z.z, 2)}). The population mean {n0(ci.mu)} {ci.contains_mu_t ? "lies inside it" : "lies outside it"}.
          </Interpretation>
        </SubSection>
        <SubSection title="What widens or narrows the interval">
          <Worked title={`The same n = ${ci.z.n} sample at three confidence levels. The three rules from class: a higher confidence level → wider; a larger sample size n → narrower; more population variability σ → wider.`}>
            <DataTable
              rows={ci.levels}
              columns={[
                { key: "level", header: "Confidence level", render: (r) => `${r.level} %` },
                { key: "z", header: "z", align: "right", render: (r) => num(r.z, 3) },
                { key: "se", header: "σ/√n", align: "right", render: (r) => num(r.se, 2) },
                { key: "moe", header: "z × σ/√n", align: "right", render: (r) => num(r.moe, 2) },
                { key: "interval", header: "Interval", align: "right", render: (r) => `${n0(r.lower)} – ${n0(r.upper)}` },
                { key: "width", header: "Width", align: "right", render: (r) => n0(r.width) },
              ]}
            />
          </Worked>
          <Result items={[{ label: "Width at 90 / 95 / 99 %", value: `${n0(ci.levels[0].width)} / ${n0(ci.levels[1].width)} / ${n0(ci.levels[2].width)}` }]} />
          <Interpretation>Raising the confidence level from 90 % to 99 % widens the interval from {n0(ci.levels[0].width)} to {n0(ci.levels[2].width)} rentals: to be more sure, we must claim less precisely. Only a larger sample (or a less variable population) narrows it at the same confidence.</Interpretation>
        </SubSection>
      </UnitSection>

      {/* ============================================================ 3.4 */}
      <UnitSection number="3.4" title="Hypothesis testing: the framework" intro="A statistical hypothesis is an assumption about a population parameter. Hypothesis testing (test of significance) is the decision-making procedure that uses sample data to decide whether to accept or reject that assumption.">
        <What>
          The null hypothesis H₀ is a definite statement about the population parameter, usually a hypothesis of no difference: H₀ : μ = μ₀, where μ₀ is the value assumed or claimed. The alternative hypothesis H₁ contradicts H₀ — rejecting H₀ implies accepting H₁. The level of significance α is the maximum probability of rejecting a true H₀, fixed before the test (usually 5 % or 1 %); it is also called the size of the test.
        </What>
        <FormulaBlock tex={["H_0 : \\mu = \\mu_0", "H_1 : \\mu \\ne \\mu_0 \\ (\\text{two-tailed}) \\qquad H_1 : \\mu > \\mu_0 \\ (\\text{right-tailed}) \\qquad H_1 : \\mu < \\mu_0 \\ (\\text{left-tailed})"]} note="Procedure: 1. Set up H₀ from the nature of the problem. 2. Set up H₁, deciding one-tailed or two-tailed. 3. Select α in advance. 4. Compute the test statistic — Z or t, depending on whether σ is known and how large the sample is. 5. Conclusion: if the computed value < critical value, accept H₀; otherwise reject H₀." />
        <Worked title="The teacher's two tables, then the questions this unit asks and which test each one gets.">
          <div className="grid gap-4 lg:grid-cols-2">
            <DataTable
              rows={[
                { size: "n ≥ 30 (any population)", known: "Z-test", unknown: "Z-test (s in place of σ)" },
                { size: "n < 30 (any population)", known: "Z-test", unknown: "t-test" },
              ]}
              columns={[
                { key: "size", header: "Sample size" },
                { key: "known", header: "Population σ known" },
                { key: "unknown", header: "Population σ unknown" },
              ]}
            />
            <DataTable
              rows={[
                { type: "Two-tailed", hyp: "H₀: μ = μ₀ ; H₁: μ ≠ μ₀", region: "both tails" },
                { type: "Right-tailed", hyp: "H₀: μ ≤ μ₀ ; H₁: μ > μ₀", region: "right tail" },
                { type: "Left-tailed", hyp: "H₀: μ ≥ μ₀ ; H₁: μ < μ₀", region: "left tail" },
              ]}
              columns={[
                { key: "type", header: "Test type" },
                { key: "hyp", header: "Hypotheses" },
                { key: "region", header: "Rejection region" },
              ]}
            />
          </div>
          <DataTable
            rows={fw.z_table}
            columns={[
              { key: "alpha", header: "Level of significance α", render: (r) => `${(r.alpha * 100).toFixed(0)} % (${r.alpha})` },
              { key: "two", header: "Two-tailed |Zα|", align: "right", render: (r) => num(r.two, r.alpha === 0.01 ? 2 : 3) },
              { key: "right", header: "Right-tailed Zα", align: "right", render: (r) => num(r.right, r.alpha === 0.01 ? 2 : 3) },
              { key: "left", header: "Left-tailed Zα", align: "right", render: (r) => num(r.left, r.alpha === 0.01 ? 2 : 3) },
            ]}
          />
          <DataTable
            rows={[
              { q: "3.6 Is the 2012 mean daily rentals different from the 2011 level?", n: `n = ${z.n} ≥ 30, σ unknown → s`, test: `Z-test, two-tailed, |Zα| = ${num(z.crit, 2)}` },
              { q: "3.7 (a) Do holidays differ from the overall mean?", n: `n = ${tt.one_sample.n} < 30, σ unknown`, test: `One-sample t, d.f. = ${tt.one_sample.df}` },
              { q: "3.7 (b) Do the 2011 and 2012 monthly means differ?", n: `n₁ = n₂ = ${tt.independent.n1} < 30`, test: `Independent-samples t (pooled), d.f. = ${tt.independent.df}` },
              { q: "3.7 (c) Same months, 2011 vs 2012 as pairs", n: `${tt.paired.n} pairs`, test: `Paired t, d.f. = ${tt.paired.df}` },
              { q: "3.8 Do the four seasons differ?", n: `k = ${one.k} groups, n = ${one.n}`, test: `One-way ANOVA, F(${one.df_between}, ${one.df_within})` },
            ]}
            columns={[
              { key: "q", header: "Question on our data" },
              { key: "n", header: "Sample" },
              { key: "test", header: "Test chosen (Step 4)" },
            ]}
          />
        </Worked>
        <Result items={[{ label: "Tabulated Z₀.₀₅ (two-tailed), used in 3.6", value: num(fw.z_table[1].two, 2) }, { label: "α for every test on this page", value: `${meta.alpha}` }]} />
        <Interpretation>Every test below follows the same five steps and the same decision rule: calculated statistic &lt; tabulated critical value → H₀ is accepted (the difference is not significant); calculated ≥ tabulated → H₀ is rejected (the difference is significant) at the 5 % level.</Interpretation>
      </UnitSection>

      {/* ============================================================ 3.5 */}
      <UnitSection number="3.5" title="Type-I and Type-II errors" intro="In practice we decide to accept or reject a hypothesis after examining only a sample — so two kinds of wrong decisions are possible.">
        <What>
          A Type-I error is rejecting H₀ when it is true; its probability is α, the level of significance, also called the producer&rsquo;s risk. A Type-II error is accepting H₀ when it is false (H₁ is true); its probability is β, also called the consumer&rsquo;s risk.
        </What>
        <FormulaBlock tex={["\\alpha = P(\\text{Reject } H_0 \\mid H_0 \\text{ true}) = P(\\text{rejecting a good lot})", "\\beta = P(\\text{Accept } H_0 \\mid H_0 \\text{ false}) = P(\\text{accepting a bad lot})"]} />
        <Worked title="The two boxes from class, worded for a bike-share operator deciding whether demand has risen (H₀: demand is unchanged).">
          <div className="grid gap-4 md:grid-cols-2">
            <ErrorBox tone="rose" title="Type-I error — reject H₀ when it is true" lines={["The operator concludes demand has risen when it has not, and stocks extra bikes for a demand rise that is not real.", `Probability = α = ${meta.alpha} (the level of significance we chose).`, "Producer's risk: money spent on bikes nobody rides."]} />
            <ErrorBox tone="amber" title="Type-II error — accept H₀ when it is false" lines={["The operator concludes demand is unchanged when it has really risen, and misses a real rise.", "Probability = β.", "Consumer's risk: riders find no bikes at the docks."]} />
          </div>
        </Worked>
        <Result items={[{ label: "Type-I risk we accept on this page", value: `α = ${meta.alpha}`, hint: "5 in 100 true H₀ would be wrongly rejected" }]} />
        <Interpretation>Lowering α (say to 1 %) makes a Type-I error rarer but a Type-II error more likely, and the other way round. The only way to reduce both types of error at the same time is to increase the sample size — which is why the Z-test on {z.n} days is more trustworthy than a t-test on {tt.one_sample.n}.</Interpretation>
      </UnitSection>

      {/* ============================================================ 3.6 */}
      <UnitSection number="3.6" title="Z-test for a single mean (n > 30)" intro={`Question: is the mean daily rentals in ${z.year_sample} different from the ${z.year_ref} level?`}>
        <What>
          For a random sample of size n (n &gt; 30) with mean x̄ drawn from a population with mean μ, the Z-test checks whether x̄ differs significantly from the specified μ₀. Case I: σ known, S.E. = σ/√n. Case II: σ unknown, use the sample standard deviation s in its place, S.E. = s/√n. Here μ₀ is the {z.year_ref} mean ({n0(z.mu0)} rentals over {z.n_2011} days), the sample is the {z.n} days of {z.year_sample}, and σ is unknown, so this is Case II.
        </What>
        <FormulaBlock tex={["Z = \\frac{t - E(t)}{\\text{S.E.}(t)} = \\frac{\\bar{x} - \\mu_0}{s / \\sqrt{n}} \\qquad (\\text{Case II: } \\sigma \\text{ unknown})"]} where={[["\\bar{x}", `mean of the ${z.year_sample} sample`], ["\\mu_0", `the ${z.year_ref} mean, the assumed population value`], ["s", "sample standard deviation of the 2012 days"], ["n", "sample size"]]} note="Decision rule: accept H₀ if |Z| < Zα, else reject. H₀ can be rejected outright, without naming a level, if |Z| > 3." />
        <Worked title="Givens, then the five steps.">
          <KV
            cols={3}
            items={[
              [`n (days of ${z.year_sample})`, `${z.n}`],
              ["x̄", n0(z.xbar)],
              [`μ₀ (mean of ${z.year_ref})`, n0(z.mu0)],
              ["s", num(z.sd, 2)],
              ["√n", num(z.sqrt_n, 3)],
              ["s/√n", num(z.se, 3)],
            ]}
          />
          <HypothesisTest
            h0={<Tex>{`H_0 : \\mu = ${n0(z.mu0).replace(/,/g, "{,}")}`}</Tex>}
            h1={<span><Tex>{`H_1 : \\mu \\ne ${n0(z.mu0).replace(/,/g, "{,}")}`}</Tex> (two-tailed)</span>}
            alpha={alphaLabel}
            statistic={<Formula tex={`Z = \\frac{\\bar{x} - \\mu_0}{s/\\sqrt{n}} = \\frac{${n0(z.xbar).replace(/,/g, "{,}")} - ${n0(z.mu0).replace(/,/g, "{,}")}}{${num(z.sd, 2).replace(/,/g, "{,}")}/\\sqrt{${z.n}}} = \\frac{${num(z.xbar - z.mu0, 2).replace(/,/g, "{,}")}}{${num(z.se, 3)}} = ${num(z.z, 3)}`} />}
            calculated={`|Z| = ${num(z.abs_z, 3)}`}
            tabulated={`Z₀.₀₅ = ${num(z.crit, 2)}`}
            decision={z.decision}
            conclusion={`Calculated |Z| = ${num(z.abs_z, 3)} ${z.decision === "reject" ? ">" : "<"} Tabulated Z₀.₀₅ = ${num(z.crit, 2)} → the ${z.year_sample} mean daily rentals ${z.decision === "reject" ? "are significantly different from" : "do not differ significantly from"} the ${z.year_ref} level of ${n0(z.mu0)}.${z.abs_z > 3 ? " |Z| > 3, so H₀ could be rejected outright without naming a level." : ""}`}
          />
        </Worked>
        <Result items={[{ label: "Calculated Z", value: num(z.z, 3) }, { label: "Tabulated Z₀.₀₅", value: num(z.crit, 2) }, { label: "Decision", value: z.decision === "reject" ? "H₀ rejected" : "H₀ accepted" }]} />
        <Interpretation>
          The difference between the two years is {n0(z.xbar - z.mu0)} rentals a day; the standard error is only {num(z.se, 1)}, so the difference is {num(z.abs_z, 1)} standard errors wide. A gap that large cannot be put down to chance: {z.year_sample} rentals are significantly higher than {z.year_ref}. Grey footnote: p ≈ {z.p < 0.0001 ? "< 0.0001" : num(z.p, 4)}.
        </Interpretation>
        <ClassCheck title={`The oceanographer example: x̄ = ${num(cc.oceanographer.ours.xbar, 1)}, μ = ${num(cc.oceanographer.ours.mu0, 1)}, σ = ${num(cc.oceanographer.ours.sd, 1)}, n = ${cc.oceanographer.ours.n}, run through the same z_test() function.`}>
          <KV
            cols={3}
            items={[
              ["Our Z", num(cc.oceanographer.ours.z, 3)],
              ["Slide's Z", num(cc.oceanographer.slide.z, 3)],
              ["Tabulated Z₀.₀₅", num(cc.oceanographer.ours.crit, 2)],
              ["Our decision", cc.oceanographer.ours.decision === "reject" ? "H₀ rejected" : "H₀ accepted"],
              ["Slide's decision", cc.oceanographer.slide.decision === "reject" ? "H₀ rejected" : "H₀ accepted"],
              ["Note", "the slide rounds σ/√n to 3 places, hence the last digit"],
            ]}
          />
        </ClassCheck>
      </UnitSection>

      {/* ============================================================ 3.7 */}
      <UnitSection number="3.7" title="t-tests" intro="A t-test determines whether there is a significant difference between means when the population standard deviation is unknown. Three common types: one-sample (sample vs a known population mean), independent samples (two unrelated groups), paired samples (the same subjects measured twice).">
        <What>
          Degrees of freedom tell the t-test how much information is in the data: one-sample and paired tests use d.f. = n − 1; the independent-samples test uses d.f. = n₁ + n₂ − 2. In every case the sample variance is computed with ÷(n − 1), the calculated |t| is compared with the tabulated t(d.f., 0.05), and H₀ is accepted when calculated &lt; tabulated.
        </What>
        <FormulaBlock
          tex={[
            "\\text{One-sample: } t = \\frac{\\bar{x} - \\mu}{s / \\sqrt{n}}, \\quad s^{2} = \\frac{\\sum (x_i - \\bar{x})^{2}}{n-1}",
            "\\text{Independent: } t = \\frac{\\bar{x} - \\bar{y}}{\\sqrt{S^{2}/n_1 + S^{2}/n_2}}, \\quad S^{2} = \\frac{\\sum (x_i - \\bar{x})^{2} + \\sum (y_i - \\bar{y})^{2}}{n_1 + n_2 - 2}",
            "\\text{Paired: } t = \\frac{\\bar{d} - \\mu_d}{s_d / \\sqrt{n}}, \\quad d = \\text{before} - \\text{after}, \\ \\mu_d = 0",
          ]}
          where={[["\\bar{x}, \\bar{y}", "sample means"], ["\\mu", "known population mean"], ["S^{2}", "pooled variance (one S² for both groups)"], ["\\bar{d}, s_d", "mean and standard deviation of the differences"], ["n", "sample size, or number of pairs"]]}
        />

        {/* ---- (a) one-sample */}
        <SubSection title={`(a) One-sample t: the ${tt.one_sample.n} holidays vs the overall mean (n = ${tt.one_sample.n} < 30)`}>
          <Worked title={`Sample: the ${tt.one_sample.n} public holidays in the two years. μ = the ${tt.one_sample.mu0_label} = ${n0(tt.one_sample.mu0)}. Table of x, x − x̄, (x − x̄)² as in the I.Q. example.`}>
            <DataTable
              rows={tt.one_sample.rows}
              columns={[
                { key: "label", header: "Holiday" },
                { key: "x", header: "x (rentals)", align: "right", render: (r) => n0(r.x) },
                { key: "dev", header: "x − x̄", align: "right", render: (r) => num(r.dev, 1) },
                { key: "dev2", header: "(x − x̄)²", align: "right", render: (r) => n0(r.dev2) },
              ]}
            />
            <KV
              cols={3}
              items={[
                ["Σx", n0(tt.one_sample.sum_x)],
                ["x̄ = Σx / n", `${n0(tt.one_sample.sum_x)} / ${tt.one_sample.n} = ${num(tt.one_sample.xbar, 1)}`],
                ["Σ(x − x̄)²", n0(tt.one_sample.sum_sq_dev)],
                ["s² = Σ(x − x̄)² / (n − 1)", `${n0(tt.one_sample.sum_sq_dev)} / ${tt.one_sample.df} = ${n0(tt.one_sample.s2)}`],
                ["s = √s²", num(tt.one_sample.s, 2)],
                ["s / √n", num(tt.one_sample.se, 2)],
              ]}
            />
            <HypothesisTest
              h0={<span><Tex>{`H_0 : \\mu = ${n0(tt.one_sample.mu0).replace(/,/g, "{,}")}`}</Tex> — holidays have the same mean rentals as all days</span>}
              h1={<span><Tex>{`H_1 : \\mu \\ne ${n0(tt.one_sample.mu0).replace(/,/g, "{,}")}`}</Tex> (two-tailed)</span>}
              alpha={alphaLabel}
              statistic={<Formula tex={`t = \\frac{\\bar{x} - \\mu}{s/\\sqrt{n}} = \\frac{${num(tt.one_sample.xbar, 1).replace(/,/g, "{,}")} - ${n0(tt.one_sample.mu0).replace(/,/g, "{,}")}}{${num(tt.one_sample.s, 2).replace(/,/g, "{,}")}/\\sqrt{${tt.one_sample.n}}} = \\frac{${num(tt.one_sample.xbar - tt.one_sample.mu0, 1).replace(/,/g, "{,}")}}{${num(tt.one_sample.se, 2)}} = ${num(tt.one_sample.t, 2)}, \\quad \\text{d.f.} = n - 1 = ${tt.one_sample.df}`} />}
              calculated={`|t| = ${num(tt.one_sample.abs_t, 2)}`}
              tabulated={`t(${tt.one_sample.df}, 0.05) = ${num(tt.one_sample.crit, 3)}`}
              decision={tt.one_sample.decision}
              conclusion={`Calculated |t| = ${num(tt.one_sample.abs_t, 2)} ${tt.one_sample.decision === "reject" ? ">" : "<"} Tabulated t(${tt.one_sample.df}, 0.05) = ${num(tt.one_sample.crit, 3)} → the data ${tt.one_sample.decision === "reject" ? "do not support" : "support"} the assumption that holidays have the same mean rentals as an ordinary day.`}
            />
          </Worked>
          <Result items={[{ label: "Calculated t", value: num(tt.one_sample.t, 2) }, { label: `Tabulated t(${tt.one_sample.df}, 0.05)`, value: num(tt.one_sample.crit, 3) }, { label: "Decision", value: tt.one_sample.decision === "reject" ? "H₀ rejected" : "H₀ accepted" }]} />
          <Interpretation>
            Holidays average {n0(tt.one_sample.xbar)} rentals, {n0(Math.abs(tt.one_sample.xbar - tt.one_sample.mu0))} {tt.one_sample.xbar < tt.one_sample.mu0 ? "below" : "above"} the overall mean, but holiday counts vary a lot (s = {n0(tt.one_sample.s)}) and there are only {tt.one_sample.n} of them, so the gap is {num(tt.one_sample.abs_t, 2)} standard errors — {tt.one_sample.decision === "accept" ? "not enough to call it significant at the 5 % level. H₀ is accepted: the difference could have arisen by chance." : "enough to call it significant at the 5 % level."} Grey footnote: p ≈ {num(tt.one_sample.p, 4)}.
          </Interpretation>
          <ClassCheck title="The I.Q. example: 70, 120, 110, 101, 88, 83, 95, 98, 107, 100 against μ = 100, through the same one_sample_t() and ci_t() functions.">
            <DataTable
              rows={[
                { item: "x̄", ours: num(cc.iq.ours.xbar, 2), slide: num(cc.iq.slide.xbar, 2) },
                { item: "Σ(x − x̄)²", ours: num(cc.iq.ours.sum_sq_dev, 2), slide: num(cc.iq.slide.sum_sq_dev, 2) },
                { item: "s² = Σ(x − x̄)²/(n − 1)", ours: num(cc.iq.ours.s2, 2), slide: num(cc.iq.slide.s2, 2) },
                { item: "s", ours: num(cc.iq.ours.s, 2), slide: num(cc.iq.slide.s, 2) },
                { item: "|t|", ours: num(cc.iq.ours.abs_t, 2), slide: num(cc.iq.slide.t, 2) },
                { item: "Tabulated t(9, 0.05)", ours: num(cc.iq.ours.crit, 3), slide: num(cc.iq.slide.crit, 3) },
                { item: "Decision", ours: cc.iq.ours.decision === "accept" ? "H₀ accepted" : "H₀ rejected", slide: "H₀ accepted" },
                { item: "95 % confidence limits", ours: `${num(cc.iq.ci.lower, 1)} – ${num(cc.iq.ci.upper, 1)}`, slide: `${num(cc.iq.slide.lower, 1)} – ${num(cc.iq.slide.upper, 1)}` },
              ]}
              columns={[
                { key: "item", header: "Quantity" },
                { key: "ours", header: "Our code", align: "right" },
                { key: "slide", header: "Slide", align: "right" },
              ]}
            />
          </ClassCheck>
        </SubSection>

        {/* ---- (b) independent */}
        <SubSection title={`(b) Independent-samples t (pooled variance): the ${tt.independent.n1} monthly means of 2011 vs the ${tt.independent.n2} of 2012`}>
          <Worked title="x = mean rentals per day in each month of 2011, y = the same for 2012. Table of x, x − x̄, (x − x̄)² and y, y − ȳ, (y − ȳ)² as in the two-diets example.">
            <DataTable
              rows={tt.independent.rows}
              columns={[
                { key: "x_label", header: "Month (x)" },
                { key: "x", header: "x", align: "right", render: (r) => n0(r.x) },
                { key: "dx", header: "x − x̄", align: "right", render: (r) => num(r.dx, 1) },
                { key: "dx2", header: "(x − x̄)²", align: "right", render: (r) => n0(r.dx2) },
                { key: "y_label", header: "Month (y)", className: "border-l" },
                { key: "y", header: "y", align: "right", render: (r) => n0(r.y) },
                { key: "dy", header: "y − ȳ", align: "right", render: (r) => num(r.dy, 1) },
                { key: "dy2", header: "(y − ȳ)²", align: "right", render: (r) => n0(r.dy2) },
              ]}
            />
            <KV
              cols={3}
              items={[
                ["n₁, n₂", `${tt.independent.n1}, ${tt.independent.n2}`],
                ["x̄ = Σx / n₁", `${n0(tt.independent.sum_x)} / ${tt.independent.n1} = ${num(tt.independent.xbar, 1)}`],
                ["ȳ = Σy / n₂", `${n0(tt.independent.sum_y)} / ${tt.independent.n2} = ${num(tt.independent.ybar, 1)}`],
                ["Σ(x − x̄)²", n0(tt.independent.ssx)],
                ["Σ(y − ȳ)²", n0(tt.independent.ssy)],
                ["d.f. = n₁ + n₂ − 2", `${tt.independent.df}`],
                ["S² = [Σ(x − x̄)² + Σ(y − ȳ)²] / (n₁ + n₂ − 2)", `${n0(tt.independent.ssx + tt.independent.ssy)} / ${tt.independent.df} = ${n0(tt.independent.s2)}`],
                ["S²/n₁ + S²/n₂", `${n0(tt.independent.s2_over_n1)} + ${n0(tt.independent.s2_over_n2)} = ${n0(tt.independent.inside)}`],
                ["√(S²/n₁ + S²/n₂)", num(tt.independent.sqrt_inside, 2)],
              ]}
            />
            <HypothesisTest
              h0={<span><Tex>{"H_0 : \\mu_1 = \\mu_2"}</Tex> — no significant difference between the mean monthly rentals of 2011 and 2012</span>}
              h1={<span><Tex>{"H_1 : \\mu_1 \\ne \\mu_2"}</Tex> (two-tailed)</span>}
              alpha={alphaLabel}
              statistic={<Formula tex={`t = \\frac{\\bar{x} - \\bar{y}}{\\sqrt{S^{2}/n_1 + S^{2}/n_2}} = \\frac{${num(tt.independent.xbar, 1).replace(/,/g, "{,}")} - ${num(tt.independent.ybar, 1).replace(/,/g, "{,}")}}{\\sqrt{${n0(tt.independent.inside).replace(/,/g, "{,}")}}} = \\frac{${num(tt.independent.diff, 1).replace(/,/g, "{,}")}}{${num(tt.independent.sqrt_inside, 2)}} = ${num(tt.independent.t, 3)}, \\quad \\text{d.f.} = ${tt.independent.df}`} />}
              calculated={`|t| = ${num(tt.independent.abs_t, 3)}`}
              tabulated={`t(${tt.independent.df}, 0.05) = ${num(tt.independent.crit, 3)}`}
              decision={tt.independent.decision}
              conclusion={`Calculated |t| = ${num(tt.independent.abs_t, 3)} ${tt.independent.decision === "reject" ? ">" : "<"} Tabulated t(${tt.independent.df}, 0.05) = ${num(tt.independent.crit, 3)} → the two years ${tt.independent.decision === "reject" ? "differ significantly" : "do not differ significantly"} in mean monthly rentals.`}
            />
          </Worked>
          <Result items={[{ label: "Calculated t", value: num(tt.independent.t, 3) }, { label: `Tabulated t(${tt.independent.df}, 0.05)`, value: num(tt.independent.crit, 3) }, { label: "Decision", value: tt.independent.decision === "reject" ? "H₀ rejected" : "H₀ accepted" }]} />
          <Interpretation>
            With only 12 months a side and large month-to-month spread (pooled S = {n0(Math.sqrt(tt.independent.s2))}), the year gap of {n0(Math.abs(tt.independent.diff))} rentals a day is still {num(tt.independent.abs_t, 1)} standard errors wide — significant at 5 %. This agrees with the Z-test on the daily data, which had far more observations and a much larger statistic. Grey footnote: p ≈ {num(tt.independent.p, 4)}.
          </Interpretation>
        </SubSection>

        {/* ---- (c) paired */}
        <SubSection title={`(c) Paired t: the same ${tt.paired.n} calendar months, 2011 (before) vs 2012 (after)`}>
          <Worked title="January 2011 is paired with January 2012, and so on. d = before − after, as in the shooting-scores example. Table of d, d − d̄, (d − d̄)².">
            <DataTable
              rows={tt.paired.rows}
              columns={[
                { key: "label", header: "Month" },
                { key: "before", header: "Before (2011)", align: "right", render: (r) => n0(r.before) },
                { key: "after", header: "After (2012)", align: "right", render: (r) => n0(r.after) },
                { key: "d", header: "d = before − after", align: "right", render: (r) => n0(r.d) },
                { key: "dd", header: "d − d̄", align: "right", render: (r) => num(r.dd, 1) },
                { key: "dd2", header: "(d − d̄)²", align: "right", render: (r) => n0(r.dd2) },
              ]}
            />
            <KV
              cols={3}
              items={[
                ["Σd", n0(tt.paired.sum_d)],
                ["d̄ = Σd / n", `${n0(tt.paired.sum_d)} / ${tt.paired.n} = ${num(tt.paired.dbar, 1)}`],
                ["Σ(d − d̄)²", n0(tt.paired.sum_sq_dev)],
                ["s² = Σ(d − d̄)² / (n − 1)", `${n0(tt.paired.sum_sq_dev)} / ${tt.paired.df} = ${n0(tt.paired.s2)}`],
                ["s = √s²", num(tt.paired.s, 2)],
                ["s / √n", num(tt.paired.se, 2)],
              ]}
            />
            <HypothesisTest
              h0={<span><Tex>{"H_0 : \\mu_1 = \\mu_2, \\text{ i.e. } \\mu_d = 0"}</Tex> — the year had no effect on a month&rsquo;s rentals</span>}
              h1={<span><Tex>{"H_1 : \\mu_d \\ne 0"}</Tex> (two-tailed)</span>}
              alpha={alphaLabel}
              statistic={<Formula tex={`t = \\frac{\\bar{d} - \\mu_d}{s_d/\\sqrt{n}} = \\frac{${num(tt.paired.dbar, 1).replace(/,/g, "{,}")} - 0}{${num(tt.paired.s, 2)}/\\sqrt{${tt.paired.n}}} = \\frac{${num(tt.paired.dbar, 1).replace(/,/g, "{,}")}}{${num(tt.paired.se, 2)}} = ${num(tt.paired.t, 2)}, \\quad \\text{d.f.} = n - 1 = ${tt.paired.df}`} />}
              calculated={`|t| = ${num(tt.paired.abs_t, 2)}`}
              tabulated={`t(${tt.paired.df}, 0.05) = ${num(tt.paired.crit, 3)}`}
              decision={tt.paired.decision}
              conclusion={`Calculated |t| = ${num(tt.paired.abs_t, 2)} ${tt.paired.decision === "reject" ? ">" : "<"} Tabulated t(${tt.paired.df}, 0.05) = ${num(tt.paired.crit, 3)} → ${tt.paired.decision === "reject" ? "the rise from 2011 to 2012 is significant in every month, not just on average." : "the change from 2011 to 2012 is not significant."}`}
            />
          </Worked>
          <Result items={[{ label: "Calculated t", value: num(tt.paired.t, 2) }, { label: `Tabulated t(${tt.paired.df}, 0.05)`, value: num(tt.paired.crit, 3) }, { label: "Decision", value: tt.paired.decision === "reject" ? "H₀ rejected" : "H₀ accepted" }]} />
          <Interpretation>
            Pairing removes the seasonal swing: every d is negative (2012 above 2011 in all 12 months), so the differences vary far less (s = {n0(tt.paired.s)}) than the monthly means themselves, and |t| jumps from {num(tt.independent.abs_t, 1)} in the independent test to {num(tt.paired.abs_t, 1)}. When the same units are measured twice, the paired test is the right one and the more powerful one. Grey footnote: p ≈ {tt.paired.p < 0.0001 ? "< 0.0001" : num(tt.paired.p, 4)}.
          </Interpretation>
        </SubSection>

        {/* ---- (d) a test that accepts H0 */}
        <SubSection title={`(d) Independent-samples t that accepts H₀: ${tt.accept.comparison}`}>
          <Worked title={`So far every test rejected H₀. For the other outcome: x = mean rentals on ${tt.accept.x_name?.toLowerCase()} in each of the ${tt.accept.n1} months, y = mean rentals on ${tt.accept.y_name?.toLowerCase()} in the same months. The raw daily averages are ${n0(tt.accept.daily_means?.x)} vs ${n0(tt.accept.daily_means?.y)}.`}>
            <DataTable
              rows={tt.accept.rows}
              columns={[
                { key: "x_label", header: "Month" },
                { key: "x", header: `x (${tt.accept.x_name})`, align: "right", render: (r) => n0(r.x) },
                { key: "dx", header: "x − x̄", align: "right", render: (r) => num(r.dx, 1) },
                { key: "dx2", header: "(x − x̄)²", align: "right", render: (r) => n0(r.dx2) },
                { key: "y", header: `y (${tt.accept.y_name})`, align: "right", className: "border-l", render: (r) => n0(r.y) },
                { key: "dy", header: "y − ȳ", align: "right", render: (r) => num(r.dy, 1) },
                { key: "dy2", header: "(y − ȳ)²", align: "right", render: (r) => n0(r.dy2) },
              ]}
            />
            <KV
              cols={3}
              items={[
                ["n₁, n₂", `${tt.accept.n1}, ${tt.accept.n2}`],
                ["x̄", num(tt.accept.xbar, 1)],
                ["ȳ", num(tt.accept.ybar, 1)],
                ["Σ(x − x̄)²", n0(tt.accept.ssx)],
                ["Σ(y − ȳ)²", n0(tt.accept.ssy)],
                ["d.f. = n₁ + n₂ − 2", `${tt.accept.df}`],
                ["S²", `${n0(tt.accept.ssx + tt.accept.ssy)} / ${tt.accept.df} = ${n0(tt.accept.s2)}`],
                ["S²/n₁ + S²/n₂", n0(tt.accept.inside)],
                ["√(S²/n₁ + S²/n₂)", num(tt.accept.sqrt_inside, 2)],
              ]}
            />
            <HypothesisTest
              h0={<span><Tex>{"H_0 : \\mu_1 = \\mu_2"}</Tex> — {tt.accept.x_name?.toLowerCase()} and {tt.accept.y_name?.toLowerCase()} have the same mean rentals</span>}
              h1={<span><Tex>{"H_1 : \\mu_1 \\ne \\mu_2"}</Tex> (two-tailed)</span>}
              alpha={alphaLabel}
              statistic={<Formula tex={`t = \\frac{\\bar{x} - \\bar{y}}{\\sqrt{S^{2}/n_1 + S^{2}/n_2}} = \\frac{${num(tt.accept.xbar, 1).replace(/,/g, "{,}")} - ${num(tt.accept.ybar, 1).replace(/,/g, "{,}")}}{${num(tt.accept.sqrt_inside, 2)}} = ${num(tt.accept.t, 3)}, \\quad \\text{d.f.} = ${tt.accept.df}`} />}
              calculated={`|t| = ${num(tt.accept.abs_t, 3)}`}
              tabulated={`t(${tt.accept.df}, 0.05) = ${num(tt.accept.crit, 3)}`}
              decision={tt.accept.decision}
              conclusion={`Calculated |t| = ${num(tt.accept.abs_t, 3)} ${tt.accept.decision === "reject" ? ">" : "<"} Tabulated t(${tt.accept.df}, 0.05) = ${num(tt.accept.crit, 3)} → ${tt.accept.x_name?.toLowerCase()} and ${tt.accept.y_name?.toLowerCase()} ${tt.accept.decision === "reject" ? "differ significantly" : "do not differ significantly"} in mean rentals.`}
            />
          </Worked>
          <Result items={[{ label: "Calculated t", value: num(tt.accept.t, 3) }, { label: `Tabulated t(${tt.accept.df}, 0.05)`, value: num(tt.accept.crit, 3) }, { label: "Decision", value: tt.accept.decision === "reject" ? "H₀ rejected" : "H₀ accepted" }]} />
          <Interpretation>
            The gap of {n0(Math.abs(tt.accept.diff))} rentals a day is small next to the month-to-month spread, so it could easily have arisen by chance: H₀ is accepted. For this bike-share, the day being a working day or not does not change total demand — commuters on weekdays are replaced by leisure riders at weekends. Grey footnote: p ≈ {num(tt.accept.p, 4)}.
          </Interpretation>
        </SubSection>
      </UnitSection>

      {/* ============================================================ 3.8 */}
      <UnitSection number="3.8" title="ANOVA: analysis of variance" intro="ANOVA tests whether there is a difference between two or more population means. For just two samples a Z-test or t-test is used; running many t-tests to compare several groups inflates the Type-I error rate, so ANOVA compares all group means at once.">
        <What>
          Basic principle: make two estimates of the population variance — one based on the variance between the samples, the other on the variance within the samples — and compare them with the F-test. If the group means really are equal, the two estimates agree and F ≈ 1; a large F means the between-groups spread is too big to be chance. Calculated F &lt; Table F → the difference is insignificant, accept H₀; calculated F ≥ Table F → significant, reject H₀.
        </What>
        <FormulaBlock
          tex={[
            "F = \\frac{\\text{estimate of population variance based on between-samples variance}}{\\text{estimate of population variance based on within-samples variance}} = \\frac{\\text{MS between}}{\\text{MS within}}",
            "\\bar{\\bar{X}} = \\frac{\\bar{X}_1 + \\bar{X}_2 + \\cdots + \\bar{X}_k}{k} \\qquad \\text{SS between} = \\sum n_i (\\bar{X}_i - \\bar{\\bar{X}})^{2} \\qquad \\text{SS within} = \\sum_i \\sum_j (X_{ij} - \\bar{X}_i)^{2}",
            "\\text{MS between} = \\frac{\\text{SS between}}{k-1} \\qquad \\text{MS within} = \\frac{\\text{SS within}}{n-k} \\qquad \\text{SS total} = \\text{SS between} + \\text{SS within}, \\ \\text{d.f.} = n-1",
          ]}
          where={[["k", "number of samples (groups)"], ["n", "total number of items in all samples"], ["n_i, \\bar{X}_i", "size and mean of sample i"], ["\\bar{\\bar{X}}", "mean of the sample means"]]}
        />

        <SubSection title={`One-way ANOVA: daily rentals by season (k = ${one.k} groups, n = ${one.n} days)`}>
          <Worked title="The teacher's 8 steps. Step 1 and the between/within terms per group are in the table; steps 2–8 follow.">
            <DataTable
              rows={one.groups}
              columns={[
                { key: "group", header: "Sample (season)" },
                { key: "n", header: "nᵢ", align: "right" },
                { key: "sum", header: "ΣX", align: "right", render: (r) => n0(r.sum) },
                { key: "mean", header: "X̄ᵢ", align: "right", render: (r) => num(r.mean, 2) },
                { key: "dev", header: "X̄ᵢ − X̿", align: "right", render: (r) => num(r.dev, 2) },
                { key: "dev2", header: "(X̄ᵢ − X̿)²", align: "right", render: (r) => n0(r.dev2) },
                { key: "n_dev2", header: "nᵢ(X̄ᵢ − X̿)²", align: "right", render: (r) => n0(r.n_dev2) },
                { key: "ss_within", header: "Σ(Xᵢⱼ − X̄ᵢ)²", align: "right", render: (r) => n0(r.ss_within) },
              ]}
            />
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Means of each sample: {one.groups.map((g) => `X̄(${g.group}) = ${num(g.mean, 2)}`).join("; ")}.</li>
              <li>
                Mean of the sample means: X̿ = ({one.groups.map((g) => num(g.mean, 2)).join(" + ")}) / {one.k} = {n0(one.sum_of_means)} / {one.k} = {num(one.grand_mean, 2)}. <Sub>{`(The seasons have slightly different nᵢ, so X̿ differs a little from the overall daily mean ${n0(one.overall_mean)}; the class formula divides by k and that is what is used.)`}</Sub>
              </li>
              <li>SS between = Σ nᵢ(X̄ᵢ − X̿)² = {one.groups.map((g) => n0(g.n_dev2)).join(" + ")} = {n0(one.ss_between)}.</li>
              <li>MS between = SS between / (k − 1) = {n0(one.ss_between)} / {one.df_between} = {n0(one.ms_between)}.</li>
              <li>SS within = Σ(X₁ᵢ − X̄₁)² + … + Σ(X₄ᵢ − X̄₄)² = {one.groups.map((g) => n0(g.ss_within)).join(" + ")} = {n0(one.ss_within)}.</li>
              <li>MS within = SS within / (n − k) = {n0(one.ss_within)} / ({one.n} − {one.k}) = {n0(one.ms_within)}.</li>
              <li>SS total = SS between + SS within = {n0(one.ss_total)}; d.f. {one.df_total} = {one.df_between} + {one.df_within}.</li>
              <li>F-ratio = MS between / MS within = {n0(one.ms_between)} / {n0(one.ms_within)} = {num(one.f, 2)}.</li>
            </ol>
            <AnovaTable
              rows={[
                { source: "Between samples (seasons)", ss: n0(one.ss_between), df: `(${one.k} − 1) = ${one.df_between}`, ms: `${n0(one.ss_between)} / ${one.df_between} = ${n0(one.ms_between)}`, f: `${n0(one.ms_between)} / ${n0(one.ms_within)} = ${num(one.f, 2)}`, limit: `F(${one.df_between}, ${one.df_within}) = ${num(one.crit, 2)}` },
                { source: "Within samples", ss: n0(one.ss_within), df: `(${one.n} − ${one.k}) = ${one.df_within}`, ms: `${n0(one.ss_within)} / ${one.df_within} = ${n0(one.ms_within)}`, f: "", limit: "" },
                { source: "Total", ss: n0(one.ss_total), df: `(${one.n} − 1) = ${one.df_total}`, ms: "", f: "", limit: "" },
              ]}
            />
            <HypothesisTest
              h0={<span>H₀: the four seasons have the same mean daily rentals (no difference in sample means)</span>}
              h1={<span>H₁: at least one season differs</span>}
              alpha="α = 0.05 (5 %)"
              statistic={<span>F-ratio = MS between / MS within = {num(one.f, 2)}, with v₁ = {one.df_between} (column) and v₂ = {one.df_within} (row) d.f.</span>}
              calculated={`F = ${num(one.f, 2)}`}
              tabulated={`F(${one.df_between}, ${one.df_within}) = ${num(one.crit, 2)}`}
              decision={one.decision}
              conclusion={`The table shows that the calculated value of F is ${num(one.f, 2)} which is ${one.decision === "reject" ? "more" : "less"} than the table value of ${num(one.crit, 2)} at 5 % level with d.f. v₁ = ${one.df_between} and v₂ = ${one.df_within}, hence ${one.decision === "reject" ? "the differences between seasons could not have arisen due to chance. The season differences are significant." : "the differences could have arisen due to chance and the analysis supports the null hypothesis of no difference in sample means."}`}
            />
          </Worked>
          <Result items={[{ label: "Calculated F", value: num(one.f, 2) }, { label: `5 % F-limit F(${one.df_between}, ${one.df_within})`, value: num(one.crit, 2) }, { label: "Decision", value: one.decision === "reject" ? "H₀ rejected" : "H₀ accepted" }]} />
          <Interpretation>
            Calculated F &gt; Table F → reject H₀, the difference is significant. The between-seasons variance estimate is {num(one.f, 0)} times the within-season one: winter&rsquo;s mean ({n0(one.groups[0].mean)}) is far below summer&rsquo;s ({n0(one.groups[2].mean)}), a gap no amount of day-to-day noise explains. Season is a real driver of demand, which Unit 4 picks up through temperature. Grey footnote: p {one.p < 0.0001 ? "< 0.0001" : `≈ ${num(one.p, 4)}`}.
          </Interpretation>
          <ClassCheck title="The wheat example: Variety A 6, 7, 3, 8; B 5, 5, 3, 7; C 5, 4, 3, 4 — through the same one_way_anova() function.">
            <DataTable
              rows={cc.wheat_one_way.ours.groups}
              columns={[
                { key: "group", header: "Sample" },
                { key: "values", header: "Values", render: (r) => (r.values ?? []).map((v) => num(v, 0)).join(", ") },
                { key: "mean", header: "X̄ᵢ", align: "right", render: (r) => num(r.mean, 0) },
                { key: "n_dev2", header: "nᵢ(X̄ᵢ − X̿)²", align: "right", render: (r) => num(r.n_dev2, 0) },
                { key: "ss_within", header: "Σ(Xᵢⱼ − X̄ᵢ)²", align: "right", render: (r) => num(r.ss_within, 0) },
              ]}
            />
            <AnovaTable
              rows={[
                { source: "Between sample", ss: `${num(cc.wheat_one_way.ours.ss_between, 0)} (slide ${cc.wheat_one_way.slide.ss_between})`, df: `${cc.wheat_one_way.ours.df_between}`, ms: `${num(cc.wheat_one_way.ours.ms_between, 2)} (slide ${num(cc.wheat_one_way.slide.ms_between, 2)})`, f: `${num(cc.wheat_one_way.ours.f, 1)} (slide ${cc.wheat_one_way.slide.f})`, limit: `F(${cc.wheat_one_way.ours.df_between}, ${cc.wheat_one_way.ours.df_within}) = ${num(cc.wheat_one_way.ours.crit, 2)} (slide ${cc.wheat_one_way.slide.crit})` },
                { source: "Within sample", ss: `${num(cc.wheat_one_way.ours.ss_within, 0)} (slide ${cc.wheat_one_way.slide.ss_within})`, df: `${cc.wheat_one_way.ours.df_within}`, ms: `${num(cc.wheat_one_way.ours.ms_within, 2)} (slide ${num(cc.wheat_one_way.slide.ms_within, 2)})`, f: "", limit: "" },
                { source: "Total", ss: num(cc.wheat_one_way.ours.ss_total, 0), df: `${cc.wheat_one_way.ours.df_total}`, ms: "", f: "", limit: "" },
              ]}
            />
            <p className="text-sm">X̿ = {num(cc.wheat_one_way.ours.grand_mean, 0)}; calculated F = {num(cc.wheat_one_way.ours.f, 1)} &lt; {num(cc.wheat_one_way.ours.crit, 2)} → {cc.wheat_one_way.ours.decision === "accept" ? "H₀ accepted, the variety differences are not significant — the slide's conclusion." : "H₀ rejected."}</p>
          </ClassCheck>
        </SubSection>

        <SubSection title={`Two-way ANOVA: mean daily rentals by ${two.row_factor} (rows) × ${two.col_factor} (columns)`}>
          <Note tone="info">Two-way ANOVA is included because it was taught in class with the wheat / fertiliser example. Our table has the same shape: {two.r} rows ({two.row_labels.join(", ")}) × {two.c} columns ({two.col_labels.join(", ")}), one observation per cell — the mean rentals per day in that quarter.</Note>
          <FormulaBlock
            tex={[
              "\\text{Correction factor} = \\frac{T^{2}}{n} \\qquad \\text{Total SS} = \\sum X_{ij}^{2} - \\frac{T^{2}}{n}",
              "\\text{SS between columns} = \\sum \\frac{T_j^{2}}{n_j} - \\frac{T^{2}}{n} \\qquad \\text{SS between rows} = \\sum \\frac{T_i^{2}}{n_i} - \\frac{T^{2}}{n}",
              "\\text{SS residual} = \\text{Total SS} - (\\text{SS between columns} + \\text{SS between rows}) \\qquad F_{\\text{col}} = \\frac{\\text{MS col}}{\\text{MS residual}}, \\ F_{\\text{row}} = \\frac{\\text{MS row}}{\\text{MS residual}}",
            ]}
            where={[["T", "total of all the values"], ["n", "number of cells (c × r)"], ["T_j, n_j", "total and count of column j"], ["T_i, n_i", "total and count of row i"], ["c, r", "number of columns and rows; d.f. = c − 1, r − 1, (c − 1)(r − 1)"]]}
          />
          <Worked title="The two-way table with row and column totals, then steps (i)–(v) exactly as in the class example.">
            <DataTable
              rows={[
                ...two.cells.map((c) => ({ row: c.row, ...Object.fromEntries(c.values.map((v, j) => [`c${j}`, n0(v)])), total: n0(c.total) })),
                { row: "Column total Tⱼ", ...Object.fromEntries(two.col_totals.map((v, j) => [`c${j}`, n0(v)])), total: `T = ${n0(two.T)}` },
              ]}
              columns={[
                { key: "row", header: `${two.row_factor} \\ ${two.col_factor}` },
                ...two.col_labels.map((l, j) => ({ key: `c${j}`, header: l, align: "right" as const })),
                { key: "total", header: "Row total Tᵢ", align: "right", className: "border-l font-medium" },
              ]}
            />
            <ol className="list-[lower-roman] space-y-1 pl-6 text-sm">
              <li>T = {n0(two.T)}, n = {two.n}, ∴ correction factor = T²/n = {n0(two.T)}² / {two.n} = {n0(two.cf)}.</li>
              <li>Total SS = ΣX² − T²/n = {n0(two.sum_sq)} − {n0(two.cf)} = {n0(two.ss_total)}.</li>
              <li>SS between columns ({two.col_factor}) = [{two.col_totals.map((t) => `${n0(t)}²/${two.r}`).join(" + ")}] − T²/n = [{two.col_terms.map((t) => n0(t)).join(" + ")}] − {n0(two.cf)} = {n0(two.ss_cols)}.</li>
              <li>SS between rows ({two.row_factor}) = [{two.cells.map((c) => `${n0(c.total)}²/${two.c}`).join(" + ")}] − T²/n = [{two.row_terms.map((t) => n0(t)).join(" + ")}] − {n0(two.cf)} = {n0(two.ss_rows)}.</li>
              <li>SS residual = Total SS − (SS columns + SS rows) = {n0(two.ss_total)} − ({n0(two.ss_cols)} + {n0(two.ss_rows)}) = {n0(two.ss_res)}.</li>
            </ol>
            <AnovaTable
              rows={[
                { source: `Between columns (${two.col_factor})`, ss: n0(two.ss_cols), df: `(${two.c} − 1) = ${two.df_cols}`, ms: `${n0(two.ss_cols)} / ${two.df_cols} = ${n0(two.ms_cols)}`, f: `${n0(two.ms_cols)} / ${n0(two.ms_res)} = ${num(two.f_cols, 2)}`, limit: `F(${two.df_cols}, ${two.df_res}) = ${num(two.crit_cols, 2)}` },
                { source: `Between rows (${two.row_factor})`, ss: n0(two.ss_rows), df: `(${two.r} − 1) = ${two.df_rows}`, ms: `${n0(two.ss_rows)} / ${two.df_rows} = ${n0(two.ms_rows)}`, f: `${n0(two.ms_rows)} / ${n0(two.ms_res)} = ${num(two.f_rows, 2)}`, limit: `F(${two.df_rows}, ${two.df_res}) = ${num(two.crit_rows, 2)}` },
                { source: "Residual or error", ss: n0(two.ss_res), df: `(${two.c} − 1) × (${two.r} − 1) = ${two.df_res}`, ms: `${n0(two.ss_res)} / ${two.df_res} = ${n0(two.ms_res)}`, f: "", limit: "" },
                { source: "Total", ss: n0(two.ss_total), df: `(${two.c} × ${two.r}) − 1 = ${two.df_total}`, ms: "", f: "", limit: "" },
              ]}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <HypothesisTest
                h0={<span>H₀ (columns): the four quarters have the same mean rentals</span>}
                h1={<span>H₁: at least one quarter differs</span>}
                alpha="α = 0.05 (5 %)"
                statistic={<span>F = MS columns / MS residual = {num(two.f_cols, 2)}, d.f. ({two.df_cols}, {two.df_res})</span>}
                calculated={`F = ${num(two.f_cols, 2)}`}
                tabulated={`F(${two.df_cols}, ${two.df_res}) = ${num(two.crit_cols, 2)}`}
                decision={two.decision_cols}
                conclusion={`Differences concerning quarters are ${two.decision_cols === "reject" ? "significant" : "insignificant"} at 5 % level as the calculated F-ratio of ${num(two.f_cols, 2)} is ${two.decision_cols === "reject" ? "more" : "less"} than the table value of ${num(two.crit_cols, 2)}.`}
              />
              <HypothesisTest
                h0={<span>H₀ (rows): the two years have the same mean rentals</span>}
                h1={<span>H₁: the years differ</span>}
                alpha="α = 0.05 (5 %)"
                statistic={<span>F = MS rows / MS residual = {num(two.f_rows, 2)}, d.f. ({two.df_rows}, {two.df_res})</span>}
                calculated={`F = ${num(two.f_rows, 2)}`}
                tabulated={`F(${two.df_rows}, ${two.df_res}) = ${num(two.crit_rows, 2)}`}
                decision={two.decision_rows}
                conclusion={`Differences concerning years are ${two.decision_rows === "reject" ? "significant" : "insignificant"} at 5 % level as the calculated F-ratio of ${num(two.f_rows, 2)} is ${two.decision_rows === "reject" ? "more" : "less"} than the table value of ${num(two.crit_rows, 2)}.`}
              />
            </div>
          </Worked>
          <Result items={[{ label: "F between columns (quarters)", value: `${num(two.f_cols, 2)} vs F(${two.df_cols}, ${two.df_res}) = ${num(two.crit_cols, 2)}`, hint: two.decision_cols === "reject" ? "H₀ rejected" : "H₀ accepted" }, { label: "F between rows (years)", value: `${num(two.f_rows, 2)} vs F(${two.df_rows}, ${two.df_res}) = ${num(two.crit_rows, 2)}`, hint: two.decision_rows === "reject" ? "H₀ rejected" : "H₀ accepted" }]} />
          <Interpretation>
            Both factors matter: once the year effect is removed, the quarters still differ ({two.decision_cols === "reject" ? "F > F-limit" : "F < F-limit"}), and once the quarter effect is removed, the years still differ ({two.decision_rows === "reject" ? "F > F-limit" : "F < F-limit"}). The residual ({n0(two.ss_res)} on {two.df_res} d.f.) is tiny next to either factor, which means season and year together explain almost all of the variation between the {two.n} quarterly means. With only {two.df_res} residual d.f. the F-limits are high ({num(two.crit_cols, 2)} and {num(two.crit_rows, 2)}), so clearing them is strong evidence. Grey footnote: p ≈ {num(two.p_cols, 4)} (quarters), {num(two.p_rows, 4)} (years).
          </Interpretation>
          <ClassCheck title="The same wheat data as a two-way design (rows = fertilisers W, X, Y, Z; columns = seeds A, B, C), through the same two_way_anova() function.">
            <DataTable
              rows={[
                { item: "Correction factor T²/n", ours: num(cc.wheat_two_way.ours.cf, 0), slide: `${cc.wheat_two_way.slide.cf}` },
                { item: "Total SS", ours: num(cc.wheat_two_way.ours.ss_total, 0), slide: `${cc.wheat_two_way.slide.ss_total}` },
                { item: "SS between columns (seeds)", ours: num(cc.wheat_two_way.ours.ss_cols, 0), slide: `${cc.wheat_two_way.slide.ss_cols}` },
                { item: "SS between rows (fertilisers)", ours: num(cc.wheat_two_way.ours.ss_rows, 0), slide: `${cc.wheat_two_way.slide.ss_rows}` },
                { item: "SS residual", ours: num(cc.wheat_two_way.ours.ss_res, 0), slide: `${cc.wheat_two_way.slide.ss_res}` },
                { item: "F columns", ours: `${num(cc.wheat_two_way.ours.f_cols, 0)} vs F(${cc.wheat_two_way.ours.df_cols}, ${cc.wheat_two_way.ours.df_res}) = ${num(cc.wheat_two_way.ours.crit_cols, 2)}`, slide: `${cc.wheat_two_way.slide.f_cols} vs ${cc.wheat_two_way.slide.crit_cols} → insignificant` },
                { item: "F rows", ours: `${num(cc.wheat_two_way.ours.f_rows, 0)} vs F(${cc.wheat_two_way.ours.df_rows}, ${cc.wheat_two_way.ours.df_res}) = ${num(cc.wheat_two_way.ours.crit_rows, 2)}`, slide: `${cc.wheat_two_way.slide.f_rows} vs ${cc.wheat_two_way.slide.crit_rows} → significant` },
              ]}
              columns={[
                { key: "item", header: "Quantity" },
                { key: "ours", header: "Our code", align: "right" },
                { key: "slide", header: "Slide", align: "right" },
              ]}
            />
            <p className="text-sm">
              Seeds: F = {num(cc.wheat_two_way.ours.f_cols, 0)} {cc.wheat_two_way.ours.decision_cols === "reject" ? ">" : "<"} {num(cc.wheat_two_way.ours.crit_cols, 2)} → {cc.wheat_two_way.ours.decision_cols === "accept" ? "insignificant" : "significant"}; fertilisers: F = {num(cc.wheat_two_way.ours.f_rows, 0)} {cc.wheat_two_way.ours.decision_rows === "reject" ? ">" : "<"} {num(cc.wheat_two_way.ours.crit_rows, 2)} → {cc.wheat_two_way.ours.decision_rows === "reject" ? "significant" : "insignificant"} — the slide&rsquo;s conclusion.
            </p>
          </ClassCheck>
        </SubSection>
      </UnitSection>

      <p className="text-xs text-muted-foreground">Critical values are looked up with scipy.stats (norm.ppf, t.ppf, f.ppf) and shown as table values; p-values appear only as grey footnotes. Sums of squares are shown rounded; the t-values and F-ratios are computed from the unrounded sums.</p>
    </PageShell>
  );
}
