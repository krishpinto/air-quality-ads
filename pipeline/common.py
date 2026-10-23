"""Shared helpers for the analysis pipeline.

Every script in this folder imports from here so paths, column names
and JSON serialisation are defined in exactly one place.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_CSV = ROOT / "data" / "raw" / "PRSA_data_2010.1.1-2014.12.31.csv"
PROCESSED = ROOT / "data" / "processed"
OUT = ROOT / "web" / "public" / "data"

PROCESSED.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

# Numeric columns used throughout (clean names, no dots)
NUMERIC = ["pm25", "DEWP", "TEMP", "PRES", "Iws", "Is", "Ir"]

LABELS = {
    "pm25": "PM2.5 (µg/m³)",
    "DEWP": "Dew point (°C)",
    "TEMP": "Temperature (°C)",
    "PRES": "Pressure (hPa)",
    "Iws": "Cumulated wind speed (m/s)",
    "Is": "Cumulated hours of snow",
    "Ir": "Cumulated hours of rain",
    "cbwd": "Wind direction",
    "season": "Season",
    "hour": "Hour of day",
    "year": "Year",
    "month": "Month",
    "log_pm25": "log(PM2.5)",
}

SEASON_ORDER = ["Winter", "Spring", "Summer", "Autumn"]
WIND_ORDER = ["NW", "NE", "SE", "cv"]
WIND_LABELS = {"NW": "North-West", "NE": "North-East", "SE": "South-East", "cv": "Calm / variable"}

# US EPA PM2.5 breakpoints (24h mean), used as the categorical target
AQI_BINS = [-np.inf, 12.0, 35.4, 55.4, 150.4, 250.4, np.inf]
AQI_LABELS = ["Good", "Moderate", "Unhealthy (sensitive)", "Unhealthy", "Very unhealthy", "Hazardous"]


def season_of(month: int) -> str:
    if month in (12, 1, 2):
        return "Winter"
    if month in (3, 4, 5):
        return "Spring"
    if month in (6, 7, 8):
        return "Summer"
    return "Autumn"


def load_raw() -> pd.DataFrame:
    return pd.read_csv(RAW_CSV)


def load_clean() -> pd.DataFrame:
    """Hourly rows with a valid PM2.5 reading plus engineered features."""
    return pd.read_parquet(PROCESSED / "hourly_clean.parquet")


def load_daily() -> pd.DataFrame:
    """One row per calendar day (1826 days), PM2.5 interpolated where missing."""
    return pd.read_parquet(PROCESSED / "daily.parquet")


def load_monthly() -> pd.DataFrame:
    return pd.read_parquet(PROCESSED / "monthly.parquet")


class _Encoder(json.JSONEncoder):
    """Turn numpy / pandas scalars into plain JSON, NaN/inf into null."""

    def default(self, o):  # noqa: D401
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
    """Recursively replace float NaN/inf (python floats) with None."""
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
    print(f"  wrote {path.relative_to(ROOT)}  ({path.stat().st_size/1024:.0f} KB)")


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
    """Histogram as list of {x0, x1, mid, count, density}."""
    v = np.asarray(values, dtype=float)
    v = v[~np.isnan(v)]
    counts, edges = np.histogram(v, bins=bins, range=rng)
    width = edges[1] - edges[0]
    total = counts.sum()
    return [
        {
            "x0": r(edges[i], 3),
            "x1": r(edges[i + 1], 3),
            "mid": r((edges[i] + edges[i + 1]) / 2, 3),
            "count": int(counts[i]),
            "density": r(counts[i] / (total * width), 6) if total else 0,
        }
        for i in range(len(counts))
    ]


def p_fmt(p: float) -> str:
    if p is None or (isinstance(p, float) and math.isnan(p)):
        return "n/a"
    if p < 0.0001:
        return "< 0.0001"
    return f"{p:.4f}"
