"""Module 4 - Correlation analysis.

Pearson (linear), Spearman (rank) and Kendall matrices; significance of
each coefficient; interpretation of strength and direction.
Output: web/public/data/correlation.json
"""
import numpy as np
import pandas as pd
from scipy import stats

from common import LABELS, NUMERIC, load_clean, load_daily, r, save

print("04_correlation")
df = load_clean()
daily = load_daily()

cols = NUMERIC + ["hour", "is_weekend"]


def strength(c: float) -> str:
    a = abs(c)
    if a < 0.1:
        return "negligible"
    if a < 0.3:
        return "weak"
    if a < 0.5:
        return "moderate"
    if a < 0.7:
        return "strong"
    return "very strong"


def matrix(method: str, data: pd.DataFrame, columns):
    m = data[columns].corr(method=method)
    return [{"row": a, "col": b, "value": r(m.loc[a, b], 3)} for a in columns for b in columns]


pearson = matrix("pearson", df, cols)
spearman = matrix("spearman", df, cols)
# Kendall is O(n log n) but slow on 41k rows x 9 cols - compute on a 5,000 sample
kendall = matrix("kendall", df.sample(5000, random_state=1), cols)

# Pairwise detail: pm25 against every other column with p-values and CI (Fisher z)
pairs = []
nrows = len(df)
for c in cols:
    if c == "pm25":
        continue
    pr, pp = stats.pearsonr(df[c], df["pm25"])
    sr, sp = stats.spearmanr(df[c], df["pm25"])
    z = np.arctanh(pr); se = 1 / np.sqrt(nrows - 3)
    lo, hi = np.tanh(z - 1.96 * se), np.tanh(z + 1.96 * se)
    pairs.append({"var": c, "label": LABELS.get(c, c), "pearson": r(pr, 4), "pearson_p": pp, "ci_low": r(lo, 4), "ci_high": r(hi, 4),
                  "spearman": r(sr, 4), "spearman_p": sp, "r2": r(pr ** 2, 4), "strength": strength(pr),
                  "direction": "positive" if pr > 0 else "negative", "n": nrows,
                  "t_stat": r(pr * np.sqrt((nrows - 2) / (1 - pr ** 2)), 3)})
pairs.sort(key=lambda d: -abs(d["pearson"]))

# All pairs ranked (upper triangle), to show strongest relationships in the dataset
all_pairs = []
pm = df[cols].corr()
sm = df[cols].corr(method="spearman")
for i, a in enumerate(cols):
    for b in cols[i + 1:]:
        all_pairs.append({"a": a, "b": b, "pearson": r(pm.loc[a, b], 3), "spearman": r(sm.loc[a, b], 3),
                          "strength": strength(pm.loc[a, b]), "direction": "positive" if pm.loc[a, b] > 0 else "negative"})
all_pairs.sort(key=lambda d: -abs(d["pearson"]))

# Correlation at the daily level (aggregation removes hourly noise - r gets larger)
dcols = ["pm25", "DEWP", "TEMP", "PRES", "Iws", "rain_hours"]
daily_pairs = [{"var": c, "pearson": r(daily["pm25"].corr(daily[c]), 3), "spearman": r(daily["pm25"].corr(daily[c], method="spearman"), 3)} for c in dcols if c != "pm25"]

# Point-biserial / eta: association of pm25 with categorical variables
def eta_squared(groups):
    allv = np.concatenate(groups); gm = allv.mean()
    ssb = sum(len(g) * (g.mean() - gm) ** 2 for g in groups)
    sst = ((allv - gm) ** 2).sum()
    return ssb / sst

cat_assoc = []
for c in ["cbwd", "season", "year", "month"]:
    groups = [g["pm25"].values for _, g in df.groupby(c)]
    cat_assoc.append({"var": c, "label": LABELS.get(c, c), "eta2": r(eta_squared(groups), 4), "k": len(groups)})

# Example scatter for pm25 vs Iws (strongest) and pm25 vs DEWP, with lines (log scale optional)
samp = df.sample(600, random_state=3)
examples = {}
for c in ["Iws", "DEWP"]:
    slope, intercept, rv, pv, se = stats.linregress(df[c], df["pm25"])
    examples[c] = {"points": [{"x": r(x, 2), "y": r(y, 1)} for x, y in zip(samp[c], samp["pm25"])],
                   "slope": r(slope, 4), "intercept": r(intercept, 3), "r": r(rv, 4)}

# Anscombe-style caution: Pearson vs Spearman gap shows non-linearity
nonlinear = [{"var": p["var"], "pearson": p["pearson"], "spearman": p["spearman"], "gap": r(abs(p["spearman"]) - abs(p["pearson"]), 4)} for p in pairs]

save("correlation", {
    "cols": cols, "labels": {c: LABELS.get(c, c) for c in cols},
    "pearson": pearson, "spearman": spearman, "kendall": kendall,
    "pairs": pairs, "all_pairs": all_pairs[:12], "daily_pairs": daily_pairs,
    "cat_assoc": cat_assoc, "examples": examples, "nonlinear": nonlinear, "n": nrows,
})
