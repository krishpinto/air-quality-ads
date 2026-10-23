"""Module 2 - Descriptive statistics.

Central tendency, dispersion, shape (skewness, kurtosis), tabulation by
groups, histograms with a normal overlay, box-plot five-number summaries.
Output: web/public/data/descriptive.json
"""
import numpy as np
import pandas as pd
from scipy import stats

from common import LABELS, NUMERIC, SEASON_ORDER, WIND_ORDER, hist, load_clean, r, save

print("02_descriptive")
df = load_clean()
n = len(df)


def describe(series: pd.Series, label: str) -> dict:
    s = series.dropna().astype(float)
    q1, med, q3 = s.quantile([0.25, 0.5, 0.75])
    iqr = q3 - q1
    mean, std = s.mean(), s.std(ddof=1)
    # mode: round continuous values to 1 decimal so a mode is meaningful
    mode_val = s.round(1).mode()
    mode_val = float(mode_val.iloc[0]) if len(mode_val) else None
    bowley = (q3 + q1 - 2 * med) / iqr if iqr else None
    pearson_mode_skew = 3 * (mean - med) / std if std else None
    lo_f, hi_f = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    outliers = int(((s < lo_f) | (s > hi_f)).sum())
    return {
        "col": series.name, "label": label, "n": int(len(s)),
        "mean": r(mean, 3), "median": r(med, 3), "mode": mode_val,
        "std": r(std, 3), "variance": r(s.var(ddof=1), 3), "cv": r(std / mean, 4) if mean else None,
        "min": r(s.min(), 3), "max": r(s.max(), 3), "range": r(s.max() - s.min(), 3),
        "q1": r(q1, 3), "q3": r(q3, 3), "iqr": r(iqr, 3),
        "skew": r(stats.skew(s, bias=False), 4),            # Fisher-Pearson moment skewness
        "pearson_skew": r(pearson_mode_skew, 4),             # 3(mean - median)/sd
        "bowley_skew": r(bowley, 4),                         # quartile skewness
        "kurtosis": r(stats.kurtosis(s, bias=False), 4),     # excess kurtosis (normal = 0)
        "sem": r(stats.sem(s), 4),
        "p5": r(s.quantile(0.05), 3), "p95": r(s.quantile(0.95), 3),
        "lower_fence": r(lo_f, 3), "upper_fence": r(hi_f, 3), "outliers": outliers,
        "outlier_pct": r(100 * outliers / len(s), 2),
    }


variables = [describe(df[c], LABELS[c]) for c in NUMERIC] + [describe(df["log_pm25"], LABELS["log_pm25"])]

# Histograms with fitted normal curve overlay
histograms = {}
for c in NUMERIC + ["log_pm25"]:
    s = df[c].dropna().astype(float)
    bins = hist(s, bins=40)
    mu, sd = s.mean(), s.std()
    for b in bins:
        b["normal"] = r(stats.norm.pdf(b["mid"], mu, sd), 6)
    histograms[c] = {"bins": bins, "mu": r(mu, 3), "sd": r(sd, 3)}


def box(s: pd.Series) -> dict:
    s = s.dropna().astype(float)
    q1, med, q3 = s.quantile([0.25, 0.5, 0.75])
    iqr = q3 - q1
    lo = s[s >= q1 - 1.5 * iqr].min()
    hi = s[s <= q3 + 1.5 * iqr].max()
    return {"min": r(s.min(), 2), "whisker_low": r(lo, 2), "q1": r(q1, 2), "median": r(med, 2), "q3": r(q3, 2),
            "whisker_high": r(hi, 2), "max": r(s.max(), 2), "mean": r(s.mean(), 2), "n": int(len(s)),
            "outliers": int(((s < q1 - 1.5 * iqr) | (s > q3 + 1.5 * iqr)).sum())}


boxplots = {
    "variables": [{"key": c, "label": LABELS[c], **box(df[c])} for c in NUMERIC],
    "pm25_by_season": [{"key": s, **box(df.loc[df["season"] == s, "pm25"])} for s in SEASON_ORDER],
    "pm25_by_wind": [{"key": w, **box(df.loc[df["cbwd"] == w, "pm25"])} for w in WIND_ORDER],
    "pm25_by_year": [{"key": str(y), **box(g["pm25"])} for y, g in df.groupby("year")],
}


def group_table(col: str, order=None) -> list:
    g = df.groupby(col)["pm25"].agg(["count", "mean", "median", "std", "min", "max"])
    if order is not None:
        g = g.reindex(order)
    out = []
    for k, row in g.iterrows():
        out.append({"group": str(k), "count": int(row["count"]), "pct": r(100 * row["count"] / n, 1),
                    "mean": r(row["mean"], 2), "median": r(row["median"], 2), "std": r(row["std"], 2),
                    "min": r(row["min"], 1), "max": r(row["max"], 1)})
    return out


tabulation = {
    "season": group_table("season", SEASON_ORDER),
    "wind": group_table("cbwd", WIND_ORDER),
    "year": group_table("year"),
    "month": group_table("month"),
    "hour": group_table("hour"),
    "weekend": [{**row, "group": "Weekend" if row["group"] == "1" else "Weekday"} for row in group_table("is_weekend")],
}

# Cross-tabulation: season x wind direction, mean PM2.5
ct = df.pivot_table(index="season", columns="cbwd", values="pm25", aggfunc="mean").reindex(SEASON_ORDER)[WIND_ORDER]
crosstab_mean = [{"season": s, **{w: r(ct.loc[s, w], 1) for w in WIND_ORDER}} for s in SEASON_ORDER]
ctn = pd.crosstab(df["season"], df["cbwd"]).reindex(SEASON_ORDER)[WIND_ORDER]
crosstab_count = [{"season": s, **{w: int(ctn.loc[s, w]) for w in WIND_ORDER}} for s in SEASON_ORDER]

# Frequency tables
freq = {
    "aqi": [{"key": k, "count": int(v), "pct": r(100 * v / n, 2)} for k, v in df["aqi_category"].value_counts().items()],
    "wind": [{"key": k, "count": int(v), "pct": r(100 * v / n, 2)} for k, v in df["cbwd"].value_counts().reindex(WIND_ORDER).items()],
}

# Empirical rule check for pm25 and TEMP: share within 1/2/3 sd
def empirical_rule(s):
    s = s.dropna(); mu, sd = s.mean(), s.std()
    return [{"k": k, "theoretical": t, "observed": r(100 * ((s - mu).abs() <= k * sd).mean(), 2)} for k, t in [(1, 68.27), (2, 95.45), (3, 99.73)]]

save("descriptive", {
    "n": n,
    "variables": variables,
    "histograms": histograms,
    "boxplots": boxplots,
    "tabulation": tabulation,
    "crosstab_mean": crosstab_mean,
    "crosstab_count": crosstab_count,
    "frequency": freq,
    "empirical_rule": {"pm25": empirical_rule(df["pm25"]), "TEMP": empirical_rule(df["TEMP"]), "log_pm25": empirical_rule(df["log_pm25"])},
})
