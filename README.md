# AirStat — Applied Data Science on Beijing PM2.5 (2010–2014)

An end-to-end Applied Data Science project: every syllabus module (data cleaning, descriptive statistics,
visualization, correlation, probability & inference, regression, validation, anomaly detection,
time-series analysis, forecasting, insights) applied to one real dataset and presented as a web dashboard.

- **Dataset:** UCI *Beijing PM2.5 Data* (dataset 381) — 43,824 hourly rows, 2010-01-01 → 2014-12-31.
  PM2.5 from the US Embassy monitor joined with weather (dew point, temperature, pressure, wind
  direction, cumulated wind speed, hours of snow/rain) from Beijing Capital Airport.
- **Computation:** Python (pandas, NumPy, SciPy, statsmodels, scikit-learn, imbalanced-learn).
- **Presentation:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (light theme)
  + [evilcharts](https://evilcharts.com) chart components (Recharts) + KaTeX for formulas.

## How it works

```
data/raw/PRSA_data_2010.1.1-2014.12.31.csv
        │
        ▼  pipeline/01_dataset.py … 11_insights.py   (Python does all the statistics)
data/processed/*.parquet   +   web/public/data/*.json
        │
        ▼  Next.js server components read the JSON and render pages + charts
http://localhost:3000
```

Nothing on the site is typed by hand — every number, table and chart comes from the JSON produced by
the pipeline. Re-running the scripts regenerates everything.

## Pages (one per module)

| Route | Module | What it covers |
|---|---|---|
| `/` | — | Problem statement, data-science process, dataset at a glance |
| `/dataset` | 1 | Data dictionary, missing values & gaps, cleaning steps, engineered features |
| `/descriptive` | 2 | Mean/median/mode, variance/SD/IQR, skewness (moment, Pearson, Bowley), kurtosis, histograms, box plots, tabulation & cross-tabulation, empirical rule |
| `/visualization` | 3 | Density, scatter (+fit), scatter matrix, bubble, diurnal/weekly/seasonal lines, heat map, bar & 100 %-stacked bar |
| `/correlation` | 4 | Pearson / Spearman / Kendall matrices, significance & CI of r, linear vs monotonic, η² |
| `/inference` | 5 | Normal, Poisson, Binomial fits & tests; interactive CLT simulator; z/t CIs, proportion CI, coverage experiment; z-, t-, Welch, paired tests; one-way ANOVA + Tukey; χ² independence; Type I/II error & power |
| `/regression` | 6 | Simple regression (4 predictors), multiple regression with wind dummies and a log-target model; t/F tests, R², adj. R², VIF, Durbin-Watson, Jarque-Bera, Breusch-Pagan, residual plots, Q-Q, chronological hold-out, nested F-test |
| `/validation` | 7 | Random vs chronological hold-out, hold-out variance, 5/10-fold CV, stratified K-fold (classifier), LOOCV, bootstrap CIs, learning curve |
| `/anomaly` | 8 | Z-score, modified z (MAD), IQR; Mahalanobis, k-NN, LOF, Isolation Forest; method agreement; Jan-2013 episode; class imbalance + SMOTE vs class weights with confusion matrices, ROC & PR curves |
| `/timeseries` | 9 | Components, moving averages, SES/Holt/Holt-Winters, linear & Mann-Kendall trend, additive/multiplicative/STL decomposition, ADF/KPSS, differencing, ACF/PACF, ARIMA by AIC + Ljung-Box, SARIMA |
| `/forecasting` | 10 | Chronological split; baselines; Holt-Winters, ARIMA, SARIMA (monthly); static vs walk-forward ARIMA and ARIMAX with weather (daily); prediction intervals; MAE/RMSE/MAPE/MASE |
| `/insights` | 11 | Executive summary, key findings, model comparison, limitations, recommendations |

## Running it

Prerequisites: Python 3.11+ and Node.js 18+ (tested with Python 3.12, Node 22).

### 1. (Optional) regenerate the analysis

The JSON outputs are committed, so this step is only needed if you change the pipeline.

```bash
pip install pandas numpy scipy statsmodels scikit-learn imbalanced-learn pyarrow
cd pipeline
python 01_dataset.py
python 02_descriptive.py
python 03_visualization.py
python 04_correlation.py
python 05_inference.py
python 06_regression.py
python 07_validation.py
python 08_anomaly.py
python 09_timeseries.py
python 10_forecasting.py
python 11_insights.py
```

(Run them in order — later scripts read the parquet files written by `01_dataset.py`, and
`11_insights.py` reads the other scripts' JSON.) The whole pipeline takes about two minutes.

### 2. Start the website

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>.

For a production build: `npm run build && npm start`.

## Repository layout

```
air-quality-ads/
├── data/
│   ├── raw/        PRSA_data_2010.1.1-2014.12.31.csv (UCI)
│   └── processed/  hourly_clean.parquet, daily.parquet, monthly.parquet (generated)
├── pipeline/       common.py + 01…11 analysis scripts
└── web/
    ├── public/data/            JSON produced by the pipeline (one file per module)
    └── src/
        ├── app/<route>/page.tsx   one server component per module
        ├── components/
        │   ├── blocks.tsx         Section, StatCard, ChartCard, FormulaCard, DataTable, …
        │   ├── formula.tsx        KaTeX renderer
        │   ├── charts/            wrappers around evilcharts + a few raw Recharts charts
        │   ├── evilcharts/        chart components installed from the evilcharts registry
        │   ├── clt-simulator.tsx  interactive Central Limit Theorem demo
        │   └── anomaly-explorer.tsx interactive anomaly-method toggle
        └── lib/                   data loader, formatters, colours
```

## Key results (from `web/public/data/insights.json`)

- Mean PM2.5 ≈ 99 µg/m³ vs median 72 — strongly right-skewed (skewness 1.8); 59 % of hours are
  "Unhealthy" or worse on the US EPA scale.
- Wind is the main driver: NW wind ≈ 70 µg/m³, calm air ≈ 126 µg/m³. Season ANOVA F ≈ 11, p < 0.0001.
- No weekend effect (Welch t, p ≈ 0.4) and no 2010→2014 change (paired t on months, n.s.).
- Weather + wind direction explain ≈ 26 % of hourly variance (OLS); residuals are autocorrelated
  (Durbin-Watson ≈ 0.3), so OLS p-values are over-confident.
- Random hold-out flatters a random forest (R² 0.46) vs chronological split (0.29).
- Multivariate anomaly methods find the January-2013 "airpocalypse" without being told.
- SMOTE raises severe-day recall from 19 % to 83 % at the cost of precision (54 % → 41 %).
- Monthly series is stationary with a strong annual cycle; Holt-Winters beats every other monthly model.
- Daily walk-forward ARIMA halves the naive RMSE; adding the day's weather (ARIMAX) helps further.

## Data source

Liang, X., Zou, T., Guo, B., Li, S., Zhang, H., Zhang, S., Huang, H., & Chen, S. X. (2015).
*Assessing Beijing's PM2.5 pollution: severity, weather impact, APEC and winter heating.*
Proceedings of the Royal Society A. Dataset: <https://archive.ics.uci.edu/dataset/381/beijing+pm2+5+data>
