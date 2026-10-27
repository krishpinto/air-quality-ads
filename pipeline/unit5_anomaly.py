"""Unit 5 - Anomaly detection.

Computes everything the /unit-5 page shows and writes web/public/data/unit5.json.

Syllabus lines served:
    5.1 Outliers and causes of outliers          -> known-event table, the raw humidity-0 % row, daily series
    5.2 Anomaly detection techniques             -> comparison table (statistical / distance / density)
    5.3 Outlier detection using statistics       -> z-score |z| > 3 on cnt, wind_kmh, RAW humidity; 1.5 x IQR fences on cnt
    5.4 Distance-based method                    -> k-NN distance (k = 5, Manhattan) on standardised (temp_c, cnt)
    5.5 Density-based method: LOF                -> own numpy LOF; class example (a, b, c, d, k = 2); real data k = 20
    5.6 SMOTE                                    -> high-demand label, SMOTE, logistic regression with / without SMOTE
    Self-learning                                -> confusion matrix, precision, recall, F1, AUC-PR

Inputs:  data/processed/daily.parquet (load_daily, 731 rows) and data/raw/day.csv (load_raw) for the
         original humidity value of 2011-03-10 (fixed in Unit 1).
Output:  web/public/data/unit5.json

Notation follows the class LOF slides: dist(p, q) = |x1 - x2| + |y1 - y2| (Manhattan), k-distance(p), N_k(p),
reach-dist_k(p, o) = max(k-distance(o), dist(p, o)), lrd(p) = |N_k(p)| / sum reach-dist, LOF(p) = avg lrd(N_k(p)) / lrd(p).
Every random draw is seeded (SEED = 42).
"""
from __future__ import annotations

import warnings

import numpy as np
import pandas as pd

from common import (HIGH_DEMAND, hist, load_daily, load_raw, r, save, sd_population, train_test)

warnings.filterwarnings("ignore")  # sklearn 1.6 + scipy 1.18 emit a harmless 'iprint' OptimizeWarning
SEED = 42

K_KNN = 5      # 5.4 k for the k-NN distance score
K_LOF = 20     # 5.5 k for LOF on the real data
K_SMOTE = 5    # 5.6 k nearest minority neighbours

# The days with a known cause, used in 5.1 and as the "what happened" column of the 5.4 / 5.5 tables.
KNOWN_EVENTS = {
    "2012-10-29": ("Genuine rare event", "Hurricane Sandy hits the US east coast; the city shuts down"),
    "2011-08-27": ("Genuine rare event", "Hurricane Irene passes Washington DC (rain, wind all day)"),
    "2011-09-07": ("Genuine rare event", "Remnants of Tropical Storm Lee: days of heavy rain and flooding"),
    "2011-09-08": ("Genuine rare event", "Remnants of Tropical Storm Lee: days of heavy rain and flooding"),
    "2011-01-26": ("Natural variation", "Snowstorm (26-27 January 2011)"),
    "2011-01-27": ("Natural variation", "Snowstorm (26-27 January 2011): streets still blocked"),
    "2012-12-26": ("Natural variation", "Day after Christmas, rain all day"),
    "2011-03-10": ("Data entry / sensor error", "Humidity recorded as 0 % (impossible); fixed in Unit 1"),
    "2011-01-22": ("Natural variation", "Coldest weekend of January 2011 (clear but about 2 °C)"),
    "2011-01-23": ("Natural variation", "Coldest weekend of January 2011 (clear but about 4 °C)"),
    "2011-07-22": ("Natural variation", "Heat wave: the hottest days of 2011 (about 35 °C)"),
    "2011-07-23": ("Natural variation", "Heat wave: the hottest days of 2011 (about 35 °C)"),
    "2012-07-07": ("Natural variation", "Heat wave: the hottest day of 2012 (35 °C), yet a busy Saturday"),
    "2012-01-04": ("Natural variation", "Cold snap after New Year (about 4 °C)"),
    "2012-09-15": ("Natural variation", "Busiest day of the whole period (a mild Saturday in September)"),
    "2012-09-29": ("Natural variation", "Second-busiest day (a mild Saturday in September)"),
    "2011-02-19": ("Natural variation", "Very dry, windy, clear Saturday (humidity 19 %, wind 34 km/h)"),
    "2012-03-08": ("Natural variation", "Windy spring day (wind 30 km/h)"),
}


def event_of(date: str) -> tuple[str, str]:
    return KNOWN_EVENTS.get(date, ("", ""))


# ----------------------------------------------------------------------------- helpers
def manhattan_matrix(X: np.ndarray) -> np.ndarray:
    """dist(p, q) = |x1 - x2| + |y1 - y2|, the metric of the class LOF example (5.4, 5.5)."""
    return np.abs(X[:, None, :] - X[None, :, :]).sum(axis=-1)


def zscore(values) -> tuple[np.ndarray, float, float]:
    """5.3  z = (x - mu) / sigma with sigma = sqrt(sum (x - mu)^2 / N)  (divide by N, as taught)."""
    v = np.asarray(values, dtype=float)
    mu, sd = float(v.mean()), sd_population(v)
    return (v - mu) / sd, mu, sd


def knn_distance(D: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
    """5.4  k-NN outlier score = distance to the k-th nearest neighbour (the k-distance of the LOF slides).
    Returns (score, index matrix of the k nearest neighbours)."""
    Dm = D.copy()
    np.fill_diagonal(Dm, np.inf)
    nn = np.argsort(Dm, axis=1, kind="stable")[:, :k]
    score = Dm[np.arange(len(D)), nn[:, k - 1]]
    return score, nn


def lof(D: np.ndarray, k: int) -> dict:
    """5.5  LOF exactly as on the class slides, in numpy so every step is visible.
    1. N_k(p) = the k nearest neighbours, k-distance(p) = distance to the k-th one.
    2. reach-dist_k(p, o) = max(k-distance(o), dist(p, o)) for every o in N_k(p).
    3. lrd(p) = |N_k(p)| / sum_o reach-dist_k(p, o).
    4. LOF(p) = [ sum_o lrd(o) / |N_k(p)| ] / lrd(p).
    Ties are broken by index order, like the slide (|N_k(p)| = k always)."""
    n = len(D)
    Dm = D.copy()
    np.fill_diagonal(Dm, np.inf)
    nn = np.argsort(Dm, axis=1, kind="stable")[:, :k]          # N_k(p)
    kdist = Dm[np.arange(n), nn[:, k - 1]]                      # k-distance(p)
    dist_po = Dm[np.arange(n)[:, None], nn]                     # dist(p, o)
    reach = np.maximum(kdist[nn], dist_po)                      # reach-dist_k(p, o)
    lrd = k / reach.sum(axis=1)                                 # lrd(p)
    avg_lrd_nn = lrd[nn].mean(axis=1)                           # average lrd of the neighbours
    L = avg_lrd_nn / lrd                                        # LOF(p)
    return {"nn": nn, "kdist": kdist, "dist_po": dist_po, "reach": reach, "lrd": lrd, "avg_lrd_nn": avg_lrd_nn, "lof": L}


def day_row(d: pd.DataFrame, i: int) -> dict:
    row = d.iloc[i]
    date = row["date"].strftime("%Y-%m-%d")
    cause, what = event_of(date)
    return {"date": date, "cnt": int(row["cnt"]), "temp_c": r(row["temp_c"], 1), "hum_pct": r(row["hum_pct"], 1),
            "wind_kmh": r(row["wind_kmh"], 1), "weather": row["weather_name"], "day_type": row["day_type"],
            "cause": cause, "what": what}


# ----------------------------------------------------------------------------- 5.1
def section_51(d: pd.DataFrame, raw: pd.DataFrame, z_cnt: np.ndarray) -> dict:
    """5.1 Outliers and causes of outliers: the known days, the raw sensor-error row, the daily series."""
    causes = [
        {"cause": "Data entry / sensor error", "meaning": "A value that was typed or measured wrongly, so it can never be true.",
         "here": "2011-03-10 has humidity 0 %, which is impossible outdoors. Fixed in Unit 1 (replaced by the mean of the neighbouring days)."},
        {"cause": "Measurement error", "meaning": "The instrument is right in general but imprecise on that reading.",
         "here": "Not seen: the weather values are daily means from an official station and the rental counts are exact system logs."},
        {"cause": "Sampling error", "meaning": "The observation comes from a different population than the rest.",
         "here": "Not seen: every row is one day of the same bike system in the same city."},
        {"cause": "Natural variation", "meaning": "An unusual but real day at the edge of normal behaviour.",
         "here": "The 26-27 January 2011 snowstorm (431 and 506 rentals) and 26 December 2012, a rainy day after Christmas (441)."},
        {"cause": "Genuine rare event", "meaning": "A real event that changes the process for a day.",
         "here": "Hurricane Sandy, 29 October 2012: 22 rentals on an 18 °C day. The lowest day in the data."},
    ]
    event_dates = ["2012-10-29", "2011-01-26", "2011-01-27", "2012-12-26", "2011-03-10"]
    events = []
    for dt in event_dates:
        i = int(d.index[d["date"] == dt][0])
        row = day_row(d, i)
        row["z_cnt"] = r(z_cnt[i], 2)
        events.append(row)
    raw_row = raw[raw["hum"] == 0].iloc[0]
    fixed = d[d["date"] == raw_row["dteday"]].iloc[0]
    raw_humidity = {"date": raw_row["dteday"], "hum_raw": float(raw_row["hum"]), "hum_raw_pct": 0.0,
                    "temp_c": r(raw_row["temp"] * 41, 1), "wind_kmh": r(raw_row["windspeed"] * 67, 1),
                    "weathersit": int(raw_row["weathersit"]), "cnt": int(raw_row["cnt"]),
                    "hum_fixed_pct": r(fixed["hum_pct"], 1)}
    marked = set(event_dates)
    series = [{"date": row["date"].strftime("%Y-%m-%d"), "cnt": int(row["cnt"]),
               "marked": int(row["cnt"]) if row["date"].strftime("%Y-%m-%d") in marked else None}
              for _, row in d.iterrows()]
    return {"definition": "An outlier is an observation that lies far away from the rest of the data, so far that it looks "
                          "like it was produced by a different mechanism.",
            "causes": causes, "events": events, "raw_humidity": raw_humidity, "series": series}


# ----------------------------------------------------------------------------- 5.3
def section_53(d: pd.DataFrame, raw: pd.DataFrame) -> dict:
    """5.3 Outlier detection using statistics: z-score rule |z| > 3 and the 1.5 x IQR fences."""
    out = {}
    # --- z-score on cnt
    cnt = d["cnt"].values.astype(float)
    z, mu, sd = zscore(cnt)
    order = np.argsort(-np.abs(z), kind="stable")[:5]
    out["z_cnt"] = {"n": int(len(cnt)), "mean": r(mu, 2), "sd": r(sd, 2), "lo": r(mu - 3 * sd, 1), "hi": r(mu + 3 * sd, 1),
                    "n_flagged": int((np.abs(z) > 3).sum()),
                    "top": [dict(day_row(d, int(i)), x=int(cnt[i]), dev=r(cnt[i] - mu, 1), z=r(z[i], 3)) for i in order]}
    # --- z-score on wind_kmh
    w = d["wind_kmh"].values.astype(float)
    zw, muw, sdw = zscore(w)
    orderw = np.argsort(-np.abs(zw), kind="stable")[:5]
    out["z_wind"] = {"n": int(len(w)), "mean": r(muw, 2), "sd": r(sdw, 2), "hi": r(muw + 3 * sdw, 1),
                     "n_flagged": int((np.abs(zw) > 3).sum()),
                     "top": [dict(day_row(d, int(i)), x=r(w[i], 1), dev=r(w[i] - muw, 2), z=r(zw[i], 3), flagged=bool(abs(zw[i]) > 3)) for i in orderw]}
    # --- z-score on the RAW humidity (before the Unit-1 fix)
    h = raw["hum"].values.astype(float) * 100
    zh, muh, sdh = zscore(h)
    orderh = np.argsort(-np.abs(zh), kind="stable")[:5]
    out["z_hum_raw"] = {"n": int(len(h)), "mean": r(muh, 2), "sd": r(sdh, 2), "lo": r(muh - 3 * sdh, 1),
                        "n_flagged": int((np.abs(zh) > 3).sum()),
                        "top": [{"date": raw.loc[i, "dteday"], "x": r(h[i], 1), "dev": r(h[i] - muh, 2), "z": r(zh[i], 3),
                                 "flagged": bool(abs(zh[i]) > 3), "cause": event_of(raw.loc[i, "dteday"])[0]} for i in orderh]}
    # --- IQR fences on cnt
    q1, q3 = np.percentile(cnt, [25, 75])
    iqr = q3 - q1
    lo_f, hi_f = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    out["iqr_cnt"] = {"q1": r(q1, 1), "q3": r(q3, 1), "iqr": r(iqr, 1), "lower_fence": r(lo_f, 1), "upper_fence": r(hi_f, 1),
                      "min": int(cnt.min()), "max": int(cnt.max()),
                      "n_below": int((cnt < lo_f).sum()), "n_above": int((cnt > hi_f).sum()), "n_flagged": int(((cnt < lo_f) | (cnt > hi_f)).sum())}
    out["hist_cnt"] = hist(cnt, bins=18, rng=(0, 9000))
    return out


# ----------------------------------------------------------------------------- 5.4
def section_54(d: pd.DataFrame, X: np.ndarray, D: np.ndarray, std: dict, sandy: int) -> dict:
    """5.4 Distance-based method: k-NN distance with k = 5 and Manhattan distance on standardised (temp_c, cnt)."""
    score, nn = knn_distance(D, K_KNN)
    order = np.argsort(-score, kind="stable")
    rank = np.empty(len(score), dtype=int)
    rank[order] = np.arange(1, len(score) + 1)
    top = [dict(day_row(d, int(i)), zt=r(X[i, 0], 3), zc=r(X[i, 1], 3), score=r(score[i], 3), rank=int(rank[i])) for i in order[:10]]
    # the worked example: Sandy's 5 nearest neighbours, every column of the distance
    worked = []
    for j in nn[sandy]:
        worked.append({"date": d.iloc[j]["date"].strftime("%Y-%m-%d"), "cnt": int(d.iloc[j]["cnt"]), "temp_c": r(d.iloc[j]["temp_c"], 1),
                       "zt": r(X[j, 0], 3), "zc": r(X[j, 1], 3),
                       "dx": r(abs(X[sandy, 0] - X[j, 0]), 3), "dy": r(abs(X[sandy, 1] - X[j, 1]), 3), "dist": r(D[sandy, j], 3)})
    pts = [{"x": r(d.iloc[i]["temp_c"], 1), "y": int(d.iloc[i]["cnt"]), "date": d.iloc[i]["date"].strftime("%Y-%m-%d"),
            "score": r(score[i], 3), "group": "Top-10 by k-NN distance" if rank[i] <= 10 else "Other days"} for i in range(len(d))]
    # class check: k-distance of a, b, c, d with k = 2 is the same score
    P = np.array([[0, 0], [0, 1], [1, 1], [3, 0]], dtype=float)
    s_toy, nn_toy = knn_distance(manhattan_matrix(P), 2)
    toy = [{"point": p, "x": int(P[i, 0]), "y": int(P[i, 1]), "neighbours": ", ".join("abcd"[j] for j in nn_toy[i]), "score": r(s_toy[i], 2),
            "slide": [2, 1, 2, 3][i]} for i, p in enumerate("abcd")]
    return {"k": K_KNN, "standardise": std, "top": top, "sandy": {"rank": int(rank[sandy]), "score": r(score[sandy], 3), "worked": worked},
            "points": pts, "toy": toy,
            "score_mean": r(score.mean(), 3), "score_median": r(float(np.median(score)), 3)}


# ----------------------------------------------------------------------------- 5.5
def section_55(d: pd.DataFrame, X: np.ndarray, D: np.ndarray, sandy: int) -> dict:
    """5.5 Density-based method: LOF. Class example reproduced step by step, then LOF (k = 20) on the real data."""
    # ---- class example a(0,0) b(0,1) c(1,1) d(3,0), k = 2, Manhattan
    names = list("abcd")
    P = np.array([[0, 0], [0, 1], [1, 1], [3, 0]], dtype=float)
    Dt = manhattan_matrix(P)
    t = lof(Dt, 2)
    toy = {
        "points": [{"point": p, "x": int(P[i, 0]), "y": int(P[i, 1])} for i, p in enumerate(names)],
        "distance_matrix": [{"point": p, **{q: int(Dt[i, j]) for j, q in enumerate(names)}} for i, p in enumerate(names)],
        "distance_examples": [
            {"pair": "dist(a, b)", "calc": "|0 − 0| + |0 − 1|", "value": int(Dt[0, 1])},
            {"pair": "dist(b, d)", "calc": "|0 − 3| + |1 − 0|", "value": int(Dt[1, 3])},
            {"pair": "dist(c, d)", "calc": "|1 − 3| + |1 − 0|", "value": int(Dt[2, 3])},
        ],
        "kdist": [{"point": p,
                   "distances": ", ".join(f"{names[j]}({int(Dt[i, j])})" for j in range(4) if j != i),
                   "sorted": ", ".join(f"{names[j]}({int(Dt[i, j])})" for j in np.argsort(np.where(np.arange(4) == i, np.inf, Dt[i]), kind="stable")[:3]),
                   "N2": "{" + ", ".join(names[j] for j in t["nn"][i]) + "}", "kdist": int(t["kdist"][i])} for i, p in enumerate(names)],
        "reach": [{"p": p, "o": names[o], "kdist_o": int(t["kdist"][o]), "dist_po": int(t["dist_po"][i, m]), "reach": int(t["reach"][i, m])}
                  for i, p in enumerate(names) for m, o in enumerate(t["nn"][i])],
        "lrd": [{"point": p, "sum_reach": " + ".join(str(int(v)) for v in t["reach"][i]) + f" = {int(t['reach'][i].sum())}",
                 "lrd_calc": f"2 / {int(t['reach'][i].sum())}", "lrd": r(t["lrd"][i], 3)} for i, p in enumerate(names)],
        "lof": [{"point": p, "N2": "{" + ", ".join(names[j] for j in t["nn"][i]) + "}", "lrd": r(t["lrd"][i], 3),
                 "avg_lrd": r(t["avg_lrd_nn"][i], 3), "lof": r(round(float(t["lof"][i]), 6), 2), "lof_exact": r(t["lof"][i], 4),
                 "slide_lof": [0.88, 1.33, 0.88, 2.00][i], "slide_lrd": [0.667, 0.5, 0.667, 0.333][i],
                 "result": "Outlier" if t["lof"][i] > 1.5 else "Normal"} for i, p in enumerate(names)],
    }
    # ---- real data
    res = lof(D, K_LOF)
    L = res["lof"]
    order = np.argsort(-L, kind="stable")
    rank = np.empty(len(L), dtype=int)
    rank[order] = np.arange(1, len(L) + 1)
    top = [dict(day_row(d, int(i)), kdist=r(res["kdist"][i], 3), lrd=r(res["lrd"][i], 3), avg_lrd=r(res["avg_lrd_nn"][i], 3),
                lof=r(L[i], 3), rank=int(rank[i])) for i in order[:10]]
    s = sandy
    sandy_worked = {"kdist": r(res["kdist"][s], 3), "sum_reach": r(res["reach"][s].sum(), 3), "lrd": r(res["lrd"][s], 3),
                    "avg_lrd": r(res["avg_lrd_nn"][s], 3), "lof": r(L[s], 3), "rank": int(rank[s]),
                    "neighbour_lrd_min": r(res["lrd"][res["nn"][s]].min(), 3), "neighbour_lrd_max": r(res["lrd"][res["nn"][s]].max(), 3)}
    pts = [{"x": r(d.iloc[i]["temp_c"], 1), "y": int(d.iloc[i]["cnt"]), "date": d.iloc[i]["date"].strftime("%Y-%m-%d"), "lof": r(L[i], 3),
            "label": f"{d.iloc[i]['date'].strftime('%Y-%m-%d')} · LOF {L[i]:.2f}"} for i in range(len(d))]
    # sklearn cross-check (same metric, same k) - reported as a one-line note
    try:
        from sklearn.neighbors import LocalOutlierFactor
        sk = -LocalOutlierFactor(n_neighbors=K_LOF, metric="manhattan").fit(X).negative_outlier_factor_
        sk_diff = r(float(np.abs(sk - L).max()), 8)
    except Exception:
        sk_diff = None
    return {"k": K_LOF, "toy": toy, "top": top, "sandy": sandy_worked, "points": pts,
            "n_ge_2": int((L >= 2).sum()), "n_ge_1_5": int((L >= 1.5).sum()), "n_lt_1": int((L < 1).sum()),
            "lof_median": r(float(np.median(L)), 3), "lof_max": r(float(L.max()), 3), "lof_min": r(float(L.min()), 3),
            "sklearn_max_abs_diff": sk_diff}


# ----------------------------------------------------------------------------- 5.6
def section_56(d: pd.DataFrame) -> dict:
    """5.6 SMOTE: the high-demand label, the imbalance, SMOTE, logistic regression with / without SMOTE."""
    from imblearn.over_sampling import SMOTE
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import average_precision_score, confusion_matrix
    from sklearn.preprocessing import StandardScaler

    feats = ["temp_c", "hum_pct", "wind_kmh", "workingday", "yr"]
    tr, te = train_test(d)
    Xtr, ytr = tr[feats].values.astype(float), tr["high_demand"].values.astype(int)
    Xte, yte = te[feats].values.astype(float), te["high_demand"].values.astype(int)
    n0, n1 = int((ytr == 0).sum()), int((ytr == 1).sum())
    counts = {"train": {"majority": n0, "minority": n1, "ratio": r(n0 / n1, 1), "minority_share": r(n1 / len(ytr), 4), "n": int(len(ytr))},
              "test": {"majority": int((yte == 0).sum()), "minority": int((yte == 1).sum()), "n": int(len(yte))},
              "all": {"majority": int((d["high_demand"] == 0).sum()), "minority": int((d["high_demand"] == 1).sum())}}

    # --- SMOTE as taught, written out: 5 example synthetic rows with parent, neighbour and lambda
    rng = np.random.default_rng(SEED)
    minority = tr[tr["high_demand"] == 1].reset_index(drop=True)
    M = minority[feats].values.astype(float)
    Dm = np.sqrt(((M[:, None, :] - M[None, :, :]) ** 2).sum(-1))   # Euclidean, like imblearn's NearestNeighbors
    np.fill_diagonal(Dm, np.inf)
    nn_min = np.argsort(Dm, axis=1, kind="stable")[:, :K_SMOTE]
    examples = []
    for _ in range(5):
        i = int(rng.integers(len(M)))
        zi = int(nn_min[i][rng.integers(K_SMOTE)])
        lam = float(rng.random())
        new = M[i] + lam * (M[zi] - M[i])
        examples.append({"parent_date": minority.loc[i, "date"].strftime("%Y-%m-%d"), "parent": [r(v, 2) for v in M[i]],
                         "neighbour_date": minority.loc[zi, "date"].strftime("%Y-%m-%d"), "neighbour": [r(v, 2) for v in M[zi]],
                         "lam": r(lam, 3), "diff": [r(v, 2) for v in (M[zi] - M[i])], "new": [r(v, 2) for v in new]})

    # --- the actual resampling (imblearn, same algorithm, seeded)
    sm = SMOTE(k_neighbors=K_SMOTE, random_state=SEED)
    Xs, ys = sm.fit_resample(Xtr, ytr)
    after = {"majority": int((ys == 0).sum()), "minority": int((ys == 1).sum()), "synthetic": int((ys == 1).sum() - n1), "n": int(len(ys))}
    synthetic = Xs[len(Xtr):]

    scatter = (
        [{"x": r(v[0], 2), "y": r(v[1], 2), "group": "Real: normal day"} for v in Xtr[ytr == 0]]
        + [{"x": r(v[0], 2), "y": r(v[1], 2), "group": "Synthetic high-demand (SMOTE)"} for v in synthetic]
        + [{"x": r(v[0], 2), "y": r(v[1], 2), "group": "Real: high-demand day"} for v in Xtr[ytr == 1]]
    )

    # --- logistic regression, inputs standardised with the training mean / sd (different units)
    def fit_eval(X, y):
        sc = StandardScaler().fit(X)
        m = LogisticRegression(max_iter=5000, random_state=SEED).fit(sc.transform(X), y)
        pred = m.predict(sc.transform(Xte))
        prob = m.predict_proba(sc.transform(Xte))[:, 1]
        tn, fp, fn, tp = (int(v) for v in confusion_matrix(yte, pred, labels=[0, 1]).ravel())
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        return {"tn": tn, "fp": fp, "fn": fn, "tp": tp, "predicted_positive": tp + fp,
                "accuracy": r((tp + tn) / len(yte), 4), "precision": r(precision, 4), "recall": r(recall, 4), "f1": r(f1, 4),
                "auc_pr": r(float(average_precision_score(yte, prob)), 4),
                "coef": {f: r(c, 4) for f, c in zip(feats, m.coef_[0])}, "intercept": r(float(m.intercept_[0]), 4)}

    without = fit_eval(Xtr, ytr)
    with_sm = fit_eval(Xs, ys)
    return {"threshold": HIGH_DEMAND, "features": feats, "k": K_SMOTE, "seed": SEED, "counts": counts, "examples": examples, "after": after,
            "scatter": scatter, "without": without, "with": with_sm,
            "majority_only_accuracy": r(counts["test"]["majority"] / counts["test"]["n"], 4)}


# ----------------------------------------------------------------------------- main
def main() -> None:
    d = load_daily().sort_values("date").reset_index(drop=True)
    raw = load_raw()
    sandy = int(d.index[d["date"] == "2012-10-29"][0])

    # 5.3 z on cnt is also needed by 5.1 (the z of each known event)
    z_cnt, _, _ = zscore(d["cnt"].values.astype(float))

    # standardised 2-D view for 5.4 and 5.5: z-scores of temp_c and cnt (different units, same weight)
    zt, mut, sdt = zscore(d["temp_c"].values.astype(float))
    zc, muc, sdc = zscore(d["cnt"].values.astype(float))
    X = np.column_stack([zt, zc])
    D = manhattan_matrix(X)
    std = {"temp_mean": r(mut, 2), "temp_sd": r(sdt, 2), "cnt_mean": r(muc, 2), "cnt_sd": r(sdc, 2),
           "sandy": {"temp_c": r(d.loc[sandy, "temp_c"], 2), "cnt": int(d.loc[sandy, "cnt"]), "zt": r(zt[sandy], 3), "zc": r(zc[sandy], 3)}}

    s51 = section_51(d, raw, z_cnt)
    s53 = section_53(d, raw)
    s54 = section_54(d, X, D, std, sandy)
    s55 = section_55(d, X, D, sandy)
    s56 = section_56(d)

    # 5.2 comparison table, filled from the results above
    s52 = {
        "families": [
            {"family": "Statistical (distribution-based)", "idea": "Assume a distribution for one variable and flag values too far from its centre.",
             "far": "|z| > 3, or outside Q₁ − 1.5·IQR and Q₃ + 1.5·IQR", "threshold": "Yes, fixed in advance (3σ or 1.5·IQR)",
             "variables": "One at a time", "finds_sandy": False, "sandy_note": f"z = {r(z_cnt[sandy], 2)}, inside ±3"},
            {"family": "Distance-based (k-NN distance)", "idea": "A point is an outlier if its nearest neighbours are far away.",
             "far": f"Distance to the {K_KNN}th nearest neighbour (Manhattan)", "threshold": "No fixed rule: rank by score, look at the top",
             "variables": "Several together", "finds_sandy": True, "sandy_note": f"rank {s54['sandy']['rank']} of {len(d)}"},
            {"family": "Density-based (LOF)", "idea": "A point is an outlier if its neighbourhood is much sparser than its neighbours' neighbourhoods.",
             "far": "LOF = average lrd of neighbours ÷ own lrd", "threshold": "No fixed rule: LOF ≈ 1 normal, LOF ≫ 1 outlier",
             "variables": "Several together", "finds_sandy": True, "sandy_note": f"LOF = {s55['sandy']['lof']}, rank {s55['sandy']['rank']} of {len(d)}"},
        ],
        "flagged": {"z_cnt": s53["z_cnt"]["n_flagged"], "iqr_cnt": s53["iqr_cnt"]["n_flagged"], "z_wind": s53["z_wind"]["n_flagged"],
                    "z_hum_raw": s53["z_hum_raw"]["n_flagged"], "knn_top": 10, "lof_ge_2": s55["n_ge_2"]},
    }

    headline = {
        "n_days": int(len(d)),
        "flagged_z_cnt": s53["z_cnt"]["n_flagged"], "flagged_iqr_cnt": s53["iqr_cnt"]["n_flagged"],
        "flagged_z_wind": s53["z_wind"]["n_flagged"], "flagged_z_hum_raw": s53["z_hum_raw"]["n_flagged"],
        "sandy_z": s53["z_cnt"]["top"][0]["z"] if s53["z_cnt"]["top"][0]["date"] == "2012-10-29" else r(z_cnt[sandy], 3),
        "sandy_knn_rank": s54["sandy"]["rank"], "sandy_knn_score": s54["sandy"]["score"],
        "sandy_lof": s55["sandy"]["lof"], "sandy_lof_rank": s55["sandy"]["rank"],
        "knn_top1": s54["top"][0]["date"], "lof_top1": s55["top"][0]["date"], "lof_top1_value": s55["top"][0]["lof"],
        "lof_ge_2": s55["n_ge_2"],
        "train_majority": s56["counts"]["train"]["majority"], "train_minority": s56["counts"]["train"]["minority"],
        "after_majority": s56["after"]["majority"], "after_minority": s56["after"]["minority"],
        "recall_without": s56["without"]["recall"], "recall_with": s56["with"]["recall"],
        "precision_without": s56["without"]["precision"], "precision_with": s56["with"]["precision"],
        "f1_without": s56["without"]["f1"], "f1_with": s56["with"]["f1"],
        "fp_without": s56["without"]["fp"], "fp_with": s56["with"]["fp"],
    }

    save("unit5", {"meta": {"n_days": int(len(d)), "start": d["date"].min().strftime("%Y-%m-%d"), "end": d["date"].max().strftime("%Y-%m-%d"),
                            "sandy_date": "2012-10-29", "seed": SEED},
                   "s51": s51, "s52": s52, "s53": s53, "s54": s54, "s55": s55, "s56": s56, "headline": headline})
    print("Unit 5 headline:", headline)


if __name__ == "__main__":
    main()
