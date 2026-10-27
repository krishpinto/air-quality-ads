"""Unit 1 - Introduction to Data Science (syllabus 1.1 - 1.6).

Runs FIRST in the pipeline: it calls build_tables() from common.py, which cleans the raw
day.csv and writes the daily / monthly / quarterly tables every later unit reads.

What it computes
    1.1  The raw data description (16 columns), the subject-area facts, correlation vs causation.
    1.2  Volume / dimensions / complexity of this dataset; the data science tasks used.
    1.3  Data preparation: explore first (mean vs median table), the five cleaning checks,
         the transformations, feature selection, the chronological training/test split.
    1.4  Model validation on the simplest model (rentals = a + b x temperature):
         hold-out, 5-fold cross-validation, leave-one-out on the 18 training months,
         bootstrapping (B = 5 shown, B = 200 for the slope distribution).
    1.5  The analytics question (which month of 2012 had the most rentals; why December dropped)
         answered with a table; the data science question pointed at Unit 6.

Inputs:  data/raw/day.csv (via common.build_tables / load_daily / load_monthly / load_quarterly)
Output:  web/public/data/unit1.json
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from common import (
    HIGH_DEMAND, LABELS, SEASON_LABELS, WEATHER_LABELS, WEEKDAY_LABELS, TEST_START,
    build_tables, hist, load_daily, load_monthly, load_quarterly, load_raw,
    pearson_r_actual_mean, r, save, sd_population, train_test,
)

RNG_SEED = 2011          # every random draw in this script uses this seed
K_FOLDS = 5
B_SHOWN = 5
B_FULL = 200


# ----------------------------------------------------------------------------- the model being validated (1.4)
def fit_line(x, y) -> tuple[float, float]:
    """1.4: the straight line Y = a + bX fitted by least squares (the formulas are Unit 4's job)."""
    x = np.asarray(x, dtype=float); y = np.asarray(y, dtype=float)
    n = len(x)
    b = (n * (x * y).sum() - x.sum() * y.sum()) / (n * (x ** 2).sum() - x.sum() ** 2)
    a = (y.sum() - b * x.sum()) / n
    return float(a), float(b)


def mae(y, yhat) -> float:
    """1.4: mean absolute error MAE = (1/n) Σ|Y − Ŷ|."""
    y = np.asarray(y, dtype=float); yhat = np.asarray(yhat, dtype=float)
    return float(np.mean(np.abs(y - yhat)))


# ----------------------------------------------------------------------------- 1.1 prior knowledge
RAW_COLUMNS = [
    # name, type, meaning
    ("instant", "Integer id", "Record index 1 … 731"),
    ("dteday", "Date (text)", "The calendar day, written as text yyyy-mm-dd"),
    ("season", "Category code", "1 Winter, 2 Spring, 3 Summer, 4 Fall (astronomical seasons)"),
    ("yr", "Binary 0 / 1", "0 = 2011, 1 = 2012"),
    ("mnth", "Category code", "Month 1 … 12"),
    ("holiday", "Binary 0 / 1", "1 if the day is a public holiday (DC holiday schedule)"),
    ("weekday", "Category code", "Day of the week, 0 = Sunday … 6 = Saturday"),
    ("workingday", "Binary 0 / 1", "1 if the day is neither a weekend nor a holiday"),
    ("weathersit", "Category code", "1 Clear, 2 Mist / cloudy, 3 Light rain / snow (4 Heavy rain never occurs)"),
    ("temp", "Numeric, normalised", "Temperature in °C divided by 41 (so it lies between 0 and 1)"),
    ("atemp", "Numeric, normalised", "Feels-like temperature in °C divided by 50"),
    ("hum", "Numeric, normalised", "Relative humidity in % divided by 100"),
    ("windspeed", "Numeric, normalised", "Wind speed in km/h divided by 67"),
    ("casual", "Count", "Rentals by casual (non-member) users that day"),
    ("registered", "Count", "Rentals by registered members that day"),
    ("cnt", "Count (target)", "Total rentals that day = casual + registered"),
]


def section_1_1(raw: pd.DataFrame, daily: pd.DataFrame) -> dict:
    """1.1 Prior knowledge: objective, subject area, the raw data columns, correlation vs causation."""
    columns = []
    for name, typ, meaning in RAW_COLUMNS:
        col = raw[name]
        if name == "dteday":
            lo, hi, uniq = str(col.min()), str(col.max()), int(col.nunique())
        else:
            lo, hi, uniq = r(col.min(), 4), r(col.max(), 4), int(col.nunique())
        columns.append({"name": name, "type": typ, "meaning": meaning, "min": lo, "max": hi, "distinct": uniq})

    # subject area: why weather and working days matter (group means of the target)
    by_weather = (daily.groupby("weather_name")["cnt"].agg(["mean", "count"]).reindex(["Clear", "Mist / cloudy", "Light rain / snow"]))
    by_daytype = daily.groupby("day_type")["cnt"].agg(["mean", "count"]).reindex(["Working day", "Weekend", "Holiday"])
    by_season = daily.groupby("season_name")["cnt"].agg(["mean", "count"]).reindex(["Winter", "Spring", "Summer", "Fall"])
    share_registered = float(daily["registered"].sum() / daily["cnt"].sum())

    # correlation vs causation: temperature -> rentals is the business-sensible direction
    corr = pearson_r_actual_mean(daily["temp_c"], daily["cnt"])

    return {
        "source": {
            "name": "UCI Machine Learning Repository, Bike Sharing Dataset (id 275)",
            "authors": "Fanaee-T & Gama (2013)", "system": "Capital Bikeshare, Washington DC, USA",
            "file": "day.csv", "weather_source": "freemeteo.com", "holiday_source": "DC holiday schedule (dchr.dc.gov)",
        },
        "rows": int(len(raw)), "columns": int(raw.shape[1]),
        "start": str(raw["dteday"].min()), "end": str(raw["dteday"].max()),
        "columns_table": columns,
        "target": {"mean": r(daily["cnt"].mean(), 1), "median": r(daily["cnt"].median(), 1),
                   "min": int(daily["cnt"].min()), "max": int(daily["cnt"].max()),
                   "min_date": daily.loc[daily["cnt"].idxmin(), "date"].strftime("%Y-%m-%d"),
                   "max_date": daily.loc[daily["cnt"].idxmax(), "date"].strftime("%Y-%m-%d"),
                   "share_registered": r(share_registered, 3)},
        "by_weather": [{"group": k, "mean_cnt": r(v["mean"], 0), "days": int(v["count"])} for k, v in by_weather.iterrows()],
        "by_daytype": [{"group": k, "mean_cnt": r(v["mean"], 0), "days": int(v["count"])} for k, v in by_daytype.iterrows()],
        "by_season": [{"group": k, "mean_cnt": r(v["mean"], 0), "days": int(v["count"])} for k, v in by_season.iterrows()],
        "corr_temp_cnt": corr,
    }


# ----------------------------------------------------------------------------- 1.2 motivation
def section_1_2(raw: pd.DataFrame, daily: pd.DataFrame) -> dict:
    """1.2 Volume, dimensions, complexity for this dataset; the data science tasks the project uses."""
    numeric_cols = ["temp", "atemp", "hum", "windspeed", "casual", "registered", "cnt"]
    category_cols = ["season", "yr", "mnth", "holiday", "weekday", "workingday", "weathersit"]
    return {
        "volume": {"rows": int(len(raw)), "columns": int(raw.shape[1]), "cells": int(raw.size),
                   "file_kb": r(raw.memory_usage(index=False, deep=True).sum() / 1024, 1),
                   "years": 2, "days_per_year": r(len(raw) / 2, 1)},
        "dimensions": {"attributes": int(raw.shape[1]), "numeric": len(numeric_cols), "category": len(category_cols),
                       "id_and_date": 2, "weather_predictors": 4, "calendar_predictors": 7,
                       "numeric_cols": numeric_cols, "category_cols": category_cols},
        "complexity": {
            "confirmatory": [
                {"question": "Do working days have more rentals than weekends and holidays?", "unit": "Unit 3 (t-test)"},
                {"question": "Is the mean of 2012 different from the mean of 2011?", "unit": "Unit 3 (Z-test)"},
                {"question": "Do the four seasons differ in rentals?", "unit": "Unit 3 (ANOVA)"},
            ],
            "exploratory": [
                {"question": "How many rentals does a day with a given temperature and humidity get?", "unit": "Unit 4 (regression)"},
                {"question": "Which days are unusual compared with every other day?", "unit": "Unit 5 (anomaly detection)"},
                {"question": "How many rentals per day will there be in the next six months?", "unit": "Unit 6 (time series forecasting)"},
            ],
        },
        "tasks_used": [
            {"task": "Regression", "description": "Predict the numeric target label of a data point. The prediction will be based on learning from a known dataset",
             "algorithms": "Linear regression, logistic regression", "here": "Predict daily rentals (cnt) from temperature and humidity", "unit": "Unit 4"},
            {"task": "Anomaly detection", "description": "Predict if a data point is an outlier compared to other data points in the dataset",
             "algorithms": "Distance-based, density-based, LOF", "here": "Find the days whose rentals do not fit the weather (e.g. the hurricane day)", "unit": "Unit 5"},
            {"task": "Time series forecasting", "description": "Predict the value of the target variable for a future timeframe based on historical values",
             "algorithms": "Exponential smoothing, ARIMA, regression", "here": "Forecast monthly rentals for the six test months", "unit": "Unit 6"},
        ],
        "tasks_not_used": [
            {"task": "Classification", "why": "the target is a count, not a class (Unit 5 only builds a high-demand label for SMOTE)"},
            {"task": "Clustering", "why": "we are not looking for groups of similar days"},
            {"task": "Association analysis", "why": "there are no transactions with items bought together"},
            {"task": "Recommendation engines", "why": "there are no users rating items"},
        ],
    }


# ----------------------------------------------------------------------------- 1.3 data preparation
def explore_table(daily: pd.DataFrame) -> list[dict]:
    """1.3 Step 2-A Explore first: mean, median, σ (÷N), min, max for the main numeric attributes."""
    rows = []
    for col in ["cnt", "temp_c", "hum_pct", "wind_kmh"]:
        v = daily[col].to_numpy(dtype=float)
        mean, med = float(v.mean()), float(np.median(v))
        rows.append({"attribute": col, "label": LABELS[col], "n": int(len(v)),
                     "mean": r(mean, 2), "median": r(med, 2), "sd": r(sd_population(v), 2),
                     "min": r(v.min(), 2), "max": r(v.max(), 2),
                     "mean_minus_median": r(mean - med, 2),
                     "gap_pct_of_median": r(100 * (mean - med) / med, 1)})
    return rows


def clean_checks(raw: pd.DataFrame, daily: pd.DataFrame, prep: dict) -> list[dict]:
    """1.3 Step 2-B Clean: the five issue types from class, what was checked and what was found."""
    codes = {c: sorted(int(v) for v in raw[c].unique()) for c in ["season", "yr", "holiday", "workingday", "weathersit"]}
    dup_dates = int(raw["dteday"].duplicated().sum())
    dup_rows = int(raw.duplicated().sum())
    missing_total = int(sum(prep["missing_before"].values()))
    inv = prep["invalid"]
    fixed = prep["invalid_fixed"]
    z = (daily["cnt"] - daily["cnt"].mean()) / sd_population(daily["cnt"])
    n_z3 = int((z.abs() > 3).sum())
    lowest = daily.loc[daily["cnt"].idxmin()]
    return [
        {"issue": "Inconsistent values", "class_example": "\"NY\" vs \"New York\"",
         "checked": "Every category column uses one set of codes only",
         "found": "season " + str(codes["season"]) + ", yr " + str(codes["yr"]) + ", holiday " + str(codes["holiday"])
                  + ", workingday " + str(codes["workingday"]) + ", weathersit " + str(codes["weathersit"]) + " - no spelling variants, the codes are numbers",
         "count": 0, "fix": "Nothing to fix", "result": "Codes mapped to labels in Transform"},
        {"issue": "Duplicate records", "class_example": "Borrower 04 repeated",
         "checked": "Repeated dates and repeated whole rows",
         "found": f"{dup_dates} repeated dates, {dup_rows} repeated rows; {prep['rows_raw']} rows for {prep['expected_days']} calendar days",
         "count": dup_rows, "fix": "Nothing to drop", "result": f"{prep['rows_raw']} rows → {prep['rows_clean']} rows"},
        {"issue": "Missing values", "class_example": "Borrower 11 income blank",
         "checked": "Blank cells in all 16 columns",
         "found": f"{missing_total} blank cells", "count": missing_total,
         "fix": "Nothing to impute", "result": "No blanks"},
        {"issue": "Invalid data", "class_example": "Credit score 900 (scale ends at 850)",
         "checked": "cnt = casual + registered on every row; no negative counts; normalised weather inside 0–1; codes inside their range; humidity 0 % is impossible outdoors",
         "found": f"{inv['cnt_not_casual_plus_registered']} rows where cnt ≠ casual + registered, {inv['negative_counts']} negative counts, "
                  f"{inv['normalised_out_of_0_1']} weather values outside 0–1, {len(fixed)} day with humidity 0 % ({', '.join(f['date'] for f in fixed)})",
         "count": len(fixed),
         "fix": "Like capping 900 to 850: replaced with the mean of the day before and the day after"
                + (f" ({fixed[0]['replaced_with_pct']} %)" if fixed else ""),
         "result": "All humidity values are possible"},
        {"issue": "Outliers", "class_example": "Income $1.25M flagged, not deleted",
         "checked": "Days with |z| > 3 on cnt (mean ± 3σ)",
         "found": f"{n_z3} days beyond 3σ; the lowest day is {lowest['date'].strftime('%Y-%m-%d')} with cnt = {int(lowest['cnt'])} (z = {float(z.loc[lowest.name]):.2f})",
         "count": n_z3, "fix": "Flagged, not deleted - treated in Unit 5", "result": "All 731 days kept"},
    ]


def transform_tables(raw: pd.DataFrame, daily: pd.DataFrame, prep: dict) -> dict:
    """1.3 Step 2-B Transform: types, de-normalisation, derived attributes, feature selection, sampling, split."""
    first = raw.iloc[0]
    d0 = daily.iloc[0]
    types = [
        {"column": "dteday", "raw_type": "text", "converted": "date", "example": f"\"{first['dteday']}\" → {d0['date'].strftime('%Y-%m-%d')} (a real date, so it sorts and groups by month)"},
        {"column": "season", "raw_type": "code 1–4", "converted": "label season_name", "example": f"{int(first['season'])} → {SEASON_LABELS[int(first['season'])]}"},
        {"column": "weathersit", "raw_type": "code 1–3", "converted": "label weather_name", "example": f"{int(first['weathersit'])} → {WEATHER_LABELS[int(first['weathersit'])]}"},
        {"column": "weekday", "raw_type": "code 0–6", "converted": "label weekday_name", "example": f"{int(first['weekday'])} → {WEEKDAY_LABELS[int(first['weekday'])]}"},
        {"column": "holiday, workingday", "raw_type": "two 0/1 flags", "converted": "one label day_type", "example": f"holiday {int(first['holiday'])}, workingday {int(first['workingday'])} → {d0['day_type']}"},
    ]
    denorm = []
    for raw_col, factor, new_col, unit in [("temp", 41, "temp_c", "°C"), ("atemp", 50, "atemp_c", "°C"), ("hum", 100, "hum_pct", "%"), ("windspeed", 67, "wind_kmh", "km/h")]:
        denorm.append({"raw": raw_col, "factor": factor, "new": new_col, "unit": unit,
                       "example_raw": r(first[raw_col], 4), "example_new": r(first[raw_col] * factor, 1),
                       "min": r(daily[new_col].min(), 1), "max": r(daily[new_col].max(), 1)})
    derived = [
        {"name": "year, month, quarter", "rule": "taken from the date", "example": f"{d0['date'].strftime('%Y-%m-%d')} → {int(d0['year'])}, {int(d0['month'])}, Q{int(d0['quarter'])}"},
        {"name": "day_type", "rule": "Holiday if holiday = 1, else Working day if workingday = 1, else Weekend", "example": d0["day_type"]},
        {"name": "t", "rule": "time index 1 … 731, one step per day (Unit 6 regresses on it)", "example": f"first day t = {int(d0['t'])}, last day t = {int(daily['t'].max())}"},
        {"name": "high_demand", "rule": f"1 if cnt > {HIGH_DEMAND:,}, else 0 (the class label Unit 5 uses for SMOTE)", "example": f"{int(daily['high_demand'].sum())} of {len(daily)} days are 1 ({100 * daily['high_demand'].mean():.1f} %)"},
        {"name": "monthly, quarterly tables", "rule": "mean cnt per day in each month (24 rows) and each quarter (8 rows)", "example": f"{prep['monthly_rows']} months, {prep['quarterly_rows']} quarters"},
    ]
    kept = [
        {"column": "cnt", "role": "target", "units": "Units 2–6"},
        {"column": "temp_c, atemp_c, hum_pct, wind_kmh", "role": "weather predictors (de-normalised)", "units": "Units 2, 4, 5, 6"},
        {"column": "season_name, weather_name, day_type, year, month, quarter", "role": "calendar groups", "units": "Units 2, 3"},
        {"column": "casual, registered", "role": "the two parts of cnt", "units": "Unit 2 (sub-divided bars)"},
        {"column": "t", "role": "time index", "units": "Unit 6"},
        {"column": "high_demand", "role": "class label", "units": "Unit 5 (SMOTE)"},
    ]
    dropped = [
        {"column": "instant", "why": "a unique identifier carries no information (like borrower_id in class)"},
        {"column": "dteday", "why": "replaced by the real date column"},
        {"column": "temp, atemp, hum, windspeed", "why": "the normalised originals - replaced by their de-normalised versions"},
    ]
    train, test = train_test(daily)
    split = {
        "rule": "two-thirds training data, one-third held out for testing",
        "why_chronological": "the rows are days in time order, so the test days must come after the training days - we cannot shuffle time",
        "train_start": train["date"].min().strftime("%Y-%m-%d"), "train_end": train["date"].max().strftime("%Y-%m-%d"),
        "test_start": test["date"].min().strftime("%Y-%m-%d"), "test_end": test["date"].max().strftime("%Y-%m-%d"),
        "train_days": int(len(train)), "test_days": int(len(test)),
        "train_pct": r(100 * len(train) / len(daily), 1), "test_pct": r(100 * len(test) / len(daily), 1),
        "train_months": prep["train_months"], "test_months": prep["test_months"],
        "boundary": TEST_START.strftime("%Y-%m-%d"),
    }
    series = [{"date": d.strftime("%Y-%m-%d"), "cnt": int(c)} for d, c in zip(daily["date"], daily["cnt"])]
    return {
        "types": types, "denormalise": denorm, "derived": derived,
        "kept": kept, "dropped": dropped,
        "sampling": {"rows": int(len(daily)), "needed": False,
                     "why": f"{len(daily)} rows fit in memory and every model below runs in seconds, so we use every day; stratified sampling is only needed for rare classes"},
        "split": split, "daily_series": series,
    }


# ----------------------------------------------------------------------------- 1.4 model validation
def holdout(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    """1.4 Hold-out validation: fit on the training days, MAE on training and on test days."""
    a, b = fit_line(train["temp_c"], train["cnt"])
    pred_tr = a + b * train["temp_c"].to_numpy()
    pred_te = a + b * test["temp_c"].to_numpy()
    # a few rows so the error measure is visible, not just the summary
    sample = test.iloc[[0, 30, 60, 90, 120, 150, 183]]
    rows = [{"date": d.strftime("%Y-%m-%d"), "temp_c": r(t, 1), "cnt": int(c), "pred": r(a + b * t, 0), "abs_err": r(abs(c - (a + b * t)), 0)}
            for d, t, c in zip(sample["date"], sample["temp_c"], sample["cnt"])]
    return {"a": r(a, 2), "b": r(b, 2), "n_train": int(len(train)), "n_test": int(len(test)),
            "mae_train": r(mae(train["cnt"], pred_tr), 1), "mae_test": r(mae(test["cnt"], pred_te), 1),
            "sum_abs_err_train": r(np.abs(train["cnt"].to_numpy() - pred_tr).sum(), 0),
            "sum_abs_err_test": r(np.abs(test["cnt"].to_numpy() - pred_te).sum(), 0),
            "sample_rows": rows}


def kfold(train: pd.DataFrame, k: int = K_FOLDS) -> dict:
    """1.4 K-fold cross-validation, k = 5, folds are blocks of time (no shuffling), MAE_cv = (1/k) Σ MAE_i."""
    idx = np.arange(len(train))
    folds = np.array_split(idx, k)          # like the class folds {01,02},{03,04},... but with days
    rows = []
    for i, val in enumerate(folds, start=1):
        tr = np.setdiff1d(idx, val)
        a, b = fit_line(train["temp_c"].iloc[tr], train["cnt"].iloc[tr])
        pred = a + b * train["temp_c"].iloc[val].to_numpy()
        rows.append({"fold": i,
                     "val_start": train["date"].iloc[val[0]].strftime("%Y-%m-%d"),
                     "val_end": train["date"].iloc[val[-1]].strftime("%Y-%m-%d"),
                     "n_val": int(len(val)), "n_train": int(len(tr)),
                     "a": r(a, 2), "b": r(b, 2), "mae": r(mae(train["cnt"].iloc[val], pred), 1)})
    maes = [row["mae"] for row in rows]
    return {"k": k, "folds": rows, "sum_mae": r(sum(maes), 1), "mae_cv": r(sum(maes) / k, 1),
            "mae_min": r(min(maes), 1), "mae_max": r(max(maes), 1)}


def loocv_monthly(monthly: pd.DataFrame) -> dict:
    """1.4 Leave-one-out on a SMALL dataset: the 18 training months, one model per month."""
    m = monthly[monthly["split"] == "train"].reset_index(drop=True)
    n = len(m)
    rows = []
    for i in range(n):
        keep = [j for j in range(n) if j != i]
        a, b = fit_line(m["temp_c"].iloc[keep], m["cnt"].iloc[keep])
        pred = a + b * m["temp_c"].iloc[i]
        rows.append({"iteration": i + 1, "month": m["date"].iloc[i].strftime("%Y-%m-%d"),
                     "temp_c": r(m["temp_c"].iloc[i], 1), "cnt": r(m["cnt"].iloc[i], 0),
                     "a": r(a, 1), "b": r(b, 1), "pred": r(pred, 0), "abs_err": r(abs(m["cnt"].iloc[i] - pred), 0)})
    errs = [row["abs_err"] for row in rows]
    return {"n": n, "rows": rows, "sum_abs_err": r(sum(errs), 0), "mae": r(sum(errs) / n, 1)}


def bootstrap(train: pd.DataFrame, b_shown: int = B_SHOWN, b_full: int = B_FULL, seed: int = RNG_SEED) -> dict:
    """1.4 Bootstrapping: samples drawn with replacement, same size as the training set; B = 5 shown, B = 200 for the slope."""
    rng = np.random.default_rng(seed)
    n = len(train)
    x = train["temp_c"].to_numpy(dtype=float); y = train["cnt"].to_numpy(dtype=float)
    shown, slopes, intercepts = [], [], []
    for s in range(1, b_full + 1):
        pick = rng.integers(0, n, size=n)                 # with replacement, size n
        a, b = fit_line(x[pick], y[pick])
        slopes.append(b); intercepts.append(a)
        if s <= b_shown:
            distinct = int(len(np.unique(pick)))
            counts = np.bincount(pick, minlength=n)
            shown.append({"sample": s, "size": n, "distinct_days": distinct, "repeated_draws": n - distinct,
                          "max_times_one_day": int(counts.max()),
                          "first_draws": [train["date"].iloc[j].strftime("%Y-%m-%d") for j in pick[:4]],
                          "a": r(a, 2), "b": r(b, 2), "mae": r(mae(y[pick], a + b * x[pick]), 1)})
    slopes = np.asarray(slopes)
    lo, hi = np.percentile(slopes, [2.5, 97.5])
    return {"B_shown": b_shown, "B_full": b_full, "size": n, "seed": seed, "samples": shown,
            "slope_mean": r(slopes.mean(), 2), "slope_sd": r(sd_population(slopes), 2),
            "slope_lo": r(lo, 2), "slope_hi": r(hi, 2), "slope_min": r(slopes.min(), 2), "slope_max": r(slopes.max(), 2),
            "intercept_mean": r(np.mean(intercepts), 1),
            "slope_hist": hist(slopes, bins=20)}


# ----------------------------------------------------------------------------- 1.5 analytics vs science
def section_1_5(daily: pd.DataFrame, monthly: pd.DataFrame, quarterly: pd.DataFrame) -> dict:
    """1.5 The analytics question answered with a table (looks back); the data science question pointed at Unit 6 (looks ahead)."""
    y12 = daily[daily["year"] == 2012]
    g = y12.groupby("month")
    rows = []
    for mth, grp in g:
        rows.append({"month": int(mth), "label": pd.Timestamp(2012, int(mth), 1).strftime("%b %Y"),
                     "days": int(len(grp)), "total": int(grp["cnt"].sum()), "mean_per_day": r(grp["cnt"].mean(), 0),
                     "mean_temp_c": r(grp["temp_c"].mean(), 1), "rain_days": int((grp["weathersit"] == 3).sum()),
                     "holidays": int(grp["holiday"].sum()), "working_days": int(grp["workingday"].sum())})
    best = max(rows, key=lambda x: x["total"])
    nov = next(x for x in rows if x["month"] == 11); dec = next(x for x in rows if x["month"] == 12)
    last_q = quarterly.iloc[-1]
    return {
        "year": 2012, "months": rows, "best_month": best,
        "december_drop": {"nov": nov, "dec": dec,
                          "drop_total": int(nov["total"] - dec["total"]), "drop_pct": r(100 * (nov["total"] - dec["total"]) / nov["total"], 1),
                          "temp_change": r(dec["mean_temp_c"] - nov["mean_temp_c"], 1)},
        "science": {"question": "How many rentals per day will there be next quarter?",
                    "last_quarter": f"{int(last_q['year'])} Q{int(last_q['quarter'])}", "last_quarter_mean": r(last_q["cnt"], 0),
                    "last_quarter_total": int(last_q["cnt_total"]), "next_quarter": "2013 Q1", "unit": "Unit 6"},
    }


# ----------------------------------------------------------------------------- main
def main() -> None:
    print("Unit 1: building the tables (common.build_tables) ...")
    prep = build_tables()
    raw = load_raw()
    daily = load_daily()
    monthly = load_monthly()
    quarterly = load_quarterly()
    train, test = train_test(daily)

    s11 = section_1_1(raw, daily)
    s12 = section_1_2(raw, daily)
    explore = explore_table(daily)
    clean = clean_checks(raw, daily, prep)
    transform = transform_tables(raw, daily, prep)

    ho = holdout(train, test)
    kf = kfold(train)
    loo = loocv_monthly(monthly)
    loo["models_if_daily"] = int(len(train))
    bs = bootstrap(train)

    s15 = section_1_5(daily, monthly, quarterly)

    out = {
        "prep": prep,
        "s1_1": s11,
        "s1_2": s12,
        "s1_3": {"explore": explore, "clean": clean, **transform},
        "s1_4": {"model": {"x": "temp_c", "y": "cnt", "form": "Y = a + bX"}, "holdout": ho, "kfold": kf, "loocv": loo, "bootstrap": bs},
        "s1_5": s15,
        "headline": {
            "a": ho["a"], "b": ho["b"],
            "holdout_mae_train": ho["mae_train"], "holdout_mae_test": ho["mae_test"],
            "kfold_mae_cv": kf["mae_cv"], "loocv_mae": loo["mae"],
            "bootstrap_slope_mean": bs["slope_mean"], "bootstrap_slope_lo": bs["slope_lo"], "bootstrap_slope_hi": bs["slope_hi"],
            "train_days": prep["train_days"], "test_days": prep["test_days"], "rows": prep["rows_clean"],
        },
    }
    save("unit1", out)
    h = out["headline"]
    print(f"  hold-out: a = {h['a']}, b = {h['b']}, MAE train {h['holdout_mae_train']}, test {h['holdout_mae_test']}")
    print(f"  5-fold MAE_cv = {h['kfold_mae_cv']}   LOOCV (18 months) MAE = {h['loocv_mae']}")
    print(f"  bootstrap slope: mean {h['bootstrap_slope_mean']}, middle 95 % {h['bootstrap_slope_lo']} .. {h['bootstrap_slope_hi']}")


if __name__ == "__main__":
    main()
