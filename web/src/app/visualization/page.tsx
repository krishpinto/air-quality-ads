import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, Note, Section } from "@/components/blocks";
import { AreaSeries, BarSeries, LineSeries } from "@/components/charts/series";
import { CategoryBars, ScatterPlot } from "@/components/charts/scatter";
import { Heatmap } from "@/components/charts/grids";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AQI_COLORS, SEASON_COLORS, WIND_COLORS } from "@/lib/colors";
import { fmt, fmtP } from "@/lib/format";

type Viz = {
  scatter: Record<string, { label: string; points: Array<{ x: number; y: number; season: string }>; slope: number; intercept: number; r: number; r2: number; p: number; x_min: number; x_max: number }>;
  bubble: Array<{ label: string; x: number; y: number; size: number; season: string; Iws: number }>;
  hour_profile: Array<{ hour: number; mean: number; lo: number; hi: number }>;
  hour_by_season: Array<Record<string, number>>;
  heatmap: Array<{ year: number; month: number; value: number }>;
  weekday: Array<{ day: string; mean: number }>;
  scatter_matrix: { vars: string[]; labels: Record<string, string>; points: Array<Record<string, number>>; corr: Record<string, number> };
  wind_bar: Array<{ key: string; label: string; count: number; mean_pm25: number; median_pm25: number; pct_unhealthy: number }>;
  season_bar: Array<{ key: string; count: number; mean_pm25: number; median_pm25: number; pct_unhealthy: number }>;
  aqi_by_season: Array<Record<string, unknown>>;
  aqi_order: string[];
  kde: { pm25: Array<{ x: number; y: number }>; log_pm25: Array<{ x: number; y: number }> };
  weekly_series: Array<{ date: string; pm25: number }>;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function Page() {
  const v = await loadData<Viz>("visualization");
  const years = Array.from(new Set(v.heatmap.map((h) => String(h.year))));
  const sm = v.scatter_matrix;
  return (
    <PageShell
      module="3"
      title="Data visualization"
      description="Choosing the right chart for the question: distributions (histogram, density), relationships (scatter, scatter matrix, bubble), comparisons (bar, stacked bar), patterns over time (line, area, heat map). Each chart below is captioned with what it is for and what it shows."
      concepts={["Histogram & density", "Scatter plot", "Scatter matrix", "Bubble chart", "Bar & stacked bar", "Line & area", "Heat map"]}
    >
      <Section title="Distribution of the target" subtitle="Kernel density estimates. The raw series is right-skewed; the log transform makes it close to symmetric, which is why the regression module also fits a log model.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="PM2.5 density" description="Long right tail: most hours below 100 µg/m³, a thin tail out past 400.">
            <AreaSeries data={v.kde.pm25} xKey="x" series={[{ key: "y", label: "density", color: "#2563eb" }]} xFormat="int" yFormat="exp" height={230} xTicks={8} />
          </ChartCard>
          <ChartCard title="log(1 + PM2.5) density" description="Roughly bell-shaped after the transform.">
            <AreaSeries data={v.kde.log_pm25} xKey="x" series={[{ key: "y", label: "density", color: "#7c3aed" }]} xFormat="1dp" yFormat="2dp" height={230} xTicks={8} />
          </ChartCard>
        </div>
      </Section>

      <Section title="Relationships: PM2.5 vs weather" subtitle="A random sample of 800 hours (plotting all 41,757 would be an unreadable blob). The red line is the least-squares fit; points are coloured by season.">
        <Tabs defaultValue="Iws">
          <TabsList className="h-auto flex-wrap">
            {Object.keys(v.scatter).map((k) => (
              <TabsTrigger key={k} value={k}>{k}</TabsTrigger>
            ))}
          </TabsList>
          {Object.entries(v.scatter).map(([k, s]) => (
            <TabsContent key={k} value={k}>
              <ChartCard
                title={`PM2.5 vs ${s.label}`}
                description={`r = ${fmt(s.r, 3)}, R² = ${fmt(s.r2, 3)}, slope = ${fmt(s.slope, 3)} µg/m³ per unit, p ${fmtP(s.p)}`}
                footer={k === "Iws" ? "Wind speed is cumulated over consecutive hours from the same direction, so large values mean a long, steady blow - exactly the condition that clears the air. The relationship is non-linear: the first few m/s matter most." : k === "DEWP" ? "Higher dew point = more moisture in the air. Humid, stagnant air masses (typically from the south-east) carry and grow particles." : k === "TEMP" ? "Temperature alone is a weak predictor: both freezing winter smog days and hot summer haze exist." : "Pressure is slightly negatively related: high-pressure systems bring subsidence that traps pollutants, but the effect is small compared with wind."}
              >
                <ScatterPlot
                  points={s.points.map((p) => ({ x: p.x, y: p.y, group: p.season }))}
                  groups={SEASON_COLORS}
                  line={[{ x: s.x_min, y: s.intercept + s.slope * s.x_min }, { x: s.x_max, y: s.intercept + s.slope * s.x_max }]}
                  xLabel={s.label}
                  yLabel="PM2.5 (µg/m³)"
                  height={320}
                />
              </ChartCard>
            </TabsContent>
          ))}
        </Tabs>
      </Section>

      <Section title="Scatter matrix" subtitle="Every pair of four variables on one grid (300 sampled hours). The diagonal lists the variable, the lower cells show Pearson r.">
        <div className="grid grid-cols-4 gap-1 rounded-lg border p-2">
          {sm.vars.map((row) =>
            sm.vars.map((col) => {
              const key = `${row}-${col}`;
              if (row === col)
                return (
                  <div key={key} className="flex h-36 items-center justify-center rounded-md bg-muted/50 text-center text-xs font-medium">
                    {sm.labels[row]}
                  </div>
                );
              const ri = sm.vars.indexOf(row), ci = sm.vars.indexOf(col);
              if (ri > ci) {
                const r = sm.corr[`${row}|${col}`];
                return (
                  <div key={key} className="flex h-36 flex-col items-center justify-center rounded-md border border-dashed text-center" style={{ background: `rgba(${r < 0 ? "37,99,235" : "225,29,72"}, ${0.05 + 0.6 * Math.abs(r)})` }}>
                    <span className="text-[10px] text-muted-foreground">r</span>
                    <span className="text-lg font-semibold tabular-nums">{fmt(r, 2)}</span>
                  </div>
                );
              }
              return (
                <div key={key} className="h-36">
                  <ScatterPlot points={sm.points.map((p) => ({ x: p[col], y: p[row] }))} xLabel={col} yLabel={row} height={144} size={10} opacity={0.4} />
                </div>
              );
            }),
          )}
        </div>
      </Section>

      <Section title="Bubble chart: one bubble per month" subtitle="Three variables at once: x = mean temperature, y = mean PM2.5, bubble size = number of unhealthy hours (> 150 µg/m³) that month, colour = season.">
        <ChartCard title="60 months, 2010–2014">
          <ScatterPlot
            points={v.bubble.map((b) => ({ x: b.x, y: b.y, group: b.season, label: `${b.label} · ${b.size} unhealthy h`, size: b.size }))}
            groups={SEASON_COLORS}
            xLabel="Mean temperature (°C)"
            yLabel="Mean PM2.5 (µg/m³)"
            height={340}
            size={90}
            opacity={0.5}
          />
        </ChartCard>
      </Section>

      <Section title="Patterns over time" subtitle="Line and area charts for the diurnal, weekly and seasonal cycles. Shaded bands are 95% confidence intervals of the hourly mean.">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Diurnal cycle" description="Mean PM2.5 by hour of day with 95% CI. Night and early morning are worst: the boundary layer is shallow and traffic/heating emissions accumulate; afternoon mixing dilutes them.">
            <AreaSeries data={v.hour_profile} xKey="hour" series={[{ key: "hi", label: "upper 95%", color: "#93c5fd", variant: "solid" }, { key: "mean", label: "mean", color: "#2563eb", variant: "solid" }, { key: "lo", label: "lower 95%", color: "#ffffff", variant: "solid" }]} xFormat="hour" height={250} xTicks={12} />
          </ChartCard>
          <ChartCard title="Diurnal cycle by season" description="The same curve split by season. Winter nights are far worse than winter afternoons; summer is flat.">
            <LineSeries data={v.hour_by_season} xKey="hour" series={["Winter", "Spring", "Summer", "Autumn"].map((s) => ({ key: s, label: s, color: SEASON_COLORS[s] }))} xFormat="hour" height={250} xTicks={12} legend />
          </ChartCard>
          <ChartCard title="Day-of-week means" description="Almost flat: no weekend effect, which the two-sample t-test later confirms.">
            <CategoryBars data={v.weekday} xKey="day" yKey="mean" yLabel="µg/m³" height={220} fallback="#64748b" />
          </ChartCard>
          <ChartCard title="Weekly mean, full period" description="Area chart of the 261 weekly means. The repeating winter peaks are the seasonal component that the time-series module decomposes.">
            <AreaSeries data={v.weekly_series} xKey="date" series={[{ key: "pm25", label: "PM2.5", color: "#2563eb" }]} xFormat="monthYearShort" height={220} xTicks={10} />
          </ChartCard>
        </div>
      </Section>

      <Section title="Heat map: year × month" subtitle="Monthly mean PM2.5. Darker = more polluted. Read along a row for the seasonal cycle, down a column for year-to-year change.">
        <ChartCard title="Monthly mean PM2.5 (µg/m³)">
          <Heatmap rows={years} cols={MONTHS} cells={v.heatmap.map((h) => ({ row: String(h.year), col: MONTHS[h.month - 1], value: h.value }))} digits={0} hue="red" rowLabel="year" colLabel="month" cellClass="h-11" />
        </ChartCard>
      </Section>

      <Section title="Categorical comparisons" subtitle="Bar charts for category means and a 100%-stacked bar for category composition.">
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Mean PM2.5 by wind direction">
            <CategoryBars data={v.wind_bar} xKey="key" yKey="mean_pm25" colors={WIND_COLORS} yLabel="µg/m³" height={220} />
          </ChartCard>
          <ChartCard title="% of hours unhealthy, by wind">
            <CategoryBars data={v.wind_bar} xKey="key" yKey="pct_unhealthy" colors={WIND_COLORS} yLabel="%" height={220} />
          </ChartCard>
          <ChartCard title="% of hours unhealthy, by season">
            <CategoryBars data={v.season_bar} xKey="key" yKey="pct_unhealthy" colors={SEASON_COLORS} yLabel="%" height={220} />
          </ChartCard>
        </div>
        <ChartCard title="EPA category mix by season (100% stacked)" description="Each bar sums to 100%. Winter has the largest share of 'Very unhealthy' and 'Hazardous' hours; summer has the most 'Moderate' hours but very few 'Good' ones.">
          <BarSeries data={v.aqi_by_season} xKey="season" series={v.aqi_order.map((a) => ({ key: a, label: a, color: AQI_COLORS[a] }))} stack="stacked" yFormat="pct" height={280} legend variant="default" />
        </ChartCard>
      </Section>

      <Note tone="info" title="Chart choice cheat-sheet">
        Distribution of one variable → histogram or density. Relationship between two numeric variables → scatter (+ fitted line). Many pairs → scatter matrix. Three numeric variables → bubble. Numeric by category → bar (or box plot for spread). Composition → stacked bar. Values over time → line/area. Two categorical dimensions with a numeric value → heat map.
      </Note>
    </PageShell>
  );
}
