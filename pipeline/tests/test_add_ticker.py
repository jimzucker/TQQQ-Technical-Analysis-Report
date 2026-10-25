"""Adding a ticker from the page: checks first, data second, the list last."""
import json
import shutil
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import add_ticker  # noqa: E402
import build  # noqa: E402
from fetch import DataError  # noqa: E402

FUND = lambda s: {"name": f"{s} Test Fund", "kind": "ETF"}  # noqa: E731
PASSES = lambda s, p: None  # noqa: E731


@pytest.fixture
def listing(tmp_path):
    p = tmp_path / "tickers.json"
    shutil.copy(Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "tickers.json", p)  # the list on 2026-10-23
    return p


def test_a_good_ticker_is_built_then_added(listing):
    built = []
    entry = add_ticker.add("DIA", listing, build_fn=lambda argv: built.append(argv) or 0, describe_fn=FUND, fetch_fn=PASSES)
    assert entry == {"symbol": "DIA", "name": "DIA Test Fund", "index": None, "leverage": 1, "benchmark": "SPY", "dir": "data/dia"}
    assert built and built[0][:2] == ["--symbol", "DIA"]
    saved = json.loads(listing.read_text())
    assert saved["tickers"][-1]["symbol"] == "DIA"
    assert not listing.with_suffix(".staged.json").exists()


def test_if_building_fails_the_list_is_unchanged(listing):
    before = listing.read_text()
    with pytest.raises(RuntimeError, match="the list is unchanged"):
        add_ticker.add("DIA", listing, build_fn=lambda argv: 1, describe_fn=FUND, fetch_fn=PASSES)
    assert listing.read_text() == before
    assert not listing.with_suffix(".staged.json").exists()


@pytest.mark.parametrize("symbol, describe_fn, fetch_fn, message", [
    ("QQQ", FUND, PASSES, "already on the daily list"),
    ("$$$", FUND, PASSES, "is not a ticker symbol"),
    ("BTC-USD", lambda s: (_ for _ in ()).throw(add_ticker.TurnedAway(f"{s} is not a stock or fund (Yahoo lists it as cryptocurrency).")), PASSES, "not a stock or fund"),
    ("NEWCO", FUND, lambda s, p: (_ for _ in ()).throw(DataError("NEWCO: only 140 rows, need at least 260")), "did not pass the daily checks: NEWCO: only 140 rows"),
])
def test_each_reason_for_turning_a_ticker_away(listing, symbol, describe_fn, fetch_fn, message):
    before = listing.read_text()
    with pytest.raises(add_ticker.TurnedAway, match=message):
        add_ticker.add(symbol, listing, build_fn=lambda argv: 0, describe_fn=describe_fn, fetch_fn=fetch_fn)
    assert listing.read_text() == before


def test_a_full_list_turns_new_tickers_away(listing):
    data = json.loads(listing.read_text())
    for i in range(add_ticker.MAX_TICKERS - len(data["tickers"])):
        data["tickers"].append({"symbol": f"T{i}", "name": "x", "index": None, "leverage": 1, "benchmark": "SPY", "dir": f"data/t{i}"})
    listing.write_text(json.dumps(data))
    with pytest.raises(add_ticker.TurnedAway, match=r"The daily list is full \(50 tickers\)"):
        add_ticker.add("DIA", listing, build_fn=lambda argv: 0, describe_fn=FUND, fetch_fn=PASSES)


def test_spy_added_this_way_would_be_compared_with_qqq():
    listing = {"default": "TQQQ", "tickers": [{"symbol": "TQQQ"}]}
    assert add_ticker.new_entry("SPY", listing, "x")["benchmark"] == "QQQ"
