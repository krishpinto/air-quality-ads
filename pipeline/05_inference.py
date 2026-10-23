"""Module 5 - Probability distributions and inferential statistics.

Normal / Poisson / Binomial fits, Central Limit Theorem simulation,
confidence intervals, z-test, t-tests, ANOVA, chi-square, Type I/II error
and power analysis.
Output: web/public/data/inference.json
"""
import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.stats.multicomp import pairwise_tukeyhsd
from statsmodels.stats.power import TTestIndPower

from common import SEASON_ORDER, WIND_ORDER, hist, load_clean, load_daily, load_monthly, r, save

print("05_inference")
df = load_clean()
daily = load_daily()
monthly = load_monthly()
rng = np.random.default_rng(2024)
ALPHA = 0.05
STANDARD = 75.0  # China GB 3095-2012 Class II 24-hour PM2.5 limit (µg/m³)

pop = df["pm25"].values.astype(float)
MU, SIGMA = pop.mean(), pop.std(ddof=0)

# ------------------------------------------------------------------ Normal
def normal_block(col, label):
    s = df[col].dropna().astype(float)
    mu, sd = s.mean(), s.std()
    bins = hist(s, bins=40)
    for b in bins:
        b["normal"] = r(stats.norm.pdf(b["mid"], mu, sd), 6)
    samp = s.sample(5000, random_state=1)
    sh_w, sh_p = stats.shapiro(samp)
    jb, jb_p = stats.jarque_bera(s)
    ks, ks_p = stats.kstest((s - mu) / sd, "norm")
    ad = stats.anderson(s, dist="norm")
    return {"label": label, "mu": r(mu, 3), "sd": r(sd, 3), "skew": r(stats.skew(s), 3), "kurtosis": r(stats.kurtosis(s), 3),
            "bins": bins,
            "tests": [
                {"name": "Shapiro-Wilk (n=5000 sample)", "stat": r(sh_w, 4), "p": sh_p},
                {"name": "Jarque-Bera", "stat": r(jb, 2), "p": jb_p},
                {"name": "Kolmogorov-Smirnov", "stat": r(ks, 4), "p": ks_p},
                {"name": "Anderson-Darling", "stat": r(ad.statistic, 3), "p": None, "crit_5pct": r(ad.critical_values[2], 3)},
            ]}

normal = {c: normal_block(c, l) for c, l in [("TEMP", "Temperature (°C)"), ("pm25", "PM2.5 (µg/m³)"), ("log_pm25", "log(1 + PM2.5)")]}
# worked probability examples on TEMP
t = df["TEMP"]; mu_t, sd_t = t.mean(), t.std()
normal["examples"] = [
    {"q": "P(TEMP > 30 °C)", "z": r((30 - mu_t) / sd_t, 3), "theoretical": r(1 - stats.norm.cdf(30, mu_t, sd_t), 4), "empirical": r((t > 30).mean(), 4)},
    {"q": "P(0 < TEMP < 20 °C)", "z": f"{(0-mu_t)/sd_t:.2f} to {(20-mu_t)/sd_t:.2f}", "theoretical": r(stats.norm.cdf(20, mu_t, sd_t) - stats.norm.cdf(0, mu_t, sd_t), 4), "empirical": r(((t > 0) & (t < 20)).mean(), 4)},
    {"q": "P(TEMP < -10 °C)", "z": r((-10 - mu_t) / sd_t, 3), "theoretical": r(stats.norm.cdf(-10, mu_t, sd_t), 4), "empirical": r((t < -10).mean(), 4)},
]
# PM2.5: normal vs log-normal fit for tail probability
shape, loc, scale = stats.lognorm.fit(pop[pop > 0], floc=0)
normal["pm25_tail"] = {
    "threshold": 150,
    "empirical": r((pop > 150).mean(), 4),
    "normal_fit": r(1 - stats.norm.cdf(150, MU, SIGMA), 4),
    "lognormal_fit": r(1 - stats.lognorm.cdf(150, shape, loc, scale), 4),
    "lognormal_params": {"sigma": r(shape, 4), "scale": r(scale, 3)},
}

# ------------------------------------------------------------------ Poisson
hz = daily["hazardous_hours"].astype(int)
lam = hz.mean()
kmax = 24
emp = hz.value_counts().reindex(range(kmax + 1), fill_value=0)
poisson_pmf = stats.poisson.pmf(np.arange(kmax + 1), lam)
poisson_table = [{"k": int(k), "observed": int(emp[k]), "obs_prob": r(emp[k] / len(hz), 4), "poisson_prob": r(poisson_pmf[k], 4),
                  "expected": r(poisson_pmf[k] * len(hz), 2)} for k in range(kmax + 1)]
# chi-square goodness of fit (merge tail so expected >= 5)
obs = emp.values.astype(float); exp = poisson_pmf * len(hz)
cut = np.where(exp < 5)[0]
if len(cut):
    c0 = cut[0]
    obs = np.append(obs[:c0], obs[c0:].sum()); exp = np.append(exp[:c0], exp[c0:].sum())
exp = exp * obs.sum() / exp.sum()
chi2_gof, chi2_gof_p = stats.chisquare(obs, exp, ddof=1)

rain = daily["rain_hours"].astype(int)
lam_r = rain.mean()
rain_emp = rain.value_counts().reindex(range(0, 16), fill_value=0)
rain_pmf = stats.poisson.pmf(np.arange(16), lam_r)
poisson = {
    "variable": "Hours per day with PM2.5 > 250 µg/m³ (hazardous)",
    "lambda": r(lam, 4), "variance": r(hz.var(), 4), "dispersion_index": r(hz.var() / lam, 3), "n_days": int(len(hz)),
    "table": poisson_table,
    "examples": [
        {"q": "P(X = 0) - a clean day", "poisson": r(stats.poisson.pmf(0, lam), 4), "empirical": r((hz == 0).mean(), 4)},
        {"q": "P(X ≥ 5)", "poisson": r(1 - stats.poisson.cdf(4, lam), 4), "empirical": r((hz >= 5).mean(), 4)},
        {"q": "P(X ≥ 12) - half the day hazardous", "poisson": r(1 - stats.poisson.cdf(11, lam), 4), "empirical": r((hz >= 12).mean(), 4)},
    ],
    "gof": {"chi2": r(chi2_gof, 2), "p": chi2_gof_p, "df": int(len(obs) - 2)},
    "rain": {"variable": "Hours of rain per day", "lambda": r(lam_r, 4), "variance": r(rain.var(), 4), "dispersion_index": r(rain.var() / lam_r, 3),
             "table": [{"k": int(k), "observed": int(rain_emp[k]), "obs_prob": r(rain_emp[k] / len(rain), 4), "poisson_prob": r(rain_pmf[k], 4)} for k in range(16)]},
}

# ------------------------------------------------------------------ Binomial
p_unh = df["unhealthy"].mean()
uh = daily.loc[daily["valid_hours"] == 24, "unhealthy_hours"].astype(int)
bin_emp = uh.value_counts().reindex(range(25), fill_value=0)
bin_pmf = stats.binom.pmf(np.arange(25), 24, p_unh)
binomial = {
    "p": r(p_unh, 4), "n": 24, "mean": r(24 * p_unh, 3), "sd": r(np.sqrt(24 * p_unh * (1 - p_unh)), 3),
    "observed_mean": r(uh.mean(), 3), "observed_sd": r(uh.std(), 3), "n_days": int(len(uh)),
    "table": [{"k": int(k), "observed": r(bin_emp[k] / len(uh), 4), "binomial": r(bin_pmf[k], 4)} for k in range(25)],
    "note": "Hours within a day are strongly autocorrelated, so independence fails: the observed distribution is far wider (U-shaped) than Binomial(24, p) predicts.",
}

# ------------------------------------------------------------------ CLT
clt_sizes = [2, 5, 10, 30, 50, 100]
clt = {"population": {"mu": r(MU, 3), "sigma": r(SIGMA, 3), "skew": r(stats.skew(pop), 3), "kurtosis": r(stats.kurtosis(pop), 3), "n": int(len(pop)),
                      "bins": hist(pop, bins=40)},
       "draws": 2000, "by_n": []}
for n_ in clt_sizes:
    means = rng.choice(pop, size=(2000, n_), replace=True).mean(axis=1)
    bins = hist(means, bins=35)
    se_theory = SIGMA / np.sqrt(n_)
    for b in bins:
        b["normal"] = r(stats.norm.pdf(b["mid"], MU, se_theory), 6)
    jb, jbp = stats.jarque_bera(means)
    clt["by_n"].append({"n": n_, "mean_of_means": r(means.mean(), 3), "sd_of_means": r(means.std(ddof=1), 3), "se_theory": r(se_theory, 3),
                        "skew": r(stats.skew(means), 3), "kurtosis": r(stats.kurtosis(means), 3), "jb_p": jbp, "bins": bins})
clt["population_sample"] = [int(x) for x in rng.choice(pop, size=4000, replace=False)]

# ------------------------------------------------------------------ Confidence intervals
ci_rows = []
for n_ in [30, 100, 500, 2000]:
    s = rng.choice(pop, size=n_, replace=False)
    xbar, sd = s.mean(), s.std(ddof=1)
    z = stats.norm.ppf(0.975); tcrit = stats.t.ppf(0.975, n_ - 1)
    ci_rows.append({"n": n_, "xbar": r(xbar, 2), "s": r(sd, 2), "se": r(sd / np.sqrt(n_), 3), "z_crit": r(z, 3), "t_crit": r(tcrit, 3),
                    "z_low": r(xbar - z * SIGMA / np.sqrt(n_), 2), "z_high": r(xbar + z * SIGMA / np.sqrt(n_), 2),
                    "t_low": r(xbar - tcrit * sd / np.sqrt(n_), 2), "t_high": r(xbar + tcrit * sd / np.sqrt(n_), 2),
                    "contains_mu": bool(xbar - tcrit * sd / np.sqrt(n_) <= MU <= xbar + tcrit * sd / np.sqrt(n_))})
# CI for proportion of unhealthy hours (Wald and Wilson)
k = int(df["unhealthy"].sum()); N = len(df); phat = k / N
z = stats.norm.ppf(0.975)
wald = (phat - z * np.sqrt(phat * (1 - phat) / N), phat + z * np.sqrt(phat * (1 - phat) / N))
den = 1 + z ** 2 / N; centre = (phat + z ** 2 / (2 * N)) / den; half = z * np.sqrt(phat * (1 - phat) / N + z ** 2 / (4 * N ** 2)) / den
proportion_ci = {"k": k, "n": N, "phat": r(phat, 4), "wald_low": r(wald[0], 4), "wald_high": r(wald[1], 4), "wilson_low": r(centre - half, 4), "wilson_high": r(centre + half, 4)}
# CI of mean by season (t)
season_ci = []
for s_ in SEASON_ORDER:
    v = df.loc[df["season"] == s_, "pm25"]
    m, se = v.mean(), stats.sem(v); tc = stats.t.ppf(0.975, len(v) - 1)
    season_ci.append({"season": s_, "n": int(len(v)), "mean": r(m, 2), "low": r(m - tc * se, 2), "high": r(m + tc * se, 2)})
# Coverage simulation: 200 samples of n=50, how many 95% t-intervals cover mu
cover = []
for i in range(100):
    s = rng.choice(pop, size=50, replace=True); m = s.mean(); h = stats.t.ppf(0.975, 49) * s.std(ddof=1) / np.sqrt(50)
    cover.append({"i": i, "low": r(m - h, 1), "high": r(m + h, 1), "mean": r(m, 1), "covers": bool(m - h <= MU <= m + h)})
coverage = {"intervals": cover, "rate": r(100 * np.mean([c["covers"] for c in cover]), 1), "mu": r(MU, 2)}
# Sample size needed for margin E at 95%
sample_size = [{"E": E, "n": int(np.ceil((z * SIGMA / E) ** 2))} for E in [20, 10, 5, 2, 1]]

# ------------------------------------------------------------------ Hypothesis tests
tests = []
# One-sample z-test: random 200 hours of 2014, H0: mu = 75 (standard), sigma known from population
s14 = rng.choice(df.loc[df["year"] == 2014, "pm25"].values, size=200, replace=False)
zstat = (s14.mean() - STANDARD) / (SIGMA / np.sqrt(200))
tests.append({"id": "z_one", "name": "One-sample z-test", "h0": f"μ = {STANDARD:.0f} µg/m³ (mean PM2.5 equals the national 24-h limit)", "h1": f"μ > {STANDARD:.0f} (one-tailed)",
              "sample": "200 random hours from 2014, σ assumed known from the full dataset", "n": 200, "xbar": r(s14.mean(), 2), "sigma": r(SIGMA, 2),
              "stat_name": "z", "stat": r(zstat, 3), "crit": r(stats.norm.ppf(0.95), 3), "p": float(1 - stats.norm.cdf(zstat)), "alpha": ALPHA,
              "decision": "Reject H0" if 1 - stats.norm.cdf(zstat) < ALPHA else "Fail to reject H0"})
# One-sample t-test on daily means 2014 vs 75
d14 = daily.loc[daily["year"] == 2014, "pm25"]
tt = stats.ttest_1samp(d14, STANDARD)
tests.append({"id": "t_one", "name": "One-sample t-test", "h0": f"μ = {STANDARD:.0f} µg/m³ for 2014 daily means", "h1": f"μ ≠ {STANDARD:.0f} (two-tailed)",
              "sample": f"{len(d14)} daily means of 2014, σ unknown", "n": int(len(d14)), "xbar": r(d14.mean(), 2), "s": r(d14.std(), 2),
              "stat_name": "t", "stat": r(tt.statistic, 3), "df": int(len(d14) - 1), "crit": r(stats.t.ppf(0.975, len(d14) - 1), 3), "p": float(tt.pvalue), "alpha": ALPHA,
              "decision": "Reject H0" if tt.pvalue < ALPHA else "Fail to reject H0"})
# Two-sample Welch t-test weekend vs weekday
we = daily.loc[daily["is_weekend"] == 1, "pm25"]; wd = daily.loc[daily["is_weekend"] == 0, "pm25"]
tw = stats.ttest_ind(we, wd, equal_var=False); mw = stats.mannwhitneyu(we, wd)
d_cohen = (we.mean() - wd.mean()) / np.sqrt((we.var() + wd.var()) / 2)
tests.append({"id": "t_two_weekend", "name": "Two-sample t-test (Welch)", "h0": "μ_weekend = μ_weekday", "h1": "μ_weekend ≠ μ_weekday",
              "sample": f"daily means: {len(we)} weekend days vs {len(wd)} weekdays", "groups": [{"name": "Weekend", "n": int(len(we)), "mean": r(we.mean(), 2), "sd": r(we.std(), 2)},
                                                                                                   {"name": "Weekday", "n": int(len(wd)), "mean": r(wd.mean(), 2), "sd": r(wd.std(), 2)}],
              "stat_name": "t", "stat": r(tw.statistic, 3), "df": r(tw.df, 1), "p": float(tw.pvalue), "alpha": ALPHA, "cohen_d": r(d_cohen, 3),
              "nonparametric": {"name": "Mann-Whitney U", "stat": r(mw.statistic, 1), "p": float(mw.pvalue)},
              "decision": "Reject H0" if tw.pvalue < ALPHA else "Fail to reject H0"})
# Two-sample: winter vs summer
wi = daily.loc[daily["season"] == "Winter", "pm25"]; su = daily.loc[daily["season"] == "Summer", "pm25"]
tw2 = stats.ttest_ind(wi, su, equal_var=False); mw2 = stats.mannwhitneyu(wi, su)
tests.append({"id": "t_two_season", "name": "Two-sample t-test (Welch)", "h0": "μ_winter = μ_summer", "h1": "μ_winter ≠ μ_summer",
              "sample": f"daily means: {len(wi)} winter days vs {len(su)} summer days", "groups": [{"name": "Winter", "n": int(len(wi)), "mean": r(wi.mean(), 2), "sd": r(wi.std(), 2)},
                                                                                                  {"name": "Summer", "n": int(len(su)), "mean": r(su.mean(), 2), "sd": r(su.std(), 2)}],
              "stat_name": "t", "stat": r(tw2.statistic, 3), "df": r(tw2.df, 1), "p": float(tw2.pvalue), "alpha": ALPHA,
              "cohen_d": r((wi.mean() - su.mean()) / np.sqrt((wi.var() + su.var()) / 2), 3),
              "nonparametric": {"name": "Mann-Whitney U", "stat": r(mw2.statistic, 1), "p": float(mw2.pvalue)},
              "decision": "Reject H0" if tw2.pvalue < ALPHA else "Fail to reject H0"})
# Paired t-test: monthly means 2010 vs 2014 (12 pairs, same calendar month)
m10 = monthly[monthly["date"].dt.year == 2010]["pm25"].values; m14 = monthly[monthly["date"].dt.year == 2014]["pm25"].values
tp = stats.ttest_rel(m14, m10); wil = stats.wilcoxon(m14, m10)
tests.append({"id": "t_paired", "name": "Paired t-test", "h0": "μ_d = 0 (no change 2010 → 2014 within the same calendar month)", "h1": "μ_d ≠ 0",
              "sample": "12 calendar months, 2014 mean minus 2010 mean", "n": 12, "pairs": [{"month": i + 1, "y2010": r(a, 1), "y2014": r(b, 1), "diff": r(b - a, 1)} for i, (a, b) in enumerate(zip(m10, m14))],
              "mean_diff": r((m14 - m10).mean(), 2), "sd_diff": r((m14 - m10).std(ddof=1), 2), "stat_name": "t", "stat": r(tp.statistic, 3), "df": 11, "p": float(tp.pvalue), "alpha": ALPHA,
              "nonparametric": {"name": "Wilcoxon signed-rank", "stat": r(wil.statistic, 1), "p": float(wil.pvalue)},
              "decision": "Reject H0" if tp.pvalue < ALPHA else "Fail to reject H0"})

# ------------------------------------------------------------------ ANOVA
def anova_block(col, order, label):
    groups = [daily.loc[daily[col].astype(str) == str(g), "pm25"].values for g in order]
    f, p = stats.f_oneway(*groups)
    kw = stats.kruskal(*groups); lev = stats.levene(*groups)
    allv = np.concatenate(groups); gm = allv.mean()
    ssb = sum(len(g) * (g.mean() - gm) ** 2 for g in groups); ssw = sum(((g - g.mean()) ** 2).sum() for g in groups)
    k = len(groups); n = len(allv)
    tuk = pairwise_tukeyhsd(allv, np.concatenate([[str(o)] * len(g) for o, g in zip(order, groups)]), alpha=ALPHA)
    tuk_rows = [{"a": str(rw[0]), "b": str(rw[1]), "meandiff": r(rw[2], 2), "p": float(rw[3]), "low": r(rw[4], 2), "high": r(rw[5], 2), "reject": bool(rw[6])}
                for rw in tuk._results_table.data[1:]]
    return {"factor": label, "k": k, "n": n,
            "groups": [{"name": str(o), "n": int(len(g)), "mean": r(g.mean(), 2), "sd": r(g.std(ddof=1), 2), "se": r(g.std(ddof=1) / np.sqrt(len(g)), 2)} for o, g in zip(order, groups)],
            "table": {"ss_between": r(ssb, 1), "df_between": k - 1, "ms_between": r(ssb / (k - 1), 1), "ss_within": r(ssw, 1), "df_within": n - k, "ms_within": r(ssw / (n - k), 1), "ss_total": r(ssb + ssw, 1)},
            "F": r(f, 3), "F_crit": r(stats.f.ppf(0.95, k - 1, n - k), 3), "p": float(p), "eta2": r(ssb / (ssb + ssw), 4),
            "levene": {"stat": r(lev.statistic, 3), "p": float(lev.pvalue)}, "kruskal": {"stat": r(kw.statistic, 2), "p": float(kw.pvalue)},
            "tukey": tuk_rows, "decision": "Reject H0" if p < ALPHA else "Fail to reject H0"}

anova = {"season": anova_block("season", SEASON_ORDER, "Season"), "wind": anova_block("wind_mode", WIND_ORDER, "Dominant wind direction of the day"),
         "year": anova_block("year", [2010, 2011, 2012, 2013, 2014], "Year")}

# ------------------------------------------------------------------ Chi-square independence
def chi_block(a, b, a_order=None, b_order=None, label=""):
    ct = pd.crosstab(df[a], df[b])
    if a_order is not None: ct = ct.reindex(a_order)
    if b_order is not None: ct = ct[b_order]
    chi2, p, dof, exp = stats.chi2_contingency(ct)
    n = ct.values.sum(); k = min(ct.shape) - 1
    cramers_v = np.sqrt(chi2 / (n * k))
    return {"label": label, "rows": list(map(str, ct.index)), "cols": list(map(str, ct.columns)),
            "observed": ct.values.astype(int).tolist(), "expected": np.round(exp, 1).tolist(),
            "chi2": r(chi2, 2), "df": int(dof), "p": float(p), "crit": r(stats.chi2.ppf(0.95, dof), 3), "cramers_v": r(cramers_v, 4), "n": int(n),
            "decision": "Reject H0 (dependent)" if p < ALPHA else "Fail to reject H0"}

aqi_order = ["Good", "Moderate", "Unhealthy (sensitive)", "Unhealthy", "Very unhealthy", "Hazardous"]
chi = {"season_aqi": chi_block("season", "aqi_category", SEASON_ORDER, aqi_order, "Season × EPA category"),
       "wind_aqi": chi_block("cbwd", "aqi_category", WIND_ORDER, aqi_order, "Wind direction × EPA category")}

# ------------------------------------------------------------------ Errors & power
power = TTestIndPower()
effects = [0.1, 0.2, 0.3, 0.5, 0.8, 1.0]
power_curve = [{"d": d, **{f"n{n_}": r(power.power(effect_size=d, nobs1=n_, alpha=ALPHA, alternative="two-sided"), 4) for n_ in [20, 50, 100, 400]}} for d in effects]
n_needed = [{"d": d, "n_per_group": int(np.ceil(power.solve_power(effect_size=d, power=0.8, alpha=ALPHA)))} for d in [0.2, 0.5, 0.8]]
# Empirical Type I error: split population randomly 1000 times, two-sample t-test, count p < 0.05
false_pos = 0
for _ in range(1000):
    a = rng.choice(pop, 60); b = rng.choice(pop, 60)
    if stats.ttest_ind(a, b, equal_var=False).pvalue < ALPHA:
        false_pos += 1
# Empirical Type II error: winter vs summer with tiny samples n=5
miss = 0
wi_v, su_v = wi.values, su.values
for _ in range(1000):
    if stats.ttest_ind(rng.choice(wi_v, 5), rng.choice(su_v, 5), equal_var=False).pvalue >= ALPHA:
        miss += 1
errors = {"alpha": ALPHA, "empirical_type1": r(false_pos / 1000, 3), "empirical_type2_n5": r(miss / 1000, 3), "power_n5": r(1 - miss / 1000, 3),
          "power_curve": power_curve, "n_needed": n_needed,
          "matrix": [{"truth": "H0 true", "reject": "Type I error (false positive), probability α", "accept": "Correct (1 − α)"},
                     {"truth": "H0 false", "reject": "Correct (power, 1 − β)", "accept": "Type II error (false negative), probability β"}]}

save("inference", {"alpha": ALPHA, "standard": STANDARD, "population": {"mu": r(MU, 3), "sigma": r(SIGMA, 3), "n": int(len(pop))},
                   "normal": normal, "poisson": poisson, "binomial": binomial, "clt": clt,
                   "ci": {"mean": ci_rows, "proportion": proportion_ci, "season": season_ci, "coverage": coverage, "sample_size": sample_size},
                   "tests": tests, "anova": anova, "chi": chi, "errors": errors})
