"""Python's indicators on the frozen test data, saved for the JavaScript copy to match.

tests/indicators.test.js checks docs/js/indicators.js against
tests/fixtures/indicators-reference.json. This test keeps that file honest: it recomputes
it with pipeline/indicators.py and fails if the saved copy differs.
Re-record after an intended change with:  UPDATE_REFERENCE=1 python -m pytest pipeline/tests
"""
import json
import math
import os
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from indicators import compute_all  # noqa: E402

FIX = Path(__file__).resolve().parents[2] / "tests" / "fixtures"
REFERENCE = FIX / "indicators-reference.json"
FILES = ["tqqq", "qqq", "spy"]


def compute():
    out = {}
    for f in FILES:
        p = json.loads((FIX / f"{f}-2026-10-23.json").read_text())
        df = pd.DataFrame({k: p["series"][k] for k in ["open", "high", "low", "close", "volume"]}, dtype=float)
        ind = compute_all(df)
        out[f] = {c: [None if math.isnan(v) else float(f"{v:.12g}") for v in ind[c]] for c in ind.columns}
    return out


def test_the_saved_reference_matches_python_today():
    got = compute()
    if os.environ.get("UPDATE_REFERENCE"):
        REFERENCE.write_text(json.dumps(got, separators=(",", ":")))
    want = json.loads(REFERENCE.read_text())
    for f in FILES:
        for col, values in got[f].items():
            for i, (a, b) in enumerate(zip(values, want[f][col])):
                assert (a is None) == (b is None), f"{f} {col} day {i}"
                if a is not None:
                    assert abs(a - b) <= 1e-9 * max(1.0, abs(b)), f"{f} {col} day {i}: {a} vs saved {b}"
