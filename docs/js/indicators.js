/*
 * Technical indicators in JavaScript — the same calculations as pipeline/indicators.py,
 * for a ticker the page shows live before the nightly job has built its data file.
 * Listed tickers keep the numbers the nightly job wrote. tests/indicators.test.js checks
 * this file against those numbers for every series and every day.
 *
 * Every function takes plain arrays and returns an array of the same length, with null
 * where the Python version has no value yet (NaN).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SI = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const isNum = (v) => v != null && Number.isFinite(v);
  const blank = (n) => new Array(n).fill(null);

  /** Rolling mean over n values; null until n values exist (pandas rolling(n).mean()). */
  function sma(s, n) {
    const out = blank(s.length);
    let sum = 0;
    for (let i = 0; i < s.length; i++) {
      sum += s[i];
      if (i >= n) sum -= s[i - n];
      if (i >= n - 1) out[i] = sum / n;
    }
    return out;
  }

  /**
   * Exponential average, pandas ewm(span=n, adjust=False, min_periods=n): starts at the
   * first value and is shown once n values have been seen. Leading nulls are skipped.
   */
  function ema(s, n) {
    const a = 2 / (n + 1), out = blank(s.length);
    let y = null, seen = 0;
    for (let i = 0; i < s.length; i++) {
      if (!isNum(s[i])) continue;
      y = y == null ? s[i] : (1 - a) * y + a * s[i];
      seen++;
      if (seen >= n) out[i] = y;
    }
    return out;
  }

  /** Wilder's smoothing, seeded with the simple average of the first n values. */
  function wilder(s, n) {
    const out = blank(s.length);
    const first = s.findIndex(isNum);
    if (first < 0 || s.length - first < n) return out;
    const start = first + n - 1;
    let sum = 0, count = 0;
    for (let i = first; i <= start; i++) if (isNum(s[i])) { sum += s[i]; count++; }
    let avg = sum / count;
    out[start] = avg;
    for (let i = start + 1; i < s.length; i++) {
      avg = (avg * (n - 1) + s[i]) / n;
      out[i] = avg;
    }
    return out;
  }

  function rsi(close, n = 14) {
    const d = close.map((c, i) => (i === 0 ? null : c - close[i - 1]));
    const gain = wilder(d.map((v) => (v == null ? null : Math.max(v, 0))), n);
    const loss = wilder(d.map((v) => (v == null ? null : Math.max(-v, 0))), n);
    return gain.map((g, i) => (g == null ? null : loss[i] === 0 ? 100 : 100 - 100 / (1 + g / loss[i])));
  }

  function macd(close, fast = 12, slow = 26, signal = 9) {
    const f = ema(close, fast), sl = ema(close, slow);
    const line = f.map((v, i) => (v == null || sl[i] == null ? null : v - sl[i]));
    const sig = ema(line, signal);
    return { line, signal: sig, hist: line.map((v, i) => (v == null || sig[i] == null ? null : v - sig[i])) };
  }

  /** Bands 2 standard deviations (population, ddof=0) either side of the 20-day average. */
  function bollinger(close, n = 20, k = 2) {
    const mid = sma(close, n), upper = blank(close.length), lower = blank(close.length);
    for (let i = n - 1; i < close.length; i++) {
      let v = 0;
      for (let j = i - n + 1; j <= i; j++) v += (close[j] - mid[i]) ** 2;
      const sd = Math.sqrt(v / n);
      upper[i] = mid[i] + k * sd;
      lower[i] = mid[i] - k * sd;
    }
    return { upper, mid, lower };
  }

  function trueRange(high, low, close) {
    return high.map((h, i) => (i === 0 ? h - low[i]
      : Math.max(h - low[i], Math.abs(h - close[i - 1]), Math.abs(low[i] - close[i - 1]))));
  }

  /** Percent below the running n-session high (0 at a new high, negative otherwise). */
  function drawdown(close, n = 252) {
    return close.map((c, i) => {
      let peak = -Infinity;
      for (let j = Math.max(0, i - n + 1); j <= i; j++) if (close[j] > peak) peak = close[j];
      return (c / peak - 1) * 100;
    });
  }

  /** Every series the data file carries, from open/high/low/close/volume arrays. */
  function computeAll({ high, low, close, volume }) {
    const m = macd(close), bb = bollinger(close);
    return {
      sma20: sma(close, 20), sma50: sma(close, 50), sma200: sma(close, 200),
      rsi14: rsi(close),
      macd: m.line, macd_signal: m.signal, macd_hist: m.hist,
      bb_upper: bb.upper, bb_mid: bb.mid, bb_lower: bb.lower,
      atr14: wilder(trueRange(high, low, close), 14),
      vol_avg20: sma(volume, 20),
      drawdown: drawdown(close),
    };
  }

  return { sma, ema, wilder, rsi, macd, bollinger, trueRange, drawdown, computeAll };
});
