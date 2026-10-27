# Viva walkthrough

Page by page, section by section: what to say (two to four sentences), the one question an examiner
is most likely to ask, and its answer. Numbers are the `headline` values in `web/public/data/unit*.json`
and `conclusion.json`; if the pipeline is re-run they are reproduced exactly (every random draw is seeded).

## Why this dataset, why this structure

**Why the Bike Sharing dataset (UCI 275)?** Because every unit of the syllabus gives a clear, explainable
result on it. There is one strong, physically obvious driver (temperature, r = 0.63) for correlation and
regression; four seasons that differ a lot (Winter 2,604 vs Summer 5,644 rentals per day) for ANOVA; real
storm days (Hurricane Irene 2011-08-27, Hurricane Sandy 2012-10-29 with 22 rentals) for anomaly detection;
and a visible growth trend (2011 mean 3,406 → 2012 mean 5,600) with a yearly cycle for time series. The
file is small (731 rows, 16 columns), clean (no missing values, no duplicates, one invalid value), and
daily, so the class formulas for grouped data, t-tests and the 2×4 centred moving average apply directly.

**Why this structure?** The site follows the Data Science Process taught in Unit 1.1: Prior knowledge →
Preparation → Modeling → Application → Knowledge. Unit 1 states the objective and prepares the data; Units
2 and 3 explore it (descriptive, then inferential); Units 4, 5 and 6 build models (regression, anomaly
detection, time series) and apply them to the held-out months; the Conclusion is the knowledge-and-actions
stage. Within every page the sections carry the syllabus numbers and the same five beats (What it is →
Formula → Worked on our data → Result → Interpretation), and the class toy examples are re-run through
the same code as a check.

**Why nothing is typed in?** Python computes every statistic and writes JSON; the pages only read it. Any
number on the site can be traced to a function in `pipeline/` and reproduced by `python run_all.py`.

---

## Home (`/`)

*Say:* The question is whether daily bike rentals in Washington DC can be described, explained and
forecast from the weather and the calendar. The data are 731 days, 16 columns, 2011–2012. Each page is one
syllabus unit, in syllabus order, on this one dataset; the diagram shows where each unit sits in the
process.

*Likely question:* Why is the hold-out 547 / 184 days and not a random 80 / 20?
*Answer:* The data are a time series, so the test period must come after the training period; the class
rule of thumb is two-thirds training, one-third test, and the last six months of 2012 are the third.

---

## Unit 1 — Introduction to Data Science (`/unit-1`)

### 1.1 Data Science and the Data Science Process
*Say:* The five stages as drawn in class, with the units placed on them. Prior knowledge has four parts:
the objective (describe, explain, forecast rentals), the subject area (a shared-bike system; demand follows
weather and the calendar), the data (16 columns, described one by one), and causation versus correlation
(weather can drive rentals; rentals cannot drive the weather).
*Q:* What is the difference between business understanding and data understanding?
*A:* Business understanding is the question the operator wants answered; data understanding is what the 16
columns can and cannot say about it (for example, there is no price or station column).

### 1.2 Volume, dimensions, complexity; data science tasks
*Say:* Volume is 731 rows, dimensions 16 attributes, complexity is the mix of confirmatory questions ("is
summer busier?") and exploratory ones ("what drives rentals, what comes next?"). From the class task table
this project uses regression, anomaly detection and time series forecasting; classification appears only
through SMOTE, and clustering, association and recommendation have no natural target here.
*Q:* Why is this not a classification problem?
*A:* The target, rentals per day, is a count, so the natural task is regression; a class label (high-demand
day) is created in Unit 5 only to show SMOTE.

### 1.3 Data preparation
*Say:* Explore first: the mean and median of rentals are close (4,504 vs 4,548), the class red flag for
skew does not fire. Then the five cleaning checks: no missing values, no duplicates, one invalid value
(humidity 0 % on 2011-03-10, replaced by 71.2 %, the mean of its neighbours, as the class capped the credit
score), outliers flagged not deleted. Transform: weather de-normalised to °C, %, km/h; season, day type
and high-demand derived; daily, monthly and quarterly tables; chronological split into 547 training and
184 test days.
*Q:* Why replace the humidity value instead of dropping the row?
*A:* Only one attribute of that day is wrong; the rentals and the other weather are valid, and the class
example (credit score 900 → 850) corrects the value rather than losing the record.

### 1.4 Model building, cross validation, k-fold, leave-one-out, bootstrapping
*Say:* The model being validated is the simplest one: rentals = 1,054.57 + 149.01 × temperature. Hold-out
MAE is 1,046 on the training days and 1,924 on the test days. 5-fold cross-validation averages 1,405 with
a wide spread between folds. Leave-one-out is run on the 18 training months (MAE 955) because on 547 days
it would fit 547 models. Bootstrapping draws samples with replacement; B = 5 are shown with their distinct
days and repeats, and B = 200 give a slope between 137.0 and 160.2.
*Q:* Why is the test MAE almost twice the training MAE?
*A:* Rentals grew through 2012; a line fitted on 2011 and early 2012 under-predicts the busier second half.
That is what a chronological hold-out is meant to reveal.

### 1.5 Data science vs data analytics
*Say:* Analytics answers a question about the past with a table (which 2012 month had the most rentals,
and why December dropped); data science builds a model that predicts the future (Unit 6).
*Q:* Is the ANOVA in Unit 3 analytics or data science?
*A:* It is inference about a population from a sample, so it belongs to data science, but it answers a
confirmatory question, not a predictive one.

### 1.6 Applications; self-learning: roles
*Say:* The six domains from class; this project is transportation and logistics, demand prediction. The
roles map onto the stages: the data engineer built the tables, the analyst explored, the ML engineer fitted
and evaluated the models.
*Q:* Which role does Unit 6 belong to?
*A:* The ML engineer: it fits models on training months and judges them on test months.

---

## Unit 2 — Descriptive statistics (`/unit-2`)

### 2.1 Types and properties of data
*Say:* Every column classified: season and weather are nominal, temperature is interval (°C has no true
zero), rentals and wind are ratio, the counts are discrete. The five properties are checked on the file:
accurate, complete (no missing), reliable (one operator's records plus a weather service), relevant, timely.
*Q:* Why is temperature interval and not ratio?
*A:* 0 °C is not "no temperature" and 20 °C is not twice as hot as 10 °C; only differences are meaningful.

### 2.2 Classification, tabulation, diagrams, graphs
*Say:* Sturges' rule gives k = 1 + 3.322 log₁₀ 731 = 10.5 → 11 classes; i = (8,714 − 22)/11 ≈ 790 → 800,
exclusive classes 0–800 … 8,000–8,800. This frequency table (class, mid-point, f, cf) feeds every formula
in 2.3. A two-way table year × season with all its parts; a simple bar by weather, a sub-divided bar
(casual vs registered), a pie with angle = % × 3.6°; a line graph of the monthly series and a histogram
with frequency polygon.
*Q:* Why exclusive classes?
*A:* Rentals are continuous for this purpose; exclusive classes (upper limit excluded) avoid a value
falling in two classes, which is the convention used in the class examples.

### 2.3 Univariate exploration
*Say:* By the step-deviation method with A = the modal class mid-point: mean 4,507 (direct and step forms
agree), median 4,498, mode 4,443, so Mode < Median < Mean. σ (÷N) = 1,944. Karl Pearson Skₚ = 0.03 and
Bowley 0.04: nearly symmetric. β₂ = 2.23 < 3: platykurtic. The same measures for temperature show a
second variable for contrast.
*Q:* The raw mean of rentals is 4,504 but the grouped mean is 4,507; why?
*A:* Grouped formulas assume every value sits at its class mid-point; the small difference is the grouping
error, which the class method accepts.

### 2.4 Multivariate exploration
*Say:* The central data point is the mean vector, the "average day". Correlation is explained with the
three reasons why correlation does not imply causation and the three classifications, each with a pair
from the data. Karl Pearson's r by the actual-mean method, r = Σxy / √(Σx² Σy²): temperature 0.6275
(moderate positive), feels-like 0.63, humidity −0.12 and wind −0.23 (low negative).
*Q:* Is r = 0.63 high?
*A:* By the class bands (0.75–0.99 high, below 0.5 low) it is moderate; it is the strongest single weather
relation in the data, and it is positive.

### 2.5 Visualization; self-learning: heat map
*Say:* Histogram (√n bins), box plot by season with the 1.5 × IQR fences, normal curve over the histogram
with the 68.2 / 95.4 / 99.7 check, scatter of rentals vs temperature, scatter matrix, bubble chart (one
bubble per month). The heat map of month × weekday is the tagged self-learning extra.
*Q:* What does the box plot say that the histogram does not?
*A:* It shows the quartiles and fences per season side by side, so the seasonal shift of the whole
distribution is visible, not just the overall shape.

---

## Unit 3 — Inferential statistics (`/unit-3`)

### 3.1 Normal and Poisson
*Say:* Temperature is near-normal, rentals less so; both are checked against the 68.2 / 95.4 / 99.7 rule.
The number of rain or snow days per month is a count with λ = 0.875; the Poisson table compares observed
and expected frequencies for 0, 1, 2, 3 days.
*Q:* Why is the Poisson appropriate for rain days?
*A:* They are counts of rare events in a fixed interval (a month) with a small mean, which is exactly the
Poisson setting.

### 3.2 Central limit theorem
*Say:* Population = 731 daily counts. 10,000 samples of n = 30 give sample means that are bell-shaped with
SE = σ/√n matching the observed SD of the means; the simulator repeats the class demonstration with n as
a slider.
*Q:* Why does the CLT matter for the tests that follow?
*A:* It is why the Z-test and the confidence interval can use the normal curve for a mean even though the
daily rentals themselves are not normal.

### 3.3 Confidence interval
*Say:* From a random sample of 50 days, x̄ ± z σ/√n gives 3,766 to 4,840 at 95 %; from 10 days,
x̄ ± t s/√n with df = 9 gives a wider interval. Raising confidence widens it; raising n narrows it.
*Q:* Why t for n = 10 and z for n = 50?
*A:* With a small sample and unknown σ the sample s replaces σ and the t distribution with n − 1 degrees of
freedom accounts for that extra uncertainty; above 30 the two are nearly the same.

### 3.4 Hypothesis-testing framework; 3.5 Type-I and Type-II errors
*Say:* The five steps: H₀, H₁ (one- or two-tailed), α = 0.05, calculated statistic vs tabulated critical
value, conclusion as "H₀ is accepted / rejected". Type-I (α, producer's risk): concluding demand rose when
it did not and stocking extra bikes; Type-II (β, consumer's risk): missing a real rise. Only a larger n
reduces both.
*Q:* Why compare with a tabulated value instead of a p-value?
*A:* The class method is the critical-value comparison; the p-value is the same decision expressed
differently and is shown only as a footnote.

### 3.6 Z-test
*Say:* Is the 2012 mean different from the 2011 mean μ₀ = 3,406? n = 366 > 30, s replaces σ,
Z = 23.47 against 1.96, H₀ rejected: demand rose.
*Q:* Why Z and not t here?
*A:* n is above 30, so by the class table the Z-test applies even with σ unknown.

### 3.7 t-tests
*Say:* One-sample: the 21 holidays vs the overall mean, t = −1.68 vs 2.086, H₀ accepted. Independent
samples with pooled variance: the 12 monthly means of 2011 vs 2012, df = 22, t = −4.13, rejected. Paired:
the same 12 calendar months, df = 11, t = −12.85, rejected. A fourth test, working vs non-working days,
t = 0.41 vs 2.013, accepted.
*Q:* Why is the paired t so much larger than the independent t on the same months?
*A:* Pairing removes the seasonal variation between months; only the year-to-year difference is left, so
the standard error is much smaller.

### 3.8 ANOVA
*Say:* One-way by season in the 8 steps: F = 128.78 against the 5 % limit 2.62, H₀ rejected; the season
means are Winter 2,604, Spring 4,992, Summer 5,644, Fall 4,728. Two-way year × quarter by the
correction-factor method: F = 188.5 for years (vs 10.13) and 60.4 for quarters (vs 9.28), both rejected.
The wheat examples from class reproduce F = 1.5 (one-way) and F = 4 and 6 (two-way).
*Q:* What does the two-way design add over the one-way?
*A:* It separates the year effect from the season effect with one table; both are significant, so growth
and seasonality are distinct findings.

---

## Unit 4 — Regression (`/unit-4`)

### 4.1 Intercept and slope
*Say:* Y = rentals, X = temperature. From the sums ΣX, ΣY, ΣX², ΣXY on the 547 training days,
b = 149.01 and a = 1,054.57: at 0 °C the line predicts about 1,055 rentals and each extra °C adds about
149. A 10-day table shows the mechanics first.
*Q:* Does the intercept have a real meaning?
*A:* 0 °C is inside the data range (winter days), so yes: it is the predicted rentals on a freezing day.

### 4.2 Error term and measures of fit
*Say:* e = Y − Ŷ; least squares minimises Σe². R² = 0.42 in-sample; MAE, MAPE (and MSE, RMSE) on the
training days and on the 184 test days (test MAE 1,924, MAPE 127 %).
*Q:* Why is the test MAPE so large?
*A:* MAPE divides by the actual value; the storm day with 22 rentals alone contributes an enormous
percentage error, which is a known weakness of MAPE.

### 4.3 Multiple linear regression
*Say:* X₁ = temperature, X₂ = humidity, by the deviation-score formulas: b₁ = 157.21, b₂ = −28.68,
b₀ = 2,686.06, R² = 0.48 (explained SS over total SS, and 1 − SSE/SST agree), adjusted R² = 0.478.
*Q:* Why only two predictors by hand?
*A:* The class formulas are the two-predictor ones; more predictors are fitted with a library in 4.5 and
labelled as such.

### 4.4 Partial regression coefficients
*Say:* The simple slope of rentals on humidity alone is −17.3; holding temperature constant it is −28.7.
The partial is larger because temperature and humidity are nearly unrelated (r₁₂ = 0.14) and temperature
was masking part of the humidity effect.
*Q:* What does "holding temperature constant" mean in practice?
*A:* Comparing two days with the same temperature and different humidity; the partial coefficient is the
expected difference in rentals per 1 % of humidity.

### 4.5 Overall significance: F-test
*Say:* H₀: β₁ = β₂ = 0. F = 251.0 against F(2, 544) = 3.01, H₀ rejected, so we go on to the individual
t-tests. Three designs compared: temperature only (R² 0.42), + humidity (0.48), + wind + year (0.74,
test MAE 1,126); the year indicator alone is worth about 1,791 rentals per day.
*Q:* If F had not rejected H₀, what next?
*A:* Stop: the flowchart rule says the model is not significant, so the individual coefficients are not
tested.

### 4.6 Individual coefficients: t-tests
*Say:* SE(b₁) by the class formula √[Σe²/(n − k − 1)] / √[Σx₁²(1 − r₁₂²)], t₁ = 21.88, t₂ = −7.95,
both beyond 1.964 with df = 544, so both predictors are significant. The 8-row class example reproduces
b₁ = 3.1479, b₂ = −1.6561, b₀ = −6.8675.
*Q:* A coefficient is significant; is it important?
*A:* Not necessarily; significance says the effect is not zero, importance is its size. Humidity's −29 per
percent is significant, but temperature's 157 per °C moves far more rentals over a typical range.

### 4.S Residual analysis (self-learning)
*Say:* Residual vs fitted, histogram of residuals, predicted vs actual with the 45° line; each of the five
assumptions gets one observation, e.g. the residual spread grows with the fitted value, so constant
variance is doubtful.
*Q:* Which assumption is most clearly violated?
*A:* Independence of errors: consecutive days have similar residuals because the series trends upward and
the model has no time term.

---

## Unit 5 — Anomaly detection (`/unit-5`)

### 5.1 Outliers and causes
*Say:* An outlier is an observation far from the rest. The causes from class: entry or sensor error (the
humidity 0 % row), measurement, natural variation (a cold clear weekend), genuine rare events (Hurricane
Irene, Hurricane Sandy with 22 rentals), sampling. Each known event is listed with its z-score.
*Q:* Should the storm days be removed?
*A:* No; they are genuine events, not errors. They are flagged and kept, and they become the subject of
this unit.

### 5.2 Techniques
*Say:* Three families: statistical (one variable, a threshold on z or the IQR), distance-based (how far
from the k-th neighbour), density-based (how much sparser than the neighbours). Unsupervised unless
labels exist; SMOTE covers the supervised, imbalanced case.
*Q:* Which family would you use first in practice?
*A:* Statistical, because it is simple and explainable; this unit shows why it is not enough on its own.

### 5.3 Statistical
*Say:* |z| > 3 on rentals flags 0 days and the 1.5 × IQR rule flags 0; even Sandy has z = −2.31, because
the distribution is wide. The same rule flags 2 wind-speed days and 2 raw-humidity days (the sensor error
among them).
*Q:* Why do the z and IQR rules agree here but disagree on skewed data?
*A:* The z rule assumes symmetry around the mean; the IQR rule uses quartiles. On this nearly symmetric
variable they coincide; on a skewed one the z rule misses the short tail and over-flags the long one.

### 5.4 Distance-based
*Say:* Standardise temperature and rentals, Manhattan distance to the 5th nearest neighbour. The top of the
list is 2011-08-27 (Hurricane Irene); Sandy is 3rd of 731. A warm day with almost no rentals has no
neighbours.
*Q:* Why standardise first?
*A:* Rentals are in thousands and temperature in tens of degrees; without standardising, rentals would
decide every distance.

### 5.5 Density-based: LOF
*Say:* k-distance, reach-dist, lrd and LOF in the class notation. The class example a, b, c, d with k = 2
reproduces LOF = 0.88, 1.33, 0.88, 2.00. On the real data with k = 20, 2011-08-27 has LOF = 2.58 (top),
Sandy 1.95 (rank 4); LOF ≈ 1 is normal, well above 1 is an outlier.
*Q:* What does LOF add over the k-NN distance?
*A:* It compares a point's density with its neighbours' density, so a point in a naturally sparse region is
not flagged just for being far from everything.

### 5.6 SMOTE
*Say:* Label high-demand = more than 7,000 rentals: 27 of 547 training days, about 1 : 19. SMOTE makes a
synthetic day on the line between a minority day and one of its 5 minority neighbours,
xᵢ + λ(x_zi − xᵢ), until the classes are 520 : 520 (493 synthetic). Logistic regression on the test days:
recall rises from 4.5 % to 91.0 %, precision from 20.0 % to 57.6 %, F1 from 0.07 to 0.71.
*Q:* Why does the model without SMOTE find almost no high-demand days?
*A:* With 1 : 19 imbalance the cheapest way to be right is to predict "normal" for everyone; SMOTE removes
that incentive by balancing the classes.

### 5.6 self-learning: confusion matrix, precision, recall, F1, AUC-PR
*Say:* The two confusion matrices side by side; false alarms rise from 12 to 45, misses fall from 64 to 6.
*Q:* Which error is worse for the operator?
*A:* A miss: an unexpected busy day with empty docks loses rides; an extra shift on a quiet day costs less.

---

## Unit 6 — Time series forecasting (`/unit-6`)

### 6.1 Taxonomy and decomposition
*Say:* The class tree: decomposition, smoothing, regression including ARIMA, machine learning. The monthly
series rises from 1,232 per day in Jan 2011 to a peak of 7,286 in Sep 2012: trend plus a yearly cycle.
On the 8 quarters, the centred 2×4 moving average gives the trend, Y − T the detrended values, the
seasonal table the indices adjusted to sum to 0 (additive) or 4 (multiplicative); trend per quarter then
forecast = trend + index. Additive fits better because the swing grew 6.5 % while the level grew 64.7 %.
2013 forecasts: 6,242, 8,558, 8,918, 7,910. The sales example reproduces 23.31 (additive) and 21.98
(multiplicative).
*Q:* Why a 2×4 centred moving average?
*A:* A 4-quarter average removes the seasonal cycle but sits between quarters; averaging two of them centres
it on a quarter, exactly as in the class example.

### 6.2 Average method, moving average, regression on time, ARIMA
*Say:* All forecast the 6 test months from the 18 training months. Average method: mean of all past.
Moving average k = 3 (and 12). Regression on t: y′ = ax + b with a = 210.78 per month (in this unit a is the
slope, as on the slides). ARIMA(1, 1, 0): one difference to remove the trend (the ADF check is the tagged
self-learning note), then regress on the previous change; chosen by lowest AIC among small orders.
*Q:* Why is a the slope here but the intercept in Unit 4?
*A:* The Unit 6 slides write y′ = ax + b; the Unit 4 slides write Y = a + bX. The page states the lettering
of each unit explicitly to avoid confusion.

### 6.3 Performance evaluation
*Say:* For each method the class table (t, y, F, e, |e|, e², |e|/y, naive error, Sum), then MAE, RMSE,
MAPE, MASE with the naive MAE from the training months as the MASE denominator. Best: moving average k = 3,
MAE 958, MAPE 19.5 %, MASE 1.72; worst: average method, MAE 1,926, MASE 3.46. Regression and ARIMA keep
rising after September because they have no seasonal term.
*Q:* Every MASE is above 1; does that mean the methods are useless?
*A:* It means none beat the one-step naive forecast on these six months, which is a hard benchmark when the
series turns; it is an honest result and the reason the limitations mention a seasonal term.

---

## Conclusion (`/conclusion`)

*Say:* Stage 5, knowledge and actions. One paragraph per unit with its headline numbers; eight finding →
action pairs (stock by temperature and humidity; plan the summer roster for about one high-demand day in
four; no separate weekend plan; monitor rentals with temperature to catch storm days; budget for growth;
use the last three months to forecast; use the balanced classifier as an early warning; always validate on
a later period); five limitations; the course conclusion.
*Q:* What is the single most useful result for the operator?
*A:* Demand depends on temperature and season, not on the weekday, and it is growing: 2012 averaged 5,600
rentals per day against 3,406 in 2011, so the fleet must be planned for growth and for summer.
