"""How fetch() chooses between data sources, and how each source's reply is read.

No network: every source is replaced by a stand-in, and requests.get by a fake reply.
"""
import datetime as dt
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import fetch  # noqa: E402
from fetch import DataError, from_csv  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures" / "TQQQ.csv"
LAST = dt.date(2026, 9, 15)  # the fixture's newest session


@pytest.fixture(scope="module")
def full():
    return from_csv(str(FIXTURE))


@pytest.fixture
def calls(monkeypatch):
    """Pretend the newest close is the fixture's last day, and record which sources ran."""
    monkeypatch.setattr(fetch, "expected_last_session", lambda now=None: LAST)
    return []


def source(name, calls, df=None, error=None):
    def fn(symbol, period):
        calls.append(name)
        if error:
            raise error
        return df.copy()
    return name, fn


def test_fetch_stops_at_the_first_source_that_is_current(monkeypatch, calls, full):
    monkeypatch.setattr(fetch, "SOURCES", [source("a", calls, full), source("b", calls, full)])
    df, name, _ = fetch.fetch("TQQQ")
    assert name == "a"
    assert calls == ["a"]  # b is never asked
    assert df.index[-1].date() == LAST


def test_fetch_moves_on_when_a_source_fails(monkeypatch, calls, full):
    monkeypatch.setattr(fetch, "SOURCES", [
        source("a", calls, error=RuntimeError("timed out")), source("b", calls, full)])
    _, name, _ = fetch.fetch("TQQQ")
    assert (name, calls) == ("b", ["a", "b"])


def test_fetch_moves_on_when_a_source_fails_the_checks(monkeypatch, calls, full):
    bad = full.copy()
    bad.iloc[100, bad.columns.get_loc("volume")] = 0  # zero volume is rejected by validate()
    monkeypatch.setattr(fetch, "SOURCES", [source("a", calls, bad), source("b", calls, full)])
    _, name, _ = fetch.fetch("TQQQ")
    assert (name, calls) == ("b", ["a", "b"])


def test_fetch_keeps_the_freshest_when_no_source_is_current(monkeypatch, calls, full):
    monkeypatch.setattr(fetch, "SOURCES", [
        source("a", calls, full.iloc[:-3]), source("b", calls, full.iloc[:-1]), source("c", calls, full.iloc[:-2])])
    monkeypatch.setattr(fetch, "expected_last_session", lambda now=None: LAST + dt.timedelta(days=1))
    df, name, _ = fetch.fetch("TQQQ")
    assert calls == ["a", "b", "c"]  # all asked, because none reached the expected close
    assert name == "b" and df.index[-1] == full.index[-2]


def test_fetch_names_every_source_when_all_fail(monkeypatch, calls):
    monkeypatch.setattr(fetch, "SOURCES", [
        source("a", calls, error=RuntimeError("blocked")), source("b", calls, error=RuntimeError("no key"))])
    with pytest.raises(DataError, match=r"a: blocked \| b: no key"):
        fetch.fetch("TQQQ")


class Reply:
    def __init__(self, body):
        self.body = body

    def raise_for_status(self):
        pass

    def json(self):
        return self.body


def yahoo_body(rows, meta=None):
    """A Yahoo chart reply for (date, open, high, low, close, adjclose, volume) rows."""
    ts = [int(dt.datetime(*map(int, r[0].split("-")), 14, 30, tzinfo=dt.timezone.utc).timestamp()) for r in rows]
    col = lambda k: [r[k] for r in rows]  # noqa: E731
    return {"chart": {"result": [{
        "meta": {"gmtoffset": -14400, **(meta or {})},
        "timestamp": ts,
        "indicators": {"quote": [{"open": col(1), "high": col(2), "low": col(3), "close": col(4), "volume": col(6)}],
                       "adjclose": [{"adjclose": col(5)}]},
    }]}}


def test_yahoo_chart_reply_is_read_and_adjusted(monkeypatch):
    import requests

    rows = [("2026-09-14", 10.0, 11.0, 9.0, 10.0, 5.0, 100),   # adjclose is half the close
            ("2026-09-15", 20.0, 22.0, 18.0, 20.0, 20.0, 200)]
    monkeypatch.setattr(requests, "get", lambda *a, **k: Reply(yahoo_body(rows)))
    df = fetch.from_yahoo_chart("TQQQ")
    assert [d.date().isoformat() for d in df.index] == ["2026-09-14", "2026-09-15"]
    # every price on the first bar is scaled by adjclose / close = 0.5; volume is not
    assert df.iloc[0][["open", "high", "low", "close"]].tolist() == [5.0, 5.5, 4.5, 5.0]
    assert df.iloc[0]["volume"] == 100
    assert df.iloc[1]["close"] == 20.0


def test_yahoo_chart_drops_a_bar_with_no_close(monkeypatch):
    import requests

    rows = [("2026-09-14", 10.0, 11.0, 9.0, 10.0, 10.0, 100),
            ("2026-09-15", None, None, None, None, None, 0)]
    monkeypatch.setattr(requests, "get", lambda *a, **k: Reply(yahoo_body(rows)))
    assert len(fetch.from_yahoo_chart("TQQQ")) == 1


def test_tiingo_needs_its_key(monkeypatch):
    monkeypatch.delenv("TIINGO_API_KEY", raising=False)
    with pytest.raises(DataError, match="TIINGO_API_KEY"):
        fetch.from_tiingo("TQQQ")


def test_tiingo_reply_uses_the_adjusted_columns(monkeypatch):
    import requests

    monkeypatch.setenv("TIINGO_API_KEY", "test")
    body = [{"date": "2026-09-15T00:00:00.000Z", "adjOpen": 1.0, "adjHigh": 2.0, "adjLow": 0.5,
             "adjClose": 1.5, "adjVolume": 300, "close": 99.0}]
    monkeypatch.setattr(requests, "get", lambda *a, **k: Reply(body))
    df = fetch.from_tiingo("TQQQ")
    assert df.iloc[0].tolist() == [1.0, 2.0, 0.5, 1.5, 300]
    assert df.index[0] == pd.Timestamp("2026-09-15")


def test_alphavantage_needs_its_key(monkeypatch):
    monkeypatch.delenv("ALPHAVANTAGE_API_KEY", raising=False)
    with pytest.raises(DataError, match="ALPHAVANTAGE_API_KEY"):
        fetch.from_alphavantage("TQQQ")
