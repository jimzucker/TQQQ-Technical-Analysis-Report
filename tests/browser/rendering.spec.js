// The main chart drawn correctly across the page's options, at every time frame,
// on a desktop and a phone screen (see playwright.config.js). Each render is checked
// by renderingProblems() in helpers.js.
//
// Every window x Daily/Mondays x light/dark is always covered. For the 13 chart switches:
//   on every pull request: all off, all on, each one on alone and each one off alone
//     (28 settings)
//   FULL_MATRIX=1 (weekly and on demand, .github/workflows/rendering-matrix.yml): every
//     combination of the 7 switches that change where things are drawn (LAYOUT: the four
//     panels, Bollinger Bands, which widen the price scale, and the two kinds of level, which
//     add tags), each with the 6 that only add lines or markers all on and all off: 256 settings.
//     All 8,192 combinations of 13 switches would take about 4 hours.
const { test, expect } = require("@playwright/test");
const { openPage, renderingProblems } = require("./helpers");

const WINDOWS = ["1m", "3m", "6m", "9m", "12m"];
const LAYOUT = ["vol", "rsi", "macd", "dd", "bb", "zones", "above"];
const DRAWING = ["rolling", "profile", "sma20", "sma50", "sma200", "swings"];
const SWITCHES = [...LAYOUT, ...DRAWING];

/** Load the page with these choices already saved, as a returning reader would. */
async function render(page, { query, panes, theme = "light", cadence = "daily" }) {
  await page.evaluate(([p, t, c]) => {
    if (p) localStorage.setItem("panes", JSON.stringify(p)); else localStorage.removeItem("panes");
    localStorage.setItem("theme", t);
    localStorage.setItem("cadence", c);
    localStorage.removeItem("settings");
  }, [panes, theme, cadence]);
  await page.goto("index.html" + query);
  await page.waitForFunction(() => window.__dashboard && window.__dashboard.res);
}

/** The switch settings to draw: 256 for the full run, otherwise the 28 described above. */
function switchSettings() {
  const set = (on) => Object.fromEntries(SWITCHES.map((k) => [k, on(k)]));
  if (process.env.FULL_MATRIX) {
    const out = [];
    for (let bits = 0; bits < 1 << LAYOUT.length; bits++) for (const drawing of [false, true])
      out.push(set((k) => (LAYOUT.includes(k) ? !!(bits & (1 << LAYOUT.indexOf(k))) : drawing)));
    return out;
  }
  return [set(() => false), set(() => true), ...SWITCHES.map((x) => set((k) => k === x)), ...SWITCHES.map((x) => set((k) => k !== x))];
}

const report = (problems) => `${problems.length} problems, first ones:\n  ` + problems.slice(0, 10).join("\n  ");

for (const w of WINDOWS) for (const cadence of ["daily", "weekly"]) {
  test(`${process.env.FULL_MATRIX ? "256" : "28"} switch settings, light and dark, ${w} ${cadence === "weekly" ? "Mondays" : "Daily"}`, async ({ page }) => {
    test.setTimeout(180000);
    const errors = await openPage(page);
    const problems = [];
    for (const panes of switchSettings()) {
      for (const theme of ["light", "dark"]) {
        await render(page, { query: `?window=${w}`, panes, theme, cadence });
        const on = SWITCHES.filter((k) => panes[k]).join("+") || "none";
        for (const p of await renderingProblems(page)) problems.push(`[${theme}, switches ${on}] ${p}`);
      }
    }
    expect(problems, report(problems)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("custom numbers of sessions draw correctly", async ({ page }) => {
  const errors = await openPage(page);
  const problems = [];
  for (const n of [21, 40, 100, 150, 200, 230, 252]) for (const cadence of ["daily", "weekly"]) {
    await render(page, { query: `?window=${n}`, panes: null, cadence });
    for (const p of await renderingProblems(page)) problems.push(`[${n} sessions, ${cadence}] ${p}`);
  }
  expect(problems, report(problems)).toEqual([]);
  expect(errors).toEqual([]);
});

test("the method settings at their limits draw correctly", async ({ page }) => {
  const errors = await openPage(page);
  const problems = [];
  const limits = ["period=2", "period=10", "cluster=0.25", "cluster=1.5", "touches=1", "touches=5", "period=2&cluster=0.25", "period=10&cluster=1.5&touches=5"];
  for (const w of WINDOWS) for (const q of limits) {
    await render(page, { query: `?window=${w}&${q}`, panes: null });
    for (const p of await renderingProblems(page)) problems.push(`[${w}, ${q}] ${p}`);
  }
  expect(problems, report(problems)).toEqual([]);
  expect(errors).toEqual([]);
});

test("clicking each switch, at each time frame, redraws correctly", async ({ page }) => {
  // the combinations above load with the switches already set; this goes through the clicks
  const errors = await openPage(page);
  const problems = [];
  for (const w of WINDOWS) {
    await page.locator(`#windowSeg button[data-w="${w}"]`).click();
    for (const k of SWITCHES) for (let n = 0; n < 2; n++) {
      await page.locator(`input[data-pane="${k}"]`).click();
      for (const p of await renderingProblems(page)) problems.push(`[${w}, after clicking ${k}] ${p}`);
    }
  }
  expect(problems, report(problems)).toEqual([]);
  expect(errors).toEqual([]);
});

test("the checker itself notices a candle hidden behind a tag", async ({ page }) => {
  // without this, a checker that silently stopped working would pass every test above
  await openPage(page, "?window=12m");
  expect(await renderingProblems(page)).toEqual([]);
  await page.evaluate(() => { const c = window.__dashboard.charts.main; c.o.rightPadPx = 0; c.render(); });
  const problems = await renderingProblems(page);
  expect(problems.some((p) => /covers the .* candle/.test(p))).toBe(true);
});

test("every ticker draws correctly at every time frame, Daily and Mondays", async ({ page }) => {
  // QQQ and SPY trade near $700, ten times TQQQ, so their price tags are wider
  const errors = await openPage(page);
  const problems = [];
  for (const ticker of ["TQQQ", "QQQ", "SPY"]) for (const w of ["1m", "3m", "6m", "9m", "12m"]) for (const cadence of ["daily", "weekly"]) {
    await page.evaluate((c) => { localStorage.setItem("cadence", c); localStorage.removeItem("settings"); }, cadence);
    await page.goto(`index.html?ticker=${ticker}&window=${w}`); await page.waitForFunction(() => window.__dashboard && window.__dashboard.res);
    for (const p of await renderingProblems(page)) problems.push(`[${ticker} ${w} ${cadence}] ${p}`);
  }
  expect(problems, problems.slice(0, 10).join("\n")).toEqual([]);
  expect(errors).toEqual([]);
});
