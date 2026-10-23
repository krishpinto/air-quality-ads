"""Module 1 - Data loading, cleaning and feature engineering.

Input : data/raw/PRSA_data_2010.1.1-2014.12.31.csv (UCI Beijing PM2.5)
Output: data/processed/{hourly_clean,daily,monthly}.parquet
        web/public/data/dataset.json
"""
import numpy as np
import pandas as pd

from common import (AQI_BINS, AQI_LABELS, LABELS, NUMERIC, PROCESSED, SEASON_ORDER, WIND_LABELS,
                    load_raw, r, save, season_of)

print("01_dataset")
raw = load_raw()
n_raw = len(raw)

# ---------- 1. Rename & type fixes ----------
df = raw.rename(columns={"pm2.5": "pm25"}).copy()
df["dt"] = pd.to_datetime(df[["year", "month", "day", "hour"]])
df = df.sort_values("dt").reset_index(drop=True)

# ---------- 2. Quality checks ----------
missing_before = df.isna().sum()
duplicates = int(df.duplicated(subset=["dt"]).sum())
neg_pm = int((df["pm25"] < 0).sum())
expected_hours = int((df["dt"].max() - df["dt"].min()) / pd.Timedelta(hours=1)) + 1

# PM2.5 gaps: how long are the runs of missing values?
is_na = df["pm25"].isna().astype(int)
runs = (is_na.diff() != 0).cumsum()
gap_lengths = is_na.groupby(runs).sum()
gap_lengths = gap_lengths[gap_lengths > 0]
gap_summary = {
    "n_gaps": int(len(gap_lengths)),
    "longest_gap_hours": int(gap_lengths.max()) if len(gap_lengths) else 0,
    "median_gap_hours": float(gap_lengths.median()) if len(gap_lengths) else 0,
    "gaps_over_24h": int((gap_lengths > 24).sum()),
}

# ---------- 3. Drop rows without the target ----------
clean = df.dropna(subset=["pm25"]).copy()
n_dropped = n_raw - len(clean)

# ---------- 4. Feature engineering ----------
clean["season"] = clean["month"].map(season_of)
clean["dow"] = clean["dt"].dt.dayofweek
clean["is_weekend"] = (clean["dow"] >= 5).astype(int)
clean["log_pm25"] = np.log1p(clean["pm25"])
clean["aqi_category"] = pd.cut(clean["pm25"], bins=AQI_BINS, labels=AQI_LABELS).astype(str)
clean["unhealthy"] = (clean["pm25"] > 150).astype(int)     # minority class for classification
clean["hazardous"] = (clean["pm25"] > 250).astype(int)
clean["date"] = clean["dt"].dt.normalize()

clean.to_parquet(PROCESSED / "hourly_clean.parquet", index=False)

# ---------- 5. Daily aggregation (time-series base) ----------
full = df.set_index("dt")
daily = pd.DataFrame({
    "pm25": full["pm25"].resample("D").mean(),
    "pm25_max": full["pm25"].resample("D").max(),
    "DEWP": full["DEWP"].resample("D").mean(),
    "TEMP": full["TEMP"].resample("D").mean(),
    "PRES": full["PRES"].resample("D").mean(),
    "Iws": full["Iws"].resample("D").mean(),
    "rain_hours": (full["Ir"] > 0).resample("D").sum(),
    "snow_hours": (full["Is"] > 0).resample("D").sum(),
    "hazardous_hours": (full["pm25"] > 250).resample("D").sum(),
    "unhealthy_hours": (full["pm25"] > 150).resample("D").sum(),
    "valid_hours": full["pm25"].resample("D").count(),
})
daily["wind_mode"] = full["cbwd"].resample("D").agg(lambda s: s.value_counts().index[0])
missing_days = int(daily["pm25"].isna().sum())
daily["pm25_interpolated"] = daily["pm25"].isna()
daily["pm25"] = daily["pm25"].interpolate(method="time").bfill().ffill()
daily["pm25_max"] = daily["pm25_max"].interpolate(method="time").bfill().ffill()
daily["year"] = daily.index.year
daily["month"] = daily.index.month
daily["season"] = daily["month"].map(season_of)
daily["dow"] = daily.index.dayofweek
daily["is_weekend"] = (daily["dow"] >= 5).astype(int)
daily["severe_day"] = (daily["pm25"] > 150).astype(int)
daily.index.name = "date"
daily.reset_index().to_parquet(PROCESSED / "daily.parquet", index=False)

monthly = daily[["pm25", "DEWP", "TEMP", "PRES", "Iws"]].resample("MS").mean()
monthly["hazardous_hours"] = daily["hazardous_hours"].resample("MS").sum()
monthly["severe_days"] = daily["severe_day"].resample("MS").sum()
monthly.index.name = "date"
monthly.reset_index().to_parquet(PROCESSED / "monthly.parquet", index=False)

# ---------- 6. JSON for the Dataset page ----------
columns = [
    {"name": "No", "type": "int", "desc": "Row number (dropped)", "role": "id"},
    {"name": "year / month / day / hour", "type": "int", "desc": "Timestamp parts, merged into one datetime", "role": "time"},
    {"name": "pm2.5", "type": "float", "desc": "PM2.5 concentration (µg/m³), US Embassy monitor. Target variable", "role": "target"},
    {"name": "DEWP", "type": "int", "desc": "Dew point (°C)", "role": "feature"},
    {"name": "TEMP", "type": "float", "desc": "Temperature (°C)", "role": "feature"},
    {"name": "PRES", "type": "float", "desc": "Atmospheric pressure (hPa)", "role": "feature"},
    {"name": "cbwd", "type": "category", "desc": "Combined wind direction: NW, NE, SE, cv (calm/variable)", "role": "feature"},
    {"name": "Iws", "type": "float", "desc": "Cumulated wind speed (m/s)", "role": "feature"},
    {"name": "Is", "type": "int", "desc": "Cumulated hours of snow", "role": "feature"},
    {"name": "Ir", "type": "int", "desc": "Cumulated hours of rain", "role": "feature"},
]
engineered = [
    {"name": "season", "desc": "Winter (Dec-Feb), Spring, Summer, Autumn from month"},
    {"name": "is_weekend", "desc": "1 if Saturday/Sunday"},
    {"name": "log_pm25", "desc": "log(1 + PM2.5), used to tame the right skew in regression"},
    {"name": "aqi_category", "desc": "US EPA PM2.5 category from breakpoints 12 / 35.4 / 55.4 / 150.4 / 250.4"},
    {"name": "unhealthy", "desc": "1 if PM2.5 > 150 (minority class for classification / SMOTE)"},
    {"name": "daily & monthly tables", "desc": "Means per day (1826 rows) and per month (60 rows) for time-series work"},
]

aqi_counts = clean["aqi_category"].value_counts().reindex(AQI_LABELS).fillna(0)
wind_counts = clean["cbwd"].value_counts()
season_counts = clean["season"].value_counts().reindex(SEASON_ORDER)

sample_rows = clean.head(12)[["dt", "pm25", "DEWP", "TEMP", "PRES", "cbwd", "Iws", "Is", "Ir", "season", "aqi_category"]].copy()
sample_rows["dt"] = sample_rows["dt"].dt.strftime("%Y-%m-%d %H:00")

numeric_summary = []
for c in NUMERIC:
    s = clean[c]
    numeric_summary.append({
        "col": c, "label": LABELS[c], "min": r(s.min(), 2), "max": r(s.max(), 2),
        "mean": r(s.mean(), 2), "std": r(s.std(), 2), "missing": int(df.rename(columns={"pm2.5": "pm25"})[c].isna().sum()),
    })

save("dataset", {
    "title": "Beijing PM2.5 hourly air-quality data (UCI ML Repository)",
    "source": "Liang et al. (2015), UCI dataset 381. Hourly PM2.5 from the US Embassy in Beijing joined with weather from Beijing Capital Airport.",
    "source_url": "https://archive.ics.uci.edu/dataset/381/beijing+pm2+5+data",
    "overview": {
        "rows_raw": n_raw, "columns_raw": int(raw.shape[1]),
        "start": df["dt"].min().strftime("%Y-%m-%d"), "end": df["dt"].max().strftime("%Y-%m-%d"),
        "expected_hours": expected_hours, "rows_clean": int(len(clean)), "rows_dropped": n_dropped,
        "pct_dropped": r(100 * n_dropped / n_raw, 2), "daily_rows": int(len(daily)), "monthly_rows": int(len(monthly)),
        "missing_days_interpolated": missing_days, "duplicates": duplicates, "negative_pm25": neg_pm,
    },
    "columns": columns,
    "engineered": engineered,
    "missing": [{"col": c, "missing": int(missing_before[c]), "pct": r(100 * missing_before[c] / n_raw, 2)} for c in missing_before.index if c != "dt"],
    "gaps": gap_summary,
    "cleaning_steps": [
        {"step": "Parse timestamp", "detail": "year, month, day, hour merged into one datetime; rows sorted chronologically", "effect": f"{n_raw:,} rows, {expected_hours:,} expected hours - no gaps in the clock"},
        {"step": "Check duplicates & range", "detail": "Duplicate timestamps and negative PM2.5 values", "effect": f"{duplicates} duplicates, {neg_pm} negative readings"},
        {"step": "Drop missing target", "detail": "Hours where the PM2.5 sensor reported NA", "effect": f"{n_dropped:,} rows removed ({100*n_dropped/n_raw:.2f}%), {gap_summary['n_gaps']} gaps, longest {gap_summary['longest_gap_hours']} h"},
        {"step": "Engineer features", "detail": "season, weekend flag, log target, EPA category, binary unhealthy flag", "effect": f"{len(clean.columns)} columns in the clean hourly table"},
        {"step": "Aggregate", "detail": "Daily means (time-interpolated where a whole day was missing) and monthly means", "effect": f"{len(daily)} daily rows ({missing_days} interpolated), {len(monthly)} monthly rows"},
    ],
    "numeric_summary": numeric_summary,
    "categorical": {
        "wind": [{"key": k, "label": WIND_LABELS[k], "count": int(v), "pct": r(100 * v / len(clean), 1)} for k, v in wind_counts.items()],
        "season": [{"key": k, "count": int(v), "pct": r(100 * v / len(clean), 1)} for k, v in season_counts.items()],
        "aqi": [{"key": k, "count": int(v), "pct": r(100 * v / len(clean), 1)} for k, v in aqi_counts.items()],
    },
    "rows_per_year": [{"year": int(y), "rows": int(n), "mean_pm25": r(m, 1)} for (y, n), m in zip(clean.groupby("year").size().items(), clean.groupby("year")["pm25"].mean())],
    "sample_rows": sample_rows.to_dict(orient="records"),
})
print("  hourly clean:", clean.shape, " daily:", daily.shape, " monthly:", monthly.shape)
