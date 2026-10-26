"""Every test reads the ticker list as it was on 2026-10-23. The live list is on the
market-data branch, not main, so it is not there when the tests run (pipeline/data_branch.sh)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build  # noqa: E402

LIST = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "tickers.json"


@pytest.fixture(autouse=True)
def frozen_ticker_list(monkeypatch):
    monkeypatch.setattr(build, "TICKERS", LIST)
