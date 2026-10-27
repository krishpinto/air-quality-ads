"""Unit 4 - Regression analysis (syllabus 4.1-4.6 + self-learning residual analysis).

Computes, from the daily bike-rental table, everything the Unit 4 page shows:
    4.1 simple regression Y = a + bX (Y = cnt, X = temp_c): 10-row worked table, normal equations,
        the Σ-form b and a on the full training set, the fitted line, a prediction, bxy·byx = r².
    4.2 error term e = Y − Ŷ and the five measures of fit (MAE, MSE, RMSE, R², MAPE), in-sample and on test.
    4.3 multiple regression Ŷ = b₀ + b₁X₁ + b₂X₂ (X₁ = temp_c, X₂ = hum_pct) by the deviation-score
        formulas, R² by the explained/total form and by 1 − SSE/SST, adjusted R².
    4.4 partial coefficients vs simple slopes, r₁₂ between the predictors.
    4.5 overall F-test (ANOVA table) and a comparison of three model designs.
    4.6 t-tests for b₁ and b₂ with the teacher's SE formula; library t-values for the 4-predictor design.
    Self-learning: residual plots and the five assumptions.
    Class check: the 8-row (Y, X₁, X₂) slide example through the same functions.

Inputs : data/processed/daily.parquet (load_daily), the Unit-1 hold-out (train_test).
Output : web/public/data/unit4.json via save("unit4", ...).

Everything is computed with numpy from the sums (ΣX, ΣY, ΣXY, ...), exactly as taught. statsmodels is
used only (a) to cross-check the hand-computed two-predictor model and (b) for the 4-predictor
alternative design in 4.5/4.6, which the class formulas (two predictors) do not cover.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats

from common import load_daily, train_test, pearson_r_actual_mean, degree_of_correlation, save, r, hist

ALPHA = 0.05
SEED = 4
PRED_TEMP = 25.0            # "When X = 25 °C ..." prediction in 4.1
PRED_HUM = 60.0             # the humidity used for the 4.3 prediction


# ----------------------------------------------------------------------------- 4.1 simple regression
def simple_sums(X, Y) -> dict:
    """4.1 - Y = a + bX from the raw sums: b = [nΣXY − ΣXΣY]/[nΣX² − (ΣX)²], a = (ΣY − bΣX)/n."""
    X = np.asarray(X, dtype=float); Y = np.asarray(Y, dtype=float)
    n = len(X)
    sx, sy, sx2, sxy = X.sum(), Y.sum(), (X ** 2).sum(), (X * Y).sum()
    num = n * sxy - sx * sy
    den = n * sx2 - sx ** 2
    b = num / den
    a = (sy - b * sx) / n
    return {"n": int(n), "sum_x": r(sx, 3), "sum_y": r(sy, 3), "sum_x2": r(sx2, 3), "sum_xy": r(sxy, 3),
            "x_mean": r(sx / n, 4), "y_mean": r(sy / n, 4),
            "b_numerator": r(num, 3), "b_denominator": r(den, 3), "b": r(b, 4), "a": r(a, 4),
            "_b": float(b), "_a": float(a)}


def normal_equations(s: dict) -> dict:
    """4.1 - solve ΣY = na + bΣX and ΣXY = aΣX + bΣX² by elimination, the way the class did."""
    n, sx, sy, sx2, sxy = s["n"], s["sum_x"], s["sum_y"], s["sum_x2"], s["sum_xy"]
    m = sx / n                                   # multiply equation (i) by ΣX/n so the a-terms match
    eq3_lhs, eq3_b = sy * m, sx * m              # (iii): ΣY·m = aΣX + b·ΣX·m
    b = (sxy - eq3_lhs) / (sx2 - eq3_b)          # (ii) − (iii)
    a = (sy - b * sx) / n
    return {"eq1": {"lhs": r(sy, 3), "n": n, "sum_x": r(sx, 3)},
            "eq2": {"lhs": r(sxy, 3), "sum_x": r(sx, 3), "sum_x2": r(sx2, 3)},
            "multiplier": r(m, 4), "eq3": {"lhs": r(eq3_lhs, 3), "sum_x": r(sx, 3), "b_coef": r(eq3_b, 3)},
            "diff_lhs": r(sxy - eq3_lhs, 3), "diff_b_coef": r(sx2 - eq3_b, 3), "b": r(b, 4), "a": r(a, 4)}


# ----------------------------------------------------------------------------- 4.2 measures of fit
def fit_measures(Y, Yhat) -> dict:
    """4.2 - MAE, MSE, RMSE, R² = 1 − Σ(Y−Ŷ)²/Σ(Y−Ȳ)², MAPE = (100/n)Σ|(Y−Ŷ)/Y|."""
    Y = np.asarray(Y, dtype=float); Yhat = np.asarray(Yhat, dtype=float)
    e = Y - Yhat
    n = len(Y)
    sse = float((e ** 2).sum()); sst = float(((Y - Y.mean()) ** 2).sum())
    return {"n": int(n), "mae": r(np.abs(e).mean(), 2), "mse": r((e ** 2).mean(), 2),
            "rmse": r(math.sqrt((e ** 2).mean()), 2), "r2": r(1 - sse / sst, 4),
            "mape": r(100 * np.mean(np.abs(e / Y)), 2), "sse": r(sse, 2), "sst": r(sst, 2),
            "sum_abs_e": r(np.abs(e).sum(), 2), "sum_ape": r(np.abs(e / Y).sum(), 4)}


# ----------------------------------------------------------------------------- 4.3 two-predictor MLR
def mlr_two(Y, X1, X2) -> dict:
    """4.3 - Ŷ = b₀ + b₁X₁ + b₂X₂ by the deviation-score formulas (board / Module p.17)."""
    Y = np.asarray(Y, dtype=float); X1 = np.asarray(X1, dtype=float); X2 = np.asarray(X2, dtype=float)
    n = len(Y)
    S = {"sum_y": Y.sum(), "sum_x1": X1.sum(), "sum_x2": X2.sum(), "sum_y2": (Y ** 2).sum(),
         "sum_x1sq": (X1 ** 2).sum(), "sum_x2sq": (X2 ** 2).sum(), "sum_x1x2": (X1 * X2).sum(),
         "sum_x1y": (X1 * Y).sum(), "sum_x2y": (X2 * Y).sum()}
    D = {"x1x1": S["sum_x1sq"] - S["sum_x1"] ** 2 / n,
         "x2x2": S["sum_x2sq"] - S["sum_x2"] ** 2 / n,
         "x1y": S["sum_x1y"] - S["sum_x1"] * S["sum_y"] / n,
         "x2y": S["sum_x2y"] - S["sum_x2"] * S["sum_y"] / n,
         "x1x2": S["sum_x1x2"] - S["sum_x1"] * S["sum_x2"] / n,
         "yy": S["sum_y2"] - S["sum_y"] ** 2 / n}
    den = D["x1x1"] * D["x2x2"] - D["x1x2"] ** 2
    num1 = D["x2x2"] * D["x1y"] - D["x1x2"] * D["x2y"]
    num2 = D["x1x1"] * D["x2y"] - D["x1x2"] * D["x1y"]
    b1, b2 = num1 / den, num2 / den
    y_mean, x1_mean, x2_mean = Y.mean(), X1.mean(), X2.mean()
    b0 = y_mean - b1 * x1_mean - b2 * x2_mean
    yhat = b0 + b1 * X1 + b2 * X2
    explained = b1 * D["x1y"] + b2 * D["x2y"]          # "R²Σy²" on the slide
    sse = float(((Y - yhat) ** 2).sum())
    r2 = explained / D["yy"]
    r12 = D["x1x2"] / math.sqrt(D["x1x1"] * D["x2x2"])
    k = 2
    return {"n": int(n), "k": k,
            "sums": {kk: r(v, 3) for kk, v in S.items()},
            "dev": {kk: r(v, 3) for kk, v in D.items()},
            "means": {"y": r(y_mean, 4), "x1": r(x1_mean, 4), "x2": r(x2_mean, 4)},
            "b1_numerator": r(num1, 3), "b2_numerator": r(num2, 3), "denominator": r(den, 3),
            "b1": r(b1, 4), "b2": r(b2, 4), "b0": r(b0, 4),
            "explained_ss": r(explained, 3), "total_ss": r(D["yy"], 3), "sse": r(sse, 3),
            "r2": r(r2, 4), "r2_alt": r(1 - sse / D["yy"], 4),
            "adj_r2": r(1 - (1 - r2) * (n - 1) / (n - k - 1), 4),
            "r12": r(r12, 4),
            "_b": (float(b0), float(b1), float(b2)), "_yhat": yhat, "_sse": sse, "_sst": float(D["yy"]), "_r2": float(r2), "_r12": float(r12),
            "_dev": D}


def f_test(r2: float, n: int, k: int) -> dict:
    """4.5 - ANOVA table: SSR = R²Σy², SSE = (1 − R²)Σy², F = MSR/MSE vs tabulated F(k, n−k−1)."""
    df_r, df_e, df_t = k, n - k - 1, n - 1
    f_calc = (df_e * r2) / (k * (1 - r2))
    f_tab = float(stats.f.ppf(1 - ALPHA, df_r, df_e))
    p = float(1 - stats.f.cdf(f_calc, df_r, df_e))
    return {"df_regression": df_r, "df_error": df_e, "df_total": df_t, "f_calc": r(f_calc, 3), "f_tab": r(f_tab, 3),
            "decision": "reject" if f_calc >= f_tab else "accept", "p": r(p, 6), "_f": f_calc}


def anova_rows(m: dict, ft: dict) -> list[dict]:
    """4.5 - the Source | d.f. | SS | MS | F table with the numbers filled in."""
    sst, r2 = m["_sst"], m["_r2"]
    ssr, sse = r2 * sst, (1 - r2) * sst
    msr, mse = ssr / ft["df_regression"], sse / ft["df_error"]
    return [{"source": "Regression", "df": ft["df_regression"], "ss": r(ssr, 3), "ms": r(msr, 3), "f": ft["f_calc"]},
            {"source": "Error", "df": ft["df_error"], "ss": r(sse, 3), "ms": r(mse, 3), "f": None},
            {"source": "Total", "df": ft["df_total"], "ss": r(sst, 3), "ms": None, "f": None}]


def t_tests(m: dict) -> dict:
    """4.6 - SE(bᵢ) = √[Σ(Y−Ŷ)²/(n−k−1)] / √[Σxᵢ²(1 − r₁₂²)], t = bᵢ/SE(bᵢ), df = n−k−1, vs tabulated t."""
    n, k = m["n"], m["k"]
    df = n - k - 1
    mse = m["_sse"] / df
    root_mse = math.sqrt(mse)
    r12 = m["_r12"]
    D = m["_dev"]
    t_tab = float(stats.t.ppf(1 - ALPHA / 2, df))
    out = {"df": df, "sse": r(m["_sse"], 3), "mse": r(mse, 4), "root_mse": r(root_mse, 4),
           "r12": r(r12, 4), "r12_sq": r(r12 ** 2, 4), "one_minus_r12_sq": r(1 - r12 ** 2, 4), "t_tab": r(t_tab, 3)}
    for i, (b, sxx) in enumerate([(m["_b"][1], D["x1x1"]), (m["_b"][2], D["x2x2"])], start=1):
        se = root_mse / math.sqrt(sxx * (1 - r12 ** 2))
        t = b / se
        p = float(2 * (1 - stats.t.cdf(abs(t), df)))
        out[f"b{i}"] = {"b": r(b, 4), "sum_x2": r(sxx, 3), "denominator": r(math.sqrt(sxx * (1 - r12 ** 2)), 4),
                        "se": r(se, 4), "t": r(t, 3), "p": r(p, 6),
                        "decision": "reject" if abs(t) > t_tab else "accept"}
    return out


def ols_design(train: pd.DataFrame, test: pd.DataFrame, cols: list[str], label: str) -> dict:
    """4.5 (LO 4.5) - one candidate design fitted by statsmodels OLS (library cross-check / k > 2 designs)."""
    Xtr = sm.add_constant(train[cols].to_numpy(dtype=float)); Xte = sm.add_constant(test[cols].to_numpy(dtype=float), has_constant="add")
    res = sm.OLS(train["cnt"].to_numpy(dtype=float), Xtr).fit()
    n, k = len(train), len(cols)
    tr = fit_measures(train["cnt"], res.fittedvalues)
    te = fit_measures(test["cnt"], Xte @ res.params)
    f_tab = float(stats.f.ppf(1 - ALPHA, k, n - k - 1))
    t_tab = float(stats.t.ppf(1 - ALPHA / 2, n - k - 1))
    names = ["b₀ (intercept)"] + cols
    return {"label": label, "predictors": cols, "k": k, "n": n,
            "coef": [{"name": nm, "b": r(c, 4), "se": r(s, 4), "t": r(t, 3), "p": r(p, 6), "decision": "reject" if abs(t) > t_tab else "accept"}
                     for nm, c, s, t, p in zip(names, res.params, res.bse, res.tvalues, res.pvalues)],
            "r2": r(res.rsquared, 4), "adj_r2": r(res.rsquared_adj, 4),
            "f_calc": r(res.fvalue, 3), "f_tab": r(f_tab, 3), "df_error": n - k - 1, "t_tab": r(t_tab, 3),
            "train": tr, "test": te}


# ----------------------------------------------------------------------------- self-learning residuals
def residual_analysis(dates, fitted, resid, X1, X2, r12) -> dict:
    """Self-learning - residual plots and one plain observation per assumption (no formal tests)."""
    fitted = np.asarray(fitted, dtype=float); resid = np.asarray(resid, dtype=float)
    sd = float(np.sqrt(np.mean(resid ** 2)))     # σ of residuals, ÷N as in Unit 2 (mean residual is 0)
    # constant variance: spread of the residuals in the low / middle / high third of the fitted values
    order = np.argsort(fitted); thirds = np.array_split(order, 3)
    spread = [{"band": lbl, "fitted_from": r(fitted[ix].min(), 0), "fitted_to": r(fitted[ix].max(), 0),
               "mean_e": r(resid[ix].mean(), 1), "sd_e": r(float(np.sqrt(np.mean((resid[ix] - resid[ix].mean()) ** 2))), 1), "n": int(len(ix))}
              for lbl, ix in zip(["Low third", "Middle third", "High third"], thirds)]
    # independence: correlation between today's residual and yesterday's (days are in time order)
    lag1 = pearson_r_actual_mean(resid[:-1], resid[1:])["r"]
    # normality: the 68 / 95 rule from Unit 2 applied to the residuals
    within1 = float(np.mean(np.abs(resid) <= sd)) * 100; within2 = float(np.mean(np.abs(resid) <= 2 * sd)) * 100
    bins = hist(resid, bins=25)
    for b in bins:
        b["normal"] = r(stats.norm.pdf(b["mid"], 0, sd), 6)
    return {"sd": r(sd, 1), "spread": spread, "lag1_r": lag1,
            "within_1sd_pct": r(within1, 1), "within_2sd_pct": r(within2, 1),
            "min_e": r(resid.min(), 0), "max_e": r(resid.max(), 0), "r12": r(r12, 4),
            "resid_vs_fitted": [{"x": r(f, 0), "y": r(e, 0), "date": d} for f, e, d in zip(fitted, resid, dates)],
            "pred_vs_actual": [{"x": r(f, 0), "y": r(f + e, 0), "date": d} for f, e, d in zip(fitted, resid, dates)],
            "hist": bins}


# ----------------------------------------------------------------------------- class check
def class_check() -> dict:
    """Class example (Module pp. 25-40): the 8-row (Y, X₁, X₂) data through the same functions."""
    Y = [140, 155, 159, 179, 192, 200, 212, 215]
    X1 = [60, 62, 67, 70, 71, 72, 75, 78]
    X2 = [22, 25, 24, 20, 15, 14, 14, 11]
    m = mlr_two(Y, X1, X2)
    ft = f_test(m["_r2"], m["n"], m["k"])
    tt = t_tests(m)
    b0, b1, b2 = m["_b"]
    pred = b0 + b1 * 74 + b2 * 14
    return {
        "rows": [{"y": y, "x1": a, "x2": b} for y, a, b in zip(Y, X1, X2)],
        "ours": {"b1": m["b1"], "b2": m["b2"], "b0": m["b0"], "pred_74_14": r(pred, 3), "r2": m["r2"],
                 "f": ft["f_calc"], "f_tab": ft["f_tab"], "se_b1": tt["b1"]["se"], "t1": tt["b1"]["t"],
                 "se_b2": tt["b2"]["se"], "t2": tt["b2"]["t"], "t_tab": tt["t_tab"], "r12": m["r12"],
                 "dev": m["dev"], "sums": m["sums"]},
        # slide values as printed on Module pp. 29-40; se_b2 / t2 are the corrected values (the slide pasted b₁'s
        # 0.838 / 3.756 under the b₂ heading, but its own conclusion uses t = −1.72). The slide rounds r₁₂ to −0.88,
        # which is why its SE(b₂) = 0.962 differs slightly from ours (exact r₁₂ = −0.8836 → 0.976).
        "slide": {"b1": 3.1479, "b2": -1.6561, "b0": -6.8675, "pred_74_14": 202.893, "r2": 0.9626,
                  "f": 64.35, "f_tab": 5.79, "se_b1": 0.838, "t1": 3.756, "se_b2": 0.962, "t2": -1.72, "t_tab": 2.571, "r12": -0.88,
                  "se_b2_printed": 0.838, "t2_printed": 3.756},
    }


# ----------------------------------------------------------------------------- main
def main() -> None:
    daily = load_daily()
    train, test = train_test(daily)
    train = train.sort_values("date").reset_index(drop=True); test = test.sort_values("date").reset_index(drop=True)
    dates_tr = train["date"].dt.strftime("%Y-%m-%d").tolist()
    Y, X1, X2 = train["cnt"].to_numpy(float), train["temp_c"].to_numpy(float), train["hum_pct"].to_numpy(float)
    Yte, X1te, X2te = test["cnt"].to_numpy(float), test["temp_c"].to_numpy(float), test["hum_pct"].to_numpy(float)
    n = len(train)

    # ---------------- 4.1 simple regression, 10-row worked sample then the full training set
    rng = np.random.default_rng(SEED)
    idx = np.sort(rng.choice(n, size=10, replace=False))
    sample = train.iloc[idx]
    s_small = simple_sums(sample["temp_c"], sample["cnt"])
    ne_small = normal_equations(s_small)
    sample_rows = [{"date": d, "x": r(x, 2), "y": int(y), "x2": r(x * x, 3), "xy": r(x * y, 2)}
                   for d, x, y in zip(sample["date"].dt.strftime("%Y-%m-%d"), sample["temp_c"], sample["cnt"])]
    s_full = simple_sums(X1, Y)
    a, b = s_full["_a"], s_full["_b"]
    yhat_tr = a + b * X1; yhat_te = a + b * X1te
    pr = pearson_r_actual_mean(X1, Y)                      # Unit-2 method on the training days
    bxy = simple_sums(Y, X1)["_b"]                          # regression of X on Y
    xs = np.linspace(X1.min(), X1.max(), 25)
    s41 = {
        "x_label": "Temperature (°C)", "y_label": "Rentals per day",
        "sample": {"rows": sample_rows, "sums": {k: v for k, v in s_small.items() if not k.startswith("_")}, "normal_equations": ne_small},
        "full": {k: v for k, v in s_full.items() if not k.startswith("_")},
        "scatter": [{"x": r(x, 2), "y": int(y), "date": d} for x, y, d in zip(X1, Y, dates_tr)],
        "line": [{"x": r(x, 2), "y": r(a + b * x, 1)} for x in xs],
        "predict": {"x": PRED_TEMP, "yhat": r(a + b * PRED_TEMP, 1)},
        "two_lines": {"byx": r(b, 4), "bxy": r(bxy, 6), "product": r(b * bxy, 4), "r_unit2": pr["r"], "r_unit2_sq": r(pr["r"] ** 2, 4),
                      "degree": degree_of_correlation(pr["r"])},
        "x_min": r(X1.min(), 2), "x_max": r(X1.max(), 2),
    }

    # ---------------- 4.2 error term and measures of fit (simple model)
    e_small = Y[idx] - yhat_tr[idx]
    resid_rows = [{"date": d, "x": r(x, 2), "y": int(y), "yhat": r(yh, 1), "e": r(e, 1), "abs_e": r(abs(e), 1), "e2": r(e * e, 1), "ape": r(abs(e) / y, 4)}
                  for d, x, y, yh, e in zip(sample["date"].dt.strftime("%Y-%m-%d"), X1[idx], Y[idx], yhat_tr[idx], e_small)]
    s42 = {"sample_residuals": resid_rows, "sample_measures": fit_measures(Y[idx], yhat_tr[idx]),
           "train": fit_measures(Y, yhat_tr), "test": fit_measures(Yte, yhat_te),
           "test_min_y": {"date": test.loc[test["cnt"].idxmin(), "date"].strftime("%Y-%m-%d"), "y": int(Yte.min())}}

    # ---------------- 4.3 two-predictor model by hand
    m = mlr_two(Y, X1, X2)
    b0, b1, b2 = m["_b"]
    yhat2_te = b0 + b1 * X1te + b2 * X2te
    sm_check = sm.OLS(Y, sm.add_constant(np.column_stack([X1, X2]))).fit()
    s43 = {k: v for k, v in m.items() if not k.startswith("_")}
    s43.update({
        "x1_label": "Temperature (°C)", "x2_label": "Humidity (%)",
        "predict": {"x1": PRED_TEMP, "x2": PRED_HUM, "yhat": r(b0 + b1 * PRED_TEMP + b2 * PRED_HUM, 1)},
        "train": fit_measures(Y, m["_yhat"]), "test": fit_measures(Yte, yhat2_te),
        "crosscheck": {"b0": r(sm_check.params[0], 4), "b1": r(sm_check.params[1], 4), "b2": r(sm_check.params[2], 4), "r2": r(sm_check.rsquared, 4)},
    })

    # ---------------- 4.4 partial vs simple coefficients
    s_hum = simple_sums(X2, Y)
    s44 = {
        "simple_temp": {"a": s_full["a"], "b": s_full["b"]},
        "simple_hum": {"a": s_hum["a"], "b": s_hum["b"]},
        "partial": {"b1": m["b1"], "b2": m["b2"]},
        "r12": m["r12"], "r12_numerator": m["dev"]["x1x2"], "r12_x1x1": m["dev"]["x1x1"], "r12_x2x2": m["dev"]["x2x2"],
        "r_hum_cnt": pearson_r_actual_mean(X2, Y)["r"],
    }

    # ---------------- 4.5 F-test and alternative designs
    ft = f_test(m["_r2"], n, 2)
    designs = [ols_design(train, test, ["temp_c"], "Design A: temp only"),
               ols_design(train, test, ["temp_c", "hum_pct"], "Design B: temp + hum"),
               ols_design(train, test, ["temp_c", "hum_pct", "wind_kmh", "yr"], "Design C: temp + hum + wind + yr")]
    best = max(designs, key=lambda d: d["adj_r2"])
    yr_coef = next(c for c in designs[2]["coef"] if c["name"] == "yr")
    year_means = train.groupby("yr")["cnt"].mean()
    s45 = {"f": {k: v for k, v in ft.items() if not k.startswith("_")}, "anova": anova_rows(m, ft),
           "designs": designs, "best_label": best["label"], "yr_coef": yr_coef["b"],
           "train_mean_2011": r(year_means.get(0), 0), "train_mean_2012": r(year_means.get(1), 0)}

    # ---------------- 4.6 t-tests
    tt = t_tests(m)
    s46 = {"two_predictor": tt, "four_predictor": designs[2]}

    # ---------------- self-learning residuals (two-predictor model)
    resid = Y - m["_yhat"]
    s_res = residual_analysis(dates_tr, m["_yhat"], resid, X1, X2, m["_r12"])

    headline = {"simple": {"a": s_full["a"], "b": s_full["b"], "r2": s42["train"]["r2"], "test_mae": s42["test"]["mae"], "test_mape": s42["test"]["mape"]},
                "two_predictor": {"b0": m["b0"], "b1": m["b1"], "b2": m["b2"], "r2": m["r2"], "adj_r2": m["adj_r2"], "f": ft["f_calc"], "f_tab": ft["f_tab"],
                                  "t1": tt["b1"]["t"], "t2": tt["b2"]["t"], "t_tab": tt["t_tab"], "test_mae": s43["test"]["mae"], "test_mape": s43["test"]["mape"]},
                "best_design": {"label": best["label"], "r2": best["r2"], "adj_r2": best["adj_r2"], "test_mae": best["test"]["mae"], "test_mape": best["test"]["mape"]}}

    out = {
        "meta": {"n_train": n, "n_test": len(test), "train_start": dates_tr[0], "train_end": dates_tr[-1],
                 "test_start": test["date"].min().strftime("%Y-%m-%d"), "test_end": test["date"].max().strftime("%Y-%m-%d"),
                 "alpha": ALPHA, "seed": SEED},
        "s41": s41, "s42": s42, "s43": s43, "s44": s44, "s45": s45, "s46": s46,
        "residuals": s_res, "class_check": class_check(), "headline": headline,
    }
    save("unit4", out)
    print("headline:", headline)
    print("class check ours:", {k: v for k, v in out["class_check"]["ours"].items() if k not in ("dev", "sums")})


if __name__ == "__main__":
    main()
