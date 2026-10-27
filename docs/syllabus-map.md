# Syllabus map

Every line of the official *Applied Data Science* syllabus (N-2024), where it is shown on the site, and
which pipeline code computes it. Section numbers are the badges on the pages (`web/src/app/<route>/page.tsx`);
functions are in `pipeline/<script>.py`.

Legend: **SL** = syllabus self-learning line (tagged "Self-learning topic" on the page).
**Words only** = covered by text and tables, no computation.

## Unit 1 — Introduction to Data Science (`/unit-1`, `unit1_process.py`)

| Syllabus line | Page section | Pipeline | What is shown |
|---|---|---|---|
| 1.1 Introduction to Data Science, Data Science Process | 1.1 | `section_1_1()`; `ProcessDiagram` component | The five-stage process diagram with each unit placed on it; prior knowledge in the four sub-steps (objective, subject area, data = 16 columns, correlation vs causation) |
| 1.2 Motivation: Volume, Dimensions and Complexity; Data Science Tasks and Examples | 1.2 | `section_1_2()` | Volume / dimensions / complexity measured on this dataset; the class task table reduced to the tasks used (regression, anomaly detection, time series) and why the others are not |
| 1.3 Overview of Data Preparation | 1.3 (Step 2-A explore, Step 2-B clean, transform) | `explore_table()`, `clean_checks()`, `transform_tables()`; `common.build_tables()` | Mean-vs-median table; the five cleaning checks (missing, duplicates, invalid, inconsistent, outliers) with counts; the humidity 0 % fix; de-normalising weather; derived attributes; the daily / monthly / quarterly tables; the chronological split 547 / 184 |
| 1.4 Model building, Cross Validation, K-fold, leave-1 out, Bootstrapping | 1.4 (four sub-sections) | `fit_line()`, `mae()`, `holdout()`, `kfold()`, `loocv_monthly()`, `bootstrap()` | Hold-out MAE train / test; 5-fold table with fold dates, a, b, MAE per fold and the average; leave-one-out on the 18 training months; bootstrapping with B = 5 shown (distinct days, repeats, a, b, MAE) and B = 200 for the slope distribution |
| 1.5 Difference between data science and data analytics | 1.5 | `section_1_5()` | The class comparison table; an analytics question answered with a table of the 2012 months, a data science question pointed at Unit 6 |
| 1.6 Applications of Data Science | 1.6 | — (words only) | The six domains from class and where this project sits (transportation and logistics, demand prediction) |
| SL: Roles in Data Science (Data Engineer, ML Engineer, Analyst) | 1.6.SL **SL** | — (words only) | The three roles mapped onto the stages of this project |
| SL: Case studies (Healthcare, Finance, Transportation, Recommender Systems) | 1.6 **SL, words only** | — | Named inside the six-domain table of 1.6; this project is the transportation case |

## Unit 2 — Data exploration using descriptive statistics (`/unit-2`, `unit2_descriptive.py`)

| Syllabus line | Page section | Pipeline | What is shown |
|---|---|---|---|
| 2.1 Types of data | 2.1 | `types_of_data()` | Every column classified: qualitative / quantitative, nominal / ordinal / interval / ratio, discrete / continuous |
| 2.1 Properties of data | 2.1 "Properties of data" | `properties_of_data()` | Accuracy, completeness, reliability, relevance, timeliness checked on this dataset |
| 2.2 Classification | 2.2 "Classification", "The frequency distribution of cnt" | `classification_examples()`, `sturges()`, `grouped_from_freq()` | Chronological / qualitative / quantitative classification; Sturges' rule (k = 11, i = 800), the frequency table with class, mid-point, f, cf |
| 2.2 Tabulation | 2.2 "Tabulation" | `two_way_table()` | A two-way table (year × season) with number, title, headnote, stub, caption, totals, footnote |
| 2.2 Diagrammatic representation | 2.2 "Diagrammatic representation" | `diagrams()` | Simple bar (mean by weather), sub-divided / percentage bar (casual vs registered by season), pie (angle = % × 3.6°) |
| 2.2 Graphic representation | 2.2 "Graphic representation" | `graphs()` | Line graph of the monthly series; histogram and frequency polygon of the frequency distribution |
| 2.3 Measures of central tendency | 2.3 "Arithmetic mean", "Median", "Mode" | `grouped_stats()` → `grouped_from_freq()` | Direct and step-deviation mean (shown to agree); median L + ((N/2 − cf)/f) × i; mode L + Δ₁/(Δ₁ + Δ₂) × i; empirical relation and the Mode / Median / Mean ordering |
| 2.3 Measures of spread | 2.3 "Measures of spread" | `grouped_from_freq()` | Range and coefficient; Q₁, Q₃, IQR, Q.D. and coefficient; σ by step deviation with ÷N |
| 2.3 Symmetry, Skewness: Karl Pearson, Bowley | 2.3 "Skewness" | `grouped_from_freq()` | Skₚ = (Mean − Mode)/σ (and the 3(Mean − Median)/σ form); Bowley (Q₃ + Q₁ − 2 Median)/(Q₃ − Q₁); interpretation by sign |
| 2.3 Kurtosis | 2.3 "Kurtosis" | `grouped_from_freq()` | μ₂, μ₄ from the grouped table, β₂ = μ₄/μ₂² compared with 3 |
| (2.3 contrast) | 2.3 "Contrast: temperature" | `grouped_stats()` on temp_c | The same measures for a second variable |
| 2.4 Central data point | 2.4 "Central data point" | `multivariate()` | The mean vector (the average day) |
| 2.4 Correlation, different forms of correlation | 2.4 "Correlation: meaning, causation and forms" | `multivariate()` | Causation vs correlation with the three reasons; positive / negative, simple / partial / multiple, linear / non-linear, each with a pair from this data |
| 2.4 Karl Pearson correlation coefficient for bivariate distribution | 2.4 "Karl Pearson's coefficient of correlation" | `common.pearson_r_actual_mean()`, `common.degree_of_correlation()` | Σx², Σy², Σxy and r for rentals vs temperature, feels-like temperature, humidity, wind; the direct-sums form as a cross-check; degree bands |
| 2.5 Univariate: Histogram | 2.5 "Univariate: histogram" | `distribution_chart()`, `common.hist()` | Histogram with the √n bin rule stated |
| 2.5 Univariate: Quartile | 2.5 "Univariate: quartile chart (box plot)" | `quartile_chart()` | Box plot by season with Q₁ − 1.5 IQR / Q₃ + 1.5 IQR fences and outlier counts |
| 2.5 Univariate: Distribution chart | 2.5 "Univariate: distribution chart" | `distribution_chart()`, `normal_pdf()` | Normal curve with the same μ, σ over the histogram; 68.2 / 95.4 / 99.7 % rule checked |
| 2.5 Multivariate: Scatter plot, Scatter matrix, Bubble chart | 2.5 "Multivariate" | `multivariate_charts()` | Scatter of rentals vs temperature; scatter matrix of four variables; one bubble per month (x = temperature, y = rentals, size = wind, colour = season) |
| SL: Shape of distributions (heavy-tailed, light-tailed, multimodal) | 2.3 "Kurtosis" **SL, words only** | — | Named in the kurtosis interpretation (platykurtic = lighter tails than normal) |
| SL: Advanced visualizations: Violin plot, Boxen plot, Pair plot, Heatmaps | 2.5-SL **SL** (heat map only) | `multivariate_charts()` | Heat map of mean rentals by month × day of week. Violin, boxen and pair plots are not shown (the scatter matrix of 2.5 is the pair-plot idea) |

## Unit 3 — Data exploration using inferential statistics (`/unit-3`, `unit3_inference.py`)

The syllabus gives this unit as one line; the page numbers its topics 3.1–3.8 in the order the line lists them.

| Syllabus line | Page section | Pipeline | What is shown |
|---|---|---|---|
| Overview of various forms of distributions: Normal | 3.1 "Normal distribution" | `normal_fit()` | Temperature and rentals with a fitted normal curve; the 68.2 / 95.4 / 99.7 check |
| Overview of various forms of distributions: Poisson | 3.1 "Poisson distribution" | `poisson_fit()` | Rain / snow days per month, λ = mean, observed vs expected table for x = 0, 1, 2, 3 |
| Central Limit Theorem | 3.2 | `clt()`; `CltSimulator` component | Population = 731 days; 10,000 samples of n = 5 / 30 / 100; SE = σ/√n vs the observed SD of the means; interactive simulator |
| Confidence Interval | 3.3 (a), (b), "What widens or narrows" | `ci_z()`, `ci_t()` | 95 % CI from n = 50 (z) and n = 10 (t, df = 9) in the four-line slide layout; 90 / 95 / 99 % widths |
| Test Hypothesis | 3.4 | `z_crit()`, `t_crit()`, `f_crit()` | The five-step framework, one- vs two-tailed, the Z critical-value table shown as table lookups |
| Type-I, Type-II errors | 3.5 | — (words only) | Producer's risk α and consumer's risk β worded for the bike-share operator; only n reduces both |
| Z-test | 3.6 | `z_test()` | Single mean, n = 366 > 30: 2012 mean vs the 2011 mean as μ₀, s in place of σ, |Z| vs 1.96 |
| t-test | 3.7 (a) one-sample, (b) independent (pooled), (c) paired, (d) a test that accepts H₀ | `one_sample_t()`, `independent_t()`, `paired_t()` | 21 holidays vs the overall mean (df 20); 12 monthly means 2011 vs 2012 (df 22) with Σ(x − x̄)²; the same 12 months paired (df 11); working vs non-working months (accept); the "when to use z vs t" table |
| ANOVA | 3.8 one-way, two-way | `one_way_anova()`, `two_way_anova()` | One-way daily rentals by season in the 8 steps with the ANOVA table; two-way year × quarter (one observation per cell) by the correction-factor method with two F-ratios |
| (class checks) | 3.3, 3.6, 3.8 amber boxes | same functions on slide data | I.Q. one-sample t; oceanographer Z-test; wheat one-way and two-way ANOVA |
| SL: Neyman-Pearson lemma, MP and UMP tests | **not covered** | — | Not on the page (not taught; outside the five-step layout used throughout) |
| SL: Practical examples using Python / Excel / R | **SL** (the whole page) | every function | Every test is run in Python; the class examples are reproduced through the same code |

## Unit 4 — Regression analysis (`/unit-4`, `unit4_regression.py`)

| Syllabus line | Page section | Pipeline | What is shown |
|---|---|---|---|
| 4.1 Mathematical and statistical equation — meaning of intercept and slope | 4.1 | `simple_sums()`, `normal_equations()` | A 10-day worked table (X, Y, X², XY), the Σ-form b and a, the normal equations, the full-sample fit Y = a + bX, "when X = 0 …" and "each 1 °C adds b …", a prediction for one day |
| 4.2 Error term — measures for model fit: R², MAE, MAPE | 4.2 | `fit_measures()` | e = Y − Ŷ, least squares; MAE, MSE, RMSE, R², MAPE in-sample and on the test days |
| 4.3 Multiple linear regression model | 4.3 | `mlr_two()` | Deviation sums Σx₁², Σx₂², Σx₁y, Σx₂y, Σx₁x₂ → b₁, b₂, b₀; the fitted equation; a prediction; R² by explained / total and by 1 − SSE/SST; adjusted R² |
| 4.4 Partial regression coefficients | 4.4 | `mlr_two()`, `simple_sums()` | Simple slope of rentals on humidity alone vs its partial coefficient holding temperature constant; r₁₂ between the predictors |
| 4.5 Testing significance of overall fit | 4.5, "Exploring alternative model designs" | `f_test()`, `anova_rows()`, `ols_design()` | H₀: β₁ = β₂ = 0; ANOVA table; calculated F vs tabulated F(k, n − k − 1); the stop / continue rule; designs A (temp), B (temp + hum), C (temp + hum + wind + yr) compared |
| 4.6 Testing individual regression coefficients | 4.6, "Which predictors matter in design C" | `t_tests()`, `ols_design()` | SE(bᵢ) by the class formula, t = bᵢ / SE, df = n − k − 1, vs tabulated t; "significant ≠ practically important" |
| (class check) | 4.6 amber box | `class_check()` → same functions | The 8-row (Y, X₁, X₂) slide example: b₁ = 3.1479, b₂ = −1.6561, b₀ = −6.8675, R², F, t |
| SL: Residual analysis and its importance in regression diagnostics | 4.S **SL** | `residual_analysis()` | Residual vs fitted, histogram of residuals, predicted vs actual with the 45° line; the five assumptions each with one observation; no formal tests |
| SL: Case studies (house prices, sales forecasting) | **not covered** | — | Not on the page; the bike-rental model is the case study |

## Unit 5 — Anomaly detection (`/unit-5`, `unit5_anomaly.py`)

| Syllabus line | Page section | Pipeline | What is shown |
|---|---|---|---|
| 5.1 Outliers, causes of outliers | 5.1 | `section_51()`, `event_of()` | Definition; the causes (entry / sensor error, measurement, natural variation, genuine rare events, sampling); which apply here (the humidity 0 % row; Hurricanes Irene and Sandy; snow days) with their z-scores |
| 5.2 Anomaly detection techniques | 5.2 | `main()` (comparison table) | The three families (statistical, distance, density), supervised vs unsupervised, a comparison table filled from the results of 5.3–5.5 |
| 5.3 Outlier detection using statistics | 5.3 "z-score rule", "IQR rule" | `section_53()`, `zscore()` | |z| > 3 on rentals (0 flagged), on wind speed (2) and on the raw humidity column (2, the sensor error among them); 1.5 × IQR fences on rentals (0 flagged); why the two rules miss Sandy |
| 5.4 Outlier detection using distance-based method | 5.4 | `section_54()`, `manhattan_matrix()`, `knn_distance()` | Standardised (temperature, rentals); distance to the k-th neighbour (k = 5, Manhattan); scatter with the top 10; table of the top-10 days; Sandy's rank |
| 5.5 Outlier detection using density-based methods | 5.5 | `section_55()`, `lof()` | k-distance, reach-dist, lrd, LOF in the class notation; the a, b, c, d class check (LOF = 0.88, 1.33, 0.88, 2.00); LOF on the real data (k = 20), scatter coloured by LOF, top-10 table, Sandy's LOF |
| 5.6 SMOTE | 5.6 | `section_56()` (imbalanced-learn SMOTE, scikit-learn logistic regression) | Label high-demand = cnt > 7,000; the imbalance table; the interpolation formula xᵢ + λ(x_zi − xᵢ) with example synthetic rows; before / after counts; scatter of synthetic points; logistic regression without and with SMOTE on the test days |
| SL: Performance metrics for anomaly detection (AUC-PR, F1, confusion matrix) | 5.6 (self-learning) **SL** | `section_56()` | Confusion matrices, precision, recall, F1, AUC-PR for both models; "SMOTE raises recall" |
| SL: Autoencoders for anomaly detection | **not covered** | — | Not on the page (not taught; a neural-network method outside the three families used) |

## Unit 6 — Time series forecasting (`/unit-6`, `unit6_timeseries.py`)

| Syllabus line | Page section | Pipeline | What is shown |
|---|---|---|---|
| 6.1 Taxonomy of time series forecasting methods | 6.1 "Taxonomy" | `main()` (taxonomy tree) | The class tree (decomposition / smoothing / regression incl. ARIMA / ML) with the leaves used in this unit marked |
| 6.1 Time series decomposition | 6.1 "Components", "Additive vs multiplicative", "Additive decomposition", "Multiplicative decomposition", "Which model fits" | `centred_ma_trend()`, `seasonal_indices()`, `decompose()`, `run_decomposition()` | T, S, C, I on the monthly line; on the 8 quarters: centred 2×4 MA trend, detrended values, seasonal table (years × Q1..Q4, totals, averages, adjustment to sum 0 / 4), trend per quarter, forecast for 2013 Q1–Q4, additive and multiplicative; which fits better and why |
| (class check) | 6.1 amber box | `class_check_sales()` → same functions | The 12-quarter sales series → Y4 Q2 = 23.31 additive, 21.98 multiplicative |
| 6.2 Average method | 6.2 "Average method" | `average_method()` | F(t) = mean of all past months, forecasting the 6 test months |
| 6.2 Moving average smoothing | 6.2 "Moving average method" | `moving_average()` | k = 3 (and k = 12) |
| 6.2 Time series analysis using linear regression | 6.2 "Linear regression (least-square method)" | `regression_on_time()` | y′ = ax + b on t with the Σ table, a = slope, b = intercept (the Unit 6 lettering, stated explicitly) |
| 6.2 ARIMA model | 6.2 "ARIMA(p, d, q)" | `arima_method()` (statsmodels) | AR / I / MA in plain words; small orders compared by AIC on the training months; ARIMA(1, 1, 0) forecast |
| (class check) | 6.2 amber box | `class_check_methods()` | The slide's average, moving-average and regression examples with their metrics |
| 6.3 Performance evaluation: MAE, RMSE, MAPE, MASE | 6.3 | `evaluation_table()`, `run_methods_and_evaluation()` | For each method the class table (t, y, F, e, |e|, e², |e|/y, naive error, Sum row) on the 6 test months, then MAE, RMSE, MAPE, MASE (denominator = in-sample naive MAE on the training months); comparison of all methods; the best and why |
| SL: Seasonal decomposition | 6.1 **SL (covered inside 6.1)** | `decompose()` | The seasonal indices and the seasonally adjusted forecast are the seasonal decomposition |
| SL: Stationarity concept and tests | 6.2 note "Self-learning: choosing d with a stationarity check" **SL** | `adf_plain()` | What stationary means; the ADF test on the training months in levels and after one difference, used only to choose d |

## Conclusion (`/conclusion`, `conclusion.py`)

| Item | Page section | Pipeline | What is shown |
|---|---|---|---|
| Knowledge and actions (stage 5 of the 1.1 process) | Unit 1 … Unit 6, Knowledge, Limits, Course | `unit1()` … `unit6()`, `actions()`, `limitations()`, `high_demand_by_season()` | One paragraph per unit with its headline numbers read from the unit JSON; eight finding → action pairs for a bike-share operator; five limitations; the course conclusion |
