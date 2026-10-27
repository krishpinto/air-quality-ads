"""Conclusion - knowledge and actions (stage 5 of the Data Science Process, Unit 1.1).

Runs LAST. It does not compute any new statistics: it reads the six unit JSON files that the
unit scripts wrote (mainly their `headline` keys) and assembles the knowledge page:

    units        one plain-language paragraph per unit in process order, with the three or four
                 numbers that matter boxed next to it - every number is read from a unit JSON
    actions      what a bike-share operator would do with each finding
    limitations  what this study cannot claim
    course_conclusion   the one-sentence summary of the course (from the syllabus intro)

The only numbers computed here are the share of high-demand days per season (from the daily
table built in Unit 1), used in one action line.

Inputs : web/public/data/unit1.json .. unit6.json, data/processed/daily.parquet
Output : web/public/data/conclusion.json  (read by web/src/app/conclusion/page.tsx and the home page)
Run    : cd pipeline && python conclusion.py
"""
from __future__ import annotations

import json

from common import HIGH_DEMAND, OUT, load_daily, r, save


# ----------------------------------------------------------------------------- helpers
def load_unit(n: int) -> dict:
    with open(OUT / f"unit{n}.json", encoding="utf-8") as f:
        return json.load(f)


def n0(x: float) -> str:
    """4507.25 -> '4,507'."""
    return f"{x:,.0f}"


def n1(x: float) -> str:
    return f"{x:,.1f}"


def n2(x: float) -> str:
    return f"{x:,.2f}"


def pct(x: float, nd: int = 1) -> str:
    """0.9104 -> '91.0 %'."""
    return f"{100 * x:.{nd}f} %"


def number(label: str, value: str, hint: str | None = None) -> dict:
    return {"label": label, "value": value, "hint": hint}


def ordinal(n: int) -> str:
    """3 -> '3rd'."""
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


# ----------------------------------------------------------------------------- one paragraph per unit
def unit1(u: dict) -> dict:
    h, p = u["headline"], u["prep"]
    fixed = p["invalid_fixed"][0]
    kf = u["s1_4"]["kfold"]
    boot = u["s1_4"]["bootstrap"]
    text = (
        f"The objective was to describe, explain and forecast the number of bikes rented per day from the weather "
        f"and the calendar. The raw file has {n0(p['rows_raw'])} days and {p['columns_raw']} columns ({p['start']} to {p['end']}). "
        f"Cleaning found {p['duplicates']} duplicates, no missing values and one invalid value: humidity {fixed['was']:.0f} % on "
        f"{fixed['date']}, replaced by {n1(fixed['replaced_with_pct'])} %, the mean of the two neighbouring days. "
        f"The weather columns were de-normalised to °C, % and km/h, and the days were split in time order into "
        f"{n0(h['train_days'])} training days and {n0(h['test_days'])} test days. "
        f"On the simplest model, rentals = {n2(h['a'])} + {n2(h['b'])} × temperature, the hold-out gave a training MAE of "
        f"{n0(h['holdout_mae_train'])} rentals but a test MAE of {n0(h['holdout_mae_test'])}; {kf['k']}-fold cross-validation averaged "
        f"{n0(h['kfold_mae_cv'])}, and {boot['B_full']} bootstrap samples put the slope between {n2(h['bootstrap_slope_lo'])} and "
        f"{n2(h['bootstrap_slope_hi'])} rentals per °C."
    )
    return {
        "unit": 1,
        "route": "/unit-1",
        "title": "Introduction to Data Science",
        "stage": "Prior knowledge → Preparation (and how models are validated)",
        "paragraph": text,
        "numbers": [
            number("Days / columns", f"{n0(p['rows_raw'])} / {p['columns_raw']}", f"{p['start']} to {p['end']}"),
            number("Train / test days", f"{n0(h['train_days'])} / {n0(h['test_days'])}", "chronological hold-out"),
            number("Hold-out MAE train / test", f"{n0(h['holdout_mae_train'])} / {n0(h['holdout_mae_test'])}", "rentals per day"),
            number("Bootstrap slope (middle 95 %)", f"{n2(h['bootstrap_slope_lo'])} – {n2(h['bootstrap_slope_hi'])}", f"B = {boot['B_full']}"),
        ],
        "one_line": f"The test error ({n0(h['holdout_mae_test'])}) is far above the training error ({n0(h['holdout_mae_train'])}): rentals grew in 2012, so a line fitted on the past under-predicts the future.",
    }


def unit2(u: dict) -> dict:
    h = u["headline"]
    bars = {b["group"]: b["mean_cnt"] for b in u["diagrams"]["simple_bar"]}
    pairs = {p["x"]: p for p in u["multivariate"]["pairs"]}
    order = " < ".join(h["order"])
    kurt = "platykurtic (flatter than normal)" if h["beta2"] < 3 else "leptokurtic (more peaked than normal)" if h["beta2"] > 3 else "mesokurtic"
    text = (
        f"From one frequency table of {u['sturges']['k']} classes of width {n0(u['sturges']['i'])}, the step-deviation method gives a mean of "
        f"{n0(h['mean'])} rentals per day, a median of {n0(h['median'])} and a mode of {n0(h['mode'])}, so {order}. "
        f"Karl Pearson's coefficient of skewness is {h['sk_pearson']:.2f} and Bowley's is {h['sk_bowley']:.2f}: both are close to 0, "
        f"so the distribution is nearly symmetric. The standard deviation is {n0(h['sigma'])} rentals, and β₂ = {h['beta2']:.2f} < 3, "
        f"so the curve is {kurt}. Rentals average {n0(bars['Clear'])} on clear days, {n0(bars['Mist / cloudy'])} on misty days and "
        f"{n0(bars['Light rain / snow'])} on rainy or snowy days. Karl Pearson's r between temperature and rentals is "
        f"{h['r_temp']:.4f} (a {pairs['temp_c']['degree']} correlation); humidity ({pairs['hum_pct']['r']:.4f}) and wind speed "
        f"({pairs['wind_kmh']['r']:.4f}) are low-degree negative."
    )
    return {
        "unit": 2,
        "route": "/unit-2",
        "title": "Data exploration using descriptive statistics",
        "stage": "Preparation: explore",
        "paragraph": text,
        "numbers": [
            number("Mean / median / mode", f"{n0(h['mean'])} / {n0(h['median'])} / {n0(h['mode'])}", "rentals per day, grouped data"),
            number("σ (÷N)", n0(h["sigma"]), "rentals per day"),
            number("Skₚ / β₂", f"{h['sk_pearson']:.2f} / {h['beta2']:.2f}", "symmetric, platykurtic"),
            number("r (temperature, rentals)", f"{h['r_temp']:.4f}", pairs["temp_c"]["degree"]),
        ],
        "one_line": f"Rentals are symmetric around {n0(h['mean'])} per day, and temperature is the one weather variable with a sizeable correlation (r = {h['r_temp']:.2f}).",
    }


def unit3(u: dict) -> dict:
    h = u["headline"]
    z = u["ztest"]
    one = u["anova"]["one_way"]
    two = u["anova"]["two_way"]
    means = {g["group"]: g["mean"] for g in one["groups"]}
    tt = u["ttests"]
    text = (
        f"Treating the {n0(u['meta']['N'])} days as a sample, a 95 % confidence interval from {u['ci']['z']['n']} random days puts the "
        f"mean daily rentals between {n0(h['ci50_lower'])} and {n0(h['ci50_upper'])}. The Z-test of the {z['year_sample']} mean "
        f"({n0(z['xbar'])}) against the {z['year_ref']} mean ({n0(z['mu0'])}) gives Z = {h['z']:.2f}, far beyond the tabulated "
        f"{h['z_crit']}, so H₀ is rejected: demand really rose. The paired t-test on the same 12 calendar months agrees "
        f"(t = {h['t_pair']:.2f}). Two tests accept H₀: the {tt['one_sample']['n']} holidays are not significantly different from the "
        f"overall mean (t = {h['t_one']:.2f} vs {tt['one_sample']['crit']}), and working days do not differ from non-working days "
        f"(t = {h['t_accept']:.2f} vs {tt['accept']['crit']}). One-way ANOVA by season gives F = {h['f_one']:.2f} against a 5 % limit of "
        f"{h['f_one_crit']}: the season means (Winter {n0(means['Winter'])}, Spring {n0(means['Spring'])}, Summer {n0(means['Summer'])}, "
        f"Fall {n0(means['Fall'])}) are significantly different. The two-way ANOVA on year × quarter rejects both: "
        f"F = {h['f_two_rows']:.1f} for the year effect and F = {h['f_two_cols']:.1f} for the quarter effect."
    )
    return {
        "unit": 3,
        "route": "/unit-3",
        "title": "Data exploration using inferential statistics",
        "stage": "Preparation: infer",
        "paragraph": text,
        "numbers": [
            number("Z-test 2012 vs 2011", f"Z = {h['z']:.2f} vs {h['z_crit']}", "H₀ rejected: demand rose"),
            number("One-way ANOVA by season", f"F = {h['f_one']:.2f} vs {h['f_one_crit']}", "H₀ rejected: seasons differ"),
            number("Working vs non-working days", f"t = {h['t_accept']:.2f} vs {tt['accept']['crit']}", "H₀ accepted: no difference"),
            number("95 % CI, n = 50", f"{n0(h['ci50_lower'])} – {n0(h['ci50_upper'])}", "rentals per day"),
        ],
        "one_line": f"Year and season matter (both rejected at 5 %); the day of the week and holidays do not (both accepted).",
    }


def unit4(u: dict) -> dict:
    h = u["headline"]
    s, m, best = h["simple"], h["two_predictor"], h["best_design"]
    yr = u["s45"]["yr_coef"]
    r12 = u["s44"]["r12"]
    text = (
        f"The simple regression Y = {n2(s['a'])} + {n2(s['b'])} X says each extra °C adds about {n0(s['b'])} rentals, and it explains "
        f"R² = {s['r2']:.2f} of the daily variation on the training days. Adding humidity as a second predictor gives "
        f"Ŷ = {n2(m['b0'])} + {n2(m['b1'])} X₁ − {n2(abs(m['b2']))} X₂ with R² = {m['r2']:.2f}: holding humidity constant each °C adds "
        f"{n0(m['b1'])} rentals, and holding temperature constant each 1 % of humidity removes {n0(abs(m['b2']))}. The partial "
        f"coefficient of humidity is much larger than its simple slope because temperature and humidity are nearly unrelated "
        f"(r₁₂ = {r12:.2f}). The F-test rejects H₀ (F = {m['f']:.1f} vs {m['f_tab']:.2f}) and both t-tests reject it "
        f"(t₁ = {m['t1']:.2f}, t₂ = {m['t2']:.2f} vs {m['t_tab']:.3f}), so the model and each coefficient are significant. "
        f"Adding wind and the year indicator ({best['label']}) lifts R² to {best['r2']:.2f}: the year dummy alone is worth about "
        f"{n0(yr)} rentals per day, and the test-period MAE falls from {n0(m['test_mae'])} to {n0(best['test_mae'])}."
    )
    return {
        "unit": 4,
        "route": "/unit-4",
        "title": "Regression analysis",
        "stage": "Modeling",
        "paragraph": text,
        "numbers": [
            number("Simple: b per °C, R²", f"{n2(s['b'])}, {s['r2']:.2f}", "Y = a + bX, X = temperature"),
            number("Two predictors: b₁, b₂, R²", f"{n2(m['b1'])}, {n2(m['b2'])}, {m['r2']:.2f}", "temperature, humidity"),
            number("F / t₁ / t₂", f"{m['f']:.1f} / {m['t1']:.2f} / {m['t2']:.2f}", f"vs {m['f_tab']:.2f} / {m['t_tab']:.3f}: all rejected"),
            number("Best design R², test MAE", f"{best['r2']:.2f}, {n0(best['test_mae'])}", best["label"]),
        ],
        "one_line": f"Weather alone explains about half the daily variation (R² = {m['r2']:.2f}); the year effect (+{n0(yr)} rentals) is the single biggest term.",
    }


def unit5(u: dict) -> dict:
    h = u["headline"]
    c = u["s56"]["counts"]
    after = u["s56"]["after"]
    top = u["s55"]["top"][0]
    text = (
        f"On rentals alone the statistical rules find nothing: the |z| > 3 rule flags {h['flagged_z_cnt']} days and the 1.5 × IQR rule "
        f"flags {h['flagged_iqr_cnt']}, because the distribution is wide. Even Hurricane Sandy, the lowest day in the data, has "
        f"z = {h['sandy_z']:.2f}. The same rule does find {h['flagged_z_wind']} wind-speed outliers and {h['flagged_z_hum_raw']} days on the "
        f"raw humidity column (the 0 % sensor error among them). Looking at two variables together changes the picture: on standardised "
        f"(temperature, rentals) the k-NN distance ranks Sandy {ordinal(h['sandy_knn_rank'])} of {n0(h['n_days'])} days and the local outlier factor gives it "
        f"LOF = {h['sandy_lof']:.2f} (rank {h['sandy_lof_rank']}); the top day by both methods is {top['date']} "
        f"({top['what'].split(' (')[0]}, LOF = {h['lof_top1_value']:.2f}). For the supervised case, high-demand days (more than "
        f"{n0(u['s56']['threshold'])} rentals) are {c['train']['minority']} of {c['train']['n']} training days, about 1 : {c['train']['ratio']:.0f}. "
        f"SMOTE raises the minority class to {after['minority']} by adding {after['synthetic']} synthetic days; logistic regression "
        f"then finds {pct(h['recall_with'])} of the test high-demand days instead of {pct(h['recall_without'])}, while precision moves "
        f"from {pct(h['precision_without'])} to {pct(h['precision_with'])} and F1 from {h['f1_without']:.2f} to {h['f1_with']:.2f}."
    )
    return {
        "unit": 5,
        "route": "/unit-5",
        "title": "Anomaly detection",
        "stage": "Modeling",
        "paragraph": text,
        "numbers": [
            number("Flagged on rentals alone (z / IQR)", f"{h['flagged_z_cnt']} / {h['flagged_iqr_cnt']}", f"Sandy z = {h['sandy_z']:.2f}"),
            number("Sandy, two variables", f"k-NN rank {h['sandy_knn_rank']}, LOF {h['sandy_lof']:.2f}", f"LOF rank {h['sandy_lof_rank']}"),
            number("Top outlier (k-NN and LOF)", top["date"], f"LOF = {h['lof_top1_value']:.2f}"),
            number("Recall without → with SMOTE", f"{pct(h['recall_without'])} → {pct(h['recall_with'])}", f"precision {pct(h['precision_without'])} → {pct(h['precision_with'])}"),
        ],
        "one_line": "One-variable rules miss the storm days; distance and density methods on two variables catch them, and SMOTE makes the rare high-demand class learnable.",
    }


def unit6(u: dict) -> dict:
    h = u["headline"]
    fit = u["decomposition"]["fit"]
    met = h["metrics"]
    best = met[h["best_key"]]
    avg = met["average"]
    reg = met["regression"]
    ari = met["arima"]
    add = h["additive_2013"]
    cf = u["component_facts"]
    text = (
        f"The monthly series rises from {n0(cf['first']['y'])} rentals per day in {cf['first']['label']} to a peak of {n0(cf['peak']['y'])} "
        f"in {cf['peak']['label']}: a strong upward trend with a yearly seasonal swing. On the {u['meta']['n_quarters']} quarterly means the "
        f"{h['better_decomposition']} decomposition fits better, because the seasonal swing grew only {fit['swing_growth_pct']:.1f} % while "
        f"the level grew {fit['level_growth_pct']:.1f} %; it forecasts {add[0]['label']}–{add[3]['label'].split(' ')[1]} at "
        f"{n0(add[0]['forecast'])}, {n0(add[1]['forecast'])}, {n0(add[2]['forecast'])} and {n0(add[3]['forecast'])} rentals per day. "
        f"Forecasting the {u['meta']['n_test']} test months from the {u['meta']['n_train']} training months, the average method is worst "
        f"(MAE {n0(avg['MAE'])}, MASE {avg['MASE']:.2f}) because old low months never leave the mean; the {best['method'].lower()} is best "
        f"(MAE {n0(best['MAE'])}, MAPE {best['MAPE']:.1f} %, MASE {best['MASE']:.2f}) because it follows the level just reached. "
        f"Regression on time (slope {n2(h['regression_a'])} rentals per month, MAE {n0(reg['MAE'])}) and {h['arima_order']} "
        f"(MAE {n0(ari['MAE'])}) keep the growth going but have no seasonal term, so they miss the autumn turn. "
        + (
            "Every MASE is above 1: none of the methods beat the one-step naive forecast on these months."
            if all(v["MASE"] > 1 for v in met.values())
            else f"The lowest MASE is {min(v['MASE'] for v in met.values()):.2f}."
        )
    )
    return {
        "unit": 6,
        "route": "/unit-6",
        "title": "Time series forecasting",
        "stage": "Modeling → Application",
        "paragraph": text,
        "numbers": [
            number("Additive forecast 2013 Q1–Q4", " · ".join(n0(q["forecast"]) for q in add), "rentals per day"),
            number("Best method", best["method"], f"MAE {n0(best['MAE'])}, MAPE {best['MAPE']:.1f} %, MASE {best['MASE']:.2f}"),
            number("Worst method", avg["method"], f"MAE {n0(avg['MAE'])}, MASE {avg['MASE']:.2f}"),
            number("Trend", f"{n2(h['regression_a'])} / month", "least-squares slope on t"),
        ],
        "one_line": f"Demand is growing about {n0(h['regression_a'])} rentals per day each month with a summer peak; short memory ({best['method'].lower()}) forecasts it best.",
    }


# ----------------------------------------------------------------------------- knowledge and actions
def high_demand_by_season() -> list[dict]:
    """Share of high-demand days (cnt > HIGH_DEMAND) in each season, from the daily table built in Unit 1."""
    d = load_daily()
    rows = []
    for season in ["Winter", "Spring", "Summer", "Fall"]:
        s = d[d["season_name"] == season]
        rows.append({"season": season, "days": int(len(s)), "high": int(s["high_demand"].sum()), "share": r(float(s["high_demand"].mean()), 4)})
    rows.append({"season": "All", "days": int(len(d)), "high": int(d["high_demand"].sum()), "share": r(float(d["high_demand"].mean()), 4)})
    return rows


def actions(u: dict[int, dict], hd: list[dict]) -> list[dict]:
    h2, h3, h4, h5, h6 = u[2]["headline"], u[3]["headline"], u[4]["headline"], u[5]["headline"], u[6]["headline"]
    means = {g["group"]: g["mean"] for g in u[3]["anova"]["one_way"]["groups"]}
    z = u[3]["ztest"]
    tt = u[3]["ttests"]
    yr = u[4]["s45"]["yr_coef"]
    m = h4["two_predictor"]
    best = h6["metrics"][h6["best_key"]]
    avg = h6["metrics"]["average"]
    summer = next(x for x in hd if x["season"] == "Summer")
    winter = next(x for x in hd if x["season"] == "Winter")
    overall = next(x for x in hd if x["season"] == "All")
    top = u[5]["s55"]["top"][0]
    sandy = u[5]["s53"]["z_cnt"]["top"][0]
    return [
        {
            "finding": f"Temperature is the strongest weather driver: r = {h2['r_temp']:.2f} (Unit 2); holding humidity constant each 1 °C adds {n0(m['b1'])} rentals, and each 1 % of humidity removes {n0(abs(m['b2']))} (Unit 4).",
            "action": "Put more bikes on the street on warm, dry days and fewer on cold or humid ones; use the two-predictor equation with the day's forecast temperature and humidity to size the fleet.",
            "units": [2, 4],
        },
        {
            "finding": f"Seasons differ significantly (F = {h3['f_one']:.1f} vs {h3['f_one_crit']}, Unit 3): Winter averages {n0(means['Winter'])} rentals per day, Summer {n0(means['Summer'])}. High-demand days (more than {n0(HIGH_DEMAND)} rentals) are {overall['high']} of {overall['days']} days ({pct(overall['share'])}) overall, {pct(summer['share'])} of summer days and {pct(winter['share'])} of winter days.",
            "action": f"Plan the summer roster for about one high-demand day in {round(1 / summer['share'])}; schedule maintenance and rebalancing crews in winter, when demand is roughly half the yearly mean.",
            "units": [3, 5],
        },
        {
            "finding": f"Working days and non-working days do not differ (t = {h3['t_accept']:.2f} vs {tt['accept']['crit']}, H₀ accepted), nor do holidays (t = {h3['t_one']:.2f} vs {tt['one_sample']['crit']}).",
            "action": "Do not run a separate weekend or holiday fleet plan; the weather and the season decide the day, not the calendar.",
            "units": [3],
        },
        {
            "finding": f"Storm days are the real outliers: {sandy['date']} (Hurricane Sandy, {n0(sandy['cnt'])} rentals) and {top['date']} (Hurricane Irene, LOF = {h5['lof_top1_value']:.2f}). One-variable rules flag {h5['flagged_z_cnt']} of them; the two-variable k-NN and LOF methods rank them at the top.",
            "action": "Monitor rentals together with temperature, not rentals alone; a warm day with almost no rentals is a system or weather emergency. Pull bikes off the street when a storm is forecast and expect near-zero revenue that day.",
            "units": [5],
        },
        {
            "finding": f"Demand grew from {n0(z['mu0'])} rentals per day in {z['year_ref']} to {n0(z['xbar'])} in {z['year_sample']} (Z = {h3['z']:.1f}, Unit 3); the year indicator is worth about {n0(yr)} rentals per day in the regression (Unit 4), and the additive decomposition forecasts {n0(h6['additive_2013'][2]['forecast'])} per day for {h6['additive_2013'][2]['label']} (Unit 6).",
            "action": "Budget the next year's fleet and docks for growth, not for the current level: the summer peak of the next year will be above anything seen so far.",
            "units": [3, 4, 6],
        },
        {
            "finding": f"Among the forecasting methods, {best['method'].lower()} had the lowest test error (MAE {n0(best['MAE'])}, MASE {best['MASE']:.2f}); the average method was worst (MAE {n0(avg['MAE'])}, MASE {avg['MASE']:.2f}).",
            "action": "For month-ahead planning use the last three months, re-forecast every month, and never use the long-run average while the trend is this steep.",
            "units": [6],
        },
        {
            "finding": f"With SMOTE the classifier finds {pct(h5['recall_with'])} of high-demand test days instead of {pct(h5['recall_without'])}, at the cost of {h5['fp_with']} false alarms instead of {h5['fp_without']} (Unit 5).",
            "action": "Use the balanced classifier as an early-warning flag for high-demand days: a missed busy day costs more than an unnecessary extra shift.",
            "units": [5],
        },
        {
            "finding": f"The hold-out test error ({n0(u[1]['headline']['holdout_mae_test'])}) is almost twice the training error ({n0(u[1]['headline']['holdout_mae_train'])}) because the series grows (Unit 1).",
            "action": "Always validate on a later period than the one the model was fitted on; a random split would hide the growth and overstate accuracy.",
            "units": [1],
        },
    ]


def limitations(u: dict[int, dict]) -> list[dict]:
    h4, h6 = u[4]["headline"], u[6]["headline"]
    best = h6["metrics"][h6["best_key"]]
    return [
        {
            "title": "Two years only",
            "detail": f"The data cover {u[1]['prep']['start']} to {u[1]['prep']['end']}: {u[6]['meta']['n_months']} monthly points and {u[6]['meta']['n_quarters']} quarters. One year of growth cannot tell whether the trend continues, flattens or was special to 2012.",
        },
        {
            "title": "Weather explains about half of the daily variation",
            "detail": f"The two-predictor model reaches R² = {h4['two_predictor']['r2']:.2f}; only when the year indicator is added does R² reach {h4['best_design']['r2']:.2f}. The rest is events, marketing, the growth of the system and the day-to-day noise of people's plans.",
        },
        {
            "title": "Monthly forecasts without a seasonal term miss the autumn turn",
            "detail": f"Regression on t and {h6['arima_order']} keep rising after September; the best method ({best['method']}) still has MASE = {best['MASE']:.2f} > 1, so none of them beats a one-step naive forecast on the six test months. A seasonal model needs more than two years to estimate its indices.",
        },
        {
            "title": "SMOTE interpolates 0/1 columns",
            "detail": "Synthetic days are drawn on the straight line between two real high-demand days, so the 0/1 columns working-day and year become fractions between 0 and 1; the classifier treats them as numbers, which is acceptable for logistic regression but is not a real calendar.",
        },
        {
            "title": "Correlation, not causation",
            "detail": "Weather can affect rentals but rentals cannot affect the weather, so the direction is clear; the year effect, however, bundles everything that changed between 2011 and 2012 (more docks, more members, more publicity) into one number.",
        },
    ]


# ----------------------------------------------------------------------------- main
def main() -> None:
    units = {n: load_unit(n) for n in range(1, 7)}
    hd = high_demand_by_season()
    p = units[1]["prep"]
    out = {
        "meta": {
            "rows": p["rows_raw"], "columns": p["columns_raw"], "start": p["start"], "end": p["end"],
            "train_days": p["train_days"], "test_days": p["test_days"], "test_start": p["test_start"],
            "objective": "Can we describe, explain and forecast the number of bikes rented per day in Washington DC from the weather and the calendar?",
        },
        "units": [unit1(units[1]), unit2(units[2]), unit3(units[3]), unit4(units[4]), unit5(units[5]), unit6(units[6])],
        "high_demand_by_season": hd,
        "actions": actions(units, hd),
        "limitations": limitations(units),
        "course_conclusion": (
            "This project walked through the complete data science workflow — data acquisition, preparation, exploration, "
            "modelling and evaluation — on one dataset, using the statistical techniques, regression, anomaly detection and "
            "time series forecasting methods of the course exactly as they were taught, so that every number on every page "
            "can be traced back to a formula from class and a line of code that computed it."
        ),
    }
    save("conclusion", out)


if __name__ == "__main__":
    main()
