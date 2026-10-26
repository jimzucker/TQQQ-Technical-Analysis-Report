// Bollinger Bands on the price chart: on by default; switching them off is remembered.
// Frozen data, last session 2026-10-23: lower band $65.26, upper band $87.32.
const { test, expect } = require("@playwright/test");
const { openPage, overChart } = require("./helpers");

test("Bollinger Bands are on by default, and switching them off is remembered", async ({ page }) => {
  const errors = await openPage(page);
  const sw = page.locator('input[data-pane="bb"]');
  await expect(sw).toBeChecked();
  expect(await page.evaluate(() => window.__dashboard.panes.bb)).toBe(true);
  await expect(page.locator("#legend")).toContainText("Bollinger Bands");
  await sw.uncheck();
  await expect(page.locator("#legend")).not.toContainText("Bollinger");
  await page.reload();
  await page.waitForFunction(() => window.__dashboard && window.__dashboard.res);
  await expect(sw).not.toBeChecked(); // the reader's choice wins over the default
  expect(errors).toEqual([]);
});

test("a reader whose saved switches predate the bands still gets them on", async ({ page }) => {
  // switches saved before this change have no Bollinger entry; the default fills it in
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("panes", JSON.stringify({ vol: true, rsi: false, macd: false, dd: false, rolling: true, profile: false, above: true }));
      sessionStorage.setItem("seeded", "1");
    }
  });
  await openPage(page);
  await expect(page.locator('input[data-pane="bb"]')).toBeChecked();
  await expect(page.locator('input[data-pane="rsi"]')).not.toBeChecked(); // their other choices are kept
});

test("the price scale stretches to fit the bands, so they are not cut off", async ({ page }) => {
  await openPage(page);
  const scale = () => page.evaluate(() => {
    const c = window.__dashboard.charts.main, d = window.__dashboard.view.data;
    const p = c.L.panes[0], [a, b] = [Math.ceil(c.view.from), Math.floor(c.view.to)];
    let lo = Infinity, hi = -Infinity;
    for (let i = a; i <= b; i++) { if (d.bb_lower[i] != null) lo = Math.min(lo, d.bb_lower[i]); if (d.bb_upper[i] != null) hi = Math.max(hi, d.bb_upper[i]); }
    return { min: p.S.lo, max: p.S.hi, bandLow: lo, bandHigh: hi };
  });
  await page.locator('input[data-pane="bb"]').uncheck();
  const off = await scale();
  expect(off.max).toBeLessThan(off.bandHigh); // without the bands the scale fits the prices only
  await page.locator('input[data-pane="bb"]').check();
  const on = await scale();
  expect(on.min).toBeLessThanOrEqual(on.bandLow);
  expect(on.max).toBeGreaterThanOrEqual(on.bandHigh);
});

test("hovering a bar shows that day's band values", async ({ page }) => {
  await openPage(page);
  await page.locator('input[data-pane="bb"]').check();
  const box = await overChart(page);
  await page.mouse.move(box.x + box.width - 70, box.y + 200); // the last bar
  const tip = page.locator("#mainChart .chart-tip");
  await expect(tip).toContainText("Oct 23, 2026");
  await expect(tip).toContainText("Bollinger Bands");
  await expect(tip).toContainText("$65.26 – $87.32");
});
