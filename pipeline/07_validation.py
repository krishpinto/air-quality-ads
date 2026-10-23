"""Module 7 - Model validation.

Hold-out (random and chronological), K-fold, stratified K-fold for a
classifier, leave-one-out, bootstrap confidence intervals, learning curve
and a cost/variance comparison of the schemes.
Output: web/public/data/validation.json
"""
import time

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (accuracy_score, f1_score, mean_absolute_error, mean_squared_error, precision_score, r2_score,
                             recall_score)
from sklearn.model_selection import KFold, LeaveOneOut, StratifiedKFold, cross_val_predict, train_test_split
from sklearn.preprocessing import StandardScaler

from common import hist, load_clean, load_daily, r, save

print("07_validation")
df = load_clean().copy()
daily = load_daily().copy()
rng = np.random.default_rng(11)

wind = pd.get_dummies(df["cbwd"], prefix="wind").astype(float).drop(columns=["wind_NW"])
X = pd.concat([df[["DEWP", "TEMP", "PRES", "Iws", "Ir", "Is"]].astype(float), wind], axis=1)
y = df["pm25"].astype(float).values
feature_names = list(X.columns)
Xv = X.values


def reg_metrics(yt, yp):
    return {"r2": r(r2_score(yt, yp), 4), "mae": r(mean_absolute_error(yt, yp), 3), "rmse": r(np.sqrt(mean_squared_error(yt, yp)), 3)}


def make(model):
    return LinearRegression() if model == "lr" else RandomForestRegressor(n_estimators=120, max_depth=14, min_samples_leaf=5, n_jobs=-1, random_state=0)


# ------------------------------------------------------------- Hold-out
holdout = []
Xtr, Xte, ytr, yte = train_test_split(Xv, y, test_size=0.2, random_state=42)
chron_tr = (df["year"] <= 2013).values; chron_te = ~chron_tr
for model in ["lr", "rf"]:
    m = make(model).fit(Xtr, ytr)
    holdout.append({"model": "Linear regression" if model == "lr" else "Random forest", "split": "Random 80/20", "n_train": len(ytr), "n_test": len(yte),
                    "train": reg_metrics(ytr, m.predict(Xtr)), "test": reg_metrics(yte, m.predict(Xte))})
    m = make(model).fit(Xv[chron_tr], y[chron_tr])
    holdout.append({"model": "Linear regression" if model == "lr" else "Random forest", "split": "Chronological (train 2010-13, test 2014)",
                    "n_train": int(chron_tr.sum()), "n_test": int(chron_te.sum()),
                    "train": reg_metrics(y[chron_tr], m.predict(Xv[chron_tr])), "test": reg_metrics(y[chron_te], m.predict(Xv[chron_te]))})

# Variance of a single random hold-out: repeat 30 times with different seeds
rep = []
for seed in range(30):
    a, b, c, d = train_test_split(Xv, y, test_size=0.2, random_state=seed)
    rep.append(r2_score(d, LinearRegression().fit(a, c).predict(b)))
holdout_variability = {"r2_values": [r(v, 4) for v in rep], "mean": r(np.mean(rep), 4), "std": r(np.std(rep, ddof=1), 5), "min": r(min(rep), 4), "max": r(max(rep), 4)}

# ------------------------------------------------------------- K-fold
kfold = {}
for k in [5, 10]:
    folds = []
    kf = KFold(n_splits=k, shuffle=True, random_state=1)
    for i, (tr, te) in enumerate(kf.split(Xv)):
        m = LinearRegression().fit(Xv[tr], y[tr])
        folds.append({"fold": i + 1, "n_train": len(tr), "n_test": len(te), **reg_metrics(y[te], m.predict(Xv[te]))})
    kfold[f"lr_k{k}"] = {"model": "Linear regression", "k": k, "folds": folds,
                          "mean_r2": r(np.mean([f["r2"] for f in folds]), 4), "std_r2": r(np.std([f["r2"] for f in folds], ddof=1), 5),
                          "mean_rmse": r(np.mean([f["rmse"] for f in folds]), 3), "std_rmse": r(np.std([f["rmse"] for f in folds], ddof=1), 4)}
folds = []
t0 = time.time()
for i, (tr, te) in enumerate(KFold(n_splits=5, shuffle=True, random_state=1).split(Xv)):
    m = make("rf").fit(Xv[tr], y[tr])
    folds.append({"fold": i + 1, "n_train": len(tr), "n_test": len(te), **reg_metrics(y[te], m.predict(Xv[te]))})
kfold["rf_k5"] = {"model": "Random forest", "k": 5, "folds": folds, "mean_r2": r(np.mean([f["r2"] for f in folds]), 4), "std_r2": r(np.std([f["r2"] for f in folds], ddof=1), 5),
                  "mean_rmse": r(np.mean([f["rmse"] for f in folds]), 3), "std_rmse": r(np.std([f["rmse"] for f in folds], ddof=1), 4), "seconds": r(time.time() - t0, 1)}

# ------------------------------------------------------------- Stratified K-fold (classifier)
yc = df["unhealthy"].values
scaler = StandardScaler().fit(Xv)
Xs = scaler.transform(Xv)
strat = {"positive_rate": r(yc.mean(), 4), "n_pos": int(yc.sum()), "n": int(len(yc)), "folds": [], "plain_folds": []}
for name, splitter in [("folds", StratifiedKFold(n_splits=5, shuffle=True, random_state=1)), ("plain_folds", KFold(n_splits=5, shuffle=True, random_state=1))]:
    for i, (tr, te) in enumerate(splitter.split(Xs, yc)):
        clf = LogisticRegression(max_iter=1000, class_weight="balanced").fit(Xs[tr], yc[tr])
        pred = clf.predict(Xs[te])
        strat[name].append({"fold": i + 1, "pos_rate_train": r(yc[tr].mean(), 4), "pos_rate_test": r(yc[te].mean(), 4),
                            "accuracy": r(accuracy_score(yc[te], pred), 4), "precision": r(precision_score(yc[te], pred), 4),
                            "recall": r(recall_score(yc[te], pred), 4), "f1": r(f1_score(yc[te], pred), 4)})
strat["mean_f1"] = r(np.mean([f["f1"] for f in strat["folds"]]), 4)
strat["mean_recall"] = r(np.mean([f["recall"] for f in strat["folds"]]), 4)

# ------------------------------------------------------------- LOOCV (daily 2014, n=365)
d14 = daily[daily["year"] == 2014].copy()
Xd = d14[["DEWP", "TEMP", "PRES", "Iws", "rain_hours"]].values; yd = d14["pm25"].values
t0 = time.time()
pred_loo = cross_val_predict(LinearRegression(), Xd, yd, cv=LeaveOneOut())
loo_sec = time.time() - t0
loo_err = (yd - pred_loo)
pred_k10 = cross_val_predict(LinearRegression(), Xd, yd, cv=KFold(10, shuffle=True, random_state=1))
loocv = {"n": int(len(yd)), "fits": int(len(yd)), "seconds": r(loo_sec, 2), "mse": r((loo_err ** 2).mean(), 2), "rmse": r(np.sqrt((loo_err ** 2).mean()), 3),
         "mae": r(np.abs(loo_err).mean(), 3), "r2": r(r2_score(yd, pred_loo), 4),
         "k10": {"rmse": r(np.sqrt(((yd - pred_k10) ** 2).mean()), 3), "r2": r(r2_score(yd, pred_k10), 4), "fits": 10},
         "points": [{"actual": r(a, 1), "pred": r(b, 1)} for a, b in zip(yd, pred_loo)],
         "per_obs_sq_err": [r(e, 1) for e in (loo_err ** 2)[:120]]}

# ------------------------------------------------------------- Bootstrap (daily, 1000 resamples)
Xd_all = daily[["DEWP", "TEMP", "PRES", "Iws", "rain_hours"]].values; yd_all = daily["pm25"].values
B = 1000
boot_coef, boot_r2, boot_mean = [], [], []
for _ in range(B):
    idx = rng.integers(0, len(yd_all), len(yd_all))
    m = LinearRegression().fit(Xd_all[idx], yd_all[idx])
    boot_coef.append(m.coef_[0]); boot_r2.append(m.score(Xd_all[idx], yd_all[idx])); boot_mean.append(yd_all[idx].mean())
full_fit = LinearRegression().fit(Xd_all, yd_all)
def pct_ci(a):
    return [r(np.percentile(a, 2.5), 4), r(np.percentile(a, 97.5), 4)]
bootstrap = {"B": B, "n": int(len(yd_all)),
             "dewp_coef": {"estimate": r(full_fit.coef_[0], 4), "boot_mean": r(np.mean(boot_coef), 4), "boot_se": r(np.std(boot_coef, ddof=1), 4), "ci": pct_ci(boot_coef), "hist": hist(boot_coef, 30)},
             "r2": {"estimate": r(full_fit.score(Xd_all, yd_all), 4), "boot_mean": r(np.mean(boot_r2), 4), "boot_se": r(np.std(boot_r2, ddof=1), 4), "ci": pct_ci(boot_r2), "hist": hist(boot_r2, 30)},
             "mean_pm25": {"estimate": r(yd_all.mean(), 3), "boot_se": r(np.std(boot_mean, ddof=1), 4), "ci": pct_ci(boot_mean), "hist": hist(boot_mean, 30),
                           "analytic_se": r(yd_all.std(ddof=1) / np.sqrt(len(yd_all)), 4)}}

# ------------------------------------------------------------- Learning curve
sizes = [300, 1000, 3000, 8000, 15000, 25000, int(chron_tr.sum())]
learning = []
for s in sizes:
    idx = rng.choice(np.where(chron_tr)[0], s, replace=False)
    row = {"n": s}
    for model in ["lr", "rf"]:
        m = make(model).fit(Xv[idx], y[idx])
        row[f"{model}_train"] = r(r2_score(y[idx], m.predict(Xv[idx])), 4)
        row[f"{model}_test"] = r(r2_score(y[chron_te], m.predict(Xv[chron_te])), 4)
    learning.append(row)

comparison = [
    {"method": "Hold-out (random 80/20)", "fits": 1, "test_r2": holdout[0]["test"]["r2"], "variance": holdout_variability["std"], "note": "Fast, but the score depends on which 20% you happened to hold out."},
    {"method": "Hold-out (chronological)", "fits": 1, "test_r2": holdout[1]["test"]["r2"], "variance": None, "note": "The honest split for time-ordered data: no future rows leak into training."},
    {"method": "5-fold CV", "fits": 5, "test_r2": kfold["lr_k5"]["mean_r2"], "variance": kfold["lr_k5"]["std_r2"], "note": "Every row is tested once; the average is far more stable."},
    {"method": "10-fold CV", "fits": 10, "test_r2": kfold["lr_k10"]["mean_r2"], "variance": kfold["lr_k10"]["std_r2"], "note": "Slightly less bias (90% train), slightly more cost."},
    {"method": "LOOCV (daily 2014)", "fits": loocv["fits"], "test_r2": loocv["r2"], "variance": None, "note": "n fits; nearly unbiased but expensive and high-variance."},
    {"method": "Bootstrap (B=1000)", "fits": B, "test_r2": None, "variance": bootstrap["r2"]["boot_se"], "note": "Gives a confidence interval for any statistic, not just a point score."},
]

save("validation", {"features": feature_names, "holdout": holdout, "holdout_variability": holdout_variability, "kfold": kfold, "stratified": strat,
                    "loocv": loocv, "bootstrap": bootstrap, "learning_curve": learning, "comparison": comparison})
