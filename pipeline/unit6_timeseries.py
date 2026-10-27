"""Unit 6 - Time series forecasting.

Computes everything the /unit-6 page shows and writes web/public/data/unit6.json.

Syllabus lines served:
    6.1 Taxonomy of forecasting methods; components (trend, seasonality, cyclical, irregular);
        additive and multiplicative decomposition (centred 2x4 moving-average trend, seasonal
        indices adjusted to sum to 0 / to 4, trend per quarter, forecast = trend + index / trend x index).
    6.2 Smoothing methods (average method, moving average k = 3 and k = 12), linear regression on the
        time index (y' = ax + b, a = slope, b = intercept - the teacher's Unit 6 lettering), ARIMA(p, d, q).
        Self-learning: stationarity check with the ADF test (used only to choose d).
    6.3 Performance evaluation: MAE, RMSE, MAPE, MASE in the teacher's table layout
        (t | y | F | e | |e| | e^2 | |e| / y | naive error, Sum row), comparison of every method.

Inputs:  data/processed/monthly.parquet (24 months; cnt = mean rentals per day in the month;
         train = first 18 months, test = last 6) and data/processed/quarterly.parquet (8 quarters,
         decomposition in-sample like the class example). Both series are rounded to whole rentals
         first so every piece of arithmetic printed on the page is exact.
Output:  web/public/data/unit6.json
"""
from __future__ import annotations

import math
import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller

from common import load_monthly, load_quarterly, r, save, train_test

warnings.filterwarnings("ignore")

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def num(x: float, nd: int = 2) -> str:
    """Format a number for the arithmetic strings shown in table cells (no trailing zeros on integers)."""
    if x is None:
        return "—"
    if abs(x - round(x)) < 1e-9:
        return f"{int(round(x)):,}"
    return f"{x:,.{nd}f}"


# =============================================================================== 6.1 decomposition
def centred_ma_trend(y: list[float]) -> list[dict]:
    """6.1 Step 1: centred 2x4 moving-average trend T(t) = [1/2 Y(t-2) + Y(t-1) + Y(t) + Y(t+1) + 1/2 Y(t+2)] / 4."""
    n = len(y)
    rows = []
    for i in range(n):                       # i = t - 1
        if i < 2 or i > n - 3:
            rows.append({"t": i + 1, "calc": None, "T": None})
            continue
        T = (0.5 * y[i - 2] + y[i - 1] + y[i] + y[i + 1] + 0.5 * y[i + 2]) / 4
        calc = f"(½·{num(y[i-2])} + {num(y[i-1])} + {num(y[i])} + {num(y[i+1])} + ½·{num(y[i+2])}) ÷ 4"
        rows.append({"t": i + 1, "calc": calc, "T": r(T, 4)})
    return rows


def seasonal_indices(labels: list[dict], detr: list[float | None], mode: str) -> dict:
    """6.1 Step 2: seasonal table (rows = years, columns = Q1..Q4, Total, Average) and the adjustment so the
    indices sum to 0 (additive, subtract sum/4) or to 4 (multiplicative, divide by sum/4)."""
    years = sorted({lab["year"] for lab in labels})
    table = []
    for yr in years:
        row = {"year": str(yr)}
        for q in range(1, 5):
            v = None
            for lab, d in zip(labels, detr):
                if lab["year"] == yr and lab["quarter"] == q:
                    v = d
            row[f"Q{q}"] = r(v, 4) if v is not None else None
        table.append(row)
    totals, averages, counts = [], [], []
    for q in range(1, 5):
        vals = [row[f"Q{q}"] for row in table if row[f"Q{q}"] is not None]
        totals.append(r(sum(vals), 4))
        counts.append(len(vals))
        averages.append(r(sum(vals) / len(vals), 4))
    s = sum(averages)
    adj = s / 4
    if mode == "additive":
        indices = [a - adj for a in averages]
        adj_text = f"Adjustment = sum ÷ 4 = {num(s, 4)} ÷ 4 = {num(adj, 4)}. Subtract it from each average."
    else:
        indices = [a / adj for a in averages]
        adj_text = f"Adjustment = sum ÷ 4 = {num(s, 4)} ÷ 4 = {num(adj, 4)}. Divide each average by it."
    return {
        "table": table,
        "totals": totals,
        "counts": counts,
        "averages": averages,
        "sum_of_averages": r(s, 4),
        "adjustment": r(adj, 4),
        "adjustment_text": adj_text,
        "indices": [r(v, 4) for v in indices],
        "indices_sum": r(sum(indices), 4),
        "target_sum": 0 if mode == "additive" else 4,
    }


def decompose(y: list[float], labels: list[dict], mode: str, targets: list[dict]) -> dict:
    """6.1 full classical decomposition + forecast for one model ('additive' or 'multiplicative').
    labels: [{year, quarter, label}] per t; targets: [{label, year, quarter, t}] to forecast."""
    trend = centred_ma_trend(y)
    rows = []
    detr = []
    for lab, yt, tr in zip(labels, y, trend):
        if tr["T"] is None:
            d = None
            dcalc = None
        else:
            d = yt - tr["T"] if mode == "additive" else yt / tr["T"]
            dcalc = f"{num(yt)} − {num(tr['T'])}" if mode == "additive" else f"{num(yt)} ÷ {num(tr['T'])}"
        detr.append(d)
        rows.append({"t": tr["t"], "label": lab["label"], "y": yt, "calc": tr["calc"], "T": tr["T"],
                     "detrended": r(d, 4), "detrended_calc": dcalc})
    seas = seasonal_indices(labels, detr, mode)
    with_T = [row for row in rows if row["T"] is not None]
    first, last = with_T[0], with_T[-1]
    between = last["t"] - first["t"]
    slope = (last["T"] - first["T"]) / between
    trend_per_q = {
        "first_t": first["t"], "first_label": first["label"], "first_T": first["T"],
        "last_t": last["t"], "last_label": last["label"], "last_T": last["T"],
        "quarters_between": between,
        "calc": f"({num(last['T'])} − {num(first['T'])}) ÷ ({last['t']} − {first['t']}) = {num(last['T'] - first['T'])} ÷ {between}",
        "value": r(slope, 4),
    }
    forecasts = []
    for tg in targets:
        ahead = tg["t"] - last["t"]
        trend_at = last["T"] + ahead * slope
        idx = seas["indices"][tg["quarter"] - 1]
        fc = trend_at + idx if mode == "additive" else trend_at * idx
        op = "+" if mode == "additive" else "×"
        forecasts.append({
            "label": tg["label"], "t": tg["t"], "quarter": tg["quarter"],
            "quarters_ahead": ahead,
            "ahead_calc": f"{tg['t']} − {last['t']} = {ahead}",
            "increase": r(ahead * slope, 4),
            "increase_calc": f"{ahead} × {num(slope, 4)} = {num(ahead * slope, 4)}",
            "trend": r(trend_at, 4),
            "trend_calc": f"{num(last['T'])} + {num(ahead * slope, 4)} = {num(trend_at, 4)}",
            "index": idx,
            "forecast": r(fc, 4),
            "forecast_calc": f"{num(trend_at, 4)} {op} {num(idx, 4)} = {num(fc, 2)}",
        })
    return {"mode": mode, "rows": rows, "seasonal": seas, "trend_per_quarter": trend_per_q, "forecasts": forecasts}


def run_decomposition() -> dict:
    """6.1 on the 8 quarterly means (2011 Q1 .. 2012 Q4), both models, forecast 2013 Q1-Q4."""
    q = load_quarterly()
    y = [int(round(v)) for v in q["cnt"]]
    labels = [{"year": int(a), "quarter": int(b), "label": f"{int(a)} Q{int(b)}"} for a, b in zip(q["year"], q["quarter"])]
    n = len(y)
    targets = [{"label": f"2013 Q{k}", "year": 2013, "quarter": k, "t": n + k} for k in range(1, 5)]
    add = decompose(y, labels, "additive", targets)
    mul = decompose(y, labels, "multiplicative", targets)

    # Which model fits? Compare the Q1 -> Q3 swing of each year with the level of each year.
    years = sorted({lab["year"] for lab in labels})
    swings, levels = {}, {}
    for yr in years:
        vals = {lab["quarter"]: yt for lab, yt in zip(labels, y) if lab["year"] == yr}
        swings[yr] = vals[3] - vals[1]
        levels[yr] = sum(vals.values()) / 4
    y0, y1 = years[0], years[-1]
    swing_growth = swings[y1] / swings[y0] - 1
    level_growth = levels[y1] / levels[y0] - 1
    # additive if the swing stayed about the same size; multiplicative if it grew about as fast as the level
    better = "multiplicative" if abs(swing_growth - level_growth) < abs(swing_growth) else "additive"
    fit = {
        "year_a": str(y0), "year_b": str(y1),
        "swing_a": swings[y0], "swing_b": swings[y1],
        "level_a": r(levels[y0], 1), "level_b": r(levels[y1], 1),
        "swing_growth_pct": r(100 * swing_growth, 1), "level_growth_pct": r(100 * level_growth, 1),
        "better": better,
    }
    chart = []
    for row_a, row_m in zip(add["rows"], mul["rows"]):
        chart.append({"label": row_a["label"], "y": row_a["y"], "T": row_a["T"], "additive": None, "multiplicative": None})
    for fa, fm in zip(add["forecasts"], mul["forecasts"]):
        chart.append({"label": fa["label"], "y": None, "T": fa["trend"], "additive": r(fa["forecast"], 1), "multiplicative": r(fm["forecast"], 1)})
    return {
        "series": [{"t": i + 1, "label": lab["label"], "year": lab["year"], "quarter": lab["quarter"], "y": yt} for i, (lab, yt) in enumerate(zip(labels, y))],
        "additive": add, "multiplicative": mul, "fit": fit, "chart": chart,
    }


def class_check_sales() -> dict:
    """6.1 check: the slide's 12-quarter sales series through the same functions."""
    y = [18, 20, 34, 44, 22, 20, 38, 48, 18, 20, 42, 56]
    labels = [{"year": yr, "quarter": q, "label": f"Y{yr}Q{q}"} for yr in (1, 2, 3) for q in (1, 2, 3, 4)]
    targets = [{"label": "Y4Q2", "year": 4, "quarter": 2, "t": 14}, {"label": "Y5Q3", "year": 5, "quarter": 3, "t": 19}]
    add = decompose(y, labels, "additive", targets)
    mul = decompose(y, labels, "multiplicative", targets)
    return {
        "data": [{"t": i + 1, "label": lab["label"], "y": v} for i, (lab, v) in enumerate(zip(labels, y))],
        "trend": [row["T"] for row in add["rows"] if row["T"] is not None],
        "slide_trend": [29.5, 30, 30.5, 31.5, 31.5, 31.0, 31.5, 33],
        "additive": {"indices": add["seasonal"]["indices"], "slide_indices": [-10.4375, -11.6875, 6.0625, 16.0625],
                     "trend_per_quarter": add["trend_per_quarter"]["value"], "slide_trend_per_quarter": 0.5,
                     "forecasts": [{"label": f["label"], "value": r(f["forecast"], 2)} for f in add["forecasts"]],
                     "slide_forecasts": [{"label": "Y4Q2", "value": 23.31}, {"label": "Y5Q3", "value": 43.56}]},
        "multiplicative": {"indices": [r(v, 3) for v in mul["seasonal"]["indices"]], "slide_indices": [0.654, 0.628, 1.193, 1.525],
                           "forecasts": [{"label": f["label"], "value": r(f["forecast"], 2)} for f in mul["forecasts"]],
                           "slide_forecasts": [{"label": "Y4Q2", "value": 21.98}, {"label": "Y5Q3", "value": 44.75}]},
    }


# =============================================================================== 6.2 methods
def average_method(y: list[float], forecast_t: list[int]) -> list[dict]:
    """6.2 Average method: F(t) = (y(1) + ... + y(t-1)) / (t-1); one step ahead, every past actual joins the mean."""
    out = []
    for t in forecast_t:
        past = y[: t - 1]
        F = sum(past) / len(past)
        shown = " + ".join(num(v) for v in past[:3]) + (" + … + " + num(past[-1]) if len(past) > 4 else (" + " + num(past[-1]) if len(past) == 4 else ""))
        out.append({"t": t, "F": r(F, 2), "calc": f"({shown}) ÷ {len(past)} = {num(F, 2)}"})
    return out


def moving_average(y: list[float], forecast_t: list[int], k: int) -> list[dict]:
    """6.2 Moving average: F(t) = (y(t-1) + ... + y(t-k)) / k; one step ahead, only the last k actuals."""
    out = []
    for t in forecast_t:
        window = y[t - 1 - k: t - 1]
        F = sum(window) / k
        shown = " + ".join(num(v) for v in window) if k <= 4 else f"{num(window[0])} + … + {num(window[-1])}"
        out.append({"t": t, "F": r(F, 2), "calc": f"({shown}) ÷ {k} = {num(F, 2)}"})
    return out


def regression_on_time(x: list[int], y: list[float], forecast_x: list[int]) -> dict:
    """6.2 Least-squares line y' = ax + b on the time index (teacher's letters: a = slope, b = intercept).
    a = [n Σxy − Σx Σy] / [n Σx² − (Σx)²], b = (Σy − a Σx) / n."""
    n = len(x)
    rows = [{"x": xi, "y": yi, "xy": xi * yi, "x2": xi * xi} for xi, yi in zip(x, y)]
    sx, sy = sum(x), sum(y)
    sxy = sum(rr["xy"] for rr in rows)
    sx2 = sum(rr["x2"] for rr in rows)
    a = (n * sxy - sx * sy) / (n * sx2 - sx * sx)
    b = (sy - a * sx) / n
    fitted = [{"x": xi, "y": yi, "fit": r(a * xi + b, 2)} for xi, yi in zip(x, y)]
    fcs = [{"t": fx, "F": r(a * fx + b, 2), "calc": f"{num(a, 2)} × {fx} + {num(b, 2)} = {num(a * fx + b, 2)}"} for fx in forecast_x]
    return {
        "n": n, "rows": rows,
        "sums": {"x": sx, "y": r(sy, 2), "xy": r(sxy, 2), "x2": sx2},
        "a": r(a, 4), "b": r(b, 4),
        "a_calc": f"[{n} × {num(sxy)} − {num(sx)} × {num(sy)}] ÷ [{n} × {num(sx2)} − {num(sx)}²] = {num(n * sxy - sx * sy)} ÷ {num(n * sx2 - sx * sx)} = {num(a, 4)}",
        "b_calc": f"({num(sy)} − {num(a, 4)} × {num(sx)}) ÷ {n} = {num(sy - a * sx, 2)} ÷ {n} = {num(b, 4)}",
        "equation": f"y′ = {num(a, 2)}x + {num(b, 2)}",
        "fitted": fitted, "forecasts": fcs,
    }


def adf_plain(series: np.ndarray, name: str) -> dict:
    """Self-learning: ADF test, reported plainly as calculated statistic vs tabulated 5 % critical value."""
    stat, p, used_lag, nobs, crit = adfuller(series, maxlag=0, autolag=None, regression="c")[:5]
    c5 = float(crit["5%"])
    return {"name": name, "n": int(len(series)), "statistic": r(stat, 3), "critical_5pct": r(c5, 3),
            "stationary": bool(stat < c5), "p_value": r(p, 4)}


def arima_method(train: list[float], horizon: int) -> dict:
    """6.2 ARIMA(p, d, q): d from the stationarity check, (p, q) ≤ 2 by the lowest AIC on the training months,
    then a 6-step-ahead forecast from the model fitted on the training months only."""
    y = np.asarray(train, dtype=float)
    adf_level = adf_plain(y, "Training months (levels)")
    adf_diff = adf_plain(np.diff(y), "First differences")
    d = 0 if adf_level["stationary"] else 1
    grid = []
    best = None
    for p in range(3):
        for q in range(3):
            try:
                res = ARIMA(y, order=(p, d, q), trend="c" if d == 0 else "n").fit()
                aic = float(res.aic)
            except Exception:
                continue
            grid.append({"p": p, "d": d, "q": q, "aic": r(aic, 2)})
            if best is None or aic < best[0]:
                best = (aic, p, q, res)
    aic, p, q, res = best
    fc = res.forecast(horizon)
    fitted = res.fittedvalues
    params = {k: r(float(v), 4) for k, v in zip(res.param_names, np.asarray(res.params))}
    return {
        "adf": [adf_level, adf_diff],
        "d": d, "p": p, "q": q, "order": f"ARIMA({p}, {d}, {q})", "aic": r(aic, 2),
        "grid": sorted(grid, key=lambda g: g["aic"]),
        "params": params,
        "fitted": [None if (d == 1 and i == 0) else r(float(v), 2) for i, v in enumerate(fitted)],
        "forecasts": [r(float(v), 2) for v in fc],
    }


# =============================================================================== 6.3 evaluation
def evaluation_table(ts: list[int], dates: list[str], y: list[float], F: list[float], y_prev: list[float], naive_mae: float) -> dict:
    """6.3 the teacher's table: t | y | F | e | |e| | e² | |e| ÷ y | naive error, Sum row; then MAE, RMSE, MAPE, MASE.
    naive_mae = the MASE denominator (in-sample naive MAE on the training months)."""
    rows = []
    for t, dte, yt, Ft, yp in zip(ts, dates, y, F, y_prev):
        e = yt - Ft
        rows.append({"t": t, "date": dte, "y": r(yt, 2), "F": r(Ft, 2), "e": r(e, 2), "abs_e": r(abs(e), 2),
                     "e2": r(e * e, 2), "ape": r(abs(e) / yt, 4), "naive": r(abs(yt - yp), 2) if yp is not None else None})
    n = len(rows)
    sums = {"e": r(sum(rr["e"] for rr in rows), 2), "abs_e": r(sum(rr["abs_e"] for rr in rows), 2),
            "e2": r(sum(rr["e2"] for rr in rows), 2), "ape": r(sum(rr["ape"] for rr in rows), 4),
            "naive": r(sum(rr["naive"] for rr in rows if rr["naive"] is not None), 2)}
    mae = sums["abs_e"] / n
    rmse = math.sqrt(sums["e2"] / n)
    mape = 100 * sums["ape"] / n
    mase = mae / naive_mae
    return {
        "rows": rows, "n": n, "sums": sums,
        "metrics": {"MAE": r(mae, 2), "RMSE": r(rmse, 2), "MAPE": r(mape, 2), "MASE": r(mase, 3)},
        "calcs": {
            "MAE": f"{num(sums['abs_e'])} ÷ {n} = {num(mae, 2)}",
            "RMSE": f"√({num(sums['e2'])} ÷ {n}) = √{num(sums['e2'] / n, 2)} = {num(rmse, 2)}",
            "MAPE": f"{num(100 * sums['ape'], 2)} % ÷ {n} = {num(mape, 2)} %",
            "MASE": f"{num(mae, 2)} ÷ {num(naive_mae, 2)} = {num(mase, 3)}",
        },
    }


def run_methods_and_evaluation() -> dict:
    """6.2 + 6.3 on the monthly series: train = first 18 months, test = last 6."""
    m = load_monthly()
    m["y"] = m["cnt"].round().astype(int)
    tr, te = train_test(m)
    y = m["y"].tolist()
    dates = [d.strftime("%Y-%m-%d") for d in pd.to_datetime(m["date"])]
    ts = m["t"].tolist()
    n_train, n_test = len(tr), len(te)
    test_t = te["t"].tolist()
    test_dates = [d.strftime("%Y-%m-%d") for d in pd.to_datetime(te["date"])]
    test_y = te["y"].tolist()
    y_prev = [y[t - 2] for t in test_t]
    train_y = tr["y"].tolist()

    # in-sample naive MAE on the training months = the MASE denominator
    diffs = [abs(train_y[j] - train_y[j - 1]) for j in range(1, n_train)]
    naive_mae = sum(diffs) / (n_train - 1)
    naive_train = {"n": n_train, "n_diffs": n_train - 1, "sum_abs_diff": r(sum(diffs), 2), "mae": r(naive_mae, 2),
                   "calc": f"{num(sum(diffs))} ÷ {n_train - 1} = {num(naive_mae, 2)}",
                   "rows": [{"t": j + 1, "y": train_y[j], "y_prev": train_y[j - 1], "abs_diff": abs(train_y[j] - train_y[j - 1])} for j in range(1, n_train)]}

    avg = average_method(y, test_t)
    ma3 = moving_average(y, test_t, 3)
    ma12 = moving_average(y, test_t, 12)
    reg = regression_on_time(tr["t"].tolist(), train_y, test_t)
    ari = arima_method(train_y, n_test)

    methods = {
        "average": {"label": "Average method", "forecasts": avg},
        "ma3": {"label": "Moving average (k = 3)", "forecasts": ma3},
        "ma12": {"label": "Moving average (k = 12)", "forecasts": ma12},
        "regression": {"label": "Linear regression on t", "forecasts": reg["forecasts"]},
        "arima": {"label": ari["order"], "forecasts": [{"t": t, "F": F, "calc": None} for t, F in zip(test_t, ari["forecasts"])]},
    }
    evaluation = {}
    for key, md in methods.items():
        evaluation[key] = {"label": md["label"], **evaluation_table(test_t, test_dates, test_y, [f["F"] for f in md["forecasts"]], y_prev, naive_mae)}

    comparison = [{"key": k, "method": ev["label"], **ev["metrics"]} for k, ev in evaluation.items()]
    best_key = min(comparison, key=lambda c: c["MAE"])["key"]
    worst_key = max(comparison, key=lambda c: c["MAE"])["key"]
    reasons = {
        "average": "it is the mean of every past month, so the growth of 2012 is pulled down by the low months of 2011 (old data never leaves).",
        "ma3": "it uses only the last three actual months, so it follows the level the series has just reached and reacts when the autumn fall begins.",
        "ma12": "a 12-month window is the mean of the whole previous year, which sits far below the 2012 level.",
        "regression": "the straight line in t keeps the upward growth going, but it has no seasonal term, so it keeps rising while the actual months fall after September.",
        "arima": "with d = 1 it starts from the last level and adds the recent momentum, but it has no seasonal term either.",
    }
    # forecast chart: 24 months, every forecast on the test months
    chart = []
    for i, (t, dte, yt) in enumerate(zip(ts, dates, y)):
        row = {"t": t, "date": dte, "y": yt, "split": m["split"].iloc[i]}
        for key, md in methods.items():
            row[key] = None
        row["arima_fit"] = ari["fitted"][i] if i < n_train else None
        row["reg_fit"] = reg["fitted"][i]["fit"] if i < n_train else None
        if t in test_t:
            j = test_t.index(t)
            for key, md in methods.items():
                row[key] = md["forecasts"][j]["F"]
        chart.append(row)
    return {
        "monthly": [{"t": t, "date": dte, "y": yt, "split": s, "label": f"{MONTHS[int(dte[5:7]) - 1]} {dte[:4]}"} for t, dte, yt, s in zip(ts, dates, y, m["split"])],
        "n_train": n_train, "n_test": n_test, "test_t": test_t,
        "naive_train": naive_train,
        "average": {"forecasts": avg},
        "ma3": {"forecasts": ma3},
        "ma12": {"forecasts": ma12},
        "regression": reg,
        "arima": ari,
        "evaluation": evaluation,
        "comparison": comparison,
        "best": {"key": best_key, "method": methods[best_key]["label"], "reason": reasons[best_key]},
        "worst": {"key": worst_key, "method": methods[worst_key]["label"], "reason": reasons[worst_key]},
        "reasons": reasons,
        "chart": chart,
    }


def class_check_methods() -> dict:
    """6.2/6.3 checks: the slide's average-method, moving-average and regression examples through the same functions."""
    y = [20, 22, 21, 25, 24, 26]
    # average method: forecasts for t = 2..7; evaluation rows t = 2..6, naive MAE over the same rows (slide convention)
    avg = average_method(y, [2, 3, 4, 5, 6, 7])
    rows_t = [2, 3, 4, 5, 6]
    naive_rows = [abs(y[t - 1] - y[t - 2]) for t in rows_t]
    ev_avg = evaluation_table(rows_t, [""] * 5, [y[t - 1] for t in rows_t], [f["F"] for f in avg[:5]], [y[t - 2] for t in rows_t], sum(naive_rows) / len(naive_rows))
    ma = moving_average(y, [4, 5, 6, 7], 3)
    rows_t = [4, 5, 6]
    naive_rows = [abs(y[t - 1] - y[t - 2]) for t in rows_t]
    ev_ma = evaluation_table(rows_t, [""] * 3, [y[t - 1] for t in rows_t], [f["F"] for f in ma[:3]], [y[t - 2] for t in rows_t], sum(naive_rows) / len(naive_rows))
    reg = regression_on_time([1, 2, 3, 4, 5], [12, 19, 29, 37, 45], [6])
    ry = [12, 19, 29, 37, 45]
    ev_reg = evaluation_table([1, 2, 3, 4, 5], [""] * 5, ry, [f["fit"] for f in reg["fitted"]], [None, 12, 19, 29, 37], sum(abs(ry[j] - ry[j - 1]) for j in range(1, 5)) / 4)
    return {
        "average": {"data": y, "F7": avg[-1]["F"], "slide_F7": 23.0, "metrics": ev_avg["metrics"], "slide_metrics": {"MAE": 2.32, "RMSE": 2.72, "MAPE": 9.45, "MASE": 1.16}},
        "ma3": {"F7": ma[-1]["F"], "slide_F7": 25.0, "metrics": ev_ma["metrics"], "slide_metrics": {"MAE": 2.67, "RMSE": 2.88, "MAPE": 10.60, "MASE": 1.14}},
        "regression": {"a": reg["a"], "b": reg["b"], "slide_a": 8.4, "slide_b": 3.2, "F6": reg["forecasts"][0]["F"], "slide_F6": 53.6,
                       "metrics": ev_reg["metrics"], "slide_metrics": {"MAE": 0.48, "RMSE": 0.566, "MAPE": 2.33, "MASE": 0.058}},
    }


# =============================================================================== main
def main() -> None:
    dec = run_decomposition()
    meth = run_methods_and_evaluation()
    taxonomy = [
        {"family": "Decomposition based methods", "leaves": [{"name": "Classical", "used": True}, {"name": "STS, X11, …", "used": False}]},
        {"family": "Smoothing based methods", "leaves": [{"name": "Moving averages", "used": True}, {"name": "Exponential smoothing", "used": False}]},
        {"family": "Regression based methods", "leaves": [{"name": "Regression with seasonality", "used": False}, {"name": "ARIMA", "used": True}]},
        {"family": "Machine learning based methods", "leaves": [{"name": "Regression", "used": False}, {"name": "Neural network", "used": False}]},
    ]
    components = [
        {"name": "Trend", "desc": "Long-term movement of data showing increase, decrease or stability; can be linear or nonlinear."},
        {"name": "Seasonality", "desc": "Regular patterns repeating at fixed intervals (daily, monthly, yearly), often due to seasons or events."},
        {"name": "Cyclical variations", "desc": "Long-term fluctuations without fixed periods, linked to economic or business cycles."},
        {"name": "Irregularity (noise)", "desc": "Random, unpredictable variations caused by events, errors or other unforeseen factors."},
    ]
    mon = meth["monthly"]
    peak = max(mon, key=lambda x: x["y"])
    low = min(mon, key=lambda x: x["y"])
    first_year = [x for x in mon if x["date"].startswith(mon[0]["date"][:4])]
    second_year = [x for x in mon if not x["date"].startswith(mon[0]["date"][:4])]
    component_facts = {
        "first": mon[0], "last": mon[-1], "peak": peak, "low": low,
        "mean_year_a": r(sum(x["y"] for x in first_year) / len(first_year), 0),
        "mean_year_b": r(sum(x["y"] for x in second_year) / len(second_year), 0),
        "year_a": mon[0]["date"][:4], "year_b": mon[-1]["date"][:4],
        "sandy": next((x for x in mon if x["date"].startswith("2012-10")), None),
    }
    add_fc = dec["additive"]["forecasts"]
    mul_fc = dec["multiplicative"]["forecasts"]
    headline = {
        "additive_2013": [{"label": f["label"], "forecast": r(f["forecast"], 0)} for f in add_fc],
        "multiplicative_2013": [{"label": f["label"], "forecast": r(f["forecast"], 0)} for f in mul_fc],
        "additive_indices": dec["additive"]["seasonal"]["indices"],
        "multiplicative_indices": [r(v, 3) for v in dec["multiplicative"]["seasonal"]["indices"]],
        "better_decomposition": dec["fit"]["better"],
        "regression_a": meth["regression"]["a"], "regression_b": meth["regression"]["b"],
        "arima_order": meth["arima"]["order"],
        "metrics": {c["key"]: {"method": c["method"], "MAE": c["MAE"], "RMSE": c["RMSE"], "MAPE": c["MAPE"], "MASE": c["MASE"]} for c in meth["comparison"]},
        "best_method": meth["best"]["method"], "best_key": meth["best"]["key"],
    }
    save("unit6", {
        "meta": {"n_months": len(mon), "n_train": meth["n_train"], "n_test": meth["n_test"], "n_quarters": len(dec["series"]),
                 "test_start": meth["monthly"][meth["n_train"]]["date"]},
        "taxonomy": taxonomy,
        "components": components,
        "component_facts": component_facts,
        "models": {"additive_example": "100 + 15 − 3 = 112", "multiplicative_example": "100 × 1.15 × 0.97 = 111.55"},
        "decomposition": dec,
        "class_check_sales": class_check_sales(),
        "methods": meth,
        "class_check_methods": class_check_methods(),
        "headline": headline,
    })
    print("  additive 2013:", [(f["label"], round(f["forecast"])) for f in add_fc])
    print("  multiplicative 2013:", [(f["label"], round(f["forecast"])) for f in mul_fc])
    print("  regression a, b:", meth["regression"]["a"], meth["regression"]["b"], "|", meth["arima"]["order"])
    for c in meth["comparison"]:
        print("  ", c)
    print("  best:", meth["best"]["method"])


if __name__ == "__main__":
    main()
