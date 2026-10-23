"""Module 9 - Time-series analysis.

Components, moving averages, exponential smoothing, linear trend, seasonal
decomposition, stationarity (ADF / KPSS), ACF / PACF and ARIMA fitting.
Output: web/public/data/timeseries.json
"""
import warnings

import numpy as np
import pandas as pd
from scipy import stats
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing, SimpleExpSmoothing
from statsmodels.tsa.seasonal import STL, seasonal_decompose
from statsmodels.tsa.stattools import acf, adfuller, kpss, pacf
from statsmodels.stats.diagnostic import acorr_ljungbox

from common import load_daily, load_monthly, r, save

warnings.filterwarnings("ignore")
print("09_timeseries")
daily = load_daily().set_index("date")
monthly = load_monthly().set_index("date")
d = daily["pm25"].astype(float)
m = monthly["pm25"].astype(float)
m.index.freq = "MS"
ds = lambda idx: [t.strftime("%Y-%m-%d") for t in idx]

# ------------------------------------------------------------- Overview series
overview = {
    "daily": [{"date": t, "pm25": r(v, 1)} for t, v in zip(ds(d.index), d)],
    "monthly": [{"date": t, "pm25": r(v, 1), "hazardous_hours": int(h), "severe_days": int(s)} for t, v, h, s in zip(ds(m.index), m, monthly["hazardous_hours"], monthly["severe_days"])],
    "yearly": [{"year": int(y), "mean": r(g.mean(), 1), "median": r(g.median(), 1), "p95": r(g.quantile(0.95), 1), "max": r(g.max(), 1)} for y, g in d.groupby(d.index.year)],
    "n_daily": int(len(d)), "n_monthly": int(len(m)),
}

# ------------------------------------------------------------- Moving averages (daily)
ma = pd.DataFrame({"pm25": d, "ma7": d.rolling(7).mean(), "ma30": d.rolling(30).mean(), "ma90": d.rolling(90).mean(), "cma7": d.rolling(7, center=True).mean()})
moving_average = {"series": [{"date": t, **{k: r(v, 1) for k, v in row.items()}} for t, row in zip(ds(ma.index), ma.to_dict("records"))],
                  "smoothness": [{"window": w, "std": r(ma[c].std(), 2), "pct_variance_removed": r(100 * (1 - ma[c].var() / d.var()), 1)} for w, c in [(1, "pm25"), (7, "ma7"), (30, "ma30"), (90, "ma90")]]}

# ------------------------------------------------------------- Exponential smoothing (monthly)
ses_fixed = SimpleExpSmoothing(m, initialization_method="estimated").fit(smoothing_level=0.3, optimized=False)
ses_opt = SimpleExpSmoothing(m, initialization_method="estimated").fit()
holt = ExponentialSmoothing(m, trend="add", initialization_method="estimated").fit()
hw = ExponentialSmoothing(m, trend="add", seasonal="add", seasonal_periods=12, initialization_method="estimated").fit()
exp_smoothing = {
    "series": [{"date": t, "actual": r(a, 1), "ses_03": r(b, 1), "ses_opt": r(c, 1), "holt": r(e, 1), "hw": r(f, 1)}
               for t, a, b, c, e, f in zip(ds(m.index), m, ses_fixed.fittedvalues, ses_opt.fittedvalues, holt.fittedvalues, hw.fittedvalues)],
    "params": [
        {"model": "SES (α = 0.3)", "alpha": 0.3, "beta": None, "gamma": None, "sse": r(ses_fixed.sse, 1), "aic": r(ses_fixed.aic, 1)},
        {"model": "SES (α optimised)", "alpha": r(ses_opt.params["smoothing_level"], 4), "beta": None, "gamma": None, "sse": r(ses_opt.sse, 1), "aic": r(ses_opt.aic, 1)},
        {"model": "Holt (trend)", "alpha": r(holt.params["smoothing_level"], 4), "beta": r(holt.params["smoothing_trend"], 4), "gamma": None, "sse": r(holt.sse, 1), "aic": r(holt.aic, 1)},
        {"model": "Holt-Winters (additive, m=12)", "alpha": r(hw.params["smoothing_level"], 4), "beta": r(hw.params["smoothing_trend"], 4), "gamma": r(hw.params["smoothing_seasonal"], 4), "sse": r(hw.sse, 1), "aic": r(hw.aic, 1)},
    ],
}
# Alpha sweep on SES to show the smoothing trade-off
alpha_sweep = []
for a in [0.1, 0.2, 0.3, 0.5, 0.7, 0.9]:
    f = SimpleExpSmoothing(m, initialization_method="estimated").fit(smoothing_level=a, optimized=False)
    alpha_sweep.append({"alpha": a, "sse": r(f.sse, 1), "rmse": r(np.sqrt(f.sse / len(m)), 2)})
exp_smoothing["alpha_sweep"] = alpha_sweep

# ------------------------------------------------------------- Linear trend (monthly)
t_idx = np.arange(len(m))
slope, intercept, rv, pv, se = stats.linregress(t_idx, m.values)
ts_res = stats.theilslopes(m.values, t_idx)
trend = {"slope_per_month": r(slope, 4), "slope_per_year": r(slope * 12, 3), "intercept": r(intercept, 3), "r2": r(rv ** 2, 4), "p": float(pv), "se": r(se, 4),
         "t": r(slope / se, 3), "theil_sen_slope_per_year": r(ts_res[0] * 12, 3), "theil_sen_ci_per_year": [r(ts_res[2] * 12, 3), r(ts_res[3] * 12, 3)],
         "line": [{"date": t, "trend": r(intercept + slope * i, 1)} for i, t in enumerate(ds(m.index))],
         "yearly_means": overview["yearly"]}
# Mann-Kendall (simple implementation)
S = sum(np.sign(m.values[j] - m.values[i]) for i in range(len(m)) for j in range(i + 1, len(m)))
var_s = len(m) * (len(m) - 1) * (2 * len(m) + 5) / 18
z_mk = (S - np.sign(S)) / np.sqrt(var_s)
trend["mann_kendall"] = {"S": int(S), "z": r(z_mk, 3), "p": float(2 * (1 - stats.norm.cdf(abs(z_mk))))}

# ------------------------------------------------------------- Decomposition
dec_add = seasonal_decompose(m, model="additive", period=12)
dec_mul = seasonal_decompose(m, model="multiplicative", period=12)
stl = STL(m, period=12, robust=True).fit()
seasonal_idx = (m.groupby(m.index.month).mean() / m.mean())
month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
decomposition = {
    "additive": [{"date": t, "observed": r(o, 1), "trend": r(tr, 1), "seasonal": r(s, 1), "residual": r(e, 1)} for t, o, tr, s, e in zip(ds(m.index), dec_add.observed, dec_add.trend, dec_add.seasonal, dec_add.resid)],
    "multiplicative": [{"date": t, "observed": r(o, 1), "trend": r(tr, 1), "seasonal": r(s, 3), "residual": r(e, 3)} for t, o, tr, s, e in zip(ds(m.index), dec_mul.observed, dec_mul.trend, dec_mul.seasonal, dec_mul.resid)],
    "stl": [{"date": t, "trend": r(tr, 1), "seasonal": r(s, 1), "residual": r(e, 1)} for t, tr, s, e in zip(ds(m.index), stl.trend, stl.seasonal, stl.resid)],
    "seasonal_index": [{"month": month_names[i - 1], "index": r(v, 3), "mean": r(m.groupby(m.index.month).mean()[i], 1)} for i, v in seasonal_idx.items()],
    "strength": {"trend": r(max(0, 1 - stl.resid.var() / (stl.trend + stl.resid).var()), 3), "seasonal": r(max(0, 1 - stl.resid.var() / (stl.seasonal + stl.resid).var()), 3)},
    "variance_share": {"seasonal": r(100 * dec_add.seasonal.var() / m.var(), 1), "trend": r(100 * dec_add.trend.dropna().var() / m.var(), 1), "residual": r(100 * dec_add.resid.dropna().var() / m.var(), 1)},
}
# Daily hour-of-day & day-of-week seasonality handled on visualization page; here weekly seasonal index for daily
dow_idx = d.groupby(d.index.dayofweek).mean() / d.mean()
decomposition["weekly_index"] = [{"day": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], "index": r(v, 3)} for i, v in dow_idx.items()]

# ------------------------------------------------------------- Stationarity
def adf_block(series, name):
    res = adfuller(series.dropna(), autolag="AIC")
    return {"series": name, "adf": r(res[0], 3), "p": float(res[1]), "lags": int(res[2]), "nobs": int(res[3]), "crit_1": r(res[4]["1%"], 3), "crit_5": r(res[4]["5%"], 3), "crit_10": r(res[4]["10%"], 3),
            "stationary": bool(res[1] < 0.05)}
def kpss_block(series, name):
    stat, p, lags, crit = kpss(series.dropna(), regression="c", nlags="auto")
    return {"series": name, "kpss": r(stat, 3), "p": float(p), "lags": int(lags), "crit_5": r(crit["5%"], 3), "stationary": bool(p > 0.05)}

m_diff = m.diff(); m_sdiff = m.diff(12); d_diff = d.diff()
stationarity = {
    "adf": [adf_block(m, "Monthly PM2.5"), adf_block(m_diff, "Monthly, 1st difference"), adf_block(m_sdiff, "Monthly, seasonal difference (lag 12)"),
            adf_block(np.log(m), "Monthly log PM2.5"), adf_block(d, "Daily PM2.5"), adf_block(d_diff, "Daily, 1st difference")],
    "kpss": [kpss_block(m, "Monthly PM2.5"), kpss_block(m_diff, "Monthly, 1st difference"), kpss_block(d, "Daily PM2.5")],
    "rolling": [{"date": t, "mean": r(a, 1), "std": r(b, 1)} for t, a, b in zip(ds(d.index), d.rolling(90).mean(), d.rolling(90).std())],
    "diff_series": [{"date": t, "level": r(a, 1), "diff": r(b, 1)} for t, a, b in zip(ds(m.index), m, m_diff)],
}

# ------------------------------------------------------------- ACF / PACF
def acf_block(series, nlags):
    s = series.dropna().values
    a = acf(s, nlags=nlags, fft=True); p_ = pacf(s, nlags=nlags, method="ywm")
    band = 1.96 / np.sqrt(len(s))
    return {"band": r(band, 4), "n": int(len(s)), "values": [{"lag": int(i), "acf": r(a[i], 4), "pacf": r(p_[i], 4)} for i in range(nlags + 1)]}
acf_pacf = {"monthly": acf_block(m, 24), "monthly_diff": acf_block(m_diff, 24), "daily": acf_block(d, 40), "daily_diff": acf_block(d_diff, 40)}

# ------------------------------------------------------------- ARIMA (monthly) - grid search by AIC
grid = []
best = None
for p in range(0, 3):
    for dd in range(0, 2):
        for q in range(0, 3):
            try:
                res = ARIMA(m, order=(p, dd, q)).fit()
                grid.append({"order": f"({p},{dd},{q})", "p": p, "d": dd, "q": q, "aic": r(res.aic, 2), "bic": r(res.bic, 2), "llf": r(res.llf, 2)})
                if best is None or res.aic < best[1].aic:
                    best = ((p, dd, q), res)
            except Exception:
                pass
grid.sort(key=lambda g: g["aic"])
order, res = best
lb = acorr_ljungbox(res.resid, lags=[12], return_df=True)
params = [{"term": k, "coef": r(v, 4), "se": r(res.bse[k], 4), "z": r(res.tvalues[k], 3), "p": float(res.pvalues[k])} for k, v in res.params.items()]
# Seasonal ARIMA for comparison
sar = ARIMA(m, order=(1, 0, 0), seasonal_order=(1, 1, 0, 12)).fit()
sar_lb = acorr_ljungbox(sar.resid, lags=[12], return_df=True)
arima = {
    "best_order": order, "grid": grid[:12], "aic": r(res.aic, 2), "bic": r(res.bic, 2), "params": params,
    "ljung_box": {"stat": r(lb["lb_stat"].iloc[0], 3), "p": float(lb["lb_pvalue"].iloc[0]), "lags": 12},
    "fitted": [{"date": t, "actual": r(a, 1), "fitted": r(f, 1), "resid": r(e, 1)} for t, a, f, e in zip(ds(m.index), m, res.fittedvalues, res.resid)],
    "resid_acf": acf_block(res.resid[1:], 20),
    "sarima": {"order": "(1,0,0)(1,1,0)[12]", "aic": r(sar.aic, 2), "bic": r(sar.bic, 2),
               "params": [{"term": k, "coef": r(v, 4), "se": r(sar.bse[k], 4), "p": float(sar.pvalues[k])} for k, v in sar.params.items()],
               "ljung_box": {"stat": r(sar_lb["lb_stat"].iloc[0], 3), "p": float(sar_lb["lb_pvalue"].iloc[0])},
               "fitted": [{"date": t, "fitted": r(f, 1)} for t, f in zip(ds(m.index), sar.fittedvalues)]},
}

save("timeseries", {"overview": overview, "moving_average": moving_average, "exp_smoothing": exp_smoothing, "trend": trend,
                    "decomposition": decomposition, "stationarity": stationarity, "acf_pacf": acf_pacf, "arima": arima})
