"""Module 8 - Anomaly detection and class imbalance.

Statistical (z-score, modified z-score, IQR), distance-based (Mahalanobis,
k-NN), density-based (LOF) and Isolation Forest on daily data; then a
supervised "severe pollution day" classifier with and without SMOTE.
Output: web/public/data/anomaly.json
"""
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from scipy import stats
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, confusion_matrix, f1_score, precision_recall_curve, precision_score,
                             recall_score, roc_auc_score, roc_curve)
from sklearn.neighbors import LocalOutlierFactor, NearestNeighbors
from sklearn.preprocessing import StandardScaler

from common import AQI_LABELS, hist, load_clean, load_daily, r, save

print("08_anomaly")
daily = load_daily().copy()
hourly = load_clean()
rng = np.random.default_rng(5)
daily["date_s"] = daily["date"].dt.strftime("%Y-%m-%d")
x = daily["pm25"].values.astype(float)
n = len(x)

# ------------------------------------------------------------- Statistical methods
mu, sd = x.mean(), x.std(ddof=1)
z = (x - mu) / sd
med = np.median(x); mad = np.median(np.abs(x - med))
mod_z = 0.6745 * (x - med) / mad
q1, q3 = np.percentile(x, [25, 75]); iqr = q3 - q1
lo_f, hi_f = q1 - 1.5 * iqr, q3 + 1.5 * iqr
lo_f3, hi_f3 = q1 - 3 * iqr, q3 + 3 * iqr
flag_z = np.abs(z) > 3
flag_modz = np.abs(mod_z) > 3.5
flag_iqr = (x < lo_f) | (x > hi_f)
flag_iqr3 = (x < lo_f3) | (x > hi_f3)
statistical = {
    "mu": r(mu, 2), "sd": r(sd, 2), "median": r(med, 2), "mad": r(mad, 2), "q1": r(q1, 2), "q3": r(q3, 2), "iqr": r(iqr, 2),
    "z_threshold": 3, "z_cut_value": r(mu + 3 * sd, 1), "modz_threshold": 3.5, "modz_cut_value": r(med + 3.5 * mad / 0.6745, 1),
    "iqr_fences": [r(lo_f, 1), r(hi_f, 1)], "iqr_fences_extreme": [r(lo_f3, 1), r(hi_f3, 1)],
    "counts": {"z": int(flag_z.sum()), "modz": int(flag_modz.sum()), "iqr": int(flag_iqr.sum()), "iqr_extreme": int(flag_iqr3.sum())},
    "z_hist": hist(z, 40),
}

# ------------------------------------------------------------- Multivariate: Mahalanobis, kNN, LOF, Isolation Forest
feats = ["pm25", "DEWP", "TEMP", "PRES", "Iws"]
M = daily[feats].values.astype(float)
Ms = StandardScaler().fit_transform(M)
cov = np.cov(Ms, rowvar=False); inv = np.linalg.inv(cov)
diff = Ms - Ms.mean(axis=0)
maha = np.sqrt(np.einsum("ij,jk,ik->i", diff, inv, diff))
maha_cut = np.sqrt(stats.chi2.ppf(0.975, df=len(feats)))
flag_maha = maha > maha_cut

K = 10
nn = NearestNeighbors(n_neighbors=K + 1).fit(Ms)
dists, _ = nn.kneighbors(Ms)
knn_score = dists[:, 1:].mean(axis=1)
knn_cut = np.percentile(knn_score, 97.5)
flag_knn = knn_score > knn_cut

lof = LocalOutlierFactor(n_neighbors=20, contamination=0.025)
lof_pred = lof.fit_predict(Ms)
lof_score = -lof.negative_outlier_factor_
flag_lof = lof_pred == -1

iso = IsolationForest(n_estimators=300, contamination=0.025, random_state=0).fit(Ms)
iso_score = -iso.score_samples(Ms)
flag_iso = iso.predict(Ms) == -1

methods = {"z": flag_z, "modz": flag_modz, "iqr": flag_iqr, "maha": flag_maha, "knn": flag_knn, "lof": flag_lof, "iso": flag_iso}
method_meta = [
    {"key": "z", "name": "Z-score", "family": "Statistical", "rule": "|z| > 3", "count": int(flag_z.sum())},
    {"key": "modz", "name": "Modified z (MAD)", "family": "Statistical", "rule": "|0.6745 (x − median) / MAD| > 3.5", "count": int(flag_modz.sum())},
    {"key": "iqr", "name": "IQR fence", "family": "Statistical", "rule": "x < Q1 − 1.5·IQR or x > Q3 + 1.5·IQR", "count": int(flag_iqr.sum())},
    {"key": "maha", "name": "Mahalanobis distance", "family": "Distance", "rule": f"D > √χ²₀.₉₇₅(5) = {maha_cut:.2f}", "count": int(flag_maha.sum())},
    {"key": "knn", "name": "k-NN distance (k=10)", "family": "Distance", "rule": "mean distance to 10 neighbours above 97.5th pct", "count": int(flag_knn.sum())},
    {"key": "lof", "name": "Local Outlier Factor", "family": "Density", "rule": "LOF score in the top 2.5%", "count": int(flag_lof.sum())},
    {"key": "iso", "name": "Isolation Forest", "family": "Ensemble", "rule": "shortest average path length, top 2.5%", "count": int(flag_iso.sum())},
]
keys = list(methods)
overlap = [{"a": a, "b": b, "jaccard": r((methods[a] & methods[b]).sum() / max((methods[a] | methods[b]).sum(), 1), 3)} for a in keys for b in keys]
agree = sum(methods[k].astype(int) for k in keys)

series = [{"date": d, "pm25": r(v, 1), "z": r(zz, 2), "maha": r(m_, 2), "lof": r(l_, 3), "agree": int(a_),
           **{f"f_{k}": bool(methods[k][i]) for k in keys}}
          for i, (d, v, zz, m_, l_, a_) in enumerate(zip(daily["date_s"], x, z, maha, lof_score, agree))]

top = daily.assign(z=z, maha=maha, lof=lof_score, knn=knn_score, iso=iso_score, agree=agree).sort_values("maha", ascending=False).head(15)
top_rows = [{"date": rw["date_s"], "pm25": r(rw["pm25"], 1), "pm25_max": r(rw["pm25_max"], 0), "DEWP": r(rw["DEWP"], 1), "TEMP": r(rw["TEMP"], 1), "PRES": r(rw["PRES"], 1),
             "Iws": r(rw["Iws"], 1), "wind": rw["wind_mode"], "z": r(rw["z"], 2), "maha": r(rw["maha"], 2), "lof": r(rw["lof"], 2), "agree": int(rw["agree"])} for _, rw in top.iterrows()]

# Distance explorer: 2-D projection pm25 vs Iws with LOF/Mahalanobis flags
idx = np.union1d(rng.choice(n, 500, replace=False), np.where(flag_maha | flag_lof)[0])
explorer = [{"x": r(daily["Iws"].iloc[i], 2), "y": r(x[i], 1), "maha": bool(flag_maha[i]), "lof": bool(flag_lof[i]), "z": bool(flag_z[i]), "date": daily["date_s"].iloc[i]} for i in idx]
# Density: LOF score & Mahalanobis distributions
density = {"lof_hist": hist(lof_score, 40), "maha_hist": hist(maha, 40), "maha_cut": r(maha_cut, 3), "knn_hist": hist(knn_score, 40), "knn_cut": r(knn_cut, 3),
           "lof_cut": r(np.percentile(lof_score, 97.5), 3)}

# Known episode check: the January 2013 "airpocalypse"
jan13 = daily[(daily["date"] >= "2013-01-10") & (daily["date"] <= "2013-01-16")]
episode = [{"date": rw["date_s"], "pm25": r(rw["pm25"], 1), "pm25_max": r(rw["pm25_max"], 0), "flags": int(agree[i])} for i, rw in zip(jan13.index, jan13.to_dict("records"))]

# ------------------------------------------------------------- Class imbalance + SMOTE
THRESH = 200
daily["severe"] = (daily["pm25"] > THRESH).astype(int)
wind_d = pd.get_dummies(daily["wind_mode"], prefix="w").astype(float)
Xc = pd.concat([daily[["DEWP", "TEMP", "PRES", "Iws", "rain_hours"]].astype(float), wind_d,
                pd.DataFrame({"m_sin": np.sin(2 * np.pi * daily["month"] / 12), "m_cos": np.cos(2 * np.pi * daily["month"] / 12)})], axis=1)
yc = daily["severe"].values
tr = (daily["year"] <= 2013).values; te = ~tr
sc = StandardScaler().fit(Xc[tr]); Xtr, Xte = sc.transform(Xc[tr]), sc.transform(Xc[te]); ytr, yte = yc[tr], yc[te]

sm = SMOTE(random_state=0, k_neighbors=5)
Xtr_sm, ytr_sm = sm.fit_resample(Xtr, ytr)


def evaluate(clf, Xa, ya, name, strategy):
    clf.fit(Xa, ya)
    prob = clf.predict_proba(Xte)[:, 1]; pred = (prob >= 0.5).astype(int)
    cm = confusion_matrix(yte, pred, labels=[0, 1])
    fpr, tpr, _ = roc_curve(yte, prob); prec, rec, _ = precision_recall_curve(yte, prob)
    step = max(1, len(fpr) // 60)
    return {"model": name, "strategy": strategy, "train_pos": int(ya.sum()), "train_neg": int(len(ya) - ya.sum()),
            "tn": int(cm[0, 0]), "fp": int(cm[0, 1]), "fn": int(cm[1, 0]), "tp": int(cm[1, 1]),
            "accuracy": r((cm[0, 0] + cm[1, 1]) / cm.sum(), 4), "precision": r(precision_score(yte, pred, zero_division=0), 4),
            "recall": r(recall_score(yte, pred), 4), "f1": r(f1_score(yte, pred), 4), "specificity": r(cm[0, 0] / max(cm[0].sum(), 1), 4),
            "roc_auc": r(roc_auc_score(yte, prob), 4), "pr_auc": r(average_precision_score(yte, prob), 4),
            "roc": [{"fpr": r(a, 3), "tpr": r(b, 3)} for a, b in zip(fpr[::step], tpr[::step])],
            "pr": [{"recall": r(a, 3), "precision": r(b, 3)} for a, b in zip(rec[::step], prec[::step])]}


results = [
    evaluate(LogisticRegression(max_iter=2000), Xtr, ytr, "Logistic regression", "No resampling"),
    evaluate(LogisticRegression(max_iter=2000), Xtr_sm, ytr_sm, "Logistic regression", "SMOTE"),
    evaluate(LogisticRegression(max_iter=2000, class_weight="balanced"), Xtr, ytr, "Logistic regression", "Class weights"),
    evaluate(RandomForestClassifier(n_estimators=300, max_depth=8, random_state=0, n_jobs=-1), Xtr, ytr, "Random forest", "No resampling"),
    evaluate(RandomForestClassifier(n_estimators=300, max_depth=8, random_state=0, n_jobs=-1), Xtr_sm, ytr_sm, "Random forest", "SMOTE"),
]
# Baseline: always predict the majority class
cm0 = confusion_matrix(yte, np.zeros_like(yte), labels=[0, 1])
baseline = {"accuracy": r(cm0[0, 0] / cm0.sum(), 4), "recall": 0.0, "precision": 0.0, "f1": 0.0, "tn": int(cm0[0, 0]), "fp": 0, "fn": int(cm0[1, 0]), "tp": 0}

# 2-D picture of what SMOTE does (DEWP vs Iws, standardized) - minority before/after
pos_before = Xtr[ytr == 1][:, :2]; pos_after = Xtr_sm[ytr_sm == 1][:, :2]; neg = Xtr[ytr == 0][:, :2]
neg_idx = rng.choice(len(neg), 400, replace=False)
synthetic_idx = rng.choice(np.arange(len(pos_before), len(pos_after)), min(300, len(pos_after) - len(pos_before)), replace=False)
smote_viz = {"neg": [{"x": r(a, 2), "y": r(b, 2)} for a, b in neg[neg_idx]], "pos": [{"x": r(a, 2), "y": r(b, 2)} for a, b in pos_before],
             "synthetic": [{"x": r(a, 2), "y": r(b, 2)} for a, b in pos_after[synthetic_idx]], "axes": ["DEWP (std)", "TEMP (std)"]}

imbalance = {
    "threshold": THRESH, "target": f"severe day: daily mean PM2.5 > {THRESH} µg/m³",
    "features": list(Xc.columns),
    "overall": {"pos": int(yc.sum()), "neg": int(len(yc) - yc.sum()), "ratio": r((len(yc) - yc.sum()) / yc.sum(), 2), "pos_pct": r(100 * yc.mean(), 2)},
    "train": {"pos": int(ytr.sum()), "neg": int(len(ytr) - ytr.sum())}, "train_smote": {"pos": int(ytr_sm.sum()), "neg": int(len(ytr_sm) - ytr_sm.sum())},
    "test": {"pos": int(yte.sum()), "neg": int(len(yte) - yte.sum()), "n": int(len(yte))},
    "aqi_hourly": [{"key": k, "count": int(v), "pct": r(100 * v / len(hourly), 2)} for k, v in hourly["aqi_category"].value_counts().reindex(AQI_LABELS).fillna(0).items()],
    "results": results, "baseline": baseline, "smote_viz": smote_viz,
}

save("anomaly", {"n_days": n, "statistical": statistical, "methods": method_meta, "overlap": overlap, "series": series, "top": top_rows,
                 "explorer": explorer, "density": density, "episode": episode, "imbalance": imbalance,
                 "agreement_counts": [{"agree": int(k), "days": int(v)} for k, v in pd.Series(agree).value_counts().sort_index().items()]})
