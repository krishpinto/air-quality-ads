import { loadData } from "@/lib/data";
import { PageShell } from "@/components/layout/page-shell";
import { UnitSection, SubSection, What, FormulaBlock, Worked, Result, Interpretation } from "@/components/syllabus";
import { ChartCard, DataTable, KV, Note } from "@/components/blocks";
import { Formula, Tex } from "@/components/formula";
import { BandLines } from "@/components/charts/xy";
import { Histogram } from "@/components/charts/series";
import { ProcessDiagram } from "@/components/unit-1/process-diagram";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmt, fmtInt, monthYear, shortDate } from "@/lib/format";

/* ------------------------------------------------------------------ JSON type (mirrors pipeline/unit1_process.py) */
type Group = { group: string; mean_cnt: number; days: number };
type Corr = { n: number; x_mean: number; y_mean: number; sum_x2: number; sum_y2: number; sum_xy: number; r: number };
type ColumnRow = { name: string; type: string; meaning: string; min: number | string; max: number | string; distinct: number };
type Question = { question: string; unit: string };
type TaskRow = { task: string; description: string; algorithms: string; here: string; unit: string };
type ExploreRow = { attribute: string; label: string; n: number; mean: number; median: number; sd: number; min: number; max: number; mean_minus_median: number; gap_pct_of_median: number };
type CleanRow = { issue: string; class_example: string; checked: string; found: string; count: number; fix: string; result: string };
type TypeRow = { column: string; raw_type: string; converted: string; example: string };
type DenormRow = { raw: string; factor: number; new: string; unit: string; example_raw: number; example_new: number; min: number; max: number };
type DerivedRow = { name: string; rule: string; example: string };
type KeptRow = { column: string; role: string; units: string };
type DroppedRow = { column: string; why: string };
type Split = { rule: string; why_chronological: string; train_start: string; train_end: string; test_start: string; test_end: string; train_days: number; test_days: number; train_pct: number; test_pct: number; train_months: number; test_months: number; boundary: string };
type HoldoutRow = { date: string; temp_c: number; cnt: number; pred: number; abs_err: number };
type FoldRow = { fold: number; val_start: string; val_end: string; n_val: number; n_train: number; a: number; b: number; mae: number };
type LooRow = { iteration: number; month: string; temp_c: number; cnt: number; a: number; b: number; pred: number; abs_err: number };
type BootRow = { sample: number; size: number; distinct_days: number; repeated_draws: number; max_times_one_day: number; first_draws: string[]; a: number; b: number; mae: number };
type Bin = { x0: number; x1: number; mid: number; count: number; density: number };
type MonthRow = { month: number; label: string; days: number; total: number; mean_per_day: number; mean_temp_c: number; rain_days: number; holidays: number; working_days: number };

type Unit1 = {
  prep: { rows_raw: number; columns_raw: number; start: string; end: string; expected_days: number; duplicates: number; rows_clean: number; rows_dropped: number; monthly_rows: number; quarterly_rows: number; train_days: number; test_days: number; train_months: number; test_months: number; test_start: string; invalid_fixed: Array<{ date: string; was: number; replaced_with_pct: number }> };
  s1_1: {
    source: { name: string; authors: string; system: string; file: string; weather_source: string; holiday_source: string };
    rows: number; columns: number; start: string; end: string; columns_table: ColumnRow[];
    target: { mean: number; median: number; min: number; max: number; min_date: string; max_date: string; share_registered: number };
    by_weather: Group[]; by_daytype: Group[]; by_season: Group[]; corr_temp_cnt: Corr;
  };
  s1_2: {
    volume: { rows: number; columns: number; cells: number; file_kb: number; years: number; days_per_year: number };
    dimensions: { attributes: number; numeric: number; category: number; id_and_date: number; weather_predictors: number; calendar_predictors: number; numeric_cols: string[]; category_cols: string[] };
    complexity: { confirmatory: Question[]; exploratory: Question[] };
    tasks_used: TaskRow[]; tasks_not_used: Array<{ task: string; why: string }>;
  };
  s1_3: {
    explore: ExploreRow[]; clean: CleanRow[]; types: TypeRow[]; denormalise: DenormRow[]; derived: DerivedRow[]; kept: KeptRow[]; dropped: DroppedRow[];
    sampling: { rows: number; needed: boolean; why: string }; split: Split; daily_series: Array<{ date: string; cnt: number }>;
  };
  s1_4: {
    model: { x: string; y: string; form: string };
    holdout: { a: number; b: number; n_train: number; n_test: number; mae_train: number; mae_test: number; sum_abs_err_train: number; sum_abs_err_test: number; sample_rows: HoldoutRow[] };
    kfold: { k: number; folds: FoldRow[]; sum_mae: number; mae_cv: number; mae_min: number; mae_max: number };
    loocv: { n: number; rows: LooRow[]; sum_abs_err: number; mae: number; models_if_daily: number };
    bootstrap: { B_shown: number; B_full: number; size: number; seed: number; samples: BootRow[]; slope_mean: number; slope_sd: number; slope_lo: number; slope_hi: number; slope_min: number; slope_max: number; intercept_mean: number; slope_hist: Bin[] };
  };
  s1_5: {
    year: number; months: MonthRow[]; best_month: MonthRow;
    december_drop: { nov: MonthRow; dec: MonthRow; drop_total: number; drop_pct: number; temp_change: number };
    science: { question: string; last_quarter: string; last_quarter_mean: number; last_quarter_total: number; next_quarter: string; unit: string };
  };
  headline: { a: number; b: number; holdout_mae_train: number; holdout_mae_test: number; kfold_mae_cv: number; loocv_mae: number; bootstrap_slope_mean: number; bootstrap_slope_lo: number; bootstrap_slope_hi: number; train_days: number; test_days: number; rows: number };
};

/* ------------------------------------------------------------------ static teaching text (no numbers) */
const DS_VS_DA: Array<[string, string, string]> = [
  ["Meaning", "A broad field that uses scientific methods, algorithms, and systems to extract knowledge from data", "Focuses on examining data to find patterns, trends, and insights"],
  ["Scope", "Very broad (includes analytics, ML, AI, statistics, big data)", "Narrower (subset of data science)"],
  ["Main Goal", "Predict future outcomes and build intelligent systems", "Understand past and present data to support decisions"],
  ["Type of Analysis", "Descriptive, Diagnostic, Predictive, Prescriptive", "Mostly Descriptive and Diagnostic"],
  ["Techniques Used", "Machine Learning, Deep Learning, Statistics, Data Mining", "Statistical analysis, querying, visualization"],
  ["Data Types", "Structured, Semi-structured, Unstructured (text, images, audio)", "Mostly Structured data"],
  ["Tools", "Python, R, TensorFlow, PyTorch, Spark", "Excel, SQL, Power BI, Tableau"],
  ["Programming", "Strong programming skills required", "Basic to moderate programming"],
  ["Outcome", "Models, predictions, automated decision systems", "Reports, dashboards, insights"],
  ["Example Question", "Will customers stop using our service next month?", "Why did sales drop last quarter?"],
];

const DOMAINS: Array<{ name: string; items: string; here?: string }> = [
  { name: "Healthcare", items: "Disease prediction, medical imaging, drug discovery" },
  { name: "Finance & Banking", items: "Fraud detection, algorithmic trading, credit scoring" },
  { name: "Retail & E-Commerce", items: "Recommendation engines, demand forecasting, dynamic pricing, customer segmentation" },
  { name: "Transportation & Logistics", items: "Autonomous vehicles, route optimisation, demand prediction (ride-hailing, dynamic pricing)", here: "This project sits here: forecasting bike-sharing demand is demand prediction for a city transport system." },
  { name: "Marketing & Social Media", items: "Targeted advertising, sentiment analysis, churn prediction, chatbots" },
  { name: "Entertainment & Media", items: "Content recommendation, automated tagging, churn and retention" },
];

const mono = "font-mono text-xs";

export default async function Unit1Page() {
  const d = await loadData<Unit1>("unit1");
  const { prep, s1_1, s1_2, s1_3, s1_4, s1_5, headline } = d;
  const ho = s1_4.holdout, kf = s1_4.kfold, loo = s1_4.loocv, bs = s1_4.bootstrap, sp = s1_3.split;
  const cntRow = s1_3.explore.find((e) => e.attribute === "cnt")!;
  const windRow = s1_3.explore.find((e) => e.attribute === "wind_kmh")!;
  const fixed = prep.invalid_fixed[0];
  const drop = s1_5.december_drop;
  const weather = (g: string) => s1_1.by_weather.find((w) => w.group === g)!;
  const daytype = (g: string) => s1_1.by_daytype.find((w) => w.group === g)!;
  const gapWord = (g: number) => (Math.abs(g) < 2 ? "close together, so no skew there" : Math.abs(g) < 10 ? "a little apart, a slight tail on one side" : "far apart - a red flag that extreme values are dragging the average");

  return (
    <PageShell
      module="1"
      title="Introduction to Data Science"
      description={`This unit sets up the whole project. It states the objective, describes the ${fmtInt(s1_1.rows)} days and ${s1_1.columns} columns of the Capital Bikeshare data, walks through the Data Science Process as drawn in class, prepares the data (explore, clean, transform, split into ${fmtInt(sp.train_days)} training and ${fmtInt(sp.test_days)} test days) and shows how a model is validated with hold-out, k-fold cross-validation, leave-one-out and bootstrapping. Every later unit reads the tables built here.`}
      concepts={["Data Science Process", "Volume, Dimensions and Complexity", "Data Science Tasks", "Data Preparation", "Cross Validation", "K-fold", "Leave-1 out", "Bootstrapping", "Data science vs data analytics", "Applications"]}
    >
      {/* ============================================================ 1.1 */}
      <UnitSection number="1.1" title="Introduction to Data Science and the Data Science Process">
        <What>
          <p>
            &ldquo;Data Science is an interdisciplinary field involving collecting, processing, storing, analyzing, and interpreting large volumes of structured and unstructured data to extract meaningful insights and knowledge.&rdquo; It is also known as Knowledge Discovery, Machine Learning, Predictive Analytics and Data Mining. The Data Science Process is the five-stage path from prior knowledge to knowledge: the process begins before any data is touched.
          </p>
        </What>

        <Worked title="The Data Science Process as drawn in class, with each unit of this project placed on its stage. The highlighted stages are the ones this unit covers.">
          <ProcessDiagram highlight={[1, 2]} />
        </Worked>

        <Worked title="1. Prior knowledge for this project, in the teacher's four sub-steps.">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-2 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-sm">1.1 Objective</CardTitle>
                <CardDescription className="text-xs">&ldquo;The process starts with a business objective or analytical question - the most important step in the lifecycle.&rdquo;</CardDescription>
              </CardHeader>
              <CardContent className="px-4 text-sm leading-relaxed">
                <p className="font-medium">Can we describe, explain and forecast the number of bike rentals per day in Washington DC from weather and calendar information?</p>
                <p className="mt-2 text-muted-foreground">Describe → Unit 2. Explain (is the difference real, which inputs matter) → Units 3 and 4. Find the unusual days → Unit 5. Forecast → Unit 6.</p>
              </CardContent>
            </Card>
            <Card className="gap-2 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <CardTitle className="text-sm">1.2 Subject area (domain knowledge)</CardTitle>
                <CardDescription className="text-xs">&ldquo;Data reveals patterns, but domain knowledge decides which patterns matter.&rdquo;</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-4 text-sm leading-relaxed">
                <p>{s1_1.source.system.split(",")[0]} is a public bike-sharing system: a rider picks up a bike at one station and returns it at another. {Math.round(100 * s1_1.target.share_registered)} % of rentals are by registered members, who mostly commute, so working days matter. Riding is outdoors, so rain, cold and wind keep people off bikes.</p>
                <KV
                  cols={1}
                  items={[
                    [`Mean rentals, ${weather("Clear").group.toLowerCase()} days (${weather("Clear").days} days)`, fmtInt(weather("Clear").mean_cnt)],
                    [`Mean rentals, ${weather("Light rain / snow").group.toLowerCase()} days (${weather("Light rain / snow").days} days)`, fmtInt(weather("Light rain / snow").mean_cnt)],
                    [`Mean rentals, working days (${daytype("Working day").days} days)`, fmtInt(daytype("Working day").mean_cnt)],
                    [`Mean rentals, holidays (${daytype("Holiday").days} days)`, fmtInt(daytype("Holiday").mean_cnt)],
                  ]}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="gap-2 py-4 shadow-none">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm">1.3 Data</CardTitle>
              <CardDescription className="text-xs">
                &ldquo;A data science model is only as good as the data used to build it.&rdquo; Source: {s1_1.source.name}, {s1_1.source.authors}. File {s1_1.source.file}: {fmtInt(s1_1.rows)} rows (one per day, {shortDate(s1_1.start)} to {shortDate(s1_1.end)}) × {s1_1.columns} columns. Weather from {s1_1.source.weather_source}; holidays from the {s1_1.source.holiday_source}. The four weather columns arrive normalised (divided by a maximum so they lie between 0 and 1); they are de-normalised in 1.3 so that one unit means 1 °C, 1 % or 1 km/h.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <DataTable<ColumnRow>
                rows={s1_1.columns_table}
                rowKey={(r) => r.name}
                columns={[
                  { key: "name", header: "Column", render: (r) => <span className={mono}>{r.name}</span> },
                  { key: "type", header: "Type" },
                  { key: "meaning", header: "Meaning", className: "whitespace-normal" },
                  { key: "min", header: "Min", align: "right", render: (r) => (typeof r.min === "number" ? fmt(r.min, Number.isInteger(r.min) ? 0 : 3) : r.min) },
                  { key: "max", header: "Max", align: "right", render: (r) => (typeof r.max === "number" ? fmt(r.max, Number.isInteger(r.max) ? 0 : 3) : r.max) },
                  { key: "distinct", header: "Distinct values", align: "right", render: (r) => fmtInt(r.distinct) },
                ]}
              />
            </CardContent>
          </Card>

          <Card className="gap-2 py-4 shadow-none">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm">1.4 Correlation vs causation</CardTitle>
              <CardDescription className="text-xs">&ldquo;Correlation indicates a statistical relationship between variables; causation implies one variable directly influences another. Correlation does not guarantee causation.&rdquo;</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 px-4 text-sm leading-relaxed">
              <p>
                Temperature and rentals move together: Karl Pearson&rsquo;s r = {fmt(s1_1.corr_temp_cnt.r, 3)} on the {fmtInt(s1_1.corr_temp_cnt.n)} days (computed properly in Unit 2). The business-sensible direction is <span className="font-medium">temperature → rentals</span>: a warm day brings riders out.
              </p>
              <p>
                The incorrect question would be &ldquo;Can we predict the temperature from the number of rentals?&rdquo; - technically possible, but business-wise wrong: rentals do not cause warm weather. So every model in this project has <Tex>{"\\text{cnt}"}</Tex> as the target and weather and calendar as inputs, never the other way round. &ldquo;Correlation can mislead; causation must guide model design.&rdquo;
              </p>
            </CardContent>
          </Card>
        </Worked>

        <Result
          items={[
            { label: "Rows (days)", value: fmtInt(s1_1.rows), hint: `${shortDate(s1_1.start)} – ${shortDate(s1_1.end)}` },
            { label: "Columns", value: s1_1.columns, hint: "16 raw attributes" },
            { label: "Target: mean rentals per day", value: fmtInt(s1_1.target.mean), hint: `min ${fmtInt(s1_1.target.min)} (${shortDate(s1_1.target.min_date)}), max ${fmtInt(s1_1.target.max)} (${shortDate(s1_1.target.max_date)})` },
            { label: "r (temperature, rentals)", value: fmt(s1_1.corr_temp_cnt.r, 3), hint: "direction: temperature → rentals" },
          ]}
        />
        <Interpretation>
          The objective is one clear question, the subject area tells us which inputs should matter (weather and working days), the data is {fmtInt(s1_1.rows)} complete days, and the causal direction is fixed before any model is built: weather explains rentals, not the reverse.
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 1.2 */}
      <UnitSection number="1.2" title="Motivation: Volume, Dimensions and Complexity; Data Science Tasks">
        <What>
          <p>
            Why data science, why now - three headings. <span className="font-medium">Volume</span>: how much data there is. <span className="font-medium">Dimensionality</span>: how many attributes describe each record; &ldquo;more attributes, more dimensions, more complexity&rdquo;. <span className="font-medium">Complexity</span>: how hard the question is to answer - a <span className="font-medium">confirmatory</span> question validates a hypothesis you already have (traditional statistics), an <span className="font-medium">exploratory</span> question searches for a model that predicts the output from the inputs (machine learning). &ldquo;We need both exploratory and confirmatory&rdquo; (Tukey, 1980).
          </p>
        </What>
        <Worked title="The three ideas applied to this dataset.">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="gap-2 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="font-mono text-[11px]">01 VOLUME</CardDescription>
                <CardTitle className="text-sm">How much data there is</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 text-sm">
                <KV cols={1} items={[["Rows", fmtInt(s1_2.volume.rows)], ["Columns", s1_2.volume.columns], ["Cells", fmtInt(s1_2.volume.cells)], ["Size in memory", `${fmt(s1_2.volume.file_kb, 0)} KB`]]} />
                <p className="text-muted-foreground">Honestly: volume is not the challenge here. One row per day for {s1_2.volume.years} years is small; every method on this site runs in seconds. The class point about volume (storage, processing time) applies to the hourly version of this data and to the city&rsquo;s trip-level log, not to this table.</p>
              </CardContent>
            </Card>
            <Card className="gap-2 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="font-mono text-[11px]">02 DIMENSIONS</CardDescription>
                <CardTitle className="text-sm">How many attributes per record</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 text-sm">
                <KV cols={1} items={[["Attributes", s1_2.dimensions.attributes], ["Numeric", s1_2.dimensions.numeric], ["Category codes", s1_2.dimensions.category], ["Id and date", s1_2.dimensions.id_and_date], ["Weather predictors", s1_2.dimensions.weather_predictors], ["Calendar predictors", s1_2.dimensions.calendar_predictors]]} />
                <p className="text-muted-foreground">Each day carries {s1_2.dimensions.weather_predictors} weather and {s1_2.dimensions.calendar_predictors} calendar attributes. One input → simple regression (Unit 4.1); several inputs → multiple regression (Unit 4.3). This is where the work is.</p>
              </CardContent>
            </Card>
            <Card className="gap-2 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="font-mono text-[11px]">03 COMPLEXITY</CardDescription>
                <CardTitle className="text-sm">How hard the question is</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmatory → Unit 3</p>
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                  {s1_2.complexity.confirmatory.map((q) => (
                    <li key={q.question}>{q.question} <span className="text-xs">({q.unit})</span></li>
                  ))}
                </ul>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Exploratory → Units 4–6</p>
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                  {s1_2.complexity.exploratory.map((q) => (
                    <li key={q.question}>{q.question} <span className="text-xs">({q.unit})</span></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </Worked>
        <Worked title="Data science tasks (the class task table), reduced to the rows this project uses.">
          <DataTable<TaskRow>
            rows={s1_2.tasks_used}
            rowKey={(r) => r.task}
            columns={[
              { key: "task", header: "Task", className: "font-medium" },
              { key: "description", header: "Description", className: "whitespace-normal" },
              { key: "algorithms", header: "Algorithms", className: "whitespace-normal" },
              { key: "here", header: "In this project", className: "whitespace-normal" },
              { key: "unit", header: "Unit" },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            Not used: {s1_2.tasks_not_used.map((t, i) => (
              <span key={t.task}>
                <span className="font-medium text-foreground">{t.task}</span> ({t.why}){i < s1_2.tasks_not_used.length - 1 ? "; " : "."}
              </span>
            ))}
          </p>
        </Worked>
        <Result items={[{ label: "Volume", value: `${fmtInt(s1_2.volume.rows)} × ${s1_2.volume.columns}`, hint: `${fmtInt(s1_2.volume.cells)} cells - small` }, { label: "Dimensions", value: s1_2.dimensions.attributes, hint: `${s1_2.dimensions.weather_predictors + s1_2.dimensions.calendar_predictors} predictors, 1 target` }, { label: "Tasks used", value: s1_2.tasks_used.length, hint: "regression, anomaly detection, forecasting" }]} />
        <Interpretation>
          The data is small, so the motivation here is dimensions and complexity, not volume: several attributes describe each day, and the questions are both confirmatory (is the difference real?) and exploratory (what will happen next?). Tukey&rsquo;s point - we need both - is exactly the plan of this project.
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 1.3 */}
      <UnitSection number="1.3" title="Overview of Data Preparation">
        <What>
          <p>
            Step 2 of the process: prepare data. &ldquo;Step 2-A: Explore&rdquo; is done first - descriptive statistics and a visualization expose the dataset&rsquo;s structure and hint that something is off. &ldquo;Step 2-B: Pre-process&rdquo; is done after exploring, in two parts: <span className="font-medium">Clean</span> (inconsistent values, duplicates, missing values, invalid data, outliers) and <span className="font-medium">Transform</span> (data types and conversion, transformation, feature selection, sampling, training/test split). &ldquo;~80 % of a data scientist&rsquo;s time is spent cleaning data, not building models.&rdquo;
          </p>
        </What>

        <SubSection title="Step 2-A · Explore first">
          <FormulaBlock
            tex={["\\bar{X} = \\frac{\\sum X}{N} \\qquad \\text{Median} = \\text{middle value of the sorted series} \\qquad \\sigma = \\sqrt{\\frac{\\sum (X - \\bar{X})^2}{N}}"]}
            note="σ is computed with ÷N, as taught. The full treatment of these measures is Unit 2; here they are only the quick look the teacher takes before cleaning."
          />
          <Worked title={`Quick statistics for the target and the three weather inputs (N = ${fmtInt(cntRow.n)} days).`}>
            <DataTable<ExploreRow>
              rows={s1_3.explore}
              rowKey={(r) => r.attribute}
              columns={[
                { key: "label", header: "Attribute", render: (r) => <span>{r.label} <span className={mono}>({r.attribute})</span></span> },
                { key: "mean", header: "Mean", align: "right", render: (r) => fmt(r.mean, 2) },
                { key: "median", header: "Median", align: "right", render: (r) => fmt(r.median, 2) },
                { key: "sd", header: "Std dev σ", align: "right", render: (r) => fmt(r.sd, 2) },
                { key: "min", header: "Min", align: "right", render: (r) => fmt(r.min, 2) },
                { key: "max", header: "Max", align: "right", render: (r) => fmt(r.max, 2) },
                { key: "gap", header: "Mean − Median", align: "right", render: (r) => `${fmt(r.mean_minus_median, 2)} (${fmt(r.gap_pct_of_median, 1)} % of median)` },
              ]}
            />
            <Note title="The teacher's mean-vs-median reading">
              {s1_3.explore.map((e) => (
                <span key={e.attribute}>
                  <span className="font-medium">{e.label}</span>: mean {fmt(e.mean, 1)} and median {fmt(e.median, 1)} are {gapWord(e.gap_pct_of_median)}.{" "}
                </span>
              ))}
              In the class example the income mean was more than double its median - the red flag for a single extreme value. Nothing like that appears here; the widest gap is wind speed at {fmt(windRow.gap_pct_of_median, 1)} % of its median, a small right tail (a few very windy days). The minimum of {fmtInt(cntRow.min)} rentals is far below everything else and is noted for the outlier check below.
            </Note>
          </Worked>
        </SubSection>

        <SubSection title="Step 2-B · Pre-process → Clean">
          <Worked title="The five issue types from class, what was checked, what was found. Numbers come from build_tables() in common.py, which every later unit reuses.">
            <DataTable<CleanRow>
              rows={s1_3.clean}
              rowKey={(r) => r.issue}
              columns={[
                { key: "issue", header: "Issue", className: "font-medium" },
                { key: "class_example", header: "Class example", className: "whitespace-normal text-muted-foreground" },
                { key: "checked", header: "What was checked", className: "whitespace-normal" },
                { key: "found", header: "Found in raw data", className: "whitespace-normal" },
                { key: "fix", header: "Fix applied", className: "whitespace-normal" },
                { key: "result", header: "Result", className: "whitespace-normal" },
              ]}
            />
          </Worked>
          <Result
            items={[
              { label: "Missing values", value: 0 },
              { label: "Duplicates", value: prep.duplicates },
              { label: "cnt = casual + registered", value: "every row" },
              { label: "Invalid value fixed", value: fixed ? 1 : 0, hint: fixed ? `${shortDate(fixed.date)}: humidity ${fixed.was} % → ${fmt(fixed.replaced_with_pct, 1)} %` : undefined },
              { label: "Rows after cleaning", value: fmtInt(prep.rows_clean), hint: `${prep.rows_dropped} dropped` },
            ]}
          />
        </SubSection>

        <SubSection title="Step 2-B · Pre-process → Transform">
          <Worked title="Data types and conversion: codes become labels, text becomes a date.">
            <DataTable<TypeRow>
              rows={s1_3.types}
              rowKey={(r) => r.column}
              columns={[
                { key: "column", header: "Column", render: (r) => <span className={mono}>{r.column}</span> },
                { key: "raw_type", header: "Raw type" },
                { key: "converted", header: "Converted to" },
                { key: "example", header: "First row", className: "whitespace-normal" },
              ]}
            />
          </Worked>
          <Worked title="Transformation: de-normalisation. The raw file divided each weather value by its maximum; we multiply back so a 1-unit change means 1 °C, 1 % or 1 km/h (needed for reading a regression slope in Unit 4).">
            <DataTable<DenormRow>
              rows={s1_3.denormalise}
              rowKey={(r) => r.raw}
              columns={[
                { key: "raw", header: "Raw column", render: (r) => <span className={mono}>{r.raw}</span> },
                { key: "factor", header: "× factor", align: "right" },
                { key: "new", header: "New column", render: (r) => <span className={mono}>{r.new}</span> },
                { key: "unit", header: "Unit" },
                { key: "example", header: "First row", align: "right", render: (r) => `${fmt(r.example_raw, 4)} → ${fmt(r.example_new, 1)} ${r.unit}` },
                { key: "min", header: "Min", align: "right", render: (r) => fmt(r.min, 1) },
                { key: "max", header: "Max", align: "right", render: (r) => fmt(r.max, 1) },
              ]}
            />
          </Worked>
          <Worked title="Derived attributes.">
            <DataTable<DerivedRow>
              rows={s1_3.derived}
              rowKey={(r) => r.name}
              columns={[
                { key: "name", header: "Attribute", render: (r) => <span className={mono}>{r.name}</span> },
                { key: "rule", header: "Rule", className: "whitespace-normal" },
                { key: "example", header: "Example", className: "whitespace-normal" },
              ]}
            />
          </Worked>
          <Worked title="Feature selection: which columns go forward to Units 2–6 and which are dropped (like dropping borrower_id in class).">
            <div className="grid gap-4 lg:grid-cols-2">
              <DataTable<KeptRow>
                rows={s1_3.kept}
                rowKey={(r) => r.column}
                columns={[
                  { key: "column", header: "Kept", render: (r) => <span className={mono}>{r.column}</span>, className: "whitespace-normal" },
                  { key: "role", header: "Role", className: "whitespace-normal" },
                  { key: "units", header: "Used in" },
                ]}
              />
              <DataTable<DroppedRow>
                rows={s1_3.dropped}
                rowKey={(r) => r.column}
                columns={[
                  { key: "column", header: "Dropped", render: (r) => <span className={mono}>{r.column}</span>, className: "whitespace-normal" },
                  { key: "why", header: "Why", className: "whitespace-normal" },
                ]}
              />
            </div>
            <Note>
              <span className="font-medium">Data sampling:</span> not needed. {s1_3.sampling.why}.
            </Note>
          </Worked>
          <Worked title={`Training / test split. Class rule of thumb: "${sp.rule}". Here the split is chronological because ${sp.why_chronological}.`}>
            <ChartCard title="Daily rentals with the split boundary" description={`Train = ${shortDate(sp.train_start)} to ${shortDate(sp.train_end)} (${fmtInt(sp.train_days)} days, ${sp.train_months} months). Test = ${shortDate(sp.test_start)} to ${shortDate(sp.test_end)} (${fmtInt(sp.test_days)} days, ${sp.test_months} months).`}>
              <BandLines data={s1_3.daily_series} xKey="date" lines={[{ key: "cnt", label: "Rentals per day", width: 1.2 }]} xFormat="monthYearShort" yLabel="rentals / day" splitAt={sp.boundary} height={280} />
            </ChartCard>
          </Worked>
          <Result
            items={[
              { label: "Training days", value: fmtInt(sp.train_days), hint: `${fmt(sp.train_pct, 1)} % · ${shortDate(sp.train_start)} – ${shortDate(sp.train_end)}` },
              { label: "Test days", value: fmtInt(sp.test_days), hint: `${fmt(sp.test_pct, 1)} % · ${shortDate(sp.test_start)} – ${shortDate(sp.test_end)}` },
              { label: "Tables built", value: `${fmtInt(prep.rows_clean)} / ${prep.monthly_rows} / ${prep.quarterly_rows}`, hint: "daily / monthly / quarterly rows" },
            ]}
          />
          <Interpretation>
            The data was already clean except for one impossible value, so almost all the preparation work is transformation: de-normalising the weather, labelling the codes, deriving the calendar attributes and the time index, and fixing the chronological split ({fmt(sp.train_pct, 0)} % / {fmt(sp.test_pct, 0)} %, close to two-thirds / one-third) that Units 4, 5 and 6 reuse.
          </Interpretation>
        </SubSection>
      </UnitSection>

      {/* ============================================================ 1.4 */}
      <UnitSection number="1.4" title="Model building, Cross Validation, K-fold, Leave-one-out, Bootstrapping">
        <What>
          <p>
            Modeling is &ldquo;building a representative model - abstracted from training data, validated against test data&rdquo;. A single train/test split can be misleading: &ldquo;a lucky split can make a weak model look great; an unlucky split can make a good model look bad&rdquo;. Cross-validation fixes this: &ldquo;every record takes a turn in the validation set - nothing is wasted&rdquo;, and averaging across folds smooths out any one unusual split. Bootstrapping is &ldquo;the process of generating bootstrapped samples from the given dataset. The samples are formulated by randomly drawing the data points with replacement. The size of the sample is usually the same as the original dataset.&rdquo;
          </p>
        </What>
        <FormulaBlock
          tex={["Y = a + bX \\qquad (\\text{the model being validated: rentals from temperature})", "\\text{MAE} = \\frac{1}{n}\\sum |Y - \\hat{Y}|", "\\text{Accuracy}_{cv} = \\frac{1}{k}\\sum_{i=1}^{k} \\text{Accuracy}_i \\quad\\Rightarrow\\quad \\text{MAE}_{cv} = \\frac{1}{k}\\sum_{i=1}^{k} \\text{MAE}_i"]}
          where={[
            ["Y", "rentals per day (cnt)"],
            ["X", "temperature in °C (temp_c)"],
            ["a, b", "intercept and slope, fitted by least squares on the training rows (the formulas are Unit 4's job)"],
            ["\\hat{Y}", "the model's prediction a + bX"],
            ["k", "number of folds"],
          ]}
          note="The class formula averages an accuracy over the folds. Our target is a number, so the score per fold is an error (MAE) instead of an accuracy; the averaging is the same."
        />

        <SubSection title="Hold-out validation">
          <Worked title={`Fit the line once on the ${fmtInt(ho.n_train)} training days, then measure MAE on the training days and on the ${fmtInt(ho.n_test)} test days the model never saw. A few test rows show how |Y − Ŷ| is formed.`}>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <DataTable<HoldoutRow>
                rows={ho.sample_rows}
                rowKey={(r) => r.date}
                columns={[
                  { key: "date", header: "Test day", render: (r) => shortDate(r.date) },
                  { key: "temp_c", header: "X = temp °C", align: "right", render: (r) => fmt(r.temp_c, 1) },
                  { key: "cnt", header: "Y = cnt", align: "right", render: (r) => fmtInt(r.cnt) },
                  { key: "pred", header: "Ŷ = a + bX", align: "right", render: (r) => fmtInt(r.pred) },
                  { key: "abs_err", header: "|Y − Ŷ|", align: "right", render: (r) => fmtInt(r.abs_err) },
                ]}
              />
              <KV cols={1} items={[["a (intercept)", fmt(ho.a, 2)], ["b (slope)", fmt(ho.b, 2)], ["Σ|Y − Ŷ| train", fmtInt(ho.sum_abs_err_train)], ["÷ n train", fmtInt(ho.n_train)], ["Σ|Y − Ŷ| test", fmtInt(ho.sum_abs_err_test)], ["÷ n test", fmtInt(ho.n_test)]]} />
            </div>
          </Worked>
          <Result items={[{ label: "MAE on training days", value: fmt(ho.mae_train, 1), hint: `${fmtInt(ho.sum_abs_err_train)} ÷ ${fmtInt(ho.n_train)}` }, { label: "MAE on test days", value: fmt(ho.mae_test, 1), hint: `${fmtInt(ho.sum_abs_err_test)} ÷ ${fmtInt(ho.n_test)}` }]} />
          <Interpretation>
            The test error is {fmt(ho.mae_test / ho.mae_train, 2)} × the training error. The model is scored once on one split, and the test months (July–December 2012) sit higher than anything the line was fitted on, so this single score &ldquo;depends entirely on which records happen to land in the test set&rdquo; - the reason the class moves on to cross-validation.
          </Interpretation>
        </SubSection>

        <SubSection title={`k-fold cross-validation (k = ${kf.k})`}>
          <Worked title={`The ${fmtInt(ho.n_train)} training days are cut into ${kf.k} consecutive blocks (no shuffling, so each fold is a stretch of time, like the class folds {01,02}, {03,04}, …). Each fold takes one turn as the validation set; the other ${kf.k - 1} folds train the line.`}>
            <DataTable<FoldRow>
              rows={kf.folds}
              rowKey={(r) => String(r.fold)}
              columns={[
                { key: "fold", header: "Fold", align: "center" },
                { key: "range", header: "Validation fold (held out)", render: (r) => `${shortDate(r.val_start)} – ${shortDate(r.val_end)}` },
                { key: "n_val", header: "n validation", align: "right" },
                { key: "n_train", header: "n training", align: "right" },
                { key: "a", header: "a", align: "right", render: (r) => fmt(r.a, 2) },
                { key: "b", header: "b", align: "right", render: (r) => fmt(r.b, 2) },
                { key: "mae", header: "MAEᵢ", align: "right", render: (r) => fmt(r.mae, 1) },
              ]}
            />
            <Formula tex={`\\text{MAE}_{cv} = \\frac{1}{${kf.k}}\\left(${kf.folds.map((f) => fmt(f.mae, 1).replace(/,/g, "{,}")).join(" + ")}\\right) = \\frac{${fmt(kf.sum_mae, 1).replace(/,/g, "{,}")}}{${kf.k}} = ${fmt(kf.mae_cv, 1).replace(/,/g, "{,}")}`} />
          </Worked>
          <Result items={[{ label: "MAE_cv (mean of 5 folds)", value: fmt(kf.mae_cv, 1) }, { label: "Lowest fold MAE", value: fmt(kf.mae_min, 1) }, { label: "Highest fold MAE", value: fmt(kf.mae_max, 1) }]} />
          <Interpretation>
            Every training day validated the model exactly once and trained it {kf.k - 1} times. The fold errors range from {fmt(kf.mae_min, 0)} to {fmt(kf.mae_max, 0)} - the spread the single hold-out score could never show. The cross-validated estimate, {fmt(kf.mae_cv, 0)}, is more honest than the one training-set number ({fmt(ho.mae_train, 0)}).
          </Interpretation>
        </SubSection>

        <SubSection title="Leave-one-out (LOOCV)">
          <Worked title={`"The most exhaustive form of k-fold: k equals the number of records." Used on a SMALL dataset: the ${loo.n} training months (mean rentals per day and mean temperature in each month). Each iteration holds out one month, fits the line on the other ${loo.n - 1}, and predicts the held-out month.`}>
            <DataTable<LooRow>
              rows={loo.rows}
              rowKey={(r) => r.month}
              columns={[
                { key: "iteration", header: "Iteration", align: "center" },
                { key: "month", header: "Held-out month", render: (r) => monthYear(r.month) },
                { key: "temp_c", header: "X = mean temp °C", align: "right", render: (r) => fmt(r.temp_c, 1) },
                { key: "cnt", header: "Y = mean cnt", align: "right", render: (r) => fmtInt(r.cnt) },
                { key: "a", header: "a", align: "right", render: (r) => fmt(r.a, 1) },
                { key: "b", header: "b", align: "right", render: (r) => fmt(r.b, 1) },
                { key: "pred", header: "Ŷ", align: "right", render: (r) => fmtInt(r.pred) },
                { key: "abs_err", header: "|Y − Ŷ|", align: "right", render: (r) => fmtInt(r.abs_err) },
              ]}
            />
            <Formula tex={`\\text{MAE}_{loocv} = \\frac{\\sum |Y - \\hat{Y}|}{n} = \\frac{${fmtInt(loo.sum_abs_err).replace(/,/g, "{,}")}}{${loo.n}} = ${fmt(loo.mae, 1).replace(/,/g, "{,}")}`} />
          </Worked>
          <Result items={[{ label: "Models trained", value: loo.n, hint: "one per month" }, { label: "Mean MAE over the 18 months", value: fmt(loo.mae, 1), hint: "rentals per day, monthly means" }]} />
          <Interpretation>
            LOOCV is used for small datasets only; on {fmtInt(loo.models_if_daily)} days it would mean {fmtInt(loo.models_if_daily)} models. On {loo.n} months it costs {loo.n} fits and wastes no record. The error is smaller than the daily numbers above because monthly means are much smoother than single days.
          </Interpretation>
        </SubSection>

        <SubSection title="Bootstrapping">
          <Worked title={`B = ${bs.B_shown} bootstrap samples drawn with replacement from the ${fmtInt(bs.size)} training days, each the same size as the training set (seed ${bs.seed}). Because of replacement, some days are drawn more than once and others not at all - like the repeated 3s and 2s circled on the slide.`}>
            <DataTable<BootRow>
              rows={bs.samples}
              rowKey={(r) => String(r.sample)}
              columns={[
                { key: "sample", header: "Sample", align: "center" },
                { key: "size", header: "Size", align: "right" },
                { key: "distinct_days", header: "Distinct days", align: "right" },
                { key: "repeated_draws", header: "Repeated draws", align: "right" },
                { key: "max_times_one_day", header: "Most times one day drawn", align: "right" },
                { key: "first_draws", header: "First four draws", render: (r) => r.first_draws.map(shortDate).join(", ") },
                { key: "a", header: "a", align: "right", render: (r) => fmt(r.a, 2) },
                { key: "b", header: "b", align: "right", render: (r) => fmt(r.b, 2) },
                { key: "mae", header: "MAE on the sample", align: "right", render: (r) => fmt(r.mae, 1) },
              ]}
            />
            <ChartCard
              title={`Slope b from B = ${bs.B_full} bootstrap samples`}
              description={`Repeat the draw ${bs.B_full} times, fit the line on each sample and keep the slope. Mean of the ${bs.B_full} slopes = ${fmt(bs.slope_mean, 2)}; the middle 95 % lie between ${fmt(bs.slope_lo, 2)} and ${fmt(bs.slope_hi, 2)}; the full range is ${fmt(bs.slope_min, 2)} to ${fmt(bs.slope_max, 2)}. The hold-out slope on the original training set was ${fmt(ho.b, 2)}.`}
            >
              <Histogram bins={bs.slope_hist} mode="count" showNormal={false} label="Number of samples" xFormat="1dp" height={220} />
            </ChartCard>
          </Worked>
          <Result items={[{ label: "Mean slope b (200 samples)", value: fmt(bs.slope_mean, 2), hint: "rentals per °C" }, { label: "Middle 95 % of slopes", value: `${fmt(bs.slope_lo, 2)} – ${fmt(bs.slope_hi, 2)}` }, { label: "Spread of slopes (σ)", value: fmt(bs.slope_sd, 2) }]} />
          <Interpretation>
            Bootstrapping tells us how stable the slope is. Every resample gives a slightly different line, but all {bs.B_full} slopes stay between {fmt(bs.slope_min, 0)} and {fmt(bs.slope_max, 0)} rentals per °C and 95 % stay within {fmt(bs.slope_lo, 0)}–{fmt(bs.slope_hi, 0)}: the &ldquo;about {fmt(ho.b, 0)} extra rentals per degree&rdquo; finding does not depend on which particular days happened to be in the training set.
          </Interpretation>
        </SubSection>

        <Result
          items={[
            { label: "Hold-out MAE train / test", value: `${fmt(headline.holdout_mae_train, 0)} / ${fmt(headline.holdout_mae_test, 0)}` },
            { label: "5-fold MAE_cv", value: fmt(headline.kfold_mae_cv, 0) },
            { label: "LOOCV MAE (18 months)", value: fmt(headline.loocv_mae, 0) },
            { label: "Bootstrap slope", value: `${fmt(headline.bootstrap_slope_mean, 1)} (${fmt(headline.bootstrap_slope_lo, 1)} – ${fmt(headline.bootstrap_slope_hi, 1)})` },
          ]}
        />
        <Interpretation>
          Four ways of validating the same simple line give four views: one split says {fmt(ho.mae_test, 0)} on unseen days, five folds say {fmt(kf.mae_cv, 0)} on average with a wide spread, leave-one-out on months says {fmt(loo.mae, 0)}, and bootstrapping says the slope itself is stable. Temperature alone is a rough model (Unit 4 adds more inputs); what this section shows is how to measure that honestly.
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 1.5 */}
      <UnitSection number="1.5" title="Difference between data science and data analytics">
        <What>
          <p>
            Data analytics &ldquo;examines existing data to answer specific questions and explain what has already happened&rdquo; - descriptive and diagnostic, &ldquo;what happened and why&rdquo;. Data science &ldquo;builds models on data (often including analytics as a step) to predict future outcomes and automate decisions&rdquo; - predictive and prescriptive, &ldquo;what will happen and what to do&rdquo;. Analytics looks back; science looks ahead.
          </p>
        </What>
        <Worked title="The class comparison table.">
          <DataTable<{ aspect: string; science: string; analytics: string }>
            rows={DS_VS_DA.map(([aspect, science, analytics]) => ({ aspect, science, analytics }))}
            rowKey={(r) => r.aspect}
            columns={[
              { key: "aspect", header: "Aspect", className: "font-medium" },
              { key: "science", header: "Data Science", className: "whitespace-normal" },
              { key: "analytics", header: "Data Analytics", className: "whitespace-normal" },
            ]}
          />
        </Worked>
        <Worked title="The two kinds of question applied to this project, side by side.">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="gap-2 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="font-mono text-[11px]">ANALYTICS · LOOKS BACK</CardDescription>
                <CardTitle className="text-sm">Which month in {s1_5.year} had the most rentals? Why did rentals drop in December?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4">
                <DataTable<MonthRow>
                  rows={s1_5.months}
                  rowKey={(r) => r.label}
                  columns={[
                    { key: "label", header: "Month", render: (r) => <span className={r.month === s1_5.best_month.month ? "font-semibold" : undefined}>{r.label}</span> },
                    { key: "total", header: "Total rentals", align: "right", render: (r) => fmtInt(r.total) },
                    { key: "mean_per_day", header: "Mean / day", align: "right", render: (r) => fmtInt(r.mean_per_day) },
                    { key: "mean_temp_c", header: "Mean °C", align: "right", render: (r) => fmt(r.mean_temp_c, 1) },
                    { key: "rain_days", header: "Rain / snow days", align: "right" },
                    { key: "working_days", header: "Working days", align: "right" },
                  ]}
                />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Answer: <span className="font-medium text-foreground">{s1_5.best_month.label}</span> had the most rentals ({fmtInt(s1_5.best_month.total)}, {fmtInt(s1_5.best_month.mean_per_day)} per day). December fell {fmtInt(drop.drop_total)} rentals ({fmt(drop.drop_pct, 0)} %) below November: the mean temperature dropped by {fmt(Math.abs(drop.temp_change), 1)} °C (from {fmt(drop.nov.mean_temp_c, 1)} to {fmt(drop.dec.mean_temp_c, 1)}), there were {drop.dec.rain_days} rain or snow days against {drop.nov.rain_days}, and {drop.dec.working_days} working days against {drop.nov.working_days}. This is a report on what happened and why - a query and a table, no model.
                </p>
              </CardContent>
            </Card>
            <Card className="gap-2 py-4 shadow-none">
              <CardHeader className="px-4 pb-0">
                <CardDescription className="font-mono text-[11px]">DATA SCIENCE · LOOKS AHEAD</CardDescription>
                <CardTitle className="text-sm">{s1_5.science.question}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 text-sm leading-relaxed">
                <p>
                  The last quarter in the data, {s1_5.science.last_quarter}, averaged {fmtInt(s1_5.science.last_quarter_mean)} rentals per day ({fmtInt(s1_5.science.last_quarter_total)} in total). The question asks about {s1_5.science.next_quarter}, which is not in the data at all. No table can answer it; it needs a model of the trend and the seasonal pattern, fitted on the past and checked on held-out months.
                </p>
                <p className="text-muted-foreground">
                  That is {s1_5.science.unit}: decomposition into trend and seasonal index, moving averages, regression on the time index and ARIMA, each scored on the {prep.test_months} test months with MAE, RMSE, MAPE and MASE. The models of Unit 4 (which inputs explain rentals) and Unit 5 (which days are abnormal) are the other &ldquo;science&rdquo; questions of this project.
                </p>
              </CardContent>
            </Card>
          </div>
        </Worked>
        <Result items={[{ label: "Analytics answer", value: s1_5.best_month.label, hint: `${fmtInt(s1_5.best_month.total)} rentals` }, { label: "December vs November", value: `−${fmt(drop.drop_pct, 0)} %`, hint: `${fmt(Math.abs(drop.temp_change), 1)} °C colder` }, { label: "Science question", value: s1_5.science.next_quarter, hint: `answered in ${s1_5.science.unit}` }]} />
        <Interpretation>
          The analytics question is answered by looking back at the table; the data science question needs a model because it is about a time that has not happened yet. Both are part of the same project, and the analytics step comes first.
        </Interpretation>
      </UnitSection>

      {/* ============================================================ 1.6 */}
      <UnitSection number="1.6" title="Applications of Data Science">
        <What>
          <p>The six domains from class, each with the applications named on the slides.</p>
        </What>
        <Worked title="Where this project sits among them.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DOMAINS.map((dom) => (
              <Card key={dom.name} className={`gap-1 py-4 shadow-none ${dom.here ? "border-teal-400 bg-teal-50/40" : ""}`}>
                <CardHeader className="px-4 pb-0">
                  <CardTitle className="text-sm">{dom.name}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 text-xs leading-relaxed text-muted-foreground">
                  <p>{dom.items}</p>
                  {dom.here && <p className="mt-2 font-medium text-teal-900">{dom.here}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </Worked>
        <Result items={[{ label: "This project's domain", value: "Transportation & Logistics", hint: "demand prediction for a shared-bike system" }]} />
        <Interpretation>
          Forecasting how many bikes a city will need per day is the same kind of problem as ride-hailing demand prediction: the operator uses it to decide how many bikes to put on the street and where, exactly the &ldquo;knowledge and actions&rdquo; stage of the process.
        </Interpretation>
      </UnitSection>

      <UnitSection number="1.6.SL" title="Roles in Data Science" selfLearning intro="Not covered in class; added from the syllabus self-learning line and mapped onto this project.">
        <What>
          <p>Three roles share the Data Science Process. Each one owns a different stage of this project.</p>
        </What>
        <Worked>
          <KV
            cols={1}
            items={[
              ["Data Engineer", `Sourcing, storing and preparing data for analysis: in this project, the pipeline that reads day.csv, runs the five cleaning checks and writes the ${fmtInt(prep.rows_clean)}-day, ${prep.monthly_rows}-month and ${prep.quarterly_rows}-quarter tables (Unit 1.3).`],
              ["Analyst", "Examines existing data to find patterns and explain what happened: the descriptive statistics, tables, charts and hypothesis tests of Units 2 and 3, and the analytics question of 1.5."],
              ["ML Engineer", `Builds, validates and deploys models: the regression, anomaly detection and forecasting models of Units 4–6, validated the way 1.4 shows (hold-out on ${fmtInt(sp.test_days)} test days, k-fold, bootstrapping).`],
            ]}
          />
        </Worked>
        <Interpretation>One student plays all three roles here, but the hand-over points are the same as in a company: the engineer&rsquo;s tables feed the analyst&rsquo;s exploration, and the analyst&rsquo;s findings decide which inputs the model builder uses.</Interpretation>
      </UnitSection>
    </PageShell>
  );
}
