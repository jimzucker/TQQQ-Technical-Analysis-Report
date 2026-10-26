// Every layer of the main chart can be shown or hidden; Simple view, Show all, and links.
const { test, expect } = require("@playwright/test");
const { openPage } = require("./helpers");

const ready = (page) => page.waitForFunction(() => window.__dashboard && window.__dashboard.res);
const panes = (page) => page.evaluate(() => ({ ...window.__dashboard.panes }));
// legend entries one by one, so "20-day avg" is not found inside the Bollinger entry
const legend = (page) => page.locator("#legend li").allTextContents();
const hasEntry = (entries, text) => entries.some((e) => e.trim() === text || e.trim().startsWith(text + " "));

test("the new switches hide their layer and its legend entry", async ({ page }) => {
  const errors = await openPage(page, "?window=12m");
  for (const [k, text] of [["sma20", "20-day avg"], ["sma50", "50-day avg"], ["sma200", "200-day avg"], ["swings", "Swing low"]]) {
    const sw = page.locator(`input[data-pane="${k}"]`);
    await expect(sw).toBeChecked(); // on by default, as before this change
    expect(hasEntry(await legend(page), text)).toBe(true);
    await sw.uncheck();
    expect((await panes(page))[k]).toBe(false);
    expect(hasEntry(await legend(page), text)).toBe(false);
    await sw.check();
  }
  expect(errors).toEqual([]);
});

test("the nearest level below (S1) and above (A1) stay on the chart with both level switches off", async ({ page }) => {
  // 12 months: S1 $66.72 is the zone the price is in; A1 $70.26 is the nearest above
  const errors = await openPage(page, "?window=12m");
  const shown = () => page.evaluate(() => {
    const lv = window.__dashboard.shownLevels;
    return { below: lv.below.map((z) => z.id), above: lv.above.map((z) => z.id), tags: window.__dashboard.tagBoxes.map((b) => b.text) };
  });
  expect(await shown()).toMatchObject({ below: ["S1", "S2", "S3", "S4", "S5", "S6", "S7"], above: ["A1", "A2"] });
  await page.locator('input[data-pane="zones"]').uncheck();
  await page.locator('input[data-pane="above"]').uncheck();
  const s = await shown();
  expect(s.below).toEqual(["S1"]);
  expect(s.above).toEqual(["A1"]);
  expect(s.tags).toEqual(expect.arrayContaining(["S1 $66.72", "A1 $70.26"]));
  expect(s.tags.some((t) => /^(S[2-9]|A[2-9])/.test(t))).toBe(false);
  // both still have a legend entry, since both are drawn
  const entries = await legend(page);
  expect(hasEntry(entries, "Support zone")).toBe(true);
  expect(hasEntry(entries, "Level above price")).toBe(true);
  await expect(page.locator("#levels tbody .lvl.support")).toHaveCount(7); // the table is not a chart layer
  expect(errors).toEqual([]);
});

test("Simple view shows only candles, support below the price and the 50 and 200-day averages", async ({ page }) => {
  const errors = await openPage(page);
  await page.locator("#simpleView").click();
  const on = Object.entries(await panes(page)).filter(([, v]) => v).map(([k]) => k).sort();
  expect(on).toEqual(["sma200", "sma50", "zones"]);
  expect(await page.evaluate(() => window.__dashboard.charts.main.L.panes.map((p) => p.id))).toEqual(["price"]);
  await expect(page.locator('input[data-pane="rsi"]')).not.toBeChecked(); // the switches follow
  await page.reload(); await ready(page);
  expect(Object.entries(await panes(page)).filter(([, v]) => v).map(([k]) => k).sort()).toEqual(["sma200", "sma50", "zones"]); // remembered
  expect(errors).toEqual([]);
});

test("Show all turns every layer and panel on", async ({ page }) => {
  await openPage(page);
  await page.locator("#showAll").click();
  expect(Object.values(await panes(page)).every(Boolean)).toBe(true);
  expect(await page.evaluate(() => window.__dashboard.charts.main.L.panes.map((p) => p.id))).toEqual(["price", "vol", "rsi", "macd", "dd"]);
});

test("the page address carries the switches when they differ from the defaults, and a link wins", async ({ page }) => {
  await openPage(page);
  expect(new URL(page.url()).searchParams.has("show")).toBe(false); // defaults: nothing added
  await page.locator("#simpleView").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("show")).toBe("zones,sma50,sma200"); // written within URL_GAP (250 ms)
  // someone else opens that link, with their own different saved switches
  await page.evaluate(() => localStorage.setItem("panes", JSON.stringify({ vol: true, rsi: true, macd: true })));
  await page.goto("index.html?window=1m&show=zones,sma50,sma200"); await ready(page);
  expect(Object.entries(await panes(page)).filter(([, v]) => v).map(([k]) => k).sort()).toEqual(["sma200", "sma50", "zones"]);
  // and an all-off link
  await page.goto("index.html?window=1m&show=none"); await ready(page);
  expect(Object.values(await panes(page)).some(Boolean)).toBe(false);
});

test("a link carrying only ?show= still sets the layers", async ({ page }) => {
  // the address carries nothing else, so the reader's remembered window is kept
  await openPage(page, "?window=6m");
  await page.goto("index.html?show=zones,sma50,sma200");
  await page.waitForFunction(() => window.__dashboard && window.__dashboard.res);
  expect(Object.entries(await panes(page)).filter(([, v]) => v).map(([k]) => k).sort()).toEqual(["sma200", "sma50", "zones"]);
  expect(await page.evaluate(() => window.__dashboard.res.opts.window)).toBe(126);
});
