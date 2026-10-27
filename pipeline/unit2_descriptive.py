"""Unit 2 - Data exploration using descriptive statistics.

Computes everything the Unit 2 page shows, the way it was taught in class (grouped-data formulas by the
step-deviation method, sigma with /N, Karl Pearson and Bowley skewness, beta2 kurtosis from moments,
Karl Pearson's r by the actual-mean method) and writes web/public/data/unit2.json.

Syllabus lines served:
    2.1 Types of data, properties of data
    2.2 Classification, tabulation, diagrammatic and graphic representation
    2.3 Univariate exploration (central tendency, spread, skewness, kurtosis)
    2.4 Multivariate exploration (central data point, correlation, Karl Pearson's r)
    2.5 Data visualization (histogram, quartile / box plot, distribution chart, scatter, scatter matrix,
        bubble chart; self-learning: heat map)

Inputs : data/processed/daily.parquet (731 days, built in Unit 1) and monthly.parquet (24 months).
Output : web/public/data/unit2.json
Main variable: cnt (rentals per day). Contrast variable: temp_c (temperature, degrees C).
Run    : cd pipeline && python unit2_descriptive.py
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from common import (
    LABELS,
    SEASON_ORDER,
    WEATHER_ORDER,
    WEEKDAY_LABELS,
    degree_of_correlation,
    hist,
    load_daily,
    load_monthly,
    load_raw,
    pearson_r_actual_mean,
    r,
    save,
    sd_population,
)


# ============================================================================ 2.2 / 2.3 grouped data
def sturges(values, width: float, start: float) -> dict:
    """2.2 Classification: Sturges' rule k = 1 + 3.322 log10 N and class width i = (L - S) / k."""
    v = np.asarray(values, dtype=float)
    N = len(v)
    L, S = float(v.max()), float(v.min())
    k_raw = 1 + 3.322 * math.log10(N)
    k = int(round(k_raw))
    i_raw = (L - S) / k
    n_classes = int(math.ceil((L - start) / width))
    return {
        "N": N, "log10_N": r(math.log10(N), 4), "k_raw": r(k_raw, 2), "k": k,
        "L": r(L, 2), "S": r(S, 2), "i_raw": r(i_raw, 2), "i": width, "start": start,
        "n_classes": n_classes, "end": start + n_classes * width,
    }


def grouped_from_freq(lo: float, width: float, freqs: list[float], nd: int = 4) -> dict:
    """2.3 Univariate exploration: every grouped (continuous-series) formula from one frequency table.

    Step-deviation method with A = mid-point of the modal class, d' = (m - A) / i.
    Mean (direct and step deviation), median, mode, quartiles, range, Q.D., sigma (/N), Karl Pearson
    and Bowley skewness, moments mu2..mu4, beta1 and beta2. Used for the real data and for the
    teacher's class examples so the same code path is checked against the slides."""
    f = np.asarray(freqs, dtype=float)
    k = len(f)
    N = float(f.sum())
    los = lo + width * np.arange(k)
    his = los + width
    m = (los + his) / 2.0
    cf = np.cumsum(f)

    # --- assumed mean A = mid-point of the modal class; step deviations
    modal = int(np.argmax(f))
    A = float(m[modal])
    d = (m - A) / width
    fd = f * d
    fd2 = f * d * d
    sum_fm = float((f * m).sum())
    sum_fd = float(fd.sum())
    sum_fd2 = float(fd2.sum())

    # --- arithmetic mean: direct and step deviation
    mean_direct = sum_fm / N
    mean_step = A + (sum_fd / N) * width

    # --- median: N/2 (not (N+1)/2) for a continuous series
    def positional(pos: float) -> dict:
        idx = int(np.argmax(cf >= pos))
        L = float(los[idx])
        cf_prev = float(cf[idx - 1]) if idx > 0 else 0.0
        fc = float(f[idx])
        value = L + ((pos - cf_prev) / fc) * width
        return {"pos": r(pos, 2), "idx": idx, "L": L, "cf_prev": cf_prev, "f": fc, "i": width, "value": r(value, nd)}

    med = positional(N / 2)
    q1 = positional(N / 4)
    q3 = positional(3 * N / 4)

    # --- mode: L + delta1 / (delta1 + delta2) x i
    f1 = float(f[modal])
    f0 = float(f[modal - 1]) if modal > 0 else 0.0
    f2 = float(f[modal + 1]) if modal < k - 1 else 0.0
    delta1 = abs(f1 - f0)
    delta2 = abs(f1 - f2)
    mode = float(los[modal]) + (delta1 / (delta1 + delta2)) * width

    # --- spread
    median = med["value"]
    Q1, Q3 = q1["value"], q3["value"]
    iqr = Q3 - Q1
    qd = iqr / 2
    coef_qd = (Q3 - Q1) / (Q3 + Q1)
    var_step = sum_fd2 / N - (sum_fd / N) ** 2
    sigma = math.sqrt(var_step) * width

    # --- skewness
    sk_pearson = (mean_step - mode) / sigma
    sk_pearson_median = 3 * (mean_step - median) / sigma
    sk_bowley = (Q3 + Q1 - 2 * median) / (Q3 - Q1)
    empirical_mode = 3 * median - 2 * mean_step

    # --- moments about the mean (grouped), kurtosis
    dev = m - mean_direct
    f_dev2 = f * dev ** 2
    f_dev3 = f * dev ** 3
    f_dev4 = f * dev ** 4
    mu2 = float(f_dev2.sum()) / N
    mu3 = float(f_dev3.sum()) / N
    mu4 = float(f_dev4.sum()) / N
    beta2 = mu4 / mu2 ** 2
    beta1 = mu3 ** 2 / mu2 ** 3

    rows = []
    for j in range(k):
        rows.append({
            "lo": r(los[j], 2), "hi": r(his[j], 2),
            "label": f"{los[j]:g}–{his[j]:g}",
            "m": r(m[j], 2), "f": int(f[j]) if float(f[j]).is_integer() else r(f[j], 2),
            "cf": int(cf[j]) if float(cf[j]).is_integer() else r(cf[j], 2),
            "rel_pct": r(100 * f[j] / N, 2),
            "d": r(d[j], 2), "fd": r(fd[j], 2), "fd2": r(fd2[j], 2),
            "dev": r(dev[j], 2), "f_dev2": r(f_dev2[j], 2), "f_dev3": r(f_dev3[j], 2), "f_dev4": r(f_dev4[j], 2),
            "is_modal": j == modal, "is_median": j == med["idx"], "is_q1": j == q1["idx"], "is_q3": j == q3["idx"],
        })

    order = sorted([("Mode", mode), ("Median", median), ("Mean", mean_step)], key=lambda t: t[1])
    return {
        "N": int(N) if N.is_integer() else N, "i": width, "k": k, "A": A, "modal_idx": modal,
        "rows": rows,
        "sums": {"f": int(N) if N.is_integer() else N, "fm": r(sum_fm, 2), "fd": r(sum_fd, 2), "fd2": r(sum_fd2, 2),
                 "f_dev2": r(float(f_dev2.sum()), 2), "f_dev3": r(float(f_dev3.sum()), 2), "f_dev4": r(float(f_dev4.sum()), 2)},
        "mean": {"direct": r(mean_direct, nd), "step": r(mean_step, nd), "A": A, "sum_fd_over_N": r(sum_fd / N, 4)},
        "median": med,
        "mode": {"value": r(mode, nd), "L": float(los[modal]), "f0": f0, "f1": f1, "f2": f2, "delta1": delta1, "delta2": delta2, "i": width,
                 "empirical": r(empirical_mode, nd), "order": [o[0] for o in order]},
        "quartiles": {"q1": q1, "q3": q3, "iqr": r(iqr, nd), "qd": r(qd, nd), "coef_qd": r(coef_qd, 4)},
        "sigma": {"value": r(sigma, nd), "sum_fd2_over_N": r(sum_fd2 / N, 4), "sum_fd_over_N_sq": r((sum_fd / N) ** 2, 4), "inside_root": r(var_step, 4)},
        "skewness": {"pearson": r(sk_pearson, 4), "pearson_median_form": r(sk_pearson_median, 4), "bowley": r(sk_bowley, 4),
                     "absolute": r(mean_step - mode, nd)},
        "moments": {"mu2": r(mu2, 4), "mu3": r(mu3, 4), "mu4": r(mu4, 4), "beta2": r(beta2, 4), "beta1": r(beta1, 6),
                    "sqrt_mu2": r(math.sqrt(mu2), nd)},
    }


def grouped_stats(values, start: float, width: float) -> dict:
    """2.2 + 2.3: bin raw values into exclusive classes [start, start+i), ... then run every grouped formula."""
    v = np.asarray(values, dtype=float)
    n_classes = int(math.ceil((v.max() - start) / width))
    edges = start + width * np.arange(n_classes + 1)
    # exclusive method: an item equal to an upper limit goes to the next class ([lo, hi)); numpy does this
    # for every bin except the last, whose upper edge is above the maximum, so nothing is affected.
    freqs, _ = np.histogram(v, bins=edges)
    out = grouped_from_freq(start, width, freqs.tolist())
    out["raw"] = {
        "L": r(float(v.max()), 2), "S": r(float(v.min()), 2),
        "range": r(float(v.max() - v.min()), 2), "coef_range": r((v.max() - v.min()) / (v.max() + v.min()), 4),
        "range_classes": r(edges[-1] - edges[0], 2), "coef_range_classes": r((edges[-1] - edges[0]) / (edges[-1] + edges[0]), 4),
        "mean": r(float(v.mean()), 4), "median": r(float(np.median(v)), 4), "sigma": r(sd_population(v), 4),
    }
    return out


# ============================================================================ 2.1 types & properties
def types_of_data(df: pd.DataFrame) -> list[dict]:
    """2.1 Types of data: classify every attribute that goes forward (qualitative/quantitative; nominal/ordinal/
    interval/ratio; discrete/continuous) with the number of distinct values as evidence."""
    spec = [
        ("cnt", "Rentals per day", "Quantitative", "Ratio", "Discrete", "a count; 0 means no rentals, 4,000 is twice 2,000"),
        ("casual", "Casual rentals", "Quantitative", "Ratio", "Discrete", "a count with a true zero"),
        ("registered", "Registered rentals", "Quantitative", "Ratio", "Discrete", "a count with a true zero"),
        ("temp_c", "Temperature (°C)", "Quantitative", "Interval", "Continuous", "0 °C is not 'no temperature'; differences are meaningful, ratios are not"),
        ("atemp_c", "Feels-like temperature (°C)", "Quantitative", "Interval", "Continuous", "same scale as temperature: no absolute zero"),
        ("hum_pct", "Humidity (%)", "Quantitative", "Ratio", "Continuous", "0 % means no moisture; 60 % is twice 30 %"),
        ("wind_kmh", "Wind speed (km/h)", "Quantitative", "Ratio", "Continuous", "0 km/h is calm; any value in between is possible"),
        ("season_name", "Season", "Qualitative", "Ordinal", "—", "named and ordered in time (Winter → Spring → Summer → Fall) but the gaps are not a measured quantity"),
        ("year", "Year", "Quantitative", "Interval", "Discrete", "like 'Year enrolled' in class: ordered, equal gaps, but year 0 is only a position on the scale"),
        ("mnth", "Month", "Qualitative", "Ordinal", "—", "Jan < Feb < … < Dec is an order, not a magnitude"),
        ("holiday", "Holiday", "Qualitative", "Nominal", "—", "yes / no label; can only be checked for equality"),
        ("weekday_name", "Day of week", "Qualitative", "Ordinal", "—", "named days with an order inside the week"),
        ("workingday", "Working day", "Qualitative", "Nominal", "—", "yes / no label"),
        ("weather_name", "Weather situation", "Qualitative", "Ordinal", "—", "clear < mist < light rain: ordered by severity, gaps not measurable"),
        ("day_type", "Day type", "Qualitative", "Nominal", "—", "Working day / Weekend / Holiday are names only"),
        ("date", "Date", "Quantitative", "Interval", "Discrete", "ordered with equal one-day gaps; no 'zero date'; one value per day"),
    ]
    out = []
    for col, label, qq, level, dc, why in spec:
        s = df[col]
        if col == "date":
            examples = [s.min().strftime("%Y-%m-%d"), s.max().strftime("%Y-%m-%d")]
        elif s.dtype == object:
            examples = [str(x) for x in list(pd.unique(s))[:4]]
        else:
            lo, hi = s.min(), s.max()
            examples = [f"{lo:g}" if float(lo).is_integer() else f"{lo:.1f}", f"{hi:g}" if float(hi).is_integer() else f"{hi:.1f}"]
        out.append({"attribute": col, "label": label, "kind": qq, "level": level, "discrete": dc, "why": why,
                    "n_distinct": int(s.nunique()), "examples": examples})
    return out


def properties_of_data(df: pd.DataFrame) -> list[dict]:
    """2.1 Properties of data: the five-point quality checklist (accuracy, completeness, reliability, relevance,
    timeliness) applied to this dataset, each with the number that supports it."""
    raw = load_raw()
    missing = int(raw.isna().sum().sum())
    cells = int(raw.shape[0] * raw.shape[1])
    expected_days = int((df["date"].max() - df["date"].min()).days) + 1
    cnt_ok = int((df["cnt"] == df["casual"] + df["registered"]).sum())
    zero_hum = int((raw["hum"] == 0).sum())
    years_old = 2026 - 2012
    return [
        {"property": "Accuracy", "question": "Is the information correct in every detail?",
         "check": f"cnt = casual + registered holds on {cnt_ok} of {len(df)} days; the counts come from the operator's own trip log, the weather from a public weather service.",
         "value": f"{cnt_ok} / {len(df)}"},
        {"property": "Completeness", "question": "How comprehensive is the information?",
         "check": f"{missing} missing cells out of {cells:,}; all {expected_days} calendar days from {df['date'].min():%Y-%m-%d} to {df['date'].max():%Y-%m-%d} are present.",
         "value": f"{missing} missing"},
        {"property": "Reliability", "question": "Does it contradict other trusted sources?",
         "check": f"One value contradicted its neighbours: humidity {zero_hum} day at 0 % (2011-03-10, physically impossible). It was replaced in Unit 1 by the mean of the day before and after.",
         "value": f"{zero_hum} contradiction"},
        {"property": "Relevance", "question": "Do you really need this information?",
         "check": "instant (a row number) and dteday (a text copy of the date) were dropped; the normalised temp/atemp/hum/windspeed columns are kept only through their de-normalised copies.",
         "value": "16 → 14 attributes"},
        {"property": "Timeliness", "question": "How up-to-date is it, usable for real-time reporting?",
         "check": f"The data ends on 2012-12-31, about {years_old} years ago. Good for learning the methods; it would not describe today's bike demand.",
         "value": f"{years_old} years old"},
    ]


# ============================================================================ 2.2 classification, tabulation, diagrams, graphs
def classification_examples(df: pd.DataFrame) -> dict:
    """2.2 Classification: the four types from class with this dataset's example of each."""
    by_year = df.groupby("year")["cnt"].agg(["mean", "count"]).reset_index()
    by_weather = df.groupby("weather_name")["cnt"].agg(["mean", "count"]).reindex(WEATHER_ORDER).reset_index()
    by_day_type = df.groupby("day_type")["cnt"].agg(["mean", "count"]).reindex(["Working day", "Weekend", "Holiday"]).reset_index()
    return {
        "chronological": [{"year": int(y), "mean_cnt": r(m, 1), "days": int(n)} for y, m, n in by_year.itertuples(index=False)],
        "geographical": "Not applicable: every row is the same city (Washington DC), so there is no area to classify by.",
        "qualitative_weather": [{"group": g, "mean_cnt": r(m, 1), "days": int(n)} for g, m, n in by_weather.itertuples(index=False)],
        "qualitative_day_type": [{"group": g, "mean_cnt": r(m, 1), "days": int(n)} for g, m, n in by_day_type.itertuples(index=False)],
    }


def two_way_table(df: pd.DataFrame) -> dict:
    """2.2 Tabulation: one two-way table (stub = year, caption = season, body = mean rentals per day) with totals."""
    body = df.pivot_table(index="year", columns="season_name", values="cnt", aggfunc="mean").reindex(columns=SEASON_ORDER)
    row_total = df.groupby("year")["cnt"].mean()
    col_total = df.groupby("season_name")["cnt"].mean().reindex(SEASON_ORDER)
    rows = []
    for y in body.index:
        rows.append({"stub": str(int(y)), "cells": [r(body.loc[y, s], 0) for s in SEASON_ORDER], "total": r(row_total.loc[y], 0)})
    return {
        "number": "Table 2.1",
        "title": "Mean daily bicycle rentals by year and season, Washington DC, 2011–2012",
        "headnote": "(mean rentals per day)",
        "stub_head": "Year",
        "caption": SEASON_ORDER,
        "rows": rows,
        "total_row": {"stub": "Total", "cells": [r(col_total.loc[s], 0) for s in SEASON_ORDER], "total": r(df["cnt"].mean(), 0)},
        "footnote": "Source: UCI Machine Learning Repository, Bike Sharing Dataset (id 275), Capital Bikeshare daily file, 731 days. Seasons are astronomical (Winter = 21 Dec – 20 Mar).",
    }


def diagrams(df: pd.DataFrame) -> dict:
    """2.2 Diagrammatic representation: simple bar, sub-divided bar, percentage bar (one-dimensional) and pie (two-dimensional)."""
    simple = df.groupby("weather_name")["cnt"].mean().reindex(WEATHER_ORDER)
    season = df.groupby("season_name")[["casual", "registered"]].mean().reindex(SEASON_ORDER)
    pie = df["weather_name"].value_counts().reindex(WEATHER_ORDER)
    N = int(pie.sum())
    return {
        "simple_bar": [{"group": g, "mean_cnt": r(v, 1)} for g, v in simple.items()],
        "subdivided_bar": [
            {"season": s, "casual": r(row["casual"], 1), "registered": r(row["registered"], 1), "total": r(row["casual"] + row["registered"], 1),
             "casual_pct": r(100 * row["casual"] / (row["casual"] + row["registered"]), 1),
             "registered_pct": r(100 * row["registered"] / (row["casual"] + row["registered"]), 1)}
            for s, row in season.iterrows()
        ],
        "pie": {"N": N, "slices": [{"group": g, "days": int(c), "pct": r(100 * c / N, 2), "angle": r(100 * c / N * 3.6, 1)} for g, c in pie.items()],
                "angle_total": r(sum(100 * c / N * 3.6 for c in pie), 1)},
    }


def graphs(df: pd.DataFrame, monthly: pd.DataFrame, freq: dict) -> dict:
    """2.2 Graphic representation: time-series line graph (historigram), histogram + frequency polygon."""
    line = [{"date": d.strftime("%Y-%m-%d"), "label": d.strftime("%b %Y"), "cnt": r(c, 1)} for d, c in zip(monthly["date"], monthly["cnt"])]
    poly = [{"label": row["label"], "m": row["m"], "f": row["f"]} for row in freq["rows"]]
    apex = max(freq["rows"], key=lambda x: x["f"])
    return {"monthly_line": line, "polygon": poly, "apex": {"label": apex["label"], "m": apex["m"], "f": apex["f"]},
            "line_min": r(min(c for c in monthly["cnt"]), 1), "line_max": r(max(c for c in monthly["cnt"]), 1)}


# ============================================================================ 2.4 multivariate
def multivariate(df: pd.DataFrame) -> dict:
    """2.4 Multivariate exploration: central data point (mean vector), correlation types and reasons illustrated
    with pairs from this data, Karl Pearson's r by the actual-mean method for cnt vs each weather variable,
    and the direct method once for the temperature pair."""
    cols = ["cnt", "temp_c", "hum_pct", "wind_kmh"]
    mean_vector = [{"var": c, "label": LABELS[c], "mean": r(df[c].mean(), 2)} for c in cols]

    pairs = []
    for c in ["temp_c", "atemp_c", "hum_pct", "wind_kmh"]:
        p = pearson_r_actual_mean(df[c], df["cnt"])
        p.update({"x": c, "x_label": LABELS[c], "y": "cnt", "degree": degree_of_correlation(p["r"]),
                  "root": r(math.sqrt(p["sum_x2"] * p["sum_y2"]), 2)})
        pairs.append(p)

    X = df["temp_c"].to_numpy(dtype=float)
    Y = df["cnt"].to_numpy(dtype=float)
    N = len(X)
    sx, sy, sx2, sy2, sxy = X.sum(), Y.sum(), (X ** 2).sum(), (Y ** 2).sum(), (X * Y).sum()
    num = N * sxy - sx * sy
    den_x = math.sqrt(N * sx2 - sx ** 2)
    den_y = math.sqrt(N * sy2 - sy ** 2)
    direct = {"N": N, "sum_x": r(sx, 2), "sum_y": r(sy, 2), "sum_x2": r(sx2, 2), "sum_y2": r(sy2, 2), "sum_xy": r(sxy, 2),
              "numerator": r(num, 2), "den_x": r(den_x, 2), "den_y": r(den_y, 2), "r": r(num / (den_x * den_y), 4)}

    # reasons a correlation may arise, each with a pair from this data
    r_chance = pearson_r_actual_mean(df["temp_c"], df["weekday"])["r"]
    r_cas_reg = pearson_r_actual_mean(df["casual"], df["registered"])["r"]
    r_cas_temp = pearson_r_actual_mean(df["casual"], df["temp_c"])["r"]
    r_reg_temp = pearson_r_actual_mean(df["registered"], df["temp_c"])["r"]
    r_temp_hum = pearson_r_actual_mean(df["temp_c"], df["hum_pct"])["r"]
    r_cnt_wind = pearson_r_actual_mean(df["cnt"], df["wind_kmh"])["r"]
    r_cnt_hum = pearson_r_actual_mean(df["cnt"], df["hum_pct"])["r"]
    r_temp_wind = pearson_r_actual_mean(df["temp_c"], df["wind_kmh"])["r"]
    reasons = [
        {"reason": "Pure chance", "pair": "temperature vs day of the week", "r": r_chance,
         "text": "the calendar cannot change the weather, so whatever small r appears is chance."},
        {"reason": "Common third variable", "pair": "casual vs registered rentals", "r": r_cas_reg,
         "text": f"both rise on warm days (r with temperature {r_cas_temp:+.2f} and {r_reg_temp:+.2f}); the weather is the third variable behind their correlation."},
        {"reason": "Mutual influence", "pair": "temperature vs humidity", "r": r_temp_hum,
         "text": "warm air evaporates more water and moist air changes how fast the ground warms; each affects the other, like price and demand in class."},
    ]
    # non-linear check: mean cnt per temperature class
    temp_classes = grouped_stats(df["temp_c"], 0, 5)
    curve = []
    for row in temp_classes["rows"]:
        mask = (df["temp_c"] >= row["lo"]) & (df["temp_c"] < row["hi"])
        if mask.sum() > 0:
            curve.append({"label": row["label"], "m": row["m"], "days": int(mask.sum()), "mean_cnt": r(df.loc[mask, "cnt"].mean(), 0)})
    types = [
        {"type": "Positive / negative", "basis": "direction in which the variables move",
         "example": f"rentals and temperature move together (r = {pairs[0]['r']:+.3f}, positive); rentals and wind move apart (r = {r_cnt_wind:+.3f}, negative)."},
        {"type": "Simple / partial / multiple", "basis": "number of variables studied",
         "example": f"simple: rentals vs temperature alone (r = {pairs[0]['r']:+.3f}); partial: rentals vs humidity with temperature held constant (Unit 4.4); multiple: rentals vs temperature and humidity together (Unit 4.3)."},
        {"type": "Linear / non-linear", "basis": "constancy of the ratio of change",
         "example": f"rentals vs temperature are roughly linear up to about 25 °C; above that the mean per class stops rising ({curve[-2]['mean_cnt']:,.0f} then {curve[-1]['mean_cnt']:,.0f} rentals), so the ratio of change is not constant at the hot end."},
    ]
    return {"mean_vector": mean_vector, "pairs": pairs, "direct": direct, "reasons": reasons, "types": types,
            "curve": curve, "extra_r": {"cnt_hum": r_cnt_hum, "cnt_wind": r_cnt_wind, "temp_wind": r_temp_wind}}


# ============================================================================ 2.5 visualization
def normal_pdf(x: np.ndarray, mu: float, sigma: float) -> np.ndarray:
    """2.5 Distribution chart: f(x) = 1/sqrt(2 pi sigma^2) e^{-(x-mu)^2 / 2 sigma^2}."""
    return np.exp(-((x - mu) ** 2) / (2 * sigma ** 2)) / math.sqrt(2 * math.pi * sigma ** 2)


def distribution_chart(values, bins: int) -> dict:
    """2.5 Distribution chart: histogram (density) with the normal curve of the same mu and sigma, and the
    68.2 / 95.4 / 99.7 % rule checked against the actual share of days within +-1, 2, 3 sigma."""
    v = np.asarray(values, dtype=float)
    mu, sigma = float(v.mean()), sd_population(v)
    h = hist(v, bins=bins)
    for b in h:
        b["normal"] = r(float(normal_pdf(np.array([b["mid"]]), mu, sigma)[0]), 6)
    rule = []
    for k_, expected in [(1, 68.2), (2, 95.4), (3, 99.7)]:
        inside = int(((v >= mu - k_ * sigma) & (v <= mu + k_ * sigma)).sum())
        rule.append({"k": k_, "lower": r(mu - k_ * sigma, 2), "upper": r(mu + k_ * sigma, 2), "days": inside,
                     "actual_pct": r(100 * inside / len(v), 1), "expected_pct": expected})
    return {"mu": r(mu, 4), "sigma": r(sigma, 4), "bins": h, "rule": rule, "n": len(v)}


def quartile_chart(df: pd.DataFrame) -> dict:
    """2.5 Quartile chart (box plot) of cnt by season: five-number summary, IQR, the 1.5 IQR fences and the
    outlier count per group. Quartile positions by the individual-series rule Q1 = (N+1)/4, Q3 = 3(N+1)/4."""
    items = []
    for s in SEASON_ORDER:
        v = np.sort(df.loc[df["season_name"] == s, "cnt"].to_numpy(dtype=float))
        n = len(v)
        q1, q2, q3 = (float(np.percentile(v, p, method="weibull")) for p in (25, 50, 75))
        iqr = q3 - q1
        lo_f, hi_f = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        inside = v[(v >= lo_f) & (v <= hi_f)]
        outliers = v[(v < lo_f) | (v > hi_f)]
        items.append({
            "key": s, "n": n, "min": r(v.min(), 0), "q1": r(q1, 1), "median": r(q2, 1), "q3": r(q3, 1), "max": r(v.max(), 0),
            "mean": r(v.mean(), 1), "iqr": r(iqr, 1), "lower_fence": r(lo_f, 1), "upper_fence": r(hi_f, 1),
            "whisker_low": r(inside.min(), 0), "whisker_high": r(inside.max(), 0),
            "outliers": int(len(outliers)), "outlier_values": [int(x) for x in outliers[:6]],
            "pos_q1": r((n + 1) / 4, 2), "pos_q3": r(3 * (n + 1) / 4, 2),
            "median_position": r((q2 - q1) / iqr, 3) if iqr else None,
            "left_whisker": r(q1 - inside.min(), 0), "right_whisker": r(inside.max() - q3, 0),
        })
    for it in items:
        it["reading"] = ("median closer to Q₁, right whisker longer → positive skew" if it["median_position"] < 0.45 and it["right_whisker"] > it["left_whisker"]
                         else "median closer to Q₃, left whisker longer → negative skew" if it["median_position"] > 0.55 and it["left_whisker"] > it["right_whisker"]
                         else "median near the middle of the box → roughly symmetric")
    # the whole-series box, for the text
    v = np.sort(df["cnt"].to_numpy(dtype=float))
    q1, q3 = (float(np.percentile(v, p, method="weibull")) for p in (25, 75))
    all_ = {"n": len(v), "q1": r(q1, 1), "q3": r(q3, 1), "iqr": r(q3 - q1, 1), "lower_fence": r(q1 - 1.5 * (q3 - q1), 1), "upper_fence": r(q3 + 1.5 * (q3 - q1), 1),
            "outliers": int(((v < q1 - 1.5 * (q3 - q1)) | (v > q3 + 1.5 * (q3 - q1))).sum()), "pos_q1": r((len(v) + 1) / 4, 2), "pos_q3": r(3 * (len(v) + 1) / 4, 2)}
    return {"items": items, "all": all_}


def multivariate_charts(df: pd.DataFrame, monthly: pd.DataFrame) -> dict:
    """2.5 Multivariate visualization: scatter plot (cnt vs temp_c by season), 4 x 4 scatter matrix with r in each
    cell, bubble chart (one bubble per month), and the self-learning heat map month x weekday."""
    scatter = [{"x": r(t, 1), "y": int(c), "group": s, "label": d.strftime("%Y-%m-%d")}
               for t, c, s, d in zip(df["temp_c"], df["cnt"], df["season_name"], df["date"])]
    cols = ["cnt", "temp_c", "hum_pct", "wind_kmh"]
    pairs = []
    for i, a in enumerate(cols):
        for j, b in enumerate(cols):
            if i == j:
                continue
            p = pearson_r_actual_mean(df[a], df[b])
            pairs.append({"row": a, "col": b, "r": p["r"], "degree": degree_of_correlation(p["r"]),
                          "points": [{"x": r(x, 1), "y": r(y, 1)} for x, y in zip(df[b], df[a])] if j < i else None})
    bubble = [{"label": d.strftime("%b %Y"), "year": str(d.year), "x": r(t, 2), "y": r(c, 1), "size": r(w, 2)}
              for d, t, c, w in zip(monthly["date"], monthly["temp_c"], monthly["cnt"], monthly["wind_kmh"])]
    heat = df.pivot_table(index="month", columns="weekday", values="cnt", aggfunc="mean")
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    cells = [{"row": months[m - 1], "col": WEEKDAY_LABELS[w], "value": r(heat.loc[m, w], 0)} for m in heat.index for w in heat.columns]
    best = max(cells, key=lambda c: c["value"])
    worst = min(cells, key=lambda c: c["value"])
    return {"scatter": scatter, "matrix": {"vars": cols, "labels": {c: LABELS[c] for c in cols}, "pairs": pairs},
            "bubble": bubble, "heat": {"rows": months, "cols": [WEEKDAY_LABELS[w] for w in range(7)], "cells": cells, "best": best, "worst": worst}}


# ============================================================================ class checks
def class_checks() -> dict:
    """Check against the class examples: the same grouped_from_freq() code reproduces the teacher's slides."""
    # Karl Pearson continuous example: profits 70-150, f = 12,18,35,42,50,45,30,8, A = 115, i = 10, N = 240
    kp = grouped_from_freq(70, 10, [12, 18, 35, 42, 50, 45, 30, 8])
    # Kurtosis continuous example: classes 0-50 by 10, f = 1,3,8,3,1, N = 16
    ku = grouped_from_freq(0, 10, [1, 3, 8, 3, 1])
    # Bowley example: weights of 589 students, open-end classes taken as 89.5-99.5 and 199.5-209.5
    bo = grouped_from_freq(89.5, 10, [1, 14, 66, 122, 145, 121, 65, 34, 12, 5, 2, 2])
    return {
        "pearson": {"slide": {"mode": 116.15, "mean": 111.46, "sigma": 17.595, "sk": -0.267},
                    "ours": {"mode": kp["mode"]["value"], "mean": kp["mean"]["step"], "sigma": kp["sigma"]["value"], "sk": kp["skewness"]["pearson"]},
                    "A": kp["A"], "N": kp["N"], "sum_fd": kp["sums"]["fd"], "sum_fd2": kp["sums"]["fd2"]},
        "kurtosis": {"slide": {"mean": 25, "mu2": 87.5, "mu4": 23750, "beta2": 3.102},
                     "ours": {"mean": ku["mean"]["direct"], "mu2": ku["moments"]["mu2"], "mu4": ku["moments"]["mu4"], "beta2": ku["moments"]["beta2"]}},
        "bowley": {"slide": {"median": 135.81, "q1": 124.93, "q3": 147.25, "sk": 0.025},
                   "ours": {"median": bo["median"]["value"], "q1": bo["quartiles"]["q1"]["value"], "q3": bo["quartiles"]["q3"]["value"], "sk": bo["skewness"]["bowley"]}},
    }


# ============================================================================ main
def main() -> None:
    df = load_daily()
    monthly = load_monthly()

    # --- 2.2 frequency distribution of cnt (Sturges) and of temp_c (same rule, same function)
    st_cnt = sturges(df["cnt"], width=800, start=0)
    cnt = grouped_stats(df["cnt"], start=0, width=800)
    st_temp = sturges(df["temp_c"], width=5, start=0)
    temp = grouped_stats(df["temp_c"], start=0, width=5)

    sqrt_n = math.sqrt(len(df))
    bins_sqrt = int(round(sqrt_n))

    out = {
        "meta": {"n_days": int(len(df)), "start": df["date"].min().strftime("%Y-%m-%d"), "end": df["date"].max().strftime("%Y-%m-%d"),
                 "variable": "cnt", "contrast": "temp_c"},
        "types": types_of_data(df),
        "properties": properties_of_data(df),
        "classification": classification_examples(df),
        "sturges": st_cnt,
        "freq_table": cnt["rows"],
        "tabulation": two_way_table(df),
        "diagrams": diagrams(df),
        "graphs": graphs(df, monthly, cnt),
        "cnt": cnt,
        "temp": temp,
        "sturges_temp": st_temp,
        "class_checks": class_checks(),
        "multivariate": multivariate(df),
        "viz": {
            "sqrt_rule": {"n": int(len(df)), "sqrt_n": r(sqrt_n, 2), "bins": bins_sqrt, "sturges_bins": cnt["k"]},
            "hist_sqrt": hist(df["cnt"], bins=bins_sqrt),
            "dist_cnt": distribution_chart(df["cnt"], bins_sqrt),
            "dist_temp": distribution_chart(df["temp_c"], bins_sqrt),
            "box": quartile_chart(df),
            **multivariate_charts(df, monthly),
        },
    }
    mv = out["multivariate"]
    out["headline"] = {
        "mean": cnt["mean"]["step"], "median": cnt["median"]["value"], "mode": cnt["mode"]["value"], "sigma": cnt["sigma"]["value"],
        "sk_pearson": cnt["skewness"]["pearson"], "sk_bowley": cnt["skewness"]["bowley"], "beta2": cnt["moments"]["beta2"],
        "r_temp": mv["pairs"][0]["r"], "order": cnt["mode"]["order"],
        "temp": {"mean": temp["mean"]["step"], "median": temp["median"]["value"], "mode": temp["mode"]["value"], "sigma": temp["sigma"]["value"],
                 "sk_pearson": temp["skewness"]["pearson"], "sk_bowley": temp["skewness"]["bowley"], "beta2": temp["moments"]["beta2"]},
    }
    save("unit2", out)
    h = out["headline"]
    print(f"  cnt grouped: mean {h['mean']}, median {h['median']}, mode {h['mode']}, sigma {h['sigma']}, "
          f"Skp {h['sk_pearson']}, SkB {h['sk_bowley']}, beta2 {h['beta2']}, r(temp) {h['r_temp']}")
    print(f"  temp grouped: {h['temp']}")
    print(f"  class checks: {out['class_checks']}")


if __name__ == "__main__":
    main()
