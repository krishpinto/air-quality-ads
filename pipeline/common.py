"""Shared helpers for the Applied Data Science pipeline.

Dataset: UCI "Bike Sharing Dataset" (id 275), Fanaee-T & Gama (2013).
    data/raw/day.csv  -  731 daily rows, Capital Bikeshare (Washington DC), 2011-01-01 .. 2012-12-31
    Target: cnt = total rentals that day (casual + registered).
    Weather: temp, atemp, hum, windspeed come NORMALISED in the raw file (divided by 41, 50, 100, 67).
             We de-normalise them in build_tables() so a "1-unit increase" means 1 °C, 1 %, 1 km/h.
    Calendar: season (1 winter, 2 spring, 3 summer, 4 fall - astronomical seasons), yr (0 = 2011, 1 = 2012),
              mnth, holiday, weekday (0 = Sunday), workingday, weathersit (1 clear, 2 mist, 3 light rain/snow,
              4 heavy rain - never occurs in the daily file).

Every unit script imports from here so that paths, column names, the train/test split and
JSON serialisation are defined in exactly one place.

Tables (built once by build_tables(), called from unit1_process.py):
    data/processed/daily.parquet      731 days  (the main table for Units 2-5)
    data/processed/monthly.parquet     24 months (Unit 6 smoothing / regression / ARIMA)
    data/processed/quarterly.parquet    8 quarters (Unit 6 decomposition, like the class example)

Chronological hold-out (Unit 1.3, reused by Units 4, 5 and 6) - the class rule of thumb "two-thirds
training, one-third held out":
    TRAIN = 2011-01-01 .. 2012-06-30 (18 months, 547 days)   TEST = 2012-07-01 .. 2012-12-31 (6 months, 184 days)
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_CSV = ROOT / "data" / "raw" / "day.csv"
PROCESSED = ROOT / "data" / "processed"
OUT = ROOT / "web" / "public" / "data"
PROCESSED.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

TEST_START = pd.Timestamp("2012-07-01")   # first day of the test period
HIGH_DEMAND = 7000                        # cnt above this = "high-demand day" (Unit 5 class label, 94 of 731 days ≈ 13%, about 1:7)

TARGET = "cnt"
NUMERIC = ["cnt", "temp_c", "atemp_c", "hum_pct", "wind_kmh", "casual", "registered"]
LABELS = {
    "cnt": "Rentals per day",
    "casual": "Casual rentals",
    "registered": "Registered rentals",
    "temp_c": "Temperature (°C)",
    "atemp_c": "Feels-like temperature (°C)",
    "hum_pct": "Humidity (%)",
    "wind_kmh": "Wind speed (km/h)",
    "season": "Season",
    "yr": "Year",
    "mnth": "Month",
    "holiday": "Holiday",
    "weekday": "Day of week",
    "workingday": "Working day",
    "weathersit": "Weather situation",
}
SEASON_LABELS = {1: "Winter", 2: "Spring", 3: "Summer", 4: "Fall"}
SEASON_ORDER = ["Winter", "Spring", "Summer", "Fall"]
WEATHER_LABELS = {1: "Clear", 2: "Mist / cloudy", 3: "Light rain / snow", 4: "Heavy rain"}
WEATHER_ORDER = ["Clear", "Mist / cloudy", "Light rain / snow"]
WEEKDAY_LABELS = {0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat"}


# ----------------------------------------------------------------------------- tables
def load_raw() -> pd.DataFrame:
    return pd.read_csv(RAW_CSV)


def build_tables() -> dict:
    """Unit 1.3 data preparation. Returns the facts the Unit 1 page reports."""
    raw = load_raw()
    n_raw = len(raw)
    df = raw.copy()
    df["date"] = pd.to_datetime(df["dteday"])
    df = df.sort_values("date").reset_index(drop=True)

    # --- the five cleaning checks from the class slides
    missing_before = {c: int(df[c].isna().sum()) for c in raw.columns}
    duplicates = int(df.duplicated(subset=["date"]).sum())
    expected_days = int((df["date"].max() - df["date"].min()).days) + 1
    invalid = {
        "cnt_not_casual_plus_registered": int((df["cnt"] != df["casual"] + df["registered"]).sum()),
        "negative_counts": int((df[["cnt", "casual", "registered"]] < 0).any(axis=1).sum()),
        "weather_out_of_range": int((~df["weathersit"].isin([1, 2, 3, 4])).sum()),
        "normalised_out_of_0_1": int(((df[["temp", "atemp", "hum", "windspeed"]] < 0) | (df[["temp", "atemp", "hum", "windspeed"]] > 1)).any(axis=1).sum()),
        "season_not_1_4": int((~df["season"].isin([1, 2, 3, 4])).sum()),
    }
    # Invalid value: 2011-03-10 has humidity 0 % (impossible - sensor error). Like the class example
    # (credit score 900 capped to 850), we replace it rather than delete the row: with the mean of
    # the day before and the day after. Flagged here so Unit 1 can report it.
    zero_hum_idx = df.index[df["hum"] == 0].tolist()
    zero_humidity = []
    for i in zero_hum_idx:
        before, after = df.loc[i - 1, "hum"], df.loc[i + 1, "hum"]
        zero_humidity.append({"date": df.loc[i, "date"].strftime("%Y-%m-%d"), "was": 0.0,
                              "replaced_with_pct": r(100 * (before + after) / 2, 1)})
        df.loc[i, "hum"] = (before + after) / 2

    # --- transform: de-normalise weather, label categories, derived attributes
    df["temp_c"] = df["temp"] * 41.0
    df["atemp_c"] = df["atemp"] * 50.0
    df["hum_pct"] = df["hum"] * 100.0
    df["wind_kmh"] = df["windspeed"] * 67.0
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month
    df["quarter"] = df["date"].dt.quarter
    df["season_name"] = df["season"].map(SEASON_LABELS)
    df["weather_name"] = df["weathersit"].map(WEATHER_LABELS)
    df["weekday_name"] = df["weekday"].map(WEEKDAY_LABELS)
    df["day_type"] = np.where(df["holiday"] == 1, "Holiday", np.where(df["workingday"] == 1, "Working day", "Weekend"))
    df["high_demand"] = (df["cnt"] > HIGH_DEMAND).astype(int)
    df["t"] = np.arange(1, len(df) + 1)                       # time index 1..731
    df["split"] = np.where(df["date"] >= TEST_START, "test", "train")
    df = df.drop(columns=["instant", "dteday"])
    df.to_parquet(PROCESSED / "daily.parquet", index=False)

    ix = df.set_index("date")
    monthly = ix[["cnt", "casual", "registered", "temp_c", "atemp_c", "hum_pct", "wind_kmh"]].resample("MS").mean()
    monthly["cnt_total"] = ix["cnt"].resample("MS").sum()
    monthly["days"] = ix["cnt"].resample("MS").count()
    monthly["rain_days"] = (ix["weathersit"] == 3).resample("MS").sum()
    monthly["year"] = monthly.index.year
    monthly["month"] = monthly.index.month
    monthly["t"] = np.arange(1, len(monthly) + 1)
    monthly["split"] = np.where(monthly.index >= TEST_START, "test", "train")
    monthly.index.name = "date"
    monthly.reset_index().to_parquet(PROCESSED / "monthly.parquet", index=False)

    quarterly = ix[["cnt", "temp_c"]].resample("QS").mean()
    quarterly["cnt_total"] = ix["cnt"].resample("QS").sum()
    quarterly["year"] = quarterly.index.year
    quarterly["quarter"] = quarterly.index.quarter
    quarterly["t"] = np.arange(1, len(quarterly) + 1)
    quarterly.index.name = "date"
    quarterly.reset_index().to_parquet(PROCESSED / "quarterly.parquet", index=False)

    return {
        "rows_raw": n_raw, "columns_raw": int(raw.shape[1]),
        "start": df["date"].min().strftime("%Y-%m-%d"), "end": df["date"].max().strftime("%Y-%m-%d"),
        "expected_days": expected_days,
        "missing_before": missing_before, "duplicates": duplicates, "invalid": invalid,
        "invalid_fixed": zero_humidity,
        "rows_clean": int(len(df)), "rows_dropped": 0,
        "monthly_rows": int(len(monthly)), "quarterly_rows": int(len(quarterly)),
        "train_days": int((df["split"] == "train").sum()), "test_days": int((df["split"] == "test").sum()),
        "train_months": int((monthly["split"] == "train").sum()), "test_months": int((monthly["split"] == "test").sum()),
        "test_start": TEST_START.strftime("%Y-%m-%d"),
    }


def load_daily() -> pd.DataFrame:
    """One row per day (731). Columns: date, season, yr, mnth, holiday, weekday, workingday, weathersit,
    temp, atemp, hum, windspeed (normalised originals), casual, registered, cnt,
    temp_c, atemp_c, hum_pct, wind_kmh, year, month, quarter, season_name, weather_name, weekday_name,
    day_type, high_demand, t, split."""
    return pd.read_parquet(PROCESSED / "daily.parquet")


def load_monthly() -> pd.DataFrame:
    """24 rows: date, cnt (mean per day), casual, registered, temp_c, atemp_c, hum_pct, wind_kmh,
    cnt_total, days, rain_days, year, month, t, split."""
    return pd.read_parquet(PROCESSED / "monthly.parquet")


def load_quarterly() -> pd.DataFrame:
    """8 rows: date, cnt (mean per day), temp_c, cnt_total, year, quarter, t."""
    return pd.read_parquet(PROCESSED / "quarterly.parquet")


def train_test(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Chronological hold-out defined in Unit 1: train = first 18 months, test = last 6 months."""
    return df[df["split"] == "train"].copy(), df[df["split"] == "test"].copy()


# ----------------------------------------------------------------------------- stats helpers (as taught)
def sd_population(values) -> float:
    """Standard deviation with ÷N (the class formula σ = √(Σx²/N)), not ÷(N−1)."""
    v = np.asarray(values, dtype=float)
    return float(np.sqrt(np.mean((v - v.mean()) ** 2)))


def pearson_r_actual_mean(x, y) -> dict:
    """Karl Pearson's r by the actual-mean method: r = Σxy / √(Σx² · Σy²), x = X − X̄, y = Y − Ȳ.
    Returns the intermediate sums so the page can show them."""
    X = np.asarray(x, dtype=float); Y = np.asarray(y, dtype=float)
    dx = X - X.mean(); dy = Y - Y.mean()
    sxx = float((dx ** 2).sum()); syy = float((dy ** 2).sum()); sxy = float((dx * dy).sum())
    return {"n": int(len(X)), "x_mean": r(X.mean(), 3), "y_mean": r(Y.mean(), 3),
            "sum_x2": r(sxx, 2), "sum_y2": r(syy, 2), "sum_xy": r(sxy, 2),
            "r": r(sxy / math.sqrt(sxx * syy), 4)}


def degree_of_correlation(rv: float) -> str:
    """The class bands: 0.75-0.99 high, 0-0.5 low (sign gives direction)."""
    a = abs(rv)
    direction = "positive" if rv > 0 else "negative"
    if a >= 0.99:
        return f"perfect {direction}"
    if a >= 0.75:
        return f"high degree {direction}"
    if a > 0.5:
        return f"moderate degree {direction}"
    if a > 0.0:
        return f"low degree {direction}"
    return "no correlation"


# ----------------------------------------------------------------------------- JSON
class _Encoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            v = float(o)
            return None if (math.isnan(v) or math.isinf(v)) else v
        if isinstance(o, (np.bool_,)):
            return bool(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        if isinstance(o, (pd.Timestamp,)):
            return o.strftime("%Y-%m-%d")
        if isinstance(o, pd.Series):
            return o.tolist()
        return super().default(o)


def _scrub(obj):
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {k: _scrub(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_scrub(v) for v in obj]
    return obj


def save(name: str, obj) -> None:
    path = OUT / f"{name}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(_scrub(obj), f, cls=_Encoder, ensure_ascii=False)
    print(f"  wrote {path.relative_to(ROOT)}  ({path.stat().st_size / 1024:.0f} KB)")


def r(x, nd=4):
    """Round a float safely (None stays None)."""
    if x is None:
        return None
    try:
        if isinstance(x, (float, np.floating)) and (math.isnan(x) or math.isinf(x)):
            return None
        return round(float(x), nd)
    except Exception:
        return x


def hist(values, bins=30, rng=None):
    """Histogram as a list of {x0, x1, mid, count, density}."""
    v = np.asarray(values, dtype=float)
    v = v[~np.isnan(v)]
    counts, edges = np.histogram(v, bins=bins, range=rng)
    width = edges[1] - edges[0]
    total = counts.sum()
    return [{"x0": r(edges[i], 3), "x1": r(edges[i + 1], 3), "mid": r((edges[i] + edges[i + 1]) / 2, 3),
             "count": int(counts[i]), "density": r(counts[i] / (total * width), 6)} for i in range(len(counts))]
