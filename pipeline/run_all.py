"""Run the whole pipeline in order and stop at the first failure.

    cd pipeline && python run_all.py

Order matters: unit1_process.py builds data/processed/*.parquet that every later script reads, and
conclusion.py reads the six unit JSON files. Each script is run as a separate process from this
directory, so `from common import ...` resolves. Timings are printed per script and in total.
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent

SCRIPTS = [
    "unit1_process.py",
    "unit2_descriptive.py",
    "unit3_inference.py",
    "unit4_regression.py",
    "unit5_anomaly.py",
    "unit6_timeseries.py",
    "conclusion.py",
]


def main() -> int:
    total_start = time.perf_counter()
    for i, script in enumerate(SCRIPTS, start=1):
        print(f"[{i}/{len(SCRIPTS)}] {script}", flush=True)
        start = time.perf_counter()
        result = subprocess.run([sys.executable, "-X", "utf8", script], cwd=HERE)
        elapsed = time.perf_counter() - start
        if result.returncode != 0:
            print(f"    FAILED after {elapsed:.1f} s (exit code {result.returncode}); stopping.", flush=True)
            return result.returncode
        print(f"    done in {elapsed:.1f} s", flush=True)
    print(f"All {len(SCRIPTS)} scripts finished in {time.perf_counter() - total_start:.1f} s.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
