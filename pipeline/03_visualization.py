"""Module 3 - Data for visualisation page.

Scatter samples, bubble chart, hour-of-day profile, year x month heat map,
scatter-matrix sample, categorical bars, KDE comparison.
Output: web/public/data/visualization.json
"""
import numpy as np
import pandas as pd
from scipy import stats

from common import LABELS, SEASON_ORDER, WIND_LABELS, WIND_ORDER, load_clean, load_daily, r, save, season_of

print("03_visualization")
df = load_clean()
daily = load_daily()
rng = np.random.default_rng(42)

# Scatter samples (800 random hours) for pm25 vs each weather variable
sample = df.sample(800, random_state=42)
scatter = {}
for c in ["DEWP", "TEMP", "PRES", "Iws"]:
    slope, intercept, rv, pv, se = stats.linregress(df[c], df["pm25"])
    scatter[c] = {
        "label": LABELS[c],
        "points": [{"x": r(x, 2), "y": r(y, 1), "season": s} for x, y, s in zip(sample[c], sample["pm25"], sample["season"])],
        "slope": r(slope, 4), "intercept": r(intercept, 3), "r": r(rv, 4), "r2": r(rv ** 2, 4), "p": pv,
        "x_min": r(df[c].min(), 2), "x_max": r(df[c].max(), 2),
    }

# Bubble chart: one bubble per calendar month (60) - x temp, y pm25, size = unhealthy hours
m = df.groupby(["year", "month"]).agg(TEMP=("TEMP", "mean"), pm25=("pm25", "mean"), DEWP=("DEWP", "mean"),
                                       Iws=("Iws", "mean"), unhealthy_hours=("unhealthy", "sum"), n=("pm25", "size")).reset_index()
m["season"] = m["month"].map(season_of)
bubble = [{"label": f"{int(a)}-{int(b):02d}", "x": r(t, 1), "y": r(p, 1), "size": int(u), "season": s, "Iws": r(w, 1)}
          for a, b, t, p, u, s, w in zip(m["year"], m["month"], m["TEMP"], m["pm25"], m["unhealthy_hours"], m["season"], m["Iws"])]

# Hour-of-day profile with 95% CI of the mean
hp = df.groupby("hour")["pm25"].agg(["mean", "std", "count"])
hour_profile = [{"hour": int(h), "mean": r(row["mean"], 2), "lo": r(row["mean"] - 1.96 * row["std"] / np.sqrt(row["count"]), 2),
                 "hi": r(row["mean"] + 1.96 * row["std"] / np.sqrt(row["count"]), 2)} for h, row in hp.iterrows()]
# Hour profile by season
hps = df.pivot_table(index="hour", columns="season", values="pm25", aggfunc="mean")[SEASON_ORDER]
hour_by_season = [{"hour": int(h), **{s: r(hps.loc[h, s], 1) for s in SEASON_ORDER}} for h in hps.index]

# Heat map year x month
hm = df.pivot_table(index="year", columns="month", values="pm25", aggfunc="mean")
heatmap = [{"year": int(y), "month": int(mo), "value": r(hm.loc[y, mo], 1)} for y in hm.index for mo in hm.columns]

# Weekly pattern (day of week)
dw = df.groupby("dow")["pm25"].mean()
dow_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
weekday = [{"day": dow_names[int(d)], "mean": r(v, 2)} for d, v in dw.items()]

# Scatter matrix (4 vars, 300 points) + correlation for each pair
sm_vars = ["pm25", "DEWP", "TEMP", "Iws"]
sm_sample = df.sample(300, random_state=7)
scatter_matrix = {
    "vars": sm_vars, "labels": {v: LABELS[v] for v in sm_vars},
    "points": sm_sample[sm_vars].round(2).to_dict(orient="records"),
    "corr": {f"{a}|{b}": r(df[a].corr(df[b]), 3) for a in sm_vars for b in sm_vars},
}

# Categorical bars
wind_bar = []
for w in WIND_ORDER:
    g = df[df["cbwd"] == w]
    wind_bar.append({"key": w, "label": WIND_LABELS[w], "count": int(len(g)), "mean_pm25": r(g["pm25"].mean(), 1),
                     "median_pm25": r(g["pm25"].median(), 1), "pct_unhealthy": r(100 * g["unhealthy"].mean(), 1)})
season_bar = []
for s in SEASON_ORDER:
    g = df[df["season"] == s]
    season_bar.append({"key": s, "count": int(len(g)), "mean_pm25": r(g["pm25"].mean(), 1), "median_pm25": r(g["pm25"].median(), 1),
                       "pct_unhealthy": r(100 * g["unhealthy"].mean(), 1)})
# Stacked: AQI category share by season
aqi_order = ["Good", "Moderate", "Unhealthy (sensitive)", "Unhealthy", "Very unhealthy", "Hazardous"]
ct = pd.crosstab(df["season"], df["aqi_category"], normalize="index").reindex(SEASON_ORDER)
aqi_by_season = [{"season": s, **{a: r(100 * ct.loc[s].get(a, 0), 2) for a in aqi_order}} for s in SEASON_ORDER]

# KDE: pm25 vs log pm25 (density curves) to motivate the log transform
def kde_curve(s, npts=120):
    s = s.dropna().values
    k = stats.gaussian_kde(s)
    xs = np.linspace(s.min(), np.percentile(s, 99.5), npts)
    return [{"x": r(x, 3), "y": r(y, 6)} for x, y in zip(xs, k(xs))]

# Daily series for the overview (downsampled: weekly mean to keep JSON light)
weekly = daily.set_index("date")["pm25"].resample("W").mean()
weekly_series = [{"date": d.strftime("%Y-%m-%d"), "pm25": r(v, 1)} for d, v in weekly.items()]

save("visualization", {
    "scatter": scatter,
    "bubble": bubble,
    "hour_profile": hour_profile,
    "hour_by_season": hour_by_season,
    "heatmap": heatmap,
    "weekday": weekday,
    "scatter_matrix": scatter_matrix,
    "wind_bar": wind_bar,
    "season_bar": season_bar,
    "aqi_by_season": aqi_by_season,
    "aqi_order": aqi_order,
    "kde": {"pm25": kde_curve(df["pm25"]), "log_pm25": kde_curve(df["log_pm25"])},
    "weekly_series": weekly_series,
})
