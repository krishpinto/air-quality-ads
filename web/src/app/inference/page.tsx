import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, Decision, FormulaCard, KV, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { BarSeries, Histogram, LineSeries } from "@/components/charts/series";
import { CategoryBars } from "@/components/charts/scatter";
import { Heatmap } from "@/components/charts/grids";
import { CltSimulator } from "@/components/clt-simulator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { fmt, fmtInt, fmtP } from "@/lib/format";
import { Tex } from "@/components/formula";

type Bins = Array<Record<string, unknown>>;
type NormalBlock = { label: string; mu: number; sd: number; skew: number; kurtosis: number; bins: Bins; tests: Array<{ name: string; stat: number; p: number | null; crit_5pct?: number }> };
type Test = { id: string; name: string; h0: string; h1: string; sample: string; n?: number; xbar?: number; sigma?: number; s?: number; stat_name: string; stat: number; crit?: number; df?: number; p: number; alpha: number; decision: string; groups?: Array<{ name: string; n: number; mean: number; sd: number }>; cohen_d?: number; nonparametric?: { name: string; stat: number; p: number }; pairs?: Array<{ month: number; y2010: number; y2014: number; diff: number }>; mean_diff?: number; sd_diff?: number };
type Anova = { factor: string; k: number; n: number; groups: Array<{ name: string; n: number; mean: number; sd: number; se: number }>; table: { ss_between: number; df_between: number; ms_between: number; ss_within: number; df_within: number; ms_within: number; ss_total: number }; F: number; F_crit: number; p: number; eta2: number; levene: { stat: number; p: number }; kruskal: { stat: number; p: number }; tukey: Array<{ a: string; b: string; meandiff: number; p: number; low: number; high: number; reject: boolean }>; decision: string };
type Chi = { label: string; rows: string[]; cols: string[]; observed: number[][]; expected: number[][]; chi2: number; df: number; p: number; crit: number; cramers_v: number; n: number; decision: string };
type Inf = {
  alpha: number; standard: number; population: { mu: number; sigma: number; n: number };
  normal: { TEMP: NormalBlock; pm25: NormalBlock; log_pm25: NormalBlock; examples: Array<{ q: string; z: number | string; theoretical: number; empirical: number }>; pm25_tail: { threshold: number; empirical: number; normal_fit: number; lognormal_fit: number; lognormal_params: { sigma: number; scale: number } } };
  poisson: { variable: string; lambda: number; variance: number; dispersion_index: number; n_days: number; table: Array<{ k: number; observed: number; obs_prob: number; poisson_prob: number; expected: number }>; examples: Array<{ q: string; poisson: number; empirical: number }>; gof: { chi2: number; p: number; df: number }; rain: { variable: string; lambda: number; variance: number; dispersion_index: number; table: Array<{ k: number; observed: number; obs_prob: number; poisson_prob: number }> } };
  binomial: { p: number; n: number; mean: number; sd: number; observed_mean: number; observed_sd: number; n_days: number; table: Array<{ k: number; observed: number; binomial: number }>; note: string };
  clt: { population: { mu: number; sigma: number; skew: number; kurtosis: number; n: number; bins: Bins }; draws: number; by_n: Array<{ n: number; mean_of_means: number; sd_of_means: number; se_theory: number; skew: number; kurtosis: number; jb_p: number; bins: Bins }>; population_sample: number[] };
  ci: { mean: Array<{ n: number; xbar: number; s: number; se: number; z_crit: number; t_crit: number; z_low: number; z_high: number; t_low: number; t_high: number; contains_mu: boolean }>; proportion: { k: number; n: number; phat: number; wald_low: number; wald_high: number; wilson_low: number; wilson_high: number }; season: Array<{ season: string; n: number; mean: number; low: number; high: number }>; coverage: { intervals: Array<{ i: number; low: number; high: number; mean: number; covers: boolean }>; rate: number; mu: number }; sample_size: Array<{ E: number; n: number }> };
  tests: Test[];
  anova: { season: Anova; wind: Anova; year: Anova };
  chi: { season_aqi: Chi; wind_aqi: Chi };
  errors: { alpha: number; empirical_type1: number; empirical_type2_n5: number; power_n5: number; power_curve: Array<Record<string, number>>; n_needed: Array<{ d: number; n_per_group: number }>; matrix: Array<{ truth: string; reject: string; accept: string }> };
};

function CoverageChart({ intervals, mu }: { intervals: Array<{ low: number; high: number; covers: boolean }>; mu: number }) {
  const lo = Math.min(...intervals.map((i) => i.low)), hi = Math.max(...intervals.map((i) => i.high));
  const W = 700, H = 320, pad = 8;
  const x = (v: number) => pad + ((v - lo) / (hi - lo)) * (W - 2 * pad);
  const rowH = (H - 2 * pad) / intervals.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 320 }}>
      <line x1={x(mu)} x2={x(mu)} y1={0} y2={H} stroke="#111827" strokeDasharray="4 4" />
      {intervals.map((iv, i) => (
        <g key={i}>
          <line x1={x(iv.low)} x2={x(iv.high)} y1={pad + i * rowH + rowH / 2} y2={pad + i * rowH + rowH / 2} stroke={iv.covers ? "#2563eb" : "#e11d48"} strokeWidth={iv.covers ? 1.2 : 2} />
        </g>
      ))}
      <text x={x(mu) + 4} y={12} fontSize={11} fill="#111827">μ = {mu.toFixed(1)}</text>
      <text x={pad} y={H - 2} fontSize={10} fill="#6b7280">{lo.toFixed(0)}</text>
      <text x={W - 30} y={H - 2} fontSize={10} fill="#6b7280">{hi.toFixed(0)}</text>
    </svg>
  );
}

function TestCard({ t, standard }: { t: Test; standard: number }) {
  return (
    <ChartCard title={t.name} description={t.sample} right={<Decision p={t.p} alpha={t.alpha} />}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <div><span className="text-muted-foreground">H₀:</span> {t.h0}</div>
            <div><span className="text-muted-foreground">H₁:</span> {t.h1}</div>
          </div>
          {t.groups && (
            <DataTable rows={t.groups} columns={[{ key: "name", header: "Group" }, { key: "n", header: "n", align: "right", render: (r) => fmtInt(r.n) }, { key: "mean", header: "Mean", align: "right", render: (r) => fmt(r.mean, 2) }, { key: "sd", header: "SD", align: "right", render: (r) => fmt(r.sd, 2) }]} />
          )}
          {t.pairs && (
            <DataTable rows={t.pairs} columns={[{ key: "month", header: "Month" }, { key: "y2010", header: "2010", align: "right" }, { key: "y2014", header: "2014", align: "right" }, { key: "diff", header: "d", align: "right", render: (r) => <span className={r.diff > 0 ? "text-rose-700" : "text-emerald-700"}>{fmt(r.diff, 1)}</span> }]} />
          )}
        </div>
        <KV
          cols={1}
          items={[
            ...(t.n !== undefined ? [["n", fmtInt(t.n)] as [string, string]] : []),
            ...(t.xbar !== undefined ? [["Sample mean x̄", fmt(t.xbar, 2)] as [string, string]] : []),
            ...(t.sigma !== undefined ? [["σ (known)", fmt(t.sigma, 2)] as [string, string]] : []),
            ...(t.s !== undefined ? [["s (sample SD)", fmt(t.s, 2)] as [string, string]] : []),
            ...(t.mean_diff !== undefined ? [["Mean difference d̄", fmt(t.mean_diff, 2)] as [string, string], ["SD of differences", fmt(t.sd_diff, 2)] as [string, string]] : []),
            [`${t.stat_name} statistic`, fmt(t.stat, 3)],
            ...(t.df !== undefined ? [["Degrees of freedom", fmt(t.df, 1)] as [string, string]] : []),
            ...(t.crit !== undefined ? [["Critical value (α = 0.05)", fmt(t.crit, 3)] as [string, string]] : []),
            ["p-value", fmtP(t.p)],
            ...(t.cohen_d !== undefined ? [["Effect size (Cohen's d)", fmt(t.cohen_d, 3)] as [string, string]] : []),
            ...(t.nonparametric ? [[`${t.nonparametric.name} p`, fmtP(t.nonparametric.p)] as [string, string]] : []),
            ["Decision", t.decision],
          ]}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t.id === "z_one" && `The sample mean of ${fmt(t.xbar, 1)} is ${fmt(t.stat, 2)} standard errors above ${standard}. With σ known we use the standard normal; the one-tailed critical value is 1.645, so the data give very strong evidence that the mean exceeds the limit.`}
        {t.id === "t_one" && "With σ unknown we estimate it from the sample and use the t distribution with n − 1 degrees of freedom. The conclusion is the same: 2014 daily means are well above the limit."}
        {t.id === "t_two_weekend" && "Welch's version does not assume equal variances. The difference between weekend and weekday pollution is tiny relative to the day-to-day spread, and the Mann-Whitney test agrees. No weekend effect."}
        {t.id === "t_two_season" && "Winter days are far more polluted than summer days; a large effect size and the rank-based Mann-Whitney test both confirm it."}
        {t.id === "t_paired" && "Pairing by calendar month removes the seasonal variation from the comparison. The 2014-minus-2010 differences are not consistently signed, so there is no evidence of improvement (or deterioration) over the period."}
      </p>
    </ChartCard>
  );
}

function AnovaCard({ a }: { a: Anova }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={`Group means ± 95% CI · ${a.factor}`} right={<Decision p={a.p} />}>
          <CategoryBars data={a.groups.map((g) => ({ name: g.name, mean: g.mean }))} xKey="name" yKey="mean" yLabel="µg/m³ (daily means)" height={220} fallback="#2563eb" />
          <DataTable rows={a.groups} columns={[{ key: "name", header: "Group" }, { key: "n", header: "n days", align: "right" }, { key: "mean", header: "Mean", align: "right", render: (r) => fmt(r.mean, 1) }, { key: "sd", header: "SD", align: "right", render: (r) => fmt(r.sd, 1) }, { key: "se", header: "SE", align: "right", render: (r) => fmt(r.se, 2) }]} />
        </ChartCard>
        <ChartCard title="ANOVA table" description="Variance is split into between-group and within-group parts; F is their ratio of mean squares.">
          <DataTable
            rows={[
              { source: "Between groups", ss: a.table.ss_between, df: a.table.df_between, ms: a.table.ms_between, F: a.F, p: a.p },
              { source: "Within groups (error)", ss: a.table.ss_within, df: a.table.df_within, ms: a.table.ms_within, F: null, p: null },
              { source: "Total", ss: a.table.ss_total, df: a.table.df_between + a.table.df_within, ms: null, F: null, p: null },
            ]}
            columns={[{ key: "source", header: "Source", className: "font-medium" }, { key: "ss", header: "SS", align: "right", render: (r) => fmtInt(r.ss as number) }, { key: "df", header: "df", align: "right" }, { key: "ms", header: "MS", align: "right", render: (r) => (r.ms === null ? "" : fmt(r.ms as number, 1)) }, { key: "F", header: "F", align: "right", render: (r) => (r.F === null ? "" : fmt(r.F as number, 2)) }, { key: "p", header: "p", align: "right", render: (r) => (r.p === null ? "" : fmtP(r.p as number)) }]}
          />
          <KV cols={2} items={[["F critical (α = 0.05)", fmt(a.F_crit, 3)], ["η² (effect size)", fmt(a.eta2, 4)], ["Levene p (equal variances?)", fmtP(a.levene.p)], ["Kruskal-Wallis p", fmtP(a.kruskal.p)]]} />
        </ChartCard>
      </div>
      <ChartCard title="Tukey HSD post-hoc comparisons" description="Which pairs differ? Adjusted for multiple comparisons. Reject = the pair's means differ significantly.">
        <DataTable rows={a.tukey} columns={[{ key: "pair", header: "Pair", render: (r) => `${r.a} vs ${r.b}` }, { key: "meandiff", header: "Mean diff", align: "right", render: (r) => fmt(r.meandiff, 1) }, { key: "ci", header: "95% CI", align: "right", render: (r) => `[${fmt(r.low, 1)}, ${fmt(r.high, 1)}]` }, { key: "p", header: "p (adj.)", align: "right", render: (r) => fmtP(r.p) }, { key: "reject", header: "", render: (r) => <Badge variant={r.reject ? "default" : "secondary"} className="rounded-md text-[10px]">{r.reject ? "differ" : "no difference"}</Badge> }]} />
      </ChartCard>
    </div>
  );
}

function ChiCard({ c }: { c: Chi }) {
  const cells = (m: number[][]) => c.rows.flatMap((r, i) => c.cols.map((col, j) => ({ row: r, col, value: m[i][j] })));
  return (
    <ChartCard title={c.label} right={<Decision p={c.p} rejectText="Reject H₀: dependent" failText="Independent" />}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium">Observed counts</div>
          <Heatmap rows={c.rows} cols={c.cols} cells={cells(c.observed)} digits={0} hue="blue" cellClass="h-9 text-[10px]" />
        </div>
        <div>
          <div className="mb-1 text-xs font-medium">Expected counts under independence</div>
          <Heatmap rows={c.rows} cols={c.cols} cells={cells(c.expected)} digits={0} hue="blue" cellClass="h-9 text-[10px]" />
        </div>
      </div>
      <KV cols={4} items={[["χ²", fmt(c.chi2, 1)], ["df", `${c.df}`], ["χ² critical", fmt(c.crit, 2)], ["p", fmtP(c.p)], ["Cramér's V", fmt(c.cramers_v, 3)], ["n", fmtInt(c.n)]]} />
    </ChartCard>
  );
}

export default async function Page() {
  const d = await loadData<Inf>("inference");
  const clt30 = d.clt.by_n.find((b) => b.n === 30)!;
  return (
    <PageShell
      module="5"
      title="Probability distributions & inferential statistics"
      description="From describing the sample to making claims about the population. Normal, Poisson and Binomial models are fitted and checked; the Central Limit Theorem is demonstrated on the real, skewed PM2.5 population; confidence intervals, z-, t-, paired, ANOVA and χ² tests answer concrete questions, and the last section quantifies Type I and Type II errors and power."
      concepts={["Normal distribution", "Poisson & Binomial", "Central Limit Theorem", "Confidence intervals", "z-test, t-test, paired t", "One-way ANOVA + Tukey", "χ² independence", "Type I/II error & power"]}
    >
      <StatGrid cols={4}>
        <StatCard label="Population mean μ" value={fmt(d.population.mu, 2)} hint={`σ = ${fmt(d.population.sigma, 2)}, N = ${fmtInt(d.population.n)} hours`} />
        <StatCard label="PM2.5 normality (Jarque-Bera p)" value={fmtP(d.normal.pm25.tests[1].p)} hint="rejected - heavy right tail" tone="bad" />
        <StatCard label="CLT at n = 30: skew of means" value={fmt(clt30.skew, 2)} hint={`population skew ${fmt(d.clt.population.skew, 2)}`} tone="good" />
        <StatCard label="Season ANOVA" value={`F = ${fmt(d.anova.season.F, 1)}`} hint={`p ${fmtP(d.anova.season.p)}, η² = ${fmt(d.anova.season.eta2, 3)}`} />
      </StatGrid>

      {/* ------------------------------------------------------ Normal */}
      <Section title="Normal distribution" subtitle="Fit N(μ, σ²) to a variable and check whether the bell curve describes it. Temperature is close to normal (bimodal at the seasons, but symmetric); PM2.5 is not; log PM2.5 is much closer.">
        <div className="grid gap-4 md:grid-cols-2">
          <FormulaCard title="Density and z-score" tex={["f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}}\\, e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}", "z = \\frac{x-\\mu}{\\sigma}, \\qquad P(X \\le x) = \\Phi(z)"]} where={[["\\Phi", "standard normal CDF"]]} />
          <FormulaCard title="Normality tests" tex={["JB = \\frac{n}{6}\\left(g_1^2 + \\frac{g_2^2}{4}\\right) \\sim \\chi^2_2", "D_{KS} = \\sup_x |F_n(x) - \\Phi(x)|"]} where={[["g_1, g_2", "skewness and excess kurtosis"], ["H_0", "the data are normal; small p → not normal"]]} />
        </div>
        <Tabs defaultValue="TEMP">
          <TabsList className="h-auto flex-wrap"><TabsTrigger value="TEMP">Temperature</TabsTrigger><TabsTrigger value="pm25">PM2.5</TabsTrigger><TabsTrigger value="log_pm25">log PM2.5</TabsTrigger></TabsList>
          {(["TEMP", "pm25", "log_pm25"] as const).map((k) => {
            const b = d.normal[k];
            return (
              <TabsContent key={k} value={k}>
                <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                  <ChartCard title={`${b.label}: histogram vs N(${fmt(b.mu, 1)}, ${fmt(b.sd, 1)}²)`} description={`skewness ${fmt(b.skew, 2)}, excess kurtosis ${fmt(b.kurtosis, 2)}`}>
                    <Histogram bins={b.bins} height={280} xFormat={k === "log_pm25" ? "1dp" : "int"} />
                  </ChartCard>
                  <ChartCard title="Tests of normality">
                    <DataTable rows={b.tests} columns={[{ key: "name", header: "Test" }, { key: "stat", header: "Statistic", align: "right", render: (r) => fmt(r.stat, 3) }, { key: "p", header: "p", align: "right", render: (r) => (r.p === null ? `crit ${fmt(r.crit_5pct, 3)}` : fmtP(r.p)) }, { key: "d", header: "", render: (r) => (r.p === null ? <Badge variant="secondary" className="rounded-md text-[10px]">{r.stat > (r.crit_5pct ?? 0) ? "not normal" : "normal"}</Badge> : <Decision p={r.p} rejectText="not normal" failText="normal" />) }]} />
                    <p className="text-xs text-muted-foreground">With n ≈ 42,000 even a mild departure from normality is detected, so look at the histogram as well as the p-value.</p>
                  </ChartCard>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Worked probabilities on temperature" description="Using the fitted normal versus the actual share of hours.">
            <DataTable rows={d.normal.examples} columns={[{ key: "q", header: "Question" }, { key: "z", header: "z", align: "right" }, { key: "theoretical", header: "Normal model", align: "right", render: (r) => fmt(r.theoretical, 4) }, { key: "empirical", header: "Observed", align: "right", render: (r) => fmt(r.empirical, 4) }]} />
          </ChartCard>
          <ChartCard title="Why the normal model fails for PM2.5 tails" description={`P(PM2.5 > ${d.normal.pm25_tail.threshold}): the normal fit under-estimates the tail; a log-normal fit (σ = ${fmt(d.normal.pm25_tail.lognormal_params.sigma, 2)}) does far better.`}>
            <KV cols={1} items={[["Observed share of hours", fmt(d.normal.pm25_tail.empirical, 4)], ["Normal model", fmt(d.normal.pm25_tail.normal_fit, 4)], ["Log-normal model", fmt(d.normal.pm25_tail.lognormal_fit, 4)]]} />
            <p className="mt-2 text-xs text-muted-foreground">Concentrations are bounded at zero and multiplicative processes (dilution, accumulation) make the log of the series roughly normal. That is the reasoning behind the log transform used in regression.</p>
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------ Poisson */}
      <Section title="Poisson distribution" subtitle={`Counts of rare events per fixed interval. Here: ${d.poisson.variable}. λ is the mean count per day.`}>
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <FormulaCard title="Poisson pmf" tex={["P(X = k) = \\frac{e^{-\\lambda}\\lambda^k}{k!}, \\qquad E[X] = \\text{Var}[X] = \\lambda"]} where={[["\\lambda", `${fmt(d.poisson.lambda, 3)} hazardous hours per day`], ["\\text{Var}/\\lambda", `${fmt(d.poisson.dispersion_index, 2)} (1 for a true Poisson)`]]}>
            <KV cols={1} items={[["Days", fmtInt(d.poisson.n_days)], ["λ (mean)", fmt(d.poisson.lambda, 3)], ["Variance", fmt(d.poisson.variance, 2)], ["Dispersion index", fmt(d.poisson.dispersion_index, 2)], ["χ² goodness of fit p", fmtP(d.poisson.gof.p)]]} />
          </FormulaCard>
          <ChartCard title="Observed vs Poisson probabilities" description="Bars: observed share of days with k hazardous hours. Line: Poisson(λ).">
            <BarSeries data={d.poisson.table.filter((t) => t.k <= 24)} xKey="k" series={[{ key: "obs_prob", label: "Observed", color: "#2563eb" }, { key: "poisson_prob", label: "Poisson(λ)", color: "#e11d48" }]} height={260} yFormat="2dp" legend variant="default" />
          </ChartCard>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Example probabilities">
            <DataTable rows={d.poisson.examples} columns={[{ key: "q", header: "Question" }, { key: "poisson", header: "Poisson", align: "right", render: (r) => fmt(r.poisson, 4) }, { key: "empirical", header: "Observed", align: "right", render: (r) => fmt(r.empirical, 4) }]} />
            <Note tone="warn">
              Over-dispersion: the variance is {fmt(d.poisson.dispersion_index, 1)}× the mean because hazardous hours cluster inside multi-day smog episodes, violating the Poisson assumption of independent events. A negative-binomial model would fit better. Rain hours (below) are closer to Poisson but still clustered.
            </Note>
          </ChartCard>
          <ChartCard title={`${d.poisson.rain.variable} (λ = ${fmt(d.poisson.rain.lambda, 2)}, dispersion ${fmt(d.poisson.rain.dispersion_index, 2)})`}>
            <BarSeries data={d.poisson.rain.table} xKey="k" series={[{ key: "obs_prob", label: "Observed", color: "#0d9488" }, { key: "poisson_prob", label: "Poisson(λ)", color: "#e11d48" }]} height={220} yFormat="2dp" legend variant="default" />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------ Binomial */}
      <Section title="Binomial distribution" subtitle={`Number of 'unhealthy' hours (> 150 µg/m³) in a 24-hour day, if each hour were an independent trial with p = ${fmt(d.binomial.p, 3)}.`}>
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <FormulaCard title="Binomial pmf" tex={["P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}", "E[X] = np = " + fmt(d.binomial.mean, 2) + ", \\quad SD = \\sqrt{np(1-p)} = " + fmt(d.binomial.sd, 2)]}>
            <KV cols={1} items={[["Observed mean", fmt(d.binomial.observed_mean, 2)], ["Observed SD", fmt(d.binomial.observed_sd, 2)], ["Complete days", fmtInt(d.binomial.n_days)]]} />
            <p className="mt-2 text-xs text-muted-foreground">{d.binomial.note}</p>
          </FormulaCard>
          <ChartCard title="Observed vs Binomial(24, p)" description="The real distribution is U-shaped: days are mostly all-clean or all-polluted, because consecutive hours share the same air mass.">
            <BarSeries data={d.binomial.table} xKey="k" series={[{ key: "observed", label: "Observed", color: "#2563eb" }, { key: "binomial", label: "Binomial", color: "#e11d48" }]} height={260} yFormat="2dp" legend variant="default" />
          </ChartCard>
        </div>
      </Section>

      {/* ------------------------------------------------------ CLT */}
      <Section title="Central Limit Theorem" subtitle="Whatever the population looks like, the mean of a random sample of n observations is approximately normal with mean μ and standard deviation σ/√n once n is moderately large.">
        <FormulaCard title="Sampling distribution of the mean" tex={["\\bar{X}_n \\;\\xrightarrow{d}\\; N\\!\\left(\\mu, \\frac{\\sigma^2}{n}\\right), \\qquad SE = \\frac{\\sigma}{\\sqrt{n}}"]} />
        <ChartCard title="Interactive simulator (runs in your browser)" description="The population is the real, skewed PM2.5 series (skewness 1.8). Increase n and the distribution of the sample mean becomes normal and narrower.">
          <CltSimulator population={d.clt.population_sample} mu={d.clt.population.mu} sigma={d.clt.population.sigma} />
        </ChartCard>
        <ChartCard title="Precomputed check for n = 2 … 100" description={`${fmtInt(d.clt.draws)} samples per n from all ${fmtInt(d.clt.population.n)} hours. SD of the means tracks σ/√n and skewness collapses towards 0.`}>
          <DataTable rows={d.clt.by_n} columns={[{ key: "n", header: "n", align: "right" }, { key: "mean_of_means", header: "Mean of x̄", align: "right", render: (r) => fmt(r.mean_of_means, 2) }, { key: "sd_of_means", header: "SD of x̄ (observed)", align: "right", render: (r) => fmt(r.sd_of_means, 2) }, { key: "se_theory", header: "σ/√n", align: "right", render: (r) => fmt(r.se_theory, 2) }, { key: "skew", header: "Skewness", align: "right", render: (r) => fmt(r.skew, 3) }, { key: "kurtosis", header: "Excess kurtosis", align: "right", render: (r) => fmt(r.kurtosis, 3) }, { key: "jb_p", header: "JB normality p", align: "right", render: (r) => fmtP(r.jb_p) }]} />
        </ChartCard>
        <div className="grid gap-4 md:grid-cols-3">
          {d.clt.by_n.filter((b) => [2, 10, 100].includes(b.n)).map((b) => (
            <ChartCard key={b.n} title={`n = ${b.n}`} description={`skew ${fmt(b.skew, 2)}, SD ${fmt(b.sd_of_means, 1)}`}>
              <Histogram bins={b.bins} height={180} color="#7c3aed" label="sample means" xFormat="int" />
            </ChartCard>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------ CI */}
      <Section title="Confidence intervals" subtitle="A 95% interval is a procedure that captures the true parameter in 95% of repeated samples. Below: intervals for the mean at several sample sizes, for a proportion, per season, and a coverage experiment.">
        <div className="grid gap-4 md:grid-cols-3">
          <FormulaCard title="Mean, σ known (z)" tex={"\\bar{x} \\pm z_{\\alpha/2}\\frac{\\sigma}{\\sqrt{n}}"} where={[["z_{0.025}", "1.960"]]} />
          <FormulaCard title="Mean, σ unknown (t)" tex={"\\bar{x} \\pm t_{\\alpha/2,\\,n-1}\\frac{s}{\\sqrt{n}}"} where={[["t", "wider for small n; → z as n grows"]]} />
          <FormulaCard title="Proportion" tex={"\\hat{p} \\pm z_{\\alpha/2}\\sqrt{\\frac{\\hat{p}(1-\\hat{p})}{n}}"} where={[["\\text{Wilson}", "better near 0 or 1 and for small n"]]} />
        </div>
        <ChartCard title="95% CI for mean PM2.5 from random samples of n hours" description={`True μ = ${fmt(d.population.mu, 2)}. Width shrinks with √n; t and z intervals converge as n grows.`}>
          <DataTable rows={d.ci.mean} columns={[{ key: "n", header: "n", align: "right" }, { key: "xbar", header: "x̄", align: "right", render: (r) => fmt(r.xbar, 2) }, { key: "s", header: "s", align: "right", render: (r) => fmt(r.s, 2) }, { key: "se", header: "SE", align: "right", render: (r) => fmt(r.se, 2) }, { key: "z", header: "z-interval", align: "right", render: (r) => `[${fmt(r.z_low, 1)}, ${fmt(r.z_high, 1)}]` }, { key: "t_crit", header: "t crit", align: "right", render: (r) => fmt(r.t_crit, 3) }, { key: "t", header: "t-interval", align: "right", render: (r) => `[${fmt(r.t_low, 1)}, ${fmt(r.t_high, 1)}]` }, { key: "contains_mu", header: "Contains μ?", render: (r) => <Badge variant={r.contains_mu ? "default" : "destructive"} className="rounded-md text-[10px]">{r.contains_mu ? "yes" : "no"}</Badge> }]} />
        </ChartCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Coverage experiment: 100 intervals from samples of n = 50" description={`Each line is one 95% t-interval; red ones miss μ. Observed coverage ${d.ci.coverage.rate}% (expected ≈ 95%).`}>
            <CoverageChart intervals={d.ci.coverage.intervals} mu={d.ci.coverage.mu} />
          </ChartCard>
          <div className="space-y-4">
            <ChartCard title="Proportion of unhealthy hours" description={`k = ${fmtInt(d.ci.proportion.k)} of n = ${fmtInt(d.ci.proportion.n)} hours above 150 µg/m³`}>
              <KV cols={1} items={[["p̂", fmt(d.ci.proportion.phat, 4)], ["Wald 95% CI", `[${fmt(d.ci.proportion.wald_low, 4)}, ${fmt(d.ci.proportion.wald_high, 4)}]`], ["Wilson 95% CI", `[${fmt(d.ci.proportion.wilson_low, 4)}, ${fmt(d.ci.proportion.wilson_high, 4)}]`]]} />
            </ChartCard>
            <ChartCard title="Mean PM2.5 by season with 95% t-intervals" description="Non-overlapping intervals already hint at the ANOVA result.">
              <DataTable rows={d.ci.season} columns={[{ key: "season", header: "Season" }, { key: "n", header: "n", align: "right", render: (r) => fmtInt(r.n) }, { key: "mean", header: "Mean", align: "right", render: (r) => fmt(r.mean, 1) }, { key: "ci", header: "95% CI", align: "right", render: (r) => `[${fmt(r.low, 1)}, ${fmt(r.high, 1)}]` }]} />
            </ChartCard>
            <ChartCard title="Sample size for a margin of error E" description="n = (z σ / E)², using σ from the full series.">
              <DataTable rows={d.ci.sample_size} columns={[{ key: "E", header: "Margin E (µg/m³)", align: "right" }, { key: "n", header: "Hours needed", align: "right", render: (r) => fmtInt(r.n) }]} />
            </ChartCard>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------ Hypothesis tests */}
      <Section title="Hypothesis testing" subtitle={`Five tests, each stated with H₀, H₁, the statistic, its critical value or p-value, and the decision at α = ${d.alpha}. The 'standard' is China's 24-hour PM2.5 limit of ${d.standard} µg/m³.`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormulaCard title="One-sample z" tex={"z = \\frac{\\bar{x}-\\mu_0}{\\sigma/\\sqrt{n}}"} />
          <FormulaCard title="One-sample t" tex={"t = \\frac{\\bar{x}-\\mu_0}{s/\\sqrt{n}},\\; df = n-1"} />
          <FormulaCard title="Two-sample t (Welch)" tex={"t = \\frac{\\bar{x}_1-\\bar{x}_2}{\\sqrt{s_1^2/n_1 + s_2^2/n_2}}"} />
          <FormulaCard title="Paired t" tex={"t = \\frac{\\bar{d}}{s_d/\\sqrt{n}},\\; df = n-1"} />
        </div>
        <div className="space-y-4">
          {d.tests.map((t) => (
            <TestCard key={t.id} t={t} standard={d.standard} />
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------ ANOVA */}
      <Section title="One-way ANOVA" subtitle="Do mean daily PM2.5 levels differ across the levels of a factor? ANOVA compares the variation between group means with the variation within groups.">
        <FormulaCard title="F statistic" tex={["F = \\frac{MS_{between}}{MS_{within}} = \\frac{SS_B/(k-1)}{SS_W/(n-k)}, \\qquad SS_B = \\sum_g n_g(\\bar{x}_g-\\bar{x})^2, \\quad SS_W = \\sum_g\\sum_i (x_{gi}-\\bar{x}_g)^2"]} where={[["H_0", "all group means equal"], ["\\eta^2", "SS_B / SS_T, share of variance explained by the factor"], ["\\text{Tukey HSD}", "pairwise follow-up with family-wise error control"]]} />
        <Tabs defaultValue="season">
          <TabsList className="h-auto flex-wrap"><TabsTrigger value="season">Season</TabsTrigger><TabsTrigger value="wind">Wind direction</TabsTrigger><TabsTrigger value="year">Year</TabsTrigger></TabsList>
          {(["season", "wind", "year"] as const).map((k) => (
            <TabsContent key={k} value={k}><AnovaCard a={d.anova[k]} /></TabsContent>
          ))}
        </Tabs>
        <Note tone="info">
          Levene&apos;s test rejects equal variances for season (winter is much more variable), so the Kruskal-Wallis rank test is shown as a robustness check; it reaches the same conclusion. Year is the interesting negative result: the year means barely differ once you look at daily data.
        </Note>
      </Section>

      {/* ------------------------------------------------------ Chi-square */}
      <Section title="χ² test of independence" subtitle="Are two categorical variables related? Compare observed cell counts with the counts expected if the variables were independent.">
        <FormulaCard title="Chi-square statistic" tex={["\\chi^2 = \\sum_{i,j}\\frac{(O_{ij}-E_{ij})^2}{E_{ij}}, \\qquad E_{ij} = \\frac{\\text{row}_i \\times \\text{col}_j}{n}, \\qquad df = (r-1)(c-1)"]} where={[["V", "Cramér's V = √(χ²/(n·min(r−1,c−1))), 0 = none, 1 = perfect association"]]} />
        <div className="space-y-4">
          <ChiCard c={d.chi.season_aqi} />
          <ChiCard c={d.chi.wind_aqi} />
        </div>
      </Section>

      {/* ------------------------------------------------------ Errors & power */}
      <Section title="Type I and Type II errors, power" subtitle="α is the chance of rejecting a true H₀; β is the chance of missing a real effect; power = 1 − β. Both are checked by simulation on this dataset.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Decision matrix">
            <DataTable rows={d.errors.matrix} columns={[{ key: "truth", header: "Reality", className: "font-medium" }, { key: "reject", header: "Test rejects H₀" }, { key: "accept", header: "Test fails to reject H₀" }]} />
            <KV cols={1} items={[["Empirical Type I rate (1000 null splits, n = 60 vs 60)", `${fmt(d.errors.empirical_type1, 3)} (target α = ${d.errors.alpha})`], ["Empirical Type II rate, winter vs summer with n = 5 per group", fmt(d.errors.empirical_type2_n5, 3)], ["Power at n = 5", fmt(d.errors.power_n5, 3)]]} />
            <p className="text-xs text-muted-foreground">Randomly splitting the same population and testing for a difference produces p &lt; 0.05 about 5% of the time: that is the Type I rate working as designed. With only five days per season, a real winter-summer difference is missed in a large share of runs: low power.</p>
          </ChartCard>
          <ChartCard title="Power curve (two-sample t, α = 0.05)" description="Power vs standardised effect size d for several group sizes. Bigger effects or bigger samples → higher power.">
            <LineSeries data={d.errors.power_curve} xKey="d" series={[{ key: "n20", label: "n = 20", color: "#e11d48" }, { key: "n50", label: "n = 50", color: "#f97316" }, { key: "n100", label: "n = 100", color: "#2563eb" }, { key: "n400", label: "n = 400", color: "#16a34a" }]} height={240} yDomain={[0, 1]} legend yFormat="2dp" />
            <DataTable rows={d.errors.n_needed} columns={[{ key: "d", header: "Effect size d", align: "right" }, { key: "n_per_group", header: "n per group for 80% power", align: "right", render: (r) => fmtInt(r.n_per_group) }]} />
          </ChartCard>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <Tex>{"\\text{Power} = 1-\\beta = P(\\text{reject } H_0 \\mid H_1 \\text{ true}), \\qquad d = \\frac{\\mu_1-\\mu_2}{\\sigma_{pooled}}"}</Tex>
        </div>
      </Section>
    </PageShell>
  );
}
