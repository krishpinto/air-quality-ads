"""Module 6 - Regression.

Simple linear regression (one predictor), multiple regression with weather
and wind-direction dummies, log-target model, diagnostics (R², adjusted R²,
F-test, t-tests, VIF, Durbin-Watson, residual normality, heteroscedasticity)
and a chronological hold-out.
Output: web/public/data/regression.json
"""
import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats
from statsmodels.stats.diagnostic import het_breuschpagan
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.stattools import durbin_watson

from common import LABELS, hist, load_clean, r, save

print("06_regression")
df = load_clean().copy()
rng = np.random.default_rng(7)
y = df["pm25"].astype(float)


def metrics(y_true, y_pred):
    y_true = np.asarray(y_true, float); y_pred = np.asarray(y_pred, float)
    err = y_true - y_pred
    mask = y_true >= 10  # MAPE explodes when the true value is near zero
    return {"mae": r(np.abs(err).mean(), 3), "rmse": r(np.sqrt((err ** 2).mean()), 3),
            "mape": r(100 * np.abs(err[mask] / y_true[mask]).mean(), 2),
            "r2": r(1 - (err ** 2).sum() / ((y_true - y_true.mean()) ** 2).sum(), 4)}


# ------------------------------------------------------------- Simple regression
simple = {}
sample_idx = rng.choice(len(df), 500, replace=False)
for c in ["DEWP", "Iws", "TEMP", "PRES"]:
    x = df[c].astype(float)
    X = sm.add_constant(x)
    res = sm.OLS(y, X).fit()
    slope, intercept = res.params[c], res.params["const"]
    xs = np.linspace(x.min(), x.max(), 40)
    ci = res.get_prediction(sm.add_constant(pd.DataFrame({c: xs}), has_constant="add")).conf_int(alpha=0.05)
    simple[c] = {
        "label": LABELS[c], "n": int(len(x)),
        "slope": r(slope, 5), "intercept": r(intercept, 4), "slope_se": r(res.bse[c], 5), "slope_t": r(res.tvalues[c], 3), "slope_p": float(res.pvalues[c]),
        "slope_ci": [r(res.conf_int().loc[c, 0], 5), r(res.conf_int().loc[c, 1], 5)],
        "r": r(np.sign(slope) * np.sqrt(res.rsquared), 4), "r2": r(res.rsquared, 4), "adj_r2": r(res.rsquared_adj, 4),
        "F": r(res.fvalue, 2), "F_p": float(res.f_pvalue), "resid_se": r(np.sqrt(res.scale), 3),
        "sxx": r(((x - x.mean()) ** 2).sum(), 1), "sxy": r(((x - x.mean()) * (y - y.mean())).sum(), 1), "x_mean": r(x.mean(), 3), "y_mean": r(y.mean(), 3),
        **metrics(y, res.fittedvalues),
        "points": [{"x": r(x.iloc[i], 2), "y": r(y.iloc[i], 1)} for i in sample_idx],
        "line": [{"x": r(v, 2), "y": r(intercept + slope * v, 2), "lo": r(lo, 2), "hi": r(hi, 2)} for v, (lo, hi) in zip(xs, ci)],
        "equation": f"PM2.5 = {intercept:.2f} {'+' if slope >= 0 else '-'} {abs(slope):.3f} × {c}",
    }

# ------------------------------------------------------------- Multiple regression
wind = pd.get_dummies(df["cbwd"], prefix="wind", drop_first=False).astype(float).drop(columns=["wind_NW"])  # NW = reference
X_weather = df[["DEWP", "TEMP", "PRES", "Iws", "Ir", "Is"]].astype(float)
X_full = pd.concat([X_weather, wind], axis=1)
pretty = {"DEWP": "Dew point", "TEMP": "Temperature", "PRES": "Pressure", "Iws": "Wind speed", "Ir": "Rain hours", "Is": "Snow hours",
          "wind_NE": "Wind NE (vs NW)", "wind_SE": "Wind SE (vs NW)", "wind_cv": "Wind calm (vs NW)", "const": "Intercept"}


def fit_block(X, target, name, log_target=False, sample_resid=600):
    Xc = sm.add_constant(X)
    res = sm.OLS(target, Xc).fit()
    fitted = res.fittedvalues; resid = res.resid
    # In log-space models, report metrics back on the original scale
    if log_target:
        pred_orig = np.expm1(fitted); y_orig = np.expm1(target)
    else:
        pred_orig = fitted; y_orig = target
    ci = res.conf_int()
    sd_x = X.std(ddof=1); sd_y = target.std(ddof=1)
    coefs = []
    for k in res.params.index:
        coefs.append({"term": k, "label": pretty.get(k, k), "coef": r(res.params[k], 5), "se": r(res.bse[k], 5), "t": r(res.tvalues[k], 3),
                      "p": float(res.pvalues[k]), "ci_low": r(ci.loc[k, 0], 5), "ci_high": r(ci.loc[k, 1], 5),
                      "beta_std": None if k == "const" else r(res.params[k] * sd_x[k] / sd_y, 4),
                      "significant": bool(res.pvalues[k] < 0.05)})
    vif = [{"term": k, "label": pretty.get(k, k), "vif": r(variance_inflation_factor(Xc.values, i), 3)} for i, k in enumerate(Xc.columns) if k != "const"]
    jb, jb_p, sk, ku = sm.stats.jarque_bera(resid)
    bp_lm, bp_p, _, _ = het_breuschpagan(resid, Xc)
    idx = rng.choice(len(resid), sample_resid, replace=False)
    osm, osr = stats.probplot(resid.sample(400, random_state=1), dist="norm", fit=False)
    return {
        "name": name, "n": int(res.nobs), "k": int(res.df_model), "r2": r(res.rsquared, 4), "adj_r2": r(res.rsquared_adj, 4),
        "F": r(res.fvalue, 2), "F_p": float(res.f_pvalue), "df_model": int(res.df_model), "df_resid": int(res.df_resid),
        "aic": r(res.aic, 1), "bic": r(res.bic, 1), "resid_se": r(np.sqrt(res.scale), 3), "log_target": log_target,
        "ss_total": r(res.centered_tss, 1), "ss_model": r(res.ess, 1), "ss_resid": r(res.ssr, 1),
        "coefficients": coefs, "vif": vif,
        "durbin_watson": r(durbin_watson(resid), 4),
        "jarque_bera": {"stat": r(jb, 1), "p": float(jb_p), "skew": r(sk, 3), "kurtosis": r(ku, 3)},
        "breusch_pagan": {"stat": r(bp_lm, 1), "p": float(bp_p)},
        "metrics": metrics(y_orig, pred_orig),
        "resid_vs_fitted": [{"fitted": r(fitted.iloc[i], 2), "resid": r(resid.iloc[i], 2)} for i in idx],
        "resid_hist": hist(resid, bins=40),
        "qq": [{"theoretical": r(a, 3), "sample": r(b, 3)} for a, b in zip(osm, osr)],
        "actual_vs_pred": [{"actual": r(y_orig.iloc[i], 1), "pred": r(pred_orig.iloc[i], 1)} for i in idx],
        "_model": res,
    }


models = {
    "weather": fit_block(X_weather, y, "Model A: weather only"),
    "full": fit_block(X_full, y, "Model B: weather + wind direction"),
    "log": fit_block(X_full, df["log_pm25"].astype(float), "Model C: log(1+PM2.5) target", log_target=True),
}

# Partial-effect curve for the full model: vary one predictor, hold others at their mean / reference wind
full_res = models["full"]["_model"]
partial = {}
means = X_full.mean()
for c in ["DEWP", "TEMP", "PRES", "Iws"]:
    xs = np.linspace(X_full[c].quantile(0.01), X_full[c].quantile(0.99), 30)
    rows = pd.DataFrame([means] * len(xs)); rows[c] = xs
    rows[["wind_NE", "wind_SE", "wind_cv"]] = 0.0
    pred = full_res.predict(sm.add_constant(rows, has_constant="add"))
    partial[c] = [{"x": r(a, 2), "y": r(b, 2)} for a, b in zip(xs, pred)]

# ------------------------------------------------------------- Chronological hold-out
train = df["year"] <= 2013; test = df["year"] == 2014
holdout = []
for key, X, target, logt in [("weather", X_weather, y, False), ("full", X_full, y, False), ("log", X_full, df["log_pm25"].astype(float), True)]:
    res = sm.OLS(target[train], sm.add_constant(X[train])).fit()
    pred_tr = res.predict(sm.add_constant(X[train])); pred_te = res.predict(sm.add_constant(X[test], has_constant="add"))
    if logt:
        pred_tr, pred_te = np.expm1(pred_tr), np.expm1(pred_te)
    holdout.append({"model": models[key]["name"], "n_train": int(train.sum()), "n_test": int(test.sum()),
                    "train": metrics(y[train], pred_tr), "test": metrics(y[test], pred_te)})

# Nested model F-test: does adding wind dummies improve Model A significantly?
ra, rb = models["weather"]["_model"], models["full"]["_model"]
f_stat, f_p, df_diff = rb.compare_f_test(ra)
nested = {"F": r(f_stat, 2), "p": float(f_p), "df_diff": int(df_diff), "r2_a": r(ra.rsquared, 4), "r2_b": r(rb.rsquared, 4)}

for m in models.values():
    m.pop("_model")

save("regression", {"simple": simple, "models": models, "partial": partial, "holdout": holdout, "nested": nested,
                    "reference_wind": "NW", "n": int(len(df))})
