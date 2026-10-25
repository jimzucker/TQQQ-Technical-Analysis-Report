// The JavaScript indicators (docs/js/indicators.js) give the same numbers as the Python
// ones (pipeline/indicators.py) that the nightly job writes into each data file.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const SI = require("../docs/js/indicators.js");

const SERIES = ["sma20", "sma50", "sma200", "rsi14", "macd", "macd_signal", "macd_hist",
  "bb_upper", "bb_mid", "bb_lower", "atr14", "vol_avg20", "drawdown"];

// Python's results on the same frozen prices (the file's prices are rounded to 4 decimals,
// so the indicators stored in the file, worked out from unrounded prices, differ slightly).
// pipeline/tests/test_indicator_reference.py keeps this reference up to date.
const REFERENCE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "indicators-reference.json"), "utf8"));

for (const name of ["tqqq", "qqq", "spy"]) {
  test(`every indicator matches Python's on every day, on the same prices: ${name.toUpperCase()}`, () => {
    const p = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", `${name}-2026-10-23.json`), "utf8"));
    const got = SI.computeAll(p.series);
    const problems = [];
    for (const k of SERIES) {
      const want = REFERENCE[name][k];
      assert.equal(got[k].length, want.length, `${k}: length`);
      for (let i = 0; i < want.length; i++) {
        const a = got[k][i], b = want[i];
        if ((a == null) !== (b == null)) problems.push(`${k} on ${p.dates[i]}: JS ${a}, Python ${b}`);
        // measured: largest difference 1.7e-10 (floating-point noise); 1e-8 leaves room, nothing more
        else if (a != null && Math.abs(a - b) > 1e-8 * Math.max(1, Math.abs(b))) problems.push(`${k} on ${p.dates[i]}: JS ${a}, Python ${b}`);
      }
    }
    assert.deepEqual(problems.slice(0, 10), [], `${problems.length} differences`);
  });
}

test("the comparison would notice a wrong calculation", () => {
  // ddof=1 instead of 0 for the bands: a plausible slip that must not pass
  const p = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "tqqq-2026-10-23.json"), "utf8"));
  const c = p.series.close, mid = SI.sma(c, 20);
  const i = c.length - 1;
  let v = 0; for (let j = i - 19; j <= i; j++) v += (c[j] - mid[i]) ** 2;
  const wrongUpper = mid[i] + 2 * Math.sqrt(v / 19);
  const want = REFERENCE.tqqq.bb_upper[i];
  assert.ok(Math.abs(wrongUpper - want) > 1e-8 * want);
  assert.ok(Math.abs(SI.computeAll(p.series).bb_upper[i] - want) <= 1e-8 * want);
});
