import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, Decision, FormulaCard, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { CorrMatrix } from "@/components/charts/grids";
import { ScatterPlot, CategoryBars } from "@/components/charts/scatter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { fmt, fmtInt, fmtP } from "@/lib/format";
import { Tex } from "@/components/formula";

type Pair = { var: string; label: string; pearson: number; pearson_p: number; ci_low: number; ci_high: number; spearman: number; spearman_p: number; r2: number; strength: string; direction: string; n: number; t_stat: number };
type Corr = {
  cols: string[]; labels: Record<string, string>;
  pearson: Array<{ row: string; col: string; value: number }>; spearman: Array<{ row: string; col: string; value: number }>; kendall: Array<{ row: string; col: string; value: number }>;
  pairs: Pair[]; all_pairs: Array<{ a: string; b: string; pearson: number; spearman: number; strength: string; direction: string }>;
  daily_pairs: Array<{ var: string; pearson: number; spearman: number }>;
  cat_assoc: Array<{ var: string; label: string; eta2: number; k: number }>;
  examples: Record<string, { points: Array<{ x: number; y: number }>; slope: number; intercept: number; r: number }>;
  nonlinear: Array<{ var: string; pearson: number; spearman: number; gap: number }>;
  n: number;
};

export default async function Page() {
  const c = await loadData<Corr>("correlation");
  const top = c.pairs[0];
  const strengthTone = (s: string) => (s === "negligible" ? "secondary" : s === "weak" ? "outline" : "default");
  return (
    <PageShell
      module="4"
      title="Correlation analysis"
      description="How strongly, and in which direction, each weather variable moves with PM2.5. Pearson measures linear association, Spearman and Kendall measure monotonic association on ranks and are robust to the skew and outliers seen in Module 2. The honest answer: individual correlations are weak-to-moderate, which already warns that a linear regression on weather will have a modest R²."
      concepts={["Pearson r", "Spearman ρ", "Kendall τ", "Correlation matrix", "Significance of r", "Coefficient of determination", "Correlation ≠ causation"]}
    >
      <StatGrid cols={4}>
        <StatCard label="Strongest linear association" value={`${top.var}: r = ${fmt(top.pearson, 3)}`} hint={`${top.strength}, ${top.direction}`} />
        <StatCard label="R² of that pair" value={fmt(top.r2, 3)} hint="share of PM2.5 variance explained by one variable" />
        <StatCard label="Sample size" value={fmtInt(c.n)} hint="hours - even tiny r is 'significant'" />
        <StatCard label="Strongest Spearman" value={`${[...c.pairs].sort((a, b) => Math.abs(b.spearman) - Math.abs(a.spearman))[0].var}: ρ = ${fmt([...c.pairs].sort((a, b) => Math.abs(b.spearman) - Math.abs(a.spearman))[0].spearman, 3)}`} hint="rank-based, robust to outliers" />
      </StatGrid>

      <Section title="Formulas">
        <div className="grid gap-4 md:grid-cols-3">
          <FormulaCard title="Pearson product-moment correlation" tex={"r = \\frac{\\sum (x_i-\\bar{x})(y_i-\\bar{y})}{\\sqrt{\\sum (x_i-\\bar{x})^2}\\sqrt{\\sum (y_i-\\bar{y})^2}} = \\frac{S_{xy}}{\\sqrt{S_{xx}S_{yy}}}"} where={[["r \\in [-1, 1]", "linear association; r² = share of variance explained"]]} />
          <FormulaCard title="Spearman rank correlation" tex={"\\rho = 1 - \\frac{6\\sum d_i^2}{n(n^2-1)}"} where={[["d_i", "difference between the ranks of xᵢ and yᵢ (ties handled by averaging ranks)"]]} />
          <FormulaCard title="Test of significance" tex={"t = \\frac{r\\sqrt{n-2}}{\\sqrt{1-r^2}} \\sim t_{n-2} \\quad\\text{under } H_0: \\rho = 0"} where={[["\\text{CI}", "Fisher z: tanh(arctanh r ± 1.96/√(n−3))"]]} />
        </div>
      </Section>

      <Section title="Correlation matrices" subtitle="Red = positive, blue = negative, intensity = strength. Hour of day and the weekend flag are included to show that time-of-day matters but the weekday does not.">
        <Tabs defaultValue="pearson">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="pearson">Pearson</TabsTrigger>
            <TabsTrigger value="spearman">Spearman</TabsTrigger>
            <TabsTrigger value="kendall">Kendall (5,000-row sample)</TabsTrigger>
          </TabsList>
          {(["pearson", "spearman", "kendall"] as const).map((m) => (
            <TabsContent key={m} value={m}>
              <ChartCard title={`${m.charAt(0).toUpperCase() + m.slice(1)} correlation matrix`}>
                <CorrMatrix cols={c.cols} labels={c.labels} cells={c[m]} />
              </ChartCard>
            </TabsContent>
          ))}
        </Tabs>
        <Note tone="info">
          The weather variables are strongly correlated with <em>each other</em> (dew point vs temperature r ≈ 0.82, temperature vs pressure r ≈ −0.83). That is multicollinearity, and it is why the regression module reports variance inflation factors.
        </Note>
      </Section>

      <Section title="PM2.5 against each variable" subtitle="Coefficient, 95% confidence interval, significance and an interpretation. With n ≈ 42k every non-zero r is statistically significant, so judge by size, not by p.">
        <DataTable
          rows={c.pairs}
          columns={[
            { key: "label", header: "Variable", className: "font-medium" },
            { key: "pearson", header: "Pearson r", align: "right", render: (r) => <span className="font-semibold">{fmt(r.pearson, 3)}</span> },
            { key: "ci", header: "95% CI", align: "right", render: (r) => `[${fmt(r.ci_low, 3)}, ${fmt(r.ci_high, 3)}]` },
            { key: "r2", header: "r²", align: "right", render: (r) => fmt(r.r2, 3) },
            { key: "t_stat", header: "t", align: "right", render: (r) => fmt(r.t_stat, 1) },
            { key: "pearson_p", header: "p", align: "right", render: (r) => fmtP(r.pearson_p) },
            { key: "spearman", header: "Spearman ρ", align: "right", render: (r) => fmt(r.spearman, 3) },
            { key: "strength", header: "Strength", render: (r) => <Badge variant={strengthTone(r.strength)} className="rounded-md text-[10px]">{r.strength}</Badge> },
            { key: "direction", header: "Direction", render: (r) => (r.direction === "positive" ? "↑ positive" : "↓ negative") },
            { key: "d", header: "H₀: ρ = 0", render: (r) => <Decision p={r.pearson_p} /> },
          ]}
        />
      </Section>

      <Section title="Linear vs monotonic" subtitle="When |Spearman| > |Pearson| the relationship is monotonic but not straight. Wind speed is the clearest case: PM2.5 falls quickly over the first few m/s and then flattens.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="|ρ| − |r| per variable" description="Positive bars: Spearman stronger than Pearson, i.e. a curved relationship or outlier damage.">
            <CategoryBars data={c.nonlinear.map((n) => ({ ...n }))} xKey="var" yKey="gap" yLabel="|ρ| − |r|" height={240} fallback="#7c3aed" />
          </ChartCard>
          <ChartCard title="PM2.5 vs cumulated wind speed (600 sampled hours)" description={`Pearson r = ${fmt(c.examples.Iws.r, 3)}. The straight line under-states the drop at low wind speeds and over-states it at high speeds.`}>
            <ScatterPlot points={c.examples.Iws.points} line={[{ x: 0, y: c.examples.Iws.intercept }, { x: 300, y: c.examples.Iws.intercept + 300 * c.examples.Iws.slope }]} xLabel="Iws (m/s, cumulated)" yLabel="PM2.5" height={260} xDomain={[0, 300]} />
          </ChartCard>
        </div>
      </Section>

      <Section title="Strongest pairs in the whole dataset" subtitle="Top 12 absolute Pearson correlations among all variables. The weather-weather pairs dominate.">
        <DataTable
          rows={c.all_pairs}
          columns={[
            { key: "pair", header: "Pair", render: (r) => <span className="font-medium">{c.labels[r.a] ?? r.a} × {c.labels[r.b] ?? r.b}</span> },
            { key: "pearson", header: "Pearson", align: "right", render: (r) => fmt(r.pearson, 3) },
            { key: "spearman", header: "Spearman", align: "right", render: (r) => fmt(r.spearman, 3) },
            { key: "strength", header: "Strength", render: (r) => <Badge variant={strengthTone(r.strength)} className="rounded-md text-[10px]">{r.strength}</Badge> },
            { key: "direction", header: "Direction" },
          ]}
        />
      </Section>

      <Section title="Aggregation level and categorical association" subtitle="Correlations grow when hourly noise is averaged out (daily means), and η² quantifies how much variance a categorical factor explains.">
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable rows={c.daily_pairs} columns={[{ key: "var", header: "Variable (daily means)" }, { key: "pearson", header: "Pearson", align: "right", render: (r) => fmt(r.pearson, 3) }, { key: "spearman", header: "Spearman", align: "right", render: (r) => fmt(r.spearman, 3) }]} />
          <div className="space-y-3">
            <DataTable rows={c.cat_assoc} columns={[{ key: "label", header: "Categorical factor" }, { key: "k", header: "Levels", align: "right" }, { key: "eta2", header: "η² (share of variance)", align: "right", render: (r) => fmt(r.eta2, 4) }]} />
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <Tex>{"\\eta^2 = \\frac{SS_{between}}{SS_{total}} = \\frac{\\sum_g n_g(\\bar{x}_g-\\bar{x})^2}{\\sum_i (x_i-\\bar{x})^2}"}</Tex>
            </div>
          </div>
        </div>
      </Section>

      <Note tone="warn" title="Correlation is not causation">
        Dew point correlates positively with PM2.5, but moisture does not create particles. Humid air arrives with south-easterly flow from industrial regions and stagnates, and moisture lets particles grow; the weather is a marker of the air mass, not the cause of emissions. This is why Module 6 adds wind-direction dummies and why the insights page warns about omitted variables.
      </Note>
    </PageShell>
  );
}
