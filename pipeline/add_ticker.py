"""Add a ticker to docs/data/tickers.json if it passes the nightly refresh's checks.

Usage:
  python pipeline/add_ticker.py DIA
Run by .github/workflows/add-ticker.yml when someone asks for a ticker on the page. On
success the entry is added and its data file built; the workflow then builds its history
and commits. Exit codes: 0 = added, 2 = turned away (the reason is printed), 1 = failure.
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402
from fetch import DataError, fetch  # noqa: E402

MAX_TICKERS = 50
SYMBOL = re.compile(r"^[A-Z][A-Z0-9.-]{0,9}$")
log = logging.getLogger("add_ticker")


class TurnedAway(Exception):
    """The ticker cannot be added; the message says why in plain words."""


def describe(symbol: str) -> dict:
    """Name and kind of security from Yahoo (yfinance), or the reason it cannot be covered."""
    import yfinance as yf

    info = yf.Ticker(symbol).info or {}
    kind = (info.get("quoteType") or "").upper()
    if kind not in ("EQUITY", "ETF"):
        raise TurnedAway(f"{symbol} is not a stock or fund (Yahoo lists it as {kind.lower() or 'unknown'}).")
    return {"name": info.get("longName") or info.get("shortName") or symbol, "kind": kind}


def new_entry(symbol: str, listing: dict, name: str) -> dict:
    """The list entry for a ticker added this way. Leverage and index are not known, so the
    page uses plain (unleveraged) wording; an owner can edit the entry afterwards."""
    if not SYMBOL.match(symbol):
        raise TurnedAway(f'"{symbol}" is not a ticker symbol: use 1 to 10 letters, digits, dots or dashes, starting with a letter.')
    symbols = [t["symbol"] for t in listing["tickers"]]
    if symbol in symbols:
        raise TurnedAway(f"{symbol} is already on the daily list.")
    if len(symbols) >= MAX_TICKERS:
        raise TurnedAway(f"The daily list is full ({MAX_TICKERS} tickers).")
    benchmark = "QQQ" if symbol == "SPY" else "SPY"
    return {"symbol": symbol, "name": name, "index": None, "leverage": 1, "benchmark": benchmark,
            "dir": f"data/{symbol.lower()}"}


def check(symbol: str, tickers_path: Path = build.TICKERS, describe_fn=describe, fetch_fn=fetch) -> tuple[dict, dict]:
    """Every check, nothing written. Returns (the list with the new entry, the entry)."""
    listing = build.load_tickers(tickers_path)
    entry = new_entry(symbol, listing, name=symbol)  # format, duplicate and size checks first
    entry["name"] = describe_fn(symbol)["name"]
    try:
        fetch_fn(symbol, "2y")  # the nightly checks: enough history, no gaps in prices, no bad splits
    except DataError as e:
        raise TurnedAway(f"{symbol} did not pass the daily checks: {e}") from e
    listing["tickers"].append(entry)
    return listing, entry


def add(symbol: str, tickers_path: Path = build.TICKERS, build_fn=None, **checks) -> dict:
    """Check, build the data file, and only then add the entry to the list, so the list never
    names a ticker whose data file is missing."""
    listing, entry = check(symbol, tickers_path, **checks)
    staged = Path(tickers_path).with_suffix(".staged.json")
    staged.write_text(json.dumps(listing, indent=2) + "\n")
    try:
        build.load_tickers(staged)  # still a valid list with the new entry
        code = (build_fn or build.main)(["--symbol", symbol, "--tickers", str(staged), "--force"])
        if code != 0:
            raise RuntimeError(f"building {symbol}'s data stopped (exit {code}); the list is unchanged")
        staged.replace(tickers_path)
    finally:
        staged.unlink(missing_ok=True)
    return entry


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("symbol")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    symbol = a.symbol.strip().upper()
    try:
        entry = add(symbol)
    except TurnedAway as e:
        print(f"Not added: {e}")
        return 2
    except Exception as e:  # noqa: BLE001 - report any failure plainly
        print(f"Could not add {symbol}: {e}")
        return 1
    print(f"Added {symbol} ({entry['name']}) to the daily list.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
