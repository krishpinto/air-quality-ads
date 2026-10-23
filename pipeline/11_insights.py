"""Module 11 - Insights: pull the headline numbers from every module's JSON.

Output: web/public/data/insights.json
"""
import json

from common import OUT, r, save

print("11_insights")
J = {name: json.load(open(OUT / f"{name}.json", encoding="utf-8")) for name in
     ["dataset", "descriptive", "correlation", "inference", "regression", "validation", "anomaly", "timeseries", "forecasting"]}

ds, de, co, inf, reg, val, an, ts, fo = (J[k] for k in ["dataset", "descriptive", "correlation", "inference", "regression", "validation", "anomaly", "timeseries", "forecasting"])
pm = next(v for v in de["variables"] if v["col"] == "pm25")
season_tab = {row["group"]: row for row in de["tabulation"]["season"]}
wind_tab = {row["group"]: row for row in de["tabulation"]["wind"]}
best_m = fo["monthly"]["table"][0]; best_d = fo["daily"]["table"][0]
naive_d = next(x for x in fo["daily"]["table"] if x["model"] == "Naive")
smote_lr = next(x for x in an["imbalance"]["results"] if x["model"] == "Logistic regression" and x["strategy"] == "SMOTE")
plain_lr = next(x for x in an["imbalance"]["results"] if x["model"] == "Logistic regression" and x["strategy"] == "No resampling")
full = reg["models"]["full"]; logm = reg["models"]["log"]
anova_season = inf["anova"]["season"]
weekend = next(t for t in inf["tests"] if t["id"] == "t_two_weekend")
paired = next(t for t in inf["tests"] if t["id"] == "t_paired")
adf_level = ts["stationarity"]["adf"][0]; adf_diff = ts["stationarity"]["adf"][1]

exec_summary = (
    f"Five years of hourly PM2.5 in Beijing ({ds['overview']['rows_clean']:,} valid hours) average {pm['mean']:.0f} µg/m³ - "
    f"{pm['mean']/75:.1f}× the national 24-hour limit and {pm['mean']/15:.0f}× the WHO guideline. The distribution is strongly right-skewed "
    f"(skewness {pm['skew']:.2f}, median {pm['median']:.0f}), so robust statistics and a log transform matter throughout. Pollution is driven by "
    f"meteorology: calm air and south-easterly winds trap particles (mean {wind_tab['cv']['mean']:.0f} and {wind_tab['SE']['mean']:.0f} µg/m³) while "
    f"north-westerly winds flush them out ({wind_tab['NW']['mean']:.0f} µg/m³). Weather alone explains about {100*full['r2']:.0f}% of hourly variance "
    f"in a linear model; the best daily forecast (walk-forward ARIMA) cuts RMSE from {naive_d['rmse']:.0f} (naive) to {best_d['rmse']:.0f} µg/m³."
)

findings = [
    {"module": "Descriptive", "title": "Heavily skewed, fat-tailed target", "detail": f"Mean {pm['mean']:.1f} vs median {pm['median']:.1f}; skewness {pm['skew']:.2f}, excess kurtosis {pm['kurtosis']:.1f}. {pm['outlier_pct']}% of hours sit above the IQR upper fence. log(1+PM2.5) brings skewness close to zero.", "stat": f"skew = {pm['skew']:.2f}"},
    {"module": "Descriptive", "title": "Winter and autumn are worst, by season and by hour", "detail": f"Season means: Winter {season_tab['Winter']['mean']:.0f}, Spring {season_tab['Spring']['mean']:.0f}, Summer {season_tab['Summer']['mean']:.0f}, Autumn {season_tab['Autumn']['mean']:.0f} µg/m³. Night hours are consistently higher than afternoon hours.", "stat": f"Winter {season_tab['Winter']['mean']:.0f} µg/m³"},
    {"module": "Correlation", "title": "Wind speed is the strongest single linear predictor", "detail": f"Pearson r(PM2.5, Iws) = {co['pairs'][0]['pearson']:.3f}; dew point r = {next(p for p in co['pairs'] if p['var']=='DEWP')['pearson']:.3f}. Spearman is larger in magnitude than Pearson for wind speed, pointing to a non-linear (saturating) relationship.", "stat": f"r = {co['pairs'][0]['pearson']:.2f}"},
    {"module": "Inference", "title": "Normality is rejected everywhere, CLT still works", "detail": f"Jarque-Bera on PM2.5: p {inf['normal']['pm25']['tests'][1]['p']:.2g}. Yet the mean of n=30 random hours has skewness {next(b for b in inf['clt']['by_n'] if b['n']==30)['skew']:.2f} and its spread matches σ/√n ({next(b for b in inf['clt']['by_n'] if b['n']==30)['sd_of_means']:.1f} vs {next(b for b in inf['clt']['by_n'] if b['n']==30)['se_theory']:.1f}).", "stat": "JB p < 0.0001"},
    {"module": "Inference", "title": "Season explains a significant share of daily variation", "detail": f"One-way ANOVA F({anova_season['table']['df_between']}, {anova_season['table']['df_within']}) = {anova_season['F']:.1f}, p = {anova_season['p']:.2g}, η² = {anova_season['eta2']:.3f}. Tukey HSD separates winter/autumn from summer; Kruskal-Wallis agrees.", "stat": f"F = {anova_season['F']:.1f}"},
    {"module": "Inference", "title": "No weekend effect; no 2010→2014 improvement", "detail": f"Weekend vs weekday Welch t = {weekend['stat']:.2f}, p = {weekend['p']:.3f}. Paired t-test on 12 calendar months 2014 vs 2010: mean change {paired['mean_diff']:+.1f} µg/m³, p = {paired['p']:.3f}.", "stat": f"p = {weekend['p']:.2f}"},
    {"module": "Regression", "title": "Weather explains a modest share of hourly PM2.5", "detail": f"Model B (weather + wind direction): R² = {full['r2']:.3f}, adjusted R² = {full['adj_r2']:.3f}, F = {full['F']:.0f} (p < 0.0001). Dew point has the largest standardised coefficient; adding wind dummies improves fit significantly (nested F p = {reg['nested']['p']:.2g}). The log-target model has better residual behaviour (Jarque-Bera skew {logm['jarque_bera']['skew']:.2f} vs {full['jarque_bera']['skew']:.2f}).", "stat": f"R² = {full['r2']:.2f}"},
    {"module": "Regression", "title": "Residuals are autocorrelated and heteroscedastic", "detail": f"Durbin-Watson = {full['durbin_watson']:.2f} (strong positive autocorrelation - hourly rows are not independent); Breusch-Pagan p = {full['breusch_pagan']['p']:.2g}. OLS standard errors are therefore optimistic; a time-series model is needed.", "stat": f"DW = {full['durbin_watson']:.2f}"},
    {"module": "Validation", "title": "Random hold-out flatters time-ordered data", "detail": f"Random 80/20 test R² for the random forest is {val['holdout'][2]['test']['r2']:.3f}, but the chronological split (train 2010-13, test 2014) gives {val['holdout'][3]['test']['r2']:.3f}. 5-fold CV R² for linear regression: {val['kfold']['lr_k5']['mean_r2']:.3f} ± {val['kfold']['lr_k5']['std_r2']:.4f}.", "stat": f"R² {val['holdout'][2]['test']['r2']:.2f} → {val['holdout'][3]['test']['r2']:.2f}"},
    {"module": "Anomaly", "title": "Multivariate methods find the January 2013 episode", "detail": f"Mahalanobis flags {an['methods'][3]['count']} days, LOF {an['methods'][5]['count']}, z-score {an['methods'][0]['count']}. The top-ranked day is {an['top'][0]['date']} (daily mean {an['top'][0]['pm25']:.0f} µg/m³, hourly max {an['top'][0]['pm25_max']:.0f}).", "stat": f"{an['methods'][3]['count']} days"},
    {"module": "Anomaly", "title": "SMOTE trades precision for recall on severe days", "detail": f"Severe days (> {an['imbalance']['threshold']} µg/m³) are {an['imbalance']['overall']['pos_pct']}% of days (1:{an['imbalance']['overall']['ratio']:.0f}). Logistic regression recall rises from {100*plain_lr['recall']:.0f}% to {100*smote_lr['recall']:.0f}% with SMOTE while precision falls from {100*plain_lr['precision']:.0f}% to {100*smote_lr['precision']:.0f}%. ROC-AUC barely moves ({plain_lr['roc_auc']:.3f} → {smote_lr['roc_auc']:.3f}) - resampling shifts the threshold, not the ranking.", "stat": f"recall {100*plain_lr['recall']:.0f}% → {100*smote_lr['recall']:.0f}%"},
    {"module": "Time series", "title": "Level is stationary; seasonality is annual", "detail": f"ADF on monthly PM2.5: p = {adf_level['p']:.3f}; first difference p = {adf_diff['p']:.2g}. Linear trend {ts['trend']['slope_per_year']:+.2f} µg/m³ per year (p = {ts['trend']['p']:.2f}) - no significant long-run trend 2010-2014. Seasonal strength {ts['decomposition']['strength']['seasonal']:.2f}.", "stat": f"trend p = {ts['trend']['p']:.2f}"},
    {"module": "Forecasting", "title": "Short-horizon ARIMA beats naive; monthly forecasting is hard", "detail": f"Daily (61-day test): best model {best_d['model']} RMSE {best_d['rmse']:.1f}, MASE {best_d['mase']:.2f} vs naive RMSE {naive_d['rmse']:.1f}. Monthly (12-month test): best {best_m['model']} RMSE {best_m['rmse']:.1f}, MAPE {best_m['mape']:.0f}%.", "stat": f"MASE {best_d['mase']:.2f}"},
]

model_comparison = [
    {"task": "Hourly PM2.5 (regression)", "model": "Linear regression (weather + wind)", "metric": "Test R² (2014)", "value": val["holdout"][1]["test"]["r2"], "secondary": f"RMSE {val['holdout'][1]['test']['rmse']:.1f}"},
    {"task": "Hourly PM2.5 (regression)", "model": "Random forest", "metric": "Test R² (2014)", "value": val["holdout"][3]["test"]["r2"], "secondary": f"RMSE {val['holdout'][3]['test']['rmse']:.1f}"},
    {"task": "Severe day (classification)", "model": "Logistic regression", "metric": "F1", "value": plain_lr["f1"], "secondary": f"recall {plain_lr['recall']:.2f}"},
    {"task": "Severe day (classification)", "model": "Logistic regression + SMOTE", "metric": "F1", "value": smote_lr["f1"], "secondary": f"recall {smote_lr['recall']:.2f}"},
    {"task": "Severe day (classification)", "model": "Random forest + SMOTE", "metric": "F1", "value": next(x for x in an["imbalance"]["results"] if x["model"] == "Random forest" and x["strategy"] == "SMOTE")["f1"], "secondary": f"ROC-AUC {next(x for x in an['imbalance']['results'] if x['model']=='Random forest' and x['strategy']=='SMOTE')['roc_auc']:.3f}"},
    {"task": "Daily forecast (61 d)", "model": "Naive", "metric": "RMSE", "value": naive_d["rmse"], "secondary": f"MASE {naive_d['mase']:.2f}"},
    {"task": "Daily forecast (61 d)", "model": best_d["model"], "metric": "RMSE", "value": best_d["rmse"], "secondary": f"MASE {best_d['mase']:.2f}"},
    {"task": "Monthly forecast (12 m)", "model": best_m["model"], "metric": "RMSE", "value": best_m["rmse"], "secondary": f"MAPE {best_m['mape']:.1f}%"},
]

limitations = [
    "One monitoring station (US Embassy) and one weather station: results describe central Beijing, not the whole city.",
    f"{ds['overview']['rows_dropped']:,} hours ({ds['overview']['pct_dropped']}%) have no PM2.5 reading and were dropped; {ds['overview']['missing_days_interpolated']} whole days were interpolated for the daily series.",
    "Hourly observations are strongly autocorrelated (Durbin-Watson far below 2), so classical p-values from OLS, t-tests and ANOVA on hourly rows are too small. Daily aggregates were used for the tests where this matters.",
    "No emission data (traffic, heating, industry) - weather can only explain the dispersion side of pollution, hence the modest R².",
    "Forecast models are evaluated on a single chronological split (2014). A different test year would give different error numbers.",
    "The ARIMAX model assumes the weather of the forecast day is known exactly; in practice it would come from a weather forecast with its own error.",
    "SMOTE creates synthetic minority rows by interpolating between neighbours; with only ~140 severe days in training the synthetic points may not reflect real severe-day weather.",
]
recommendations = [
    "Report PM2.5 with median and IQR, not mean and SD - the mean is pulled up by a few extreme days.",
    "Issue public health warnings when the forecast shows calm or south-easterly wind with high dew point in winter; these three conditions carry most of the signal.",
    "Use recall-oriented classifiers (SMOTE or class weights) for severe-day alerts: a missed hazardous day costs more than a false alarm.",
    "Prefer walk-forward evaluation and chronological splits for any model that will be used operationally.",
    "Add exogenous drivers (emissions, regional transport, boundary-layer height) to lift the explained variance beyond what local weather provides.",
    "For monthly planning use seasonal-naive or Holt-Winters as a floor; the annual cycle is the only reliable monthly structure.",
]

save("insights", {"executive_summary": exec_summary, "findings": findings, "model_comparison": model_comparison, "limitations": limitations,
                  "recommendations": recommendations,
                  "headline": {"mean_pm25": pm["mean"], "median_pm25": pm["median"], "skew": pm["skew"], "hours": ds["overview"]["rows_clean"], "days": ds["overview"]["daily_rows"],
                               "pct_unhealthy": next(a for a in ds["categorical"]["aqi"] if a["key"] == "Unhealthy")["pct"] + next(a for a in ds["categorical"]["aqi"] if a["key"] == "Very unhealthy")["pct"] + next(a for a in ds["categorical"]["aqi"] if a["key"] == "Hazardous")["pct"],
                               "r2_full": full["r2"], "best_daily_model": best_d["model"], "best_daily_rmse": best_d["rmse"], "naive_daily_rmse": naive_d["rmse"],
                               "smote_recall_gain": r(smote_lr["recall"] - plain_lr["recall"], 3)}})
