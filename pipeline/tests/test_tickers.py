"""The ticker list (data/tickers.json on the market-data branch) and building one ticker from it."""
import json
import shutil
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures" / "TQQQ.csv"
# the list as it was on 2026-10-23; the live one is on the market-data branch, not main
LIST = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "tickers.json"


def test_the_list_is_valid_and_each_ticker_has_its_own_data_file():
    listing = build.load_tickers(LIST)
    assert listing["default"] == "TQQQ"
    assert [t["symbol"] for t in listing["tickers"]] == ["TQQQ", "QQQ", "SPY"]
    files = [build.ticker_file(t) for t in listing["tickers"]]
    assert files == [build.ROOT / "docs" / "data" / "tqqq.json",  # TQQQ's file stays where it has always been
                     build.ROOT / "docs" / "data" / "qqq" / "qqq.json",
                     build.ROOT / "docs" / "data" / "spy" / "spy.json"]


@pytest.mark.parametrize("change, message", [
    (lambda d: d["tickers"].append(dict(d["tickers"][1], dir="data/other")), "listed twice"),
    (lambda d: d["tickers"][1].update(dir="data"), "share a folder"),
    (lambda d: d["tickers"][1].update(benchmark="DIA"), "not on the list"),
    (lambda d: d["tickers"][1].update(benchmark="QQQ"), "its own benchmark"),
    (lambda d: d.update(default="DIA"), "default"),
])
def test_a_broken_list_is_stopped_with_the_reason(tmp_path, change, message):
    data = json.loads(LIST.read_text())
    change(data)
    p = tmp_path / "tickers.json"
    p.write_text(json.dumps(data))
    with pytest.raises(ValueError, match=message):
        build.load_tickers(p)


def test_build_writes_another_ticker_with_its_own_benchmark_and_leverage(tmp_path, monkeypatch):
    monkeypatch.setattr(build, "expected_last_session", lambda now=None: build.dt.date(2026, 9, 15))
    for sym in ("QQQ", "SPY"):  # the same prices stand in for both; only the labels are checked
        shutil.copy(FIXTURE, tmp_path / f"{sym}.csv")
    out = tmp_path / "qqq.json"
    assert build.main(["--symbol", "qqq", "--csv-dir", str(tmp_path), "--out", str(out)]) == 0
    meta = json.loads(out.read_text())["meta"]
    assert (meta["symbol"], meta["benchmark"], meta["leverage"], meta["index"]) == ("QQQ", "SPY", 1, "Nasdaq-100")
    assert "bench_close" in json.loads(out.read_text())["series"]


def test_build_stops_for_a_ticker_not_on_the_list(tmp_path):
    assert build.main(["--symbol", "ZZZZ", "--out", str(tmp_path / "x.json")]) == 1
    assert not (tmp_path / "x.json").exists()


def test_a_correction_is_still_found_in_a_file_written_before_the_change(tmp_path):
    # files written before the multi-ticker change call the benchmark qqq_close
    from fetch import from_csv
    df = from_csv(str(FIXTURE))
    payload = build.build_payload(df, df, "csv", [])
    payload["series"]["qqq_close"] = payload["series"].pop("bench_close")
    moved = df.copy()
    moved.iloc[-1, moved.columns.get_loc("close")] *= 1.01
    assert build.revised_fields(payload, df, moved)[0].startswith("bench_close")
