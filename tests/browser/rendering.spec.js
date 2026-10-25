// The main chart drawn correctly across the page's options, at every time frame,
// on a desktop and a phone screen (see playwright.config.js). Each render is checked
// by renderingProblems() in helpers.js.
//
// Every window x Daily/Mondays x light/dark is always covered. For the 8 chart switches:
//   on every pull request: all off, all on, each one on alone and each one off alone
//     (18 settings, about a minute in all)
//   FULL_MATRIX=1 (weekly and on demand, .github/workflows/rendering-matrix.yml):
//     all 256 settings (about 8 minutes on an 8-core machine)
const { test, expect } = require("@playwright/test");
const { openPage, renderingProblems } = require("./helpers");

const WINDOWS = ["1m", "3m", "6m", "9m", "12m"];
const SWITCHES = ["vol", "rsi", "macd", "dd", "rolling", "profile", "above", "bb"];

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

/** The switch settings to draw: all 256 for the full run, otherwise the 18 described above. */
function switchSettings() {
  const set = (on) => Object.fromEntries(SWITCHES.map((k) => [k, on(k)]));
  if (process.env.FULL_MATRIX) {
    return Array.from({ length: 1 << SWITCHES.length }, (_, bits) => set((k) => !!(bits & (1 << SWITCHES.indexOf(k)))));
  }
  return [set(() => false), set(() => true), ...SWITCHES.map((x) => set((k) => k === x)), ...SWITCHES.map((x) => set((k) => k !== x))];
}

const report = (problems) => `${problems.length} problems, first ones:\n  ` + problems.slice(0, 10).join("\n  ");

for (const w of WINDOWS) for (const cadence of ["daily", "weekly"]) {
  test(`${process.env.FULL_MATRIX ? "all 256" : "18"} switch settings, light and dark, ${w} ${cadence === "weekly" ? "Mondays" : "Daily"}`, async ({ page }) => {
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
