import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, FormulaCard, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { Histogram } from "@/components/charts/series";
import { CategoryBars } from "@/components/charts/scatter";
import { BoxPlot, Heatmap } from "@/components/charts/grids";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEASON_COLORS, WIND_COLORS } from "@/lib/colors";
import { fmt, fmtInt } from "@/lib/format";
import { Tex } from "@/components/formula";

type Var = { col: string; label: string; n: number; mean: number; median: number; mode: number | null; std: number; variance: number; cv: number | null; min: number; max: number; range: number; q1: number; q3: number; iqr: number; skew: number; pearson_skew: number | null; bowley_skew: number | null; kurtosis: number; sem: number; p5: number; p95: number; lower_fence: number; upper_fence: number; outliers: number; outlier_pct: number };
type Box = { key: string; min: number; whisker_low: number; q1: number; median: number; q3: number; whisker_high: number; max: number; mean: number; n: number; outliers: number };
type Group = { group: string; count: number; pct: number; mean: number; median: number; std: number; min: number; max: number };
type Desc = {
  n: number;
  variables: Var[];
  histograms: Record<string, { bins: Array<Record<string, unknown>>; mu: number; sd: number }>;
  boxplots: { variables: Array<Box & { label: string }>; pm25_by_season: Box[]; pm25_by_wind: Box[]; pm25_by_year: Box[] };
  tabulation: Record<"season" | "wind" | "year" | "month" | "hour" | "weekend", Group[]>;
  crosstab_mean: Array<Record<string, unknown>>;
  crosstab_count: Array<Record<string, unknown>>;
  frequency: { aqi: Array<{ key: string; count: number; pct: number }>; wind: Array<{ key: string; count: number; pct: number }> };
  empirical_rule: Record<string, Array<{ k: number; theoretical: number; observed: number }>>;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function Page() {
  const d = await loadData<Desc>("descriptive");
  const pm = d.variables.find((v) => v.col === "pm25")!;
  const lp = d.variables.find((v) => v.col === "log_pm25")!;
  const seasons = ["Winter", "Spring", "Summer", "Autumn"];
  const winds = ["NW", "NE", "SE", "cv"];
  const ctMean = d.crosstab_mean.flatMap((r) => winds.map((w) => ({ row: String(r.season), col: w, value: r[w] as number })));

  return (
    <PageShell
      module="2"
      title="Descriptive statistics"
      description="Summarising 41,757 hourly readings with measures of central tendency, dispersion and shape, then tabulating PM2.5 by season, wind direction, year, month and hour. The headline: the mean is much larger than the median, so PM2.5 is strongly right-skewed and robust statistics (median, IQR) describe a typical hour better than mean and standard deviation."
      concepts={["Mean / median / mode", "Variance & SD", "Range, IQR, percentiles", "Skewness & kurtosis", "Coefficient of variation", "Tabulation & cross-tabulation", "Empirical rule"]}
    >
      <StatGrid cols={6}>
        <StatCard label="Mean" value={fmt(pm.mean, 1)} hint="µg/m³ · pulled up by extremes" />
        <StatCard label="Median" value={fmt(pm.median, 1)} hint="half the hours are below this" />
        <StatCard label="Mode" value={fmt(pm.mode, 0)} hint="most frequent reading" />
        <StatCard label="Std. deviation" value={fmt(pm.std, 1)} hint={`CV = ${fmt(pm.cv, 2)} (SD ÷ mean)`} />
        <StatCard label="IQR" value={fmt(pm.iqr, 1)} hint={`Q1 ${fmt(pm.q1, 0)} → Q3 ${fmt(pm.q3, 0)}`} />
        <StatCard label="Skewness" value={fmt(pm.skew, 2)} hint={`kurtosis ${fmt(pm.kurtosis, 2)} (excess)`} tone="warn" />
      </StatGrid>

      <Section title="Formulas" subtitle="Sample versions (n − 1 denominators). These are the exact quantities computed in pipeline/02_descriptive.py with pandas and SciPy.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormulaCard title="Central tendency" tex={["\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n} x_i", "\\tilde{x} = x_{(n+1)/2} \\quad \\text{(middle of the sorted data)}"]} where={[["\\bar{x}", "arithmetic mean"], ["\\tilde{x}", "median; mode = most frequent value"]]} />
          <FormulaCard title="Dispersion" tex={["s^2 = \\frac{1}{n-1}\\sum (x_i-\\bar{x})^2, \\qquad s = \\sqrt{s^2}", "\\text{IQR} = Q_3 - Q_1, \\qquad CV = \\frac{s}{\\bar{x}}"]} where={[["Q_1, Q_3", "25th and 75th percentiles"], ["CV", "relative spread, unit-free"]]} />
          <FormulaCard title="Shape" tex={["g_1 = \\frac{\\frac{1}{n}\\sum (x_i-\\bar{x})^3}{s^3}, \\qquad g_2 = \\frac{\\frac{1}{n}\\sum (x_i-\\bar{x})^4}{s^4} - 3", "Sk_{P} = \\frac{3(\\bar{x}-\\tilde{x})}{s}, \\qquad Sk_{B} = \\frac{Q_3 + Q_1 - 2Q_2}{Q_3 - Q_1}"]} where={[["g_1", "moment skewness (0 = symmetric)"], ["g_2", "excess kurtosis (0 = normal tails)"], ["Sk_P, Sk_B", "Pearson and Bowley (quartile) skewness"]]} />
        </div>
      </Section>

      <Section title="Summary table" subtitle="One row per numeric variable. Outliers are counted with the 1.5 × IQR rule.">
        <DataTable
          rows={d.variables}
          columns={[
            { key: "label", header: "Variable", className: "font-medium whitespace-nowrap" },
            { key: "n", header: "n", align: "right", render: (r) => fmtInt(r.n) },
            { key: "mean", header: "Mean", align: "right", render: (r) => fmt(r.mean, 2) },
            { key: "median", header: "Median", align: "right", render: (r) => fmt(r.median, 2) },
            { key: "mode", header: "Mode", align: "right", render: (r) => fmt(r.mode, 1) },
            { key: "std", header: "SD", align: "right", render: (r) => fmt(r.std, 2) },
            { key: "variance", header: "Variance", align: "right", render: (r) => fmt(r.variance, 1) },
            { key: "cv", header: "CV", align: "right", render: (r) => fmt(r.cv, 2) },
            { key: "min", header: "Min", align: "right", render: (r) => fmt(r.min, 1) },
            { key: "q1", header: "Q1", align: "right", render: (r) => fmt(r.q1, 1) },
            { key: "q3", header: "Q3", align: "right", render: (r) => fmt(r.q3, 1) },
            { key: "max", header: "Max", align: "right", render: (r) => fmt(r.max, 1) },
            { key: "iqr", header: "IQR", align: "right", render: (r) => fmt(r.iqr, 1) },
            { key: "skew", header: "Skew", align: "right", render: (r) => <span className={Math.abs(r.skew) > 1 ? "text-amber-700 font-medium" : ""}>{fmt(r.skew, 2)}</span> },
            { key: "bowley_skew", header: "Bowley", align: "right", render: (r) => fmt(r.bowley_skew, 2) },
            { key: "kurtosis", header: "Kurtosis", align: "right", render: (r) => fmt(r.kurtosis, 2) },
            { key: "outlier_pct", header: "Outliers %", align: "right", render: (r) => fmt(r.outlier_pct, 1) },
          ]}
        />
        <Note tone="info" title="Reading the table">
          For PM2.5 the mean ({fmt(pm.mean, 1)}) sits well above the median ({fmt(pm.median, 1)}) and the moment skewness is {fmt(pm.skew, 2)} with excess kurtosis {fmt(pm.kurtosis, 1)}: a long right tail with occasional extreme hours (max {fmt(pm.max, 0)}). After the log transform skewness drops to {fmt(lp.skew, 2)} and kurtosis to {fmt(lp.kurtosis, 2)}, close to a normal shape. Snow and rain hours are mostly zero, which is why their skewness and kurtosis are extreme; they are count-like variables, not continuous ones.
        </Note>
      </Section>

      <Section title="Distributions" subtitle="Histogram with the fitted normal density overlaid. A good fit means the red curve traces the bars.">
        <Tabs defaultValue="pm25">
          <TabsList className="h-auto flex-wrap">
            {d.variables.map((v) => (
              <TabsTrigger key={v.col} value={v.col}>
                {v.col === "log_pm25" ? "log PM2.5" : v.col === "pm25" ? "PM2.5" : v.col}
              </TabsTrigger>
            ))}
          </TabsList>
          {d.variables.map((v) => (
            <TabsContent key={v.col} value={v.col}>
              <ChartCard
                title={v.label}
                description={`μ = ${fmt(d.histograms[v.col].mu, 2)}, σ = ${fmt(d.histograms[v.col].sd, 2)}, skewness ${fmt(v.skew, 2)}, excess kurtosis ${fmt(v.kurtosis, 2)}`}
                footer={
                  <span>
                    Empirical rule check (share of observations within k·σ of the mean): {(d.empirical_rule[v.col] ?? d.empirical_rule.pm25).map((e) => `k=${e.k}: ${e.observed}% vs ${e.theoretical}% expected`).join(" · ")}
                    {d.empirical_rule[v.col] ? "" : " (shown for PM2.5)"}
                  </span>
                }
              >
                <Histogram bins={d.histograms[v.col].bins} height={280} xFormat={v.col === "log_pm25" ? "1dp" : "int"} />
              </ChartCard>
            </TabsContent>
          ))}
        </Tabs>
      </Section>

      <Section title="Box plots" subtitle="Five-number summary per group. Longer right whiskers and far-out maxima are the visual signature of right skew.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="PM2.5 by season" description="Winter has the widest spread and highest extremes; summer is the most compact.">
            <BoxPlot items={d.boxplots.pm25_by_season} colors={SEASON_COLORS} unit="" />
          </ChartCard>
          <ChartCard title="PM2.5 by wind direction" description="North-westerly (NW) hours are cleanest; calm/variable (cv) hours are worst.">
            <BoxPlot items={d.boxplots.pm25_by_wind} colors={WIND_COLORS} />
          </ChartCard>
          <ChartCard title="PM2.5 by year" description="No visible year-on-year improvement in the median between 2010 and 2014.">
            <BoxPlot items={d.boxplots.pm25_by_year} />
          </ChartCard>
          <ChartCard title="Weather variables" description="Each on its own scale, so compare shapes rather than positions.">
            <div className="space-y-4">
              {d.boxplots.variables
                .filter((b) => ["DEWP", "TEMP", "PRES", "Iws"].includes(b.key))
                .map((b) => (
                  <BoxPlot key={b.key} items={[{ ...b, key: b.label }]} min={b.min - (b.max - b.min) * 0.02} max={b.max + (b.max - b.min) * 0.02} note={false} />
                ))}
            </div>
          </ChartCard>
        </div>
      </Section>

      <Section title="Tabulation" subtitle="Group-wise summaries of PM2.5. Count, mean, median and spread per category.">
        <Tabs defaultValue="season">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="season">Season</TabsTrigger>
            <TabsTrigger value="wind">Wind</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="hour">Hour</TabsTrigger>
            <TabsTrigger value="weekend">Weekday / weekend</TabsTrigger>
          </TabsList>
          {(["season", "wind", "year", "month", "hour", "weekend"] as const).map((k) => (
            <TabsContent key={k} value={k} className="space-y-4">
              <ChartCard title={`Mean PM2.5 by ${k}`}>
                <CategoryBars
                  data={d.tabulation[k].map((g) => ({ ...g, label: k === "month" ? MONTHS[Number(g.group) - 1] : k === "hour" ? `${g.group}h` : g.group }))}
                  xKey="label"
                  yKey="mean"
                  colors={k === "season" ? SEASON_COLORS : k === "wind" ? WIND_COLORS : undefined}
                  colorKey="group"
                  yLabel="µg/m³"
                  height={230}
                  refY={pm.mean}
                  refLabel="overall mean"
                />
              </ChartCard>
              <DataTable
                rows={d.tabulation[k]}
                columns={[
                  { key: "group", header: k === "month" ? "Month" : k.charAt(0).toUpperCase() + k.slice(1), render: (r) => (k === "month" ? MONTHS[Number(r.group) - 1] : r.group) },
                  { key: "count", header: "Hours", align: "right", render: (r) => fmtInt(r.count) },
                  { key: "pct", header: "%", align: "right", render: (r) => fmt(r.pct, 1) },
                  { key: "mean", header: "Mean", align: "right", render: (r) => fmt(r.mean, 1) },
                  { key: "median", header: "Median", align: "right", render: (r) => fmt(r.median, 1) },
                  { key: "std", header: "SD", align: "right", render: (r) => fmt(r.std, 1) },
                  { key: "min", header: "Min", align: "right", render: (r) => fmt(r.min, 0) },
                  { key: "max", header: "Max", align: "right", render: (r) => fmt(r.max, 0) },
                ]}
              />
            </TabsContent>
          ))}
        </Tabs>
      </Section>

      <Section title="Cross-tabulation: season × wind direction" subtitle="Two categorical variables at once. Left: mean PM2.5 in each cell. Right: number of hours in each cell.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Mean PM2.5 (µg/m³)">
            <Heatmap rows={seasons} cols={winds} cells={ctMean} digits={0} hue="red" rowLabel="season" colLabel="wind direction" />
          </ChartCard>
          <ChartCard title="Hours observed">
            <Heatmap rows={seasons} cols={winds} cells={d.crosstab_count.flatMap((r) => winds.map((w) => ({ row: String(r.season), col: w, value: r[w] as number })))} digits={0} hue="blue" rowLabel="season" colLabel="wind direction" />
          </ChartCard>
        </div>
        <Note tone="good" title="Interpretation">
          The worst cell is winter with calm air; the cleanest is any season with north-westerly wind. Season and wind act together: calm winter air sits over the city with coal heating emissions, while NW wind brings dry, clean air from Mongolia. This interaction motivates the ANOVA and the regression with wind dummies later.
        </Note>
      </Section>

      <Section title="Frequency tables" subtitle="Relative frequency of categorical variables.">
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable rows={d.frequency.aqi} columns={[{ key: "key", header: "EPA category" }, { key: "count", header: "Hours", align: "right", render: (r) => fmtInt(r.count) }, { key: "pct", header: "Relative frequency %", align: "right", render: (r) => fmt(r.pct, 2) }]} />
          <DataTable rows={d.frequency.wind} columns={[{ key: "key", header: "Wind direction" }, { key: "count", header: "Hours", align: "right", render: (r) => fmtInt(r.count) }, { key: "pct", header: "Relative frequency %", align: "right", render: (r) => fmt(r.pct, 2) }]} />
        </div>
      </Section>

      <Section title="Worked example: Bowley skewness of PM2.5">
        <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-7">
          <Tex>{`Sk_B = \\frac{Q_3 + Q_1 - 2Q_2}{Q_3 - Q_1} = \\frac{${fmt(pm.q3, 1)} + ${fmt(pm.q1, 1)} - 2 \\times ${fmt(pm.median, 1)}}{${fmt(pm.q3, 1)} - ${fmt(pm.q1, 1)}} = ${fmt(pm.bowley_skew, 3)}`}</Tex>
          <p className="mt-2 text-muted-foreground">
            A positive value means the upper quartile is further from the median than the lower quartile: the right half of the box is longer. Pearson&apos;s version using the mean gives <Tex>{`3(\\bar{x}-\\tilde{x})/s = 3(${fmt(pm.mean, 1)} - ${fmt(pm.median, 1)})/${fmt(pm.std, 1)} = ${fmt(pm.pearson_skew, 3)}`}</Tex>, in agreement.
          </p>
        </div>
      </Section>
    </PageShell>
  );
}
