"""Module 10 - Forecasting with a chronological train/test split.

Monthly: train 2010-2013 (48 months), test 2014 (12 months).
Daily : train to 2014-10-31, test Nov-Dec 2014 (61 days), including a
walk-forward one-step ARIMA and an ARIMAX with weather regressors.
Output: web/public/data/forecasting.json
"""
import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing, SimpleExpSmoothing

from common import load_daily, load_monthly, r, save

warnings.filterwarnings("ignore")
print("10_forecasting")
daily = load_daily().set_index("date")
monthly = load_monthly().set_index("date")
m = monthly["pm25"].astype(float); m.index.freq = "MS"
d = daily["pm25"].astype(float); d.index.freq = "D"
ds = lambda idx: [t.strftime("%Y-%m-%d") for t in idx]


def metrics(y, f, train, m_season=1):
    y = np.asarray(y, float); f = np.asarray(f, float); train = np.asarray(train, float)
    e = y - f
    scale = np.mean(np.abs(train[m_season:] - train[:-m_season]))  # in-sample naive MAE
    return {"mae": r(np.abs(e).mean(), 2), "rmse": r(np.sqrt((e ** 2).mean()), 2), "mape": r(100 * np.mean(np.abs(e / y)), 2),
            "mase": r(np.abs(e).mean() / scale, 3), "bias": r(e.mean(), 2)}


# ============================================================= MONTHLY
tr = m[m.index.year <= 2013]; te = m[m.index.year == 2014]
h = len(te)
fc = {}
fc["Naive"] = np.repeat(tr.iloc[-1], h)
fc["Seasonal naive"] = tr.iloc[-12:].values
fc["Mean"] = np.repeat(tr.mean(), h)
fc["Drift"] = tr.iloc[-1] + (tr.iloc[-1] - tr.iloc[0]) / (len(tr) - 1) * np.arange(1, h + 1)
fc["Moving average (3)"] = np.repeat(tr.iloc[-3:].mean(), h)
ses = SimpleExpSmoothing(tr, initialization_method="estimated").fit(); fc["SES"] = ses.forecast(h).values
holt = ExponentialSmoothing(tr, trend="add", damped_trend=True, initialization_method="estimated").fit(); fc["Holt (damped)"] = holt.forecast(h).values
hw = ExponentialSmoothing(tr, trend="add", seasonal="add", seasonal_periods=12, initialization_method="estimated").fit(); fc["Holt-Winters"] = hw.forecast(h).values
# ARIMA: pick order by AIC on the training set only
best = None
for p in range(3):
    for dd in range(2):
        for q in range(3):
            try:
                res = ARIMA(tr, order=(p, dd, q)).fit()
                if best is None or res.aic < best[1].aic:
                    best = ((p, dd, q), res)
            except Exception:
                pass
arima_order, arima_res = best
arima_pred = arima_res.get_forecast(h); fc[f"ARIMA{arima_order}"] = arima_pred.predicted_mean.values
arima_ci = arima_pred.conf_int(alpha=0.05)
sar = ARIMA(tr, order=(1, 0, 0), seasonal_order=(1, 1, 0, 12)).fit()
sar_pred = sar.get_forecast(h); fc["SARIMA(1,0,0)(1,1,0)[12]"] = sar_pred.predicted_mean.values
sar_ci = sar_pred.conf_int(alpha=0.05)
# Holt-Winters CI by simulation
sims = hw.simulate(h, repetitions=500, error="add", random_state=0)
hw_lo, hw_hi = np.percentile(sims.values, 2.5, axis=1), np.percentile(sims.values, 97.5, axis=1)

monthly_table = [{"model": k, **metrics(te.values, v, tr.values, 1), "mase_seasonal": metrics(te.values, v, tr.values, 12)["mase"]} for k, v in fc.items()]
monthly_table.sort(key=lambda x: x["rmse"])
monthly_series = []
for i, t in enumerate(ds(te.index)):
    row = {"date": t, "actual": r(te.iloc[i], 1), **{k: r(v[i], 1) for k, v in fc.items()},
           "arima_lo": r(arima_ci.iloc[i, 0], 1), "arima_hi": r(arima_ci.iloc[i, 1], 1),
           "sarima_lo": r(sar_ci.iloc[i, 0], 1), "sarima_hi": r(sar_ci.iloc[i, 1], 1), "hw_lo": r(hw_lo[i], 1), "hw_hi": r(hw_hi[i], 1)}
    monthly_series.append(row)
history = [{"date": t, "actual": r(v, 1)} for t, v in zip(ds(tr.index[-24:]), tr.iloc[-24:])]
# Error by horizon for the three main models
horizon = [{"h": i + 1, **{k: r(abs(te.iloc[i] - fc[k][i]), 1) for k in ["Seasonal naive", "Holt-Winters", f"ARIMA{arima_order}", "SARIMA(1,0,0)(1,1,0)[12]"]}} for i in range(h)]
monthly_block = {"n_train": len(tr), "n_test": h, "train_start": ds(tr.index)[0], "train_end": ds(tr.index)[-1], "test_start": ds(te.index)[0], "test_end": ds(te.index)[-1],
                 "models": list(fc.keys()), "table": monthly_table, "series": monthly_series, "history": history, "horizon": horizon,
                 "arima_order": arima_order, "hw_params": {k: r(hw.params[k], 4) for k in ["smoothing_level", "smoothing_trend", "smoothing_seasonal"]}}

# ============================================================= DAILY
split = pd.Timestamp("2014-10-31")
dtr = d[d.index <= split]; dte = d[d.index > split]
hd = len(dte)
dfc = {}
dfc["Naive"] = np.repeat(dtr.iloc[-1], hd)
dfc["Mean (last 90 d)"] = np.repeat(dtr.iloc[-90:].mean(), hd)
dfc["Seasonal naive (7)"] = np.tile(dtr.iloc[-7:].values, int(np.ceil(hd / 7)))[:hd]
dses = SimpleExpSmoothing(dtr, initialization_method="estimated").fit(); dfc["SES"] = dses.forecast(hd).values
dhw = ExponentialSmoothing(dtr, trend="add", damped_trend=True, seasonal="add", seasonal_periods=7, initialization_method="estimated").fit(); dfc["Holt-Winters (7)"] = dhw.forecast(hd).values
dar = ARIMA(dtr, order=(2, 1, 2)).fit()
dar_pred = dar.get_forecast(hd); dfc["ARIMA(2,1,2) static"] = dar_pred.predicted_mean.values
dar_ci = dar_pred.conf_int(alpha=0.05)
# Walk-forward one-step ARIMA: after each test day the model sees the real value (no refit)
res = dar
wf_pred, wf_lo, wf_hi = [], [], []
for t in dte.index:
    f = res.get_forecast(1)
    wf_pred.append(float(f.predicted_mean.iloc[0])); ci = f.conf_int(alpha=0.05); wf_lo.append(float(ci.iloc[0, 0])); wf_hi.append(float(ci.iloc[0, 1]))
    res = res.append(pd.Series([dte.loc[t]], index=pd.DatetimeIndex([t], freq="D"), name=dtr.name), refit=False)
dfc["ARIMA(2,1,2) walk-forward"] = np.array(wf_pred)
# ARIMAX: weather of the forecast day as exogenous regressors (assumes a perfect weather forecast)
exog_cols = ["DEWP", "TEMP", "PRES", "Iws"]
ex_tr = daily.loc[dtr.index, exog_cols].astype(float); ex_te = daily.loc[dte.index, exog_cols].astype(float)
arx = ARIMA(dtr, exog=ex_tr, order=(1, 0, 1)).fit()
arx_pred = arx.get_forecast(hd, exog=ex_te); dfc["ARIMAX(1,0,1) + weather"] = arx_pred.predicted_mean.values
arx_ci = arx_pred.conf_int(alpha=0.05)

daily_table = [{"model": k, **metrics(dte.values, v, dtr.values, 1)} for k, v in dfc.items()]
daily_table.sort(key=lambda x: x["rmse"])
daily_series = [{"date": t, "actual": r(dte.iloc[i], 1), **{k: r(v[i], 1) for k, v in dfc.items()},
                 "wf_lo": r(wf_lo[i], 1), "wf_hi": r(wf_hi[i], 1), "static_lo": r(dar_ci.iloc[i, 0], 1), "static_hi": r(dar_ci.iloc[i, 1], 1),
                 "arx_lo": r(arx_ci.iloc[i, 0], 1), "arx_hi": r(arx_ci.iloc[i, 1], 1)} for i, t in enumerate(ds(dte.index))]
daily_history = [{"date": t, "actual": r(v, 1)} for t, v in zip(ds(dtr.index[-60:]), dtr.iloc[-60:])]
daily_block = {"n_train": len(dtr), "n_test": hd, "split": ds([split])[0], "models": list(dfc.keys()), "table": daily_table, "series": daily_series, "history": daily_history,
               "arimax_params": [{"term": k, "coef": r(v, 4), "p": float(arx.pvalues[k])} for k, v in arx.params.items()],
               "walk_forward_note": "The one-step model is updated with each observed day (statsmodels append, refit=False) - the forecast for day t+1 always uses data up to day t."}

# Residual diagnostics for the best daily model (walk-forward)
wf_err = dte.values - np.array(wf_pred)
residuals = {"model": "ARIMA(2,1,2) walk-forward", "mean": r(wf_err.mean(), 2), "sd": r(wf_err.std(ddof=1), 2),
             "series": [{"date": t, "resid": r(e, 1)} for t, e in zip(ds(dte.index), wf_err)],
             "coverage_95": r(100 * np.mean((dte.values >= wf_lo) & (dte.values <= wf_hi)), 1)}

save("forecasting", {"monthly": monthly_block, "daily": daily_block, "residuals": residuals,
                     "metric_defs": [
                         {"name": "MAE", "formula": "\\frac{1}{n}\\sum|y_t-\\hat y_t|", "meaning": "Average size of the error, same units as PM2.5."},
                         {"name": "RMSE", "formula": "\\sqrt{\\frac{1}{n}\\sum(y_t-\\hat y_t)^2}", "meaning": "Penalises large misses more than MAE."},
                         {"name": "MAPE", "formula": "\\frac{100}{n}\\sum\\left|\\frac{y_t-\\hat y_t}{y_t}\\right|", "meaning": "Scale-free percentage error; unstable when y is near 0."},
                         {"name": "MASE", "formula": "\\frac{\\text{MAE}}{\\frac{1}{T-1}\\sum_{t=2}^{T}|y_t-y_{t-1}|}", "meaning": "Error relative to the naive in-sample forecast; < 1 beats naive."},
                     ]})
