"""Unit 3 - Data Exploration using Inferential Statistics.

Syllabus line: "Overview of various forms of distributions: Normal, Poisson; Central Limit Theorem;
Confidence Interval; Hypothesis testing; Type-I and Type-II errors; Z-test; t-test; ANOVA (one-way,
two-way)".

What this script computes, in the teacher's layout and notation (see research/module-3.md):
    3.1 Normal distribution (daily temp_c and cnt: histogram + fitted curve, 68.2 / 95.4 / 99.7 check) and
        Poisson distribution (rain/snow days per month, lambda = mean, observed vs expected table).
    3.2 Central limit theorem: population = 731 daily counts; 10,000 samples of n = 5 / 30 / 100 (seeded).
    3.3 Confidence interval: z-based for a random sample of n = 50 days, t-based for n = 10 days (df = 9),
        and the 90 / 95 / 99 % intervals for the n = 50 sample.
    3.4 Hypothesis-testing framework: the Z critical-value table (from scipy, shown as table lookups).
    3.5 Type-I / Type-II errors: no numbers, page text only.
    3.6 Z-test for a single mean (n > 30): 2012 daily rentals vs the 2011 mean as mu_0 (Case II, s used for sigma).
    3.7 t-tests: one-sample (21 holidays vs the overall mean), independent samples with pooled variance
        (12 monthly means 2011 vs 12 of 2012), paired (same 12 calendar months 2011 vs 2012), and a second
        independent-samples test (working-day vs non-working-day monthly means) that accepts H0.
    3.8 ANOVA: one-way daily cnt by season in the teacher's 8 steps; two-way year x quarter (one observation
        per cell) by the correction-factor method T^2/n.
    Class checks: wheat one-way ANOVA (F = 1.5), wheat two-way ANOVA (F = 4 and 6), oceanographer Z-test
        (Z = 2.067), I.Q. one-sample t (t = 0.62, CI 87.0 - 107.4) - all run through the same functions.

Inputs : data/processed/daily.parquet, monthly.parquet, quarterly.parquet (built by unit1_process.py).
Output : web/public/data/unit3.json  (read by web/src/app/unit-3/page.tsx).
Every test: alpha = 0.05, two-tailed, decision by "calculated vs tabulated" critical value. Critical values come
from scipy.stats (norm.ppf / t.ppf / f.ppf) but are labelled like table lookups on the page.
Random draws use numpy default_rng(2024) so the output is identical on every run.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
from scipy import stats

from common import SEASON_ORDER, hist, load_daily, load_monthly, load_quarterly, r, save, sd_population

ALPHA = 0.05
SEED = 2024
rng = np.random.default_rng(SEED)


# ----------------------------------------------------------------------------- critical values (table lookups)
def z_crit(alpha: float = ALPHA, tails: int = 2) -> float:
    """Tabulated Z_alpha (two-tailed by default) - 3.4 framework, 3.6 Z-test."""
    return float(stats.norm.ppf(1 - alpha / tails))


def t_crit(df: int, alpha: float = ALPHA, tails: int = 2) -> float:
    """Tabulated t(df, alpha) - 3.3 CI with t, 3.7 t-tests."""
    return float(stats.t.ppf(1 - alpha / tails, df))


def f_crit(df1: int, df2: int, alpha: float = ALPHA) -> float:
    """Tabulated 5 % F-limit F(v1, v2) - 3.8 ANOVA."""
    return float(stats.f.ppf(1 - alpha, df1, df2))


def sample_sd(values) -> float:
    """s with ÷(n − 1), as in the slide's I.Q. example (used inside t-tests and the t-based CI)."""
    v = np.asarray(values, dtype=float)
    return float(np.sqrt(((v - v.mean()) ** 2).sum() / (len(v) - 1)))


# ----------------------------------------------------------------------------- 3.1 Normal and Poisson
def normal_fit(values, label: str, bins: int = 30, unit: str = "") -> dict:
    """3.1 Normal: histogram + fitted N(mu, sigma) curve and the 68.2 / 95.4 / 99.7 empirical-rule check."""
    v = np.asarray(values, dtype=float)
    mu = float(v.mean())
    sigma = sd_population(v)                       # sigma with ÷N, as taught
    bars = hist(v, bins=bins)
    for b in bars:                                 # the pdf as taught, evaluated at the bin mid-point
        b["normal"] = r(math.exp(-((b["mid"] - mu) ** 2) / (2 * sigma ** 2)) / math.sqrt(2 * math.pi * sigma ** 2), 8)
    rule = []
    for k, expected in [(1, 68.2), (2, 95.4), (3, 99.7)]:
        inside = int(((v >= mu - k * sigma) & (v <= mu + k * sigma)).sum())
        rule.append({"k": k, "lower": r(mu - k * sigma, 2), "upper": r(mu + k * sigma, 2),
                     "inside": inside, "actual_pct": r(100 * inside / len(v), 1), "rule_pct": expected,
                     "gap": r(100 * inside / len(v) - expected, 1)})
    return {"label": label, "unit": unit, "n": int(len(v)), "mean": r(mu, 2), "sigma": r(sigma, 2),
            "min": r(v.min(), 2), "max": r(v.max(), 2), "bins": bars, "rule": rule,
            "max_gap": r(max(abs(x["gap"]) for x in rule), 1)}


def poisson_fit(counts) -> dict:
    """3.1 Poisson: lambda = mean count per month, P(X = x) = e^-lambda lambda^x / x!, expected = N * P(X = x)."""
    c = np.asarray(counts, dtype=int)
    n = int(len(c))
    lam = float(c.mean())
    var = float(((c - lam) ** 2).mean())           # variance with ÷N
    rows = []
    cum = 0.0
    for x in range(0, 4):
        p = math.exp(-lam) * lam ** x / math.factorial(x)
        cum += p
        rows.append({"x": str(x), "observed": int((c == x).sum()), "p": r(p, 4), "expected": r(n * p, 2),
                     "term": f"e^{{-{lam:.3f}}} {lam:.3f}^{x} / {x}!"})
    p_tail = 1 - cum
    rows.append({"x": "4+", "observed": int((c >= 4).sum()), "p": r(p_tail, 4), "expected": r(n * p_tail, 2),
                 "term": "1 − P(0) − P(1) − P(2) − P(3)"})
    return {"n": n, "lambda": r(lam, 4), "sum": int(c.sum()), "variance": r(var, 4),
            "ratio": r(var / lam, 3), "rows": rows,
            "max_count": int(c.max()), "counts": c.tolist(),
            "fit_ok": bool(0.5 <= var / lam <= 1.5)}


# ----------------------------------------------------------------------------- 3.2 CLT
def clt(population, sizes=(5, 30, 100), draws: int = 10_000, chart_n: int = 30) -> dict:
    """3.2 CLT: draw `draws` samples of size n with replacement, average each; compare with mu and sigma/sqrt(n)."""
    pop = np.asarray(population, dtype=float)
    mu = float(pop.mean())
    sigma = sd_population(pop)
    table, chart = [], None
    for n in sizes:
        samples = rng.choice(pop, size=(draws, n), replace=True)
        means = samples.mean(axis=1)
        row = {"n": n, "draws": draws, "mean_of_means": r(means.mean(), 2), "sd_of_means": r(sd_population(means), 2),
               "se_theory": r(sigma / math.sqrt(n), 2), "min_mean": r(means.min(), 1), "max_mean": r(means.max(), 1)}
        table.append(row)
        if n == chart_n:
            bars = hist(means, bins=40)
            se = sigma / math.sqrt(n)
            for b in bars:
                b["normal"] = r(math.exp(-((b["mid"] - mu) ** 2) / (2 * se ** 2)) / math.sqrt(2 * math.pi * se ** 2), 8)
            chart = {"n": n, "bins": bars, "row": row}
    return {"N": int(len(pop)), "mu": r(mu, 2), "sigma": r(sigma, 2), "draws": draws, "sizes": list(sizes),
            "population_bins": hist(pop, bins=30), "table": table, "chart": chart,
            "population": [int(x) for x in pop]}


# ----------------------------------------------------------------------------- 3.3 Confidence interval
def ci_z(sample, sigma: float, level: float = 0.95) -> dict:
    """3.3 CI = x_bar ± z·(sigma/sqrt n), the slide's four-line layout."""
    v = np.asarray(sample, dtype=float)
    n = len(v)
    xbar = float(v.mean())
    z = float(stats.norm.ppf(1 - (1 - level) / 2))
    se = sigma / math.sqrt(n)
    moe = z * se
    return {"level": int(round(level * 100)), "n": n, "xbar": r(xbar, 2), "sigma": r(sigma, 2), "z": r(z, 3),
            "se": r(se, 2), "moe": r(moe, 2), "lower": r(xbar - moe, 2), "upper": r(xbar + moe, 2),
            "width": r(2 * moe, 2)}


def ci_t(sample) -> dict:
    """3.3 CI with t when sigma is unknown and n < 30: x_bar ± t_0.05 · s/sqrt n, s with ÷(n − 1), df = n − 1."""
    v = np.asarray(sample, dtype=float)
    n = len(v)
    xbar = float(v.mean())
    dev = v - xbar
    ss = float((dev ** 2).sum())
    s2 = ss / (n - 1)
    s = math.sqrt(s2)
    df = n - 1
    t = t_crit(df)
    se = s / math.sqrt(n)
    moe = t * se
    return {"n": n, "sum_x": r(v.sum(), 2), "xbar": r(xbar, 2), "sum_sq_dev": r(ss, 2), "s2": r(s2, 2), "s": r(s, 2),
            "df": df, "t": r(t, 3), "se": r(se, 3), "moe": r(moe, 3), "lower": r(xbar - moe, 2), "upper": r(xbar + moe, 2),
            "rows": [{"x": r(x, 2), "dev": r(d, 2), "dev2": r(d * d, 2)} for x, d in zip(v, dev)]}


# ----------------------------------------------------------------------------- 3.6 Z-test
def z_test(xbar: float, mu0: float, sd: float, n: int, sd_label: str = "s", tails: int = 2) -> dict:
    """3.6 Z-test of significance for a single mean, n > 30: Z = (x_bar − mu_0)/(sd/sqrt n) vs tabulated Z_0.05."""
    se = sd / math.sqrt(n)
    z = (xbar - mu0) / se
    crit = z_crit(ALPHA, tails)
    reject = abs(z) > crit
    return {"xbar": r(xbar, 2), "mu0": r(mu0, 2), "sd": r(sd, 2), "sd_label": sd_label, "n": n, "sqrt_n": r(math.sqrt(n), 3),
            "se": r(se, 3), "z": r(z, 3), "abs_z": r(abs(z), 3), "crit": r(crit, 2), "alpha": ALPHA,
            "decision": "reject" if reject else "accept", "p": r(2 * stats.norm.sf(abs(z)), 4)}


# ----------------------------------------------------------------------------- 3.7 t-tests
def one_sample_t(values, mu0: float, labels=None) -> dict:
    """3.7(a) one-sample t: t = (x_bar − mu)/(s/sqrt n), s² = Σ(x − x_bar)²/(n − 1), df = n − 1."""
    v = np.asarray(values, dtype=float)
    n = len(v)
    xbar = float(v.mean())
    dev = v - xbar
    ss = float((dev ** 2).sum())
    s2 = ss / (n - 1)
    s = math.sqrt(s2)
    se = s / math.sqrt(n)
    t = (xbar - mu0) / se
    df = n - 1
    crit = t_crit(df)
    rows = [{"label": (labels[i] if labels is not None else str(i + 1)), "x": r(x, 2), "dev": r(d, 2), "dev2": r(d * d, 2)}
            for i, (x, d) in enumerate(zip(v, dev))]
    return {"n": n, "sum_x": r(v.sum(), 2), "xbar": r(xbar, 2), "mu0": r(mu0, 2), "sum_sq_dev": r(ss, 2),
            "s2": r(s2, 2), "s": r(s, 2), "se": r(se, 3), "t": r(t, 3), "abs_t": r(abs(t), 3), "df": df,
            "crit": r(crit, 3), "decision": "reject" if abs(t) > crit else "accept", "rows": rows,
            "p": r(2 * stats.t.sf(abs(t), df), 4)}


def independent_t(x, y, x_labels=None, y_labels=None) -> dict:
    """3.7(b, d) independent-samples t with pooled variance (the slide's formula):
    S² = [Σ(x − x_bar)² + Σ(y − y_bar)²]/(n1 + n2 − 2), t = (x_bar − y_bar)/sqrt(S²/n1 + S²/n2), df = n1 + n2 − 2."""
    X = np.asarray(x, dtype=float); Y = np.asarray(y, dtype=float)
    n1, n2 = len(X), len(Y)
    xbar, ybar = float(X.mean()), float(Y.mean())
    dx, dy = X - xbar, Y - ybar
    ssx, ssy = float((dx ** 2).sum()), float((dy ** 2).sum())
    df = n1 + n2 - 2
    s2 = (ssx + ssy) / df
    inside = s2 / n1 + s2 / n2
    t = (xbar - ybar) / math.sqrt(inside)
    crit = t_crit(df)
    rows = []
    for i in range(max(n1, n2)):
        row = {}
        if i < n1:
            row.update({"x_label": x_labels[i] if x_labels is not None else str(i + 1), "x": r(X[i], 2), "dx": r(dx[i], 2), "dx2": r(dx[i] ** 2, 2)})
        if i < n2:
            row.update({"y_label": y_labels[i] if y_labels is not None else str(i + 1), "y": r(Y[i], 2), "dy": r(dy[i], 2), "dy2": r(dy[i] ** 2, 2)})
        rows.append(row)
    return {"n1": n1, "n2": n2, "sum_x": r(X.sum(), 2), "sum_y": r(Y.sum(), 2), "xbar": r(xbar, 2), "ybar": r(ybar, 2),
            "ssx": r(ssx, 2), "ssy": r(ssy, 2), "df": df, "s2": r(s2, 2), "s2_over_n1": r(s2 / n1, 2), "s2_over_n2": r(s2 / n2, 2),
            "inside": r(inside, 2), "sqrt_inside": r(math.sqrt(inside), 3), "diff": r(xbar - ybar, 2),
            "t": r(t, 3), "abs_t": r(abs(t), 3), "crit": r(crit, 3), "decision": "reject" if abs(t) > crit else "accept",
            "rows": rows, "p": r(2 * stats.t.sf(abs(t), df), 4)}


def paired_t(before, after, labels) -> dict:
    """3.7(c) paired t: d = before − after, t = (d_bar − 0)/(s_d/sqrt n), s_d² = Σ(d − d_bar)²/(n − 1), df = n − 1."""
    B = np.asarray(before, dtype=float); A = np.asarray(after, dtype=float)
    n = len(B)
    d = B - A
    dbar = float(d.mean())
    dd = d - dbar
    ss = float((dd ** 2).sum())
    s2 = ss / (n - 1)
    s = math.sqrt(s2)
    se = s / math.sqrt(n)
    t = dbar / se
    df = n - 1
    crit = t_crit(df)
    rows = [{"label": labels[i], "before": r(B[i], 2), "after": r(A[i], 2), "d": r(d[i], 2), "dd": r(dd[i], 2), "dd2": r(dd[i] ** 2, 2)}
            for i in range(n)]
    return {"n": n, "sum_d": r(d.sum(), 2), "dbar": r(dbar, 2), "sum_sq_dev": r(ss, 2), "s2": r(s2, 2), "s": r(s, 2),
            "se": r(se, 3), "t": r(t, 3), "abs_t": r(abs(t), 3), "df": df, "crit": r(crit, 3),
            "decision": "reject" if abs(t) > crit else "accept", "rows": rows, "p": r(2 * stats.t.sf(abs(t), df), 4)}


# ----------------------------------------------------------------------------- 3.8 ANOVA
def one_way_anova(groups: dict) -> dict:
    """3.8 one-way ANOVA in the teacher's 8 steps: X_bar_i, X_double_bar, SS between = Σ n_i (X_bar_i − X̿)²,
    MS between, SS within = ΣΣ(X_ij − X_bar_i)², MS within, total, F-ratio vs F(k − 1, n − k)."""
    names = list(groups.keys())
    arrs = [np.asarray(groups[g], dtype=float) for g in names]
    k = len(arrs)
    n = int(sum(len(a) for a in arrs))
    means = [float(a.mean()) for a in arrs]
    grand = sum(means) / k                                    # step 2: mean of the sample means (as taught)
    between_terms = [len(a) * (m - grand) ** 2 for a, m in zip(arrs, means)]
    ss_between = float(sum(between_terms))
    df_between = k - 1
    ms_between = ss_between / df_between
    within_terms = [float(((a - m) ** 2).sum()) for a, m in zip(arrs, means)]
    ss_within = float(sum(within_terms))
    df_within = n - k
    ms_within = ss_within / df_within
    ss_total = ss_between + ss_within
    f = ms_between / ms_within
    crit = f_crit(df_between, df_within)
    step1 = [{"group": g, "n": int(len(a)), "sum": r(a.sum(), 2), "mean": r(m, 2),
              "dev": r(m - grand, 2), "dev2": r((m - grand) ** 2, 2), "n_dev2": r(bt, 2), "ss_within": r(wt, 2),
              "values": [r(x, 2) for x in a] if len(a) <= 12 else None}
             for g, a, m, bt, wt in zip(names, arrs, means, between_terms, within_terms)]
    return {"k": k, "n": n, "groups": step1, "grand_mean": r(grand, 2), "sum_of_means": r(sum(means), 2),
            "ss_between": r(ss_between, 2), "df_between": df_between, "ms_between": r(ms_between, 2),
            "ss_within": r(ss_within, 2), "df_within": df_within, "ms_within": r(ms_within, 2),
            "ss_total": r(ss_total, 2), "df_total": n - 1, "f": r(f, 3), "crit": r(crit, 2),
            "decision": "reject" if f >= crit else "accept", "p": r(stats.f.sf(f, df_between, df_within), 4),
            "overall_mean": r(float(np.concatenate(arrs).mean()), 2)}


def two_way_anova(matrix, row_labels, col_labels, row_factor: str, col_factor: str) -> dict:
    """3.8 two-way ANOVA, one observation per cell, correction-factor method: T²/n, Total SS = ΣX² − T²/n,
    SS between columns = ΣT_j²/n_j − T²/n, SS between rows = ΣT_i²/n_i − T²/n, residual = Total − (cols + rows)."""
    M = np.asarray(matrix, dtype=float)
    rows_n, cols_n = M.shape
    T = float(M.sum())
    n = int(M.size)
    cf = T * T / n
    sum_sq = float((M ** 2).sum())
    ss_total = sum_sq - cf
    col_totals = M.sum(axis=0); row_totals = M.sum(axis=1)
    col_terms = [float(t * t / rows_n) for t in col_totals]
    row_terms = [float(t * t / cols_n) for t in row_totals]
    ss_cols = sum(col_terms) - cf
    ss_rows = sum(row_terms) - cf
    ss_res = ss_total - (ss_cols + ss_rows)
    df_cols, df_rows = cols_n - 1, rows_n - 1
    df_res = df_cols * df_rows
    ms_cols, ms_rows, ms_res = ss_cols / df_cols, ss_rows / df_rows, ss_res / df_res
    f_cols, f_rows = ms_cols / ms_res, ms_rows / ms_res
    crit_cols, crit_rows = f_crit(df_cols, df_res), f_crit(df_rows, df_res)
    cells = [{"row": row_labels[i], "values": [r(x, 2) for x in M[i]], "total": r(row_totals[i], 2),
              "squares": [r(x * x, 2) for x in M[i]]} for i in range(rows_n)]
    return {"row_factor": row_factor, "col_factor": col_factor, "row_labels": list(row_labels), "col_labels": list(col_labels),
            "r": rows_n, "c": cols_n, "n": n, "cells": cells, "col_totals": [r(t, 2) for t in col_totals],
            "T": r(T, 2), "cf": r(cf, 2), "sum_sq": r(sum_sq, 2), "ss_total": r(ss_total, 2),
            "col_terms": [r(t, 2) for t in col_terms], "row_terms": [r(t, 2) for t in row_terms],
            "ss_cols": r(ss_cols, 2), "ss_rows": r(ss_rows, 2), "ss_res": r(ss_res, 2),
            "df_cols": df_cols, "df_rows": df_rows, "df_res": df_res, "df_total": n - 1,
            "ms_cols": r(ms_cols, 2), "ms_rows": r(ms_rows, 2), "ms_res": r(ms_res, 2),
            "f_cols": r(f_cols, 3), "f_rows": r(f_rows, 3), "crit_cols": r(crit_cols, 2), "crit_rows": r(crit_rows, 2),
            "decision_cols": "reject" if f_cols >= crit_cols else "accept",
            "decision_rows": "reject" if f_rows >= crit_rows else "accept",
            "p_cols": r(stats.f.sf(f_cols, df_cols, df_res), 4), "p_rows": r(stats.f.sf(f_rows, df_rows, df_res), 4)}


# ----------------------------------------------------------------------------- main
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def main() -> None:
    daily = load_daily()
    monthly = load_monthly().sort_values("date").reset_index(drop=True)
    quarterly = load_quarterly().sort_values("date").reset_index(drop=True)
    cnt = daily["cnt"].to_numpy(dtype=float)
    N = int(len(daily))
    mu_all = float(cnt.mean())
    sigma_all = sd_population(cnt)

    # ---- 3.1 distributions
    distributions = {
        "normal": {"temp": normal_fit(daily["temp_c"], "Daily temperature", bins=30, unit="°C"),
                   "cnt": normal_fit(cnt, "Daily rentals", bins=30, unit="rentals")},
        "poisson": poisson_fit(monthly["rain_days"]),
    }

    # ---- 3.2 CLT
    clt_out = clt(cnt)

    # ---- 3.3 CI
    idx50 = rng.choice(N, size=50, replace=False)
    sample50 = cnt[idx50]
    idx10 = rng.choice(N, size=10, replace=False)
    sample10 = cnt[idx10]
    ci = {
        "z": ci_z(sample50, sigma_all, 0.95),
        "levels": [ci_z(sample50, sigma_all, lv) for lv in (0.90, 0.95, 0.99)],
        "t": ci_t(sample10),
        "t_dates": [str(d) for d in daily.loc[idx10, "date"].dt.strftime("%Y-%m-%d")],
        "mu": r(mu_all, 2),
        "contains_mu_z": bool(ci_z(sample50, sigma_all, 0.95)["lower"] <= mu_all <= ci_z(sample50, sigma_all, 0.95)["upper"]),
    }
    ci["contains_mu_t"] = bool(ci["t"]["lower"] <= mu_all <= ci["t"]["upper"])

    # ---- 3.4 framework: the Z critical-value table (from scipy, shown as a table)
    framework = {
        "z_table": [{"alpha": a, "two": r(z_crit(a, 2), 3), "right": r(z_crit(a, 1), 3), "left": r(-z_crit(a, 1), 3)}
                    for a in (0.01, 0.05, 0.10)],
        "t_examples": [{"df": df, "t": r(t_crit(df), 3)} for df in (9, 11, 20, 22, 25, 46)],
    }

    # ---- 3.6 Z-test: 2012 vs the 2011 mean
    d2011 = daily[daily["year"] == 2011]["cnt"].to_numpy(dtype=float)
    d2012 = daily[daily["year"] == 2012]["cnt"].to_numpy(dtype=float)
    mu0 = float(d2011.mean())
    s2012 = sample_sd(d2012)
    ztest = z_test(float(d2012.mean()), mu0, s2012, int(len(d2012)), sd_label="s")
    ztest.update({"n_2011": int(len(d2011)), "year_sample": 2012, "year_ref": 2011})

    # ---- 3.7 t-tests
    hol = daily[daily["holiday"] == 1].sort_values("date")
    t_one = one_sample_t(hol["cnt"].to_numpy(dtype=float), mu_all, labels=hol["date"].dt.strftime("%Y-%m-%d").tolist())
    t_one["mu0_label"] = "overall mean daily rentals (all 731 days)"

    m2011 = monthly[monthly["year"] == 2011].sort_values("month")
    m2012 = monthly[monthly["year"] == 2012].sort_values("month")
    t_ind = independent_t(m2011["cnt"].to_numpy(dtype=float), m2012["cnt"].to_numpy(dtype=float),
                          x_labels=[f"{MONTHS[m - 1]} 2011" for m in m2011["month"]],
                          y_labels=[f"{MONTHS[m - 1]} 2012" for m in m2012["month"]])
    t_pair = paired_t(m2011["cnt"].to_numpy(dtype=float), m2012["cnt"].to_numpy(dtype=float), labels=MONTHS)

    # (d) a comparison designed to accept H0: working-day vs non-working-day monthly means
    work = daily[daily["workingday"] == 1].groupby(["year", "month"])["cnt"].mean()
    nonwork = daily[daily["workingday"] == 0].groupby(["year", "month"])["cnt"].mean()
    lab = [f"{MONTHS[m - 1]} {y}" for (y, m) in work.index]
    t_accept = independent_t(work.to_numpy(dtype=float), nonwork.to_numpy(dtype=float), x_labels=lab, y_labels=lab)
    t_accept["comparison"] = "working days vs non-working days (weekends and holidays)"
    t_accept["x_name"] = "Working days"; t_accept["y_name"] = "Non-working days"
    if t_accept["decision"] == "reject":
        wk = daily[daily["weekday"].between(1, 5)].groupby(["year", "month"])["cnt"].mean()
        we = daily[daily["weekday"].isin([0, 6])].groupby(["year", "month"])["cnt"].mean()
        t_accept = independent_t(wk.to_numpy(dtype=float), we.to_numpy(dtype=float), x_labels=lab, y_labels=lab)
        t_accept["comparison"] = "weekdays (Mon–Fri) vs weekends (Sat–Sun)"
        t_accept["x_name"] = "Weekdays"; t_accept["y_name"] = "Weekends"
    t_accept["daily_means"] = {"x": r(float(daily[daily["workingday"] == 1]["cnt"].mean()), 1),
                               "y": r(float(daily[daily["workingday"] == 0]["cnt"].mean()), 1)}

    # ---- 3.8 ANOVA
    groups = {s: daily[daily["season_name"] == s]["cnt"].to_numpy(dtype=float) for s in SEASON_ORDER}
    anova1 = one_way_anova(groups)
    anova1["factor"] = "season"
    piv = quarterly.pivot(index="year", columns="quarter", values="cnt").sort_index()
    anova2 = two_way_anova(piv.to_numpy(), [str(y) for y in piv.index], [f"Q{q}" for q in piv.columns],
                           row_factor="year", col_factor="quarter (season)")

    # ---- class checks, through the same functions
    wheat = {"Variety A": [6, 7, 3, 8], "Variety B": [5, 5, 3, 7], "Variety C": [5, 4, 3, 4]}
    check_one = one_way_anova(wheat)
    check_two = two_way_anova(np.array([[6, 5, 5], [7, 5, 4], [3, 3, 3], [8, 7, 4]]),
                              ["W", "X", "Y", "Z"], ["A", "B", "C"], row_factor="fertilizer", col_factor="seed variety")
    check_z = z_test(59.1, 57.4, 5.2, 40, sd_label="σ")
    iq = [70, 120, 110, 101, 88, 83, 95, 98, 107, 100]
    check_t = one_sample_t(iq, 100.0)
    check_t_ci = ci_t(iq)
    class_checks = {
        "wheat_one_way": {"ours": check_one, "slide": {"ss_between": 8, "ss_within": 24, "ms_between": 4.00, "ms_within": 2.67, "f": 1.5, "crit": 4.26}},
        "wheat_two_way": {"ours": check_two, "slide": {"cf": 300, "ss_total": 32, "ss_cols": 8, "ss_rows": 18, "ss_res": 6, "f_cols": 4, "f_rows": 6, "crit_cols": 5.14, "crit_rows": 4.76}},
        "oceanographer": {"ours": check_z, "slide": {"z": 2.067, "crit": 1.96, "decision": "reject"}},
        "iq": {"ours": check_t, "ci": check_t_ci, "slide": {"xbar": 97.2, "sum_sq_dev": 1833.60, "s2": 203.73, "s": 14.27, "t": 0.62, "crit": 2.262, "lower": 87.0, "upper": 107.4}},
    }

    headline = {
        "z": ztest["z"], "z_decision": ztest["decision"], "z_crit": ztest["crit"],
        "t_one": t_one["t"], "t_one_decision": t_one["decision"],
        "t_ind": t_ind["t"], "t_ind_decision": t_ind["decision"],
        "t_pair": t_pair["t"], "t_pair_decision": t_pair["decision"],
        "t_accept": t_accept["t"], "t_accept_decision": t_accept["decision"], "t_accept_comparison": t_accept["comparison"],
        "f_one": anova1["f"], "f_one_crit": anova1["crit"], "f_one_decision": anova1["decision"],
        "f_two_cols": anova2["f_cols"], "f_two_cols_crit": anova2["crit_cols"], "f_two_cols_decision": anova2["decision_cols"],
        "f_two_rows": anova2["f_rows"], "f_two_rows_crit": anova2["crit_rows"], "f_two_rows_decision": anova2["decision_rows"],
        "ci50_lower": ci["z"]["lower"], "ci50_upper": ci["z"]["upper"], "ci50_xbar": ci["z"]["xbar"],
    }

    save("unit3", {
        "meta": {"N": N, "mu": r(mu_all, 2), "sigma": r(sigma_all, 2), "alpha": ALPHA, "seed": SEED,
                 "months": int(len(monthly)), "quarters": int(len(quarterly))},
        "distributions": distributions,
        "clt": clt_out,
        "ci": ci,
        "framework": framework,
        "ztest": ztest,
        "ttests": {"one_sample": t_one, "independent": t_ind, "paired": t_pair, "accept": t_accept},
        "anova": {"one_way": anova1, "two_way": anova2},
        "class_checks": class_checks,
        "headline": headline,
    })
    print("  Z =", ztest["z"], ztest["decision"], "| t one =", t_one["t"], t_one["decision"], "| t ind =", t_ind["t"], t_ind["decision"],
          "| t paired =", t_pair["t"], t_pair["decision"], "| t accept =", t_accept["t"], t_accept["decision"])
    print("  F one-way =", anova1["f"], "vs", anova1["crit"], anova1["decision"], "| two-way cols F =", anova2["f_cols"], "vs", anova2["crit_cols"],
          "rows F =", anova2["f_rows"], "vs", anova2["crit_rows"])
    print("  CI n=50:", ci["z"]["lower"], "-", ci["z"]["upper"], "| checks: wheat F =", check_one["f"], "two-way", check_two["f_cols"], check_two["f_rows"],
          "| ocean Z =", check_z["z"], "| IQ t =", check_t["t"], "CI", check_t_ci["lower"], check_t_ci["upper"])


if __name__ == "__main__":
    main()
