import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { ChartCard, DataTable, KV, Note, Section, StatCard, StatGrid } from "@/components/blocks";
import { CategoryBars } from "@/components/charts/scatter";
import { Donut } from "@/components/charts/donut";
import { Badge } from "@/components/ui/badge";
import { AQI_COLORS, SEASON_COLORS, WIND_COLORS } from "@/lib/colors";
import { fmt, fmtInt } from "@/lib/format";

type Dataset = {
  title: string; source: string; source_url: string;
  overview: { rows_raw: number; columns_raw: number; start: string; end: string; expected_hours: number; rows_clean: number; rows_dropped: number; pct_dropped: number; daily_rows: number; monthly_rows: number; missing_days_interpolated: number; duplicates: number; negative_pm25: number };
  columns: Array<{ name: string; type: string; desc: string; role: string }>;
  engineered: Array<{ name: string; desc: string }>;
  missing: Array<{ col: string; missing: number; pct: number }>;
  gaps: { n_gaps: number; longest_gap_hours: number; median_gap_hours: number; gaps_over_24h: number };
  cleaning_steps: Array<{ step: string; detail: string; effect: string }>;
  numeric_summary: Array<{ col: string; label: string; min: number; max: number; mean: number; std: number; missing: number }>;
  categorical: { wind: Array<{ key: string; label: string; count: number; pct: number }>; season: Array<{ key: string; count: number; pct: number }>; aqi: Array<{ key: string; count: number; pct: number }> };
  rows_per_year: Array<{ year: number; rows: number; mean_pm25: number }>;
  sample_rows: Array<Record<string, unknown>>;
};

export default async function Page() {
  const d = await loadData<Dataset>("dataset");
  const o = d.overview;
  return (
    <PageShell
      module="1"
      title="Dataset, cleaning & feature engineering"
      description="The raw UCI file, what was wrong with it, what was done about it, and the extra columns that the later modules rely on. Structured vs unstructured data, data types, missing values and the cleaning steps are covered here."
      concepts={["Structured data", "Data types", "Missing values", "Data cleaning", "Feature engineering", "Aggregation"]}
    >
      <StatGrid cols={6}>
        <StatCard label="Raw rows" value={fmtInt(o.rows_raw)} hint={`${o.columns_raw} columns`} />
        <StatCard label="Expected hours" value={fmtInt(o.expected_hours)} hint="continuous clock, no gaps" />
        <StatCard label="Missing PM2.5" value={fmtInt(o.rows_dropped)} hint={`${o.pct_dropped}% of rows`} tone="warn" />
        <StatCard label="Clean hourly rows" value={fmtInt(o.rows_clean)} hint="used for all hourly stats" tone="good" />
        <StatCard label="Daily rows" value={fmtInt(o.daily_rows)} hint={`${o.missing_days_interpolated} days interpolated`} />
        <StatCard label="Monthly rows" value={fmtInt(o.monthly_rows)} hint="for seasonal models" />
      </StatGrid>

      <Section title="Source" subtitle={d.source}>
        <KV
          cols={2}
          items={[
            ["Dataset", d.title],
            ["Repository", <a key="u" href={d.source_url} className="underline underline-offset-2" target="_blank" rel="noreferrer">UCI ML Repository, dataset 381</a>],
            ["Granularity", "Hourly, one row per clock hour"],
            ["Period", `${o.start} to ${o.end}`],
            ["Target variable", "pm2.5 (µg/m³)"],
            ["Type", "Structured, tabular time series with one categorical column"],
          ]}
        />
      </Section>

      <Section title="Data dictionary" subtitle="Original columns and their roles. The timestamp is split across four integer columns in the raw file.">
        <DataTable
          rows={d.columns}
          columns={[
            { key: "name", header: "Column", render: (r) => <code className="text-xs">{r.name}</code> },
            { key: "type", header: "Type", render: (r) => <Badge variant="outline" className="rounded-md font-mono text-[10px]">{r.type}</Badge> },
            { key: "role", header: "Role", render: (r) => <Badge variant={r.role === "target" ? "default" : "secondary"} className="rounded-md text-[10px]">{r.role}</Badge> },
            { key: "desc", header: "Description" },
          ]}
        />
      </Section>

      <Section title="Missing values and gaps" subtitle="Only the target has missing values. They come in runs when the monitor was offline, not at random.">
        <div className="grid gap-4 lg:grid-cols-2">
          <DataTable
            rows={d.missing.filter((m) => m.col !== "No")}
            columns={[
              { key: "col", header: "Column", render: (r) => <code className="text-xs">{r.col}</code> },
              { key: "missing", header: "Missing", align: "right", render: (r) => fmtInt(r.missing) },
              { key: "pct", header: "%", align: "right", render: (r) => fmt(r.pct, 2) },
            ]}
          />
          <div className="space-y-3">
            <KV
              cols={1}
              items={[
                ["Number of missing runs", fmtInt(d.gaps.n_gaps)],
                ["Longest run", `${fmtInt(d.gaps.longest_gap_hours)} hours (${(d.gaps.longest_gap_hours / 24).toFixed(1)} days)`],
                ["Median run length", `${d.gaps.median_gap_hours} hours`],
                ["Runs longer than a day", fmtInt(d.gaps.gaps_over_24h)],
                ["Duplicate timestamps", fmtInt(o.duplicates)],
                ["Negative readings", fmtInt(o.negative_pm25)],
              ]}
            />
            <Note tone="info">
              Rows without a target cannot be used for statistics on PM2.5, so they are dropped (listwise deletion). For the daily series a whole day is missing only {o.missing_days_interpolated} times; those days are filled by linear interpolation in time so that time-series models see an unbroken sequence.
            </Note>
          </div>
        </div>
      </Section>

      <Section title="Cleaning steps" subtitle="Executed in order by pipeline/01_dataset.py.">
        <DataTable
          rows={d.cleaning_steps.map((s, i) => ({ ...s, i: i + 1 }))}
          columns={[
            { key: "i", header: "#", align: "center" },
            { key: "step", header: "Step", className: "font-medium" },
            { key: "detail", header: "What" },
            { key: "effect", header: "Effect" },
          ]}
        />
      </Section>

      <Section title="Engineered features" subtitle="Columns added for later modules.">
        <DataTable rows={d.engineered} columns={[{ key: "name", header: "Feature", render: (r) => <code className="text-xs">{r.name}</code> }, { key: "desc", header: "Definition" }]} />
      </Section>

      <Section title="Numeric summary of the clean table">
        <DataTable
          rows={d.numeric_summary}
          columns={[
            { key: "label", header: "Variable" },
            { key: "min", header: "Min", align: "right", render: (r) => fmt(r.min, 1) },
            { key: "max", header: "Max", align: "right", render: (r) => fmt(r.max, 1) },
            { key: "mean", header: "Mean", align: "right", render: (r) => fmt(r.mean, 2) },
            { key: "std", header: "Std", align: "right", render: (r) => fmt(r.std, 2) },
            { key: "missing", header: "Missing (raw)", align: "right", render: (r) => fmtInt(r.missing) },
          ]}
        />
      </Section>

      <Section title="Categorical variables" subtitle="Frequency of the wind direction categories, the derived season and the EPA category of each hour.">
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Wind direction (cbwd)">
            <CategoryBars data={d.categorical.wind} xKey="key" yKey="count" colors={WIND_COLORS} height={220} yLabel="hours" />
          </ChartCard>
          <ChartCard title="Season">
            <CategoryBars data={d.categorical.season} xKey="key" yKey="count" colors={SEASON_COLORS} height={220} yLabel="hours" />
          </ChartCard>
          <ChartCard title="EPA category">
            <Donut data={d.categorical.aqi} nameKey="key" valueKey="count" colors={AQI_COLORS} height={220} />
          </ChartCard>
        </div>
      </Section>

      <Section title="Rows per year" subtitle="Coverage is even; 2010 and 2011 have slightly more sensor downtime.">
        <DataTable
          rows={d.rows_per_year}
          columns={[
            { key: "year", header: "Year" },
            { key: "rows", header: "Valid hours", align: "right", render: (r) => fmtInt(r.rows) },
            { key: "coverage", header: "Coverage", align: "right", render: (r) => `${((100 * r.rows) / (r.year % 4 === 0 ? 8784 : 8760)).toFixed(1)}%` },
            { key: "mean_pm25", header: "Mean PM2.5", align: "right", render: (r) => fmt(r.mean_pm25, 1) },
          ]}
        />
      </Section>

      <Section title="Sample rows" subtitle="First twelve valid hours of the clean table.">
        <DataTable
          rows={d.sample_rows}
          columns={[
            { key: "dt", header: "Timestamp" },
            { key: "pm25", header: "PM2.5", align: "right" },
            { key: "DEWP", header: "DEWP", align: "right" },
            { key: "TEMP", header: "TEMP", align: "right" },
            { key: "PRES", header: "PRES", align: "right" },
            { key: "cbwd", header: "Wind" },
            { key: "Iws", header: "Iws", align: "right" },
            { key: "Is", header: "Is", align: "right" },
            { key: "Ir", header: "Ir", align: "right" },
            { key: "season", header: "Season" },
            { key: "aqi_category", header: "EPA category" },
          ]}
        />
      </Section>
    </PageShell>
  );
}
