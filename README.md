# Applied Data Science on Capital Bikeshare

A course project for *Applied Data Science* (B.Tech Computer Engineering, N-2024 syllabus). The six
units of the syllabus are applied, in syllabus order, to one dataset, and presented as a website in
which every section is numbered like the syllabus and computed the way it was taught in class.

**The question:** can we describe, explain and forecast the number of bikes rented per day in
Washington DC from the weather and the calendar?

**The dataset:** UCI Machine Learning Repository, *Bike Sharing Dataset* (id 275), file `day.csv`:
731 daily rows (2011-01-01 to 2012-12-31), 16 columns, Capital Bikeshare rentals joined with
weather and calendar attributes. No missing values, no duplicates, one invalid value (humidity 0 %).

> Fanaee-T, H. & Gama, J. (2013). *Event labeling combining ensemble detectors and background
> knowledge.* Progress in Artificial Intelligence. Dataset: <https://archive.ics.uci.edu/dataset/275/bike+sharing+dataset>

**The structure:** the Data Science Process from Unit 1 (Prior knowledge → Preparation → Modeling →
Application → Knowledge). Unit 1 = the process, preparation and how models are validated;
Units 2–3 = explore; Units 4–6 = model, apply and forecast; Conclusion = knowledge and actions.

## Unit map

| Route | Syllabus unit | Sub-sections on the page | Pipeline script | JSON |
|---|---|---|---|---|
| `/` | — | The process diagram, how to read the site, one card per unit | — | reads `unit1…unit6.json` |
| `/unit-1` | 1. Introduction to Data Science | 1.1 Process · 1.2 Volume, dimensions, complexity, tasks · 1.3 Data preparation · 1.4 Hold-out, k-fold, leave-one-out, bootstrapping · 1.5 Data science vs analytics · 1.6 Applications · SL: roles | `pipeline/unit1_process.py` | `unit1.json` |
| `/unit-2` | 2. Data exploration using descriptive statistics | 2.1 Types and properties · 2.2 Classification, tabulation, diagrams, graphs · 2.3 Univariate (mean, median, mode, range, Q.D., σ, Karl Pearson and Bowley skewness, kurtosis) · 2.4 Multivariate (central data point, correlation, Karl Pearson's r) · 2.5 Visualization · SL: heat map | `pipeline/unit2_descriptive.py` | `unit2.json` |
| `/unit-3` | 3. Data exploration using inferential statistics | 3.1 Normal, Poisson · 3.2 Central limit theorem · 3.3 Confidence interval · 3.4 Hypothesis-testing framework · 3.5 Type-I / Type-II errors · 3.6 Z-test · 3.7 t-tests (one-sample, independent, paired) · 3.8 ANOVA (one-way, two-way) | `pipeline/unit3_inference.py` | `unit3.json` |
| `/unit-4` | 4. Regression analysis | 4.1 Intercept and slope · 4.2 Error term, R², MAE, MAPE · 4.3 Multiple linear regression · 4.4 Partial coefficients · 4.5 Overall F-test · 4.6 Individual t-tests · SL: residual analysis | `pipeline/unit4_regression.py` | `unit4.json` |
| `/unit-5` | 5. Anomaly detection | 5.1 Outliers and causes · 5.2 Techniques · 5.3 Statistical (z-score, IQR) · 5.4 Distance-based (k-NN) · 5.5 Density-based (LOF) · 5.6 SMOTE · SL: confusion matrix, precision, recall, F1, AUC-PR | `pipeline/unit5_anomaly.py` | `unit5.json` |
| `/unit-6` | 6. Time series forecasting | 6.1 Taxonomy, components, additive and multiplicative decomposition · 6.2 Average method, moving average, regression on time, ARIMA · SL: stationarity (ADF) · 6.3 MAE, RMSE, MAPE, MASE | `pipeline/unit6_timeseries.py` | `unit6.json` |
| `/conclusion` | Knowledge and actions | One paragraph per unit with headline numbers, actions, limitations, course conclusion | `pipeline/conclusion.py` | `conclusion.json` |

`docs/syllabus-map.md` maps every line of the official syllabus to a page section and a pipeline
function. `docs/viva-walkthrough.md` is a section-by-section script with the likely question on each.

## How to run

Prerequisites: Python 3.11+ and Node.js 18+.

```bash
# 1. the analysis (writes data/processed/*.parquet and web/public/data/*.json)
pip install pandas numpy scipy statsmodels scikit-learn imbalanced-learn pyarrow
cd pipeline
python run_all.py          # runs the seven scripts below in order and stops at the first failure
```

or script by script, in this order (unit 1 builds the tables every later script reads; the
conclusion reads the six unit JSON files):

```bash
python unit1_process.py
python unit2_descriptive.py
python unit3_inference.py
python unit4_regression.py
python unit5_anomaly.py
python unit6_timeseries.py
python conclusion.py
```

Every random draw is seeded, so re-running reproduces the same JSON. The JSON files are committed,
so the website runs without re-running the pipeline.

```bash
# 2. the website
cd web
npm install
npm run dev                # http://localhost:3000
```

Production: `npm run build && npm start`. Type-check: `npx tsc --noEmit -p tsconfig.json`. Lint: `npx eslint src`.

## Repository layout

```
air-quality-ads/
├── data/
│   ├── raw/            day.csv (UCI 275) + README-uci.txt
│   └── processed/      daily.parquet (731), monthly.parquet (24), quarterly.parquet (8)  — generated, git-ignored
├── pipeline/
│   ├── common.py       paths, build_tables(), loaders, train_test(), σ with ÷N, Karl Pearson's r, save()
│   ├── unit1_process.py … unit6_timeseries.py, conclusion.py
│   └── run_all.py
├── docs/
│   ├── syllabus-map.md
│   └── viva-walkthrough.md
└── web/                Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts + KaTeX
    ├── public/data/    unit1.json … unit6.json, conclusion.json  (written by the pipeline)
    └── src/
        ├── app/<route>/page.tsx          one async server component per page; reads its JSON with loadData()
        ├── components/syllabus.tsx       UnitSection, What, FormulaBlock, Worked, Result, Interpretation, HypothesisTest, ClassCheck
        ├── components/blocks.tsx         Section, ChartCard, DataTable, KV, Note, …
        ├── components/charts/            chart wrappers (client components, plain props)
        ├── components/unit-N/            components used by one unit only (e.g. unit-1/process-diagram.tsx)
        ├── components/layout/            sidebar, nav.ts (the page order), page-shell.tsx
        └── lib/                          data.ts (JSON loader), format.ts, colors.ts
```

## Conventions

### The five beats

Every syllabus section on every page has the same five parts, in this order:

1. **What it is** — one or two sentences in the wording used in class.
2. **Formula** — exactly as taught (KaTeX), with the symbols explained.
3. **Worked on our data** — a table that shows the intermediate columns of the calculation, the way the
   class worked examples do (e.g. X, f, d′, fd′, fd′², cf; or ΣX, ΣY, ΣXY, …). Large N shows the grouped
   table or the summary sums, never all 731 rows.
4. **Result** — the number(s), boxed.
5. **Interpretation** — one sentence in the class phrasing (e.g. "Sk > 0 → positively skewed",
   "Calculated F > Table F → reject H₀").

Notation follows the class: σ uses ÷N; skewness is Karl Pearson (Mean − Mode)/σ and Bowley; kurtosis
is β₂ = μ₄/μ₂²; Karl Pearson's r by the actual-mean method; regression by the Σ-form and deviation-score
formulas; hypothesis tests in the 5-step layout (H₀, H₁, α, calculated statistic vs tabulated critical
value, "H₀ is accepted / rejected"). Critical values are computed with scipy but labelled as table
lookups, e.g. "Tabulated t(22, 0.05) = 2.074"; p-values appear only as small footnotes.

Sections that come from the syllabus *self-learning* lines are tagged **Self-learning topic**.

### Class example checks

Where the class slides contain a worked toy example, the page reproduces it in an amber box titled
**Check against the class example**: the slide's data are run through the *same* function as the bike
data, and the slide's numbers are printed next to ours. Checks included: Bowley and kurtosis grouped
examples (Unit 2); the I.Q. one-sample t, the oceanographer Z-test, the wheat one-way and two-way ANOVA
(Unit 3); the 8-row (Y, X₁, X₂) multiple regression (Unit 4); the a, b, c, d LOF example with k = 2 and
Manhattan distance (Unit 5); the 12-quarter sales decomposition and the average / moving-average /
regression examples (Unit 6).

### The hold-out

Defined once in Unit 1.3 (`common.py`: `TEST_START`, `train_test()`) and reused by Units 4, 5 and 6:

- **Training** = 2011-01-01 to 2012-06-30 — 547 days, 18 months.
- **Test** = 2012-07-01 to 2012-12-31 — 184 days, 6 months.

The split is chronological (the class rule of thumb of about two-thirds training, one-third test) because
the data are a time series: a model may only be judged on days later than the ones it was fitted on.
Models are reported in-sample on the training days, as in class, and their MAE / MAPE on the test days.

### Nothing typed in

Python computes every statistic and writes one JSON file per unit; the pages read that JSON. Numbers in
prose are interpolated from the data, never typed. Re-running the pipeline regenerates the whole site.
