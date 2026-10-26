// How the main chart responds to the mouse, trackpad, keyboard and buttons.
const { test, expect } = require("@playwright/test");
const { openPage, view, overChart } = require("./helpers");

const span = (v) => v.to - v.from;
const full = (page) => page.evaluate(() => {
  const [from, to] = window.__dashboard.charts.main.bounds;
  return { from, to };
});

test("keyboard + and - zoom, and 0 resets", async ({ page }) => {
  await openPage(page);
  const start = await view(page);
  await page.locator("#mainChart canvas").focus();
  await page.keyboard.press("+");
  const zoomed = await view(page);
  expect(span(zoomed)).toBeLessThan(span(start));
  await page.keyboard.press("-");
  expect(span(await view(page))).toBeGreaterThan(span(zoomed));
  await page.keyboard.press("0");
  expect(await view(page)).toEqual(start);
});

test("the chart opens on the chosen window, with all the history still reachable", async ({ page }) => {
  await openPage(page);
  const start = await view(page);
  const all = await full(page);
  expect(start.to).toBe(all.to);
  // it opens a little before the window starts, for context, but well short of all the history
  const windowStart = await page.evaluate(() => window.__dashboard.view.start);
  expect(start.from).toBeLessThanOrEqual(windowStart);
  expect(start.from).toBeGreaterThan(windowStart - 30);
  expect(start.from).toBeGreaterThan(all.from);
});

test("Reset view and double-click put the chart back", async ({ page }) => {
  await openPage(page);
  await page.locator("#mainChart canvas").focus();
  const start = await view(page);
  await page.keyboard.press("+");
  await page.locator("#resetZoom").click();
  expect(await view(page)).toEqual(start);
  await page.locator("#mainChart canvas").focus(); // the click moved focus to the button
  await page.keyboard.press("-"); await page.keyboard.press("-"); // zoom out past the window
  expect(span(await view(page))).toBeGreaterThan(span(start));
  await page.locator("#mainChart canvas").dblclick({ position: { x: 300, y: 150 } });
  expect(await view(page)).toEqual(start);
});

test("after a window change, reset goes back to the new window", async ({ page }) => {
  await openPage(page);
  await page.locator('#windowSeg button[data-w="3m"]').click();
  const start3m = await view(page);
  expect(span(start3m)).toBeLessThan(80); // about 63 sessions plus a little context
  await page.locator("#zoomOut").click();
  await page.locator("#resetZoom").click();
  expect(await view(page)).toEqual(start3m);
  // and after switching to Mondays, which rebuilds the chart
  await page.locator('#cadenceSeg button[data-cadence="weekly"]').click();
  const startWeekly = await view(page);
  await page.locator("#zoomOut").click();
  await page.locator("#resetZoom").click();
  expect(await view(page)).toEqual(startWeekly);
});

test("dragging sideways moves the chart through time", async ({ page }) => {
  await openPage(page);
  await page.locator("#mainChart canvas").focus();
  await page.keyboard.press("+"); await page.keyboard.press("+"); // zoom in so there is room to move
  const before = await view(page);
  const box = await overChart(page);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + 150, { steps: 10 });
  await page.mouse.up();
  const after = await view(page);
  expect(after.from).toBeLessThan(before.from); // dragged right = earlier dates
  expect(span(after)).toBeCloseTo(span(before), 5);
});

test("Ctrl + scroll over the chart zooms it", async ({ page }) => {
  await openPage(page);
  const before = await view(page);
  await overChart(page);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect.poll(async () => span(await view(page))).toBeLessThan(span(before));
});

test("a plain scroll over the chart scrolls the page and leaves the chart alone", async ({ page }) => {
  await openPage(page);
  await overChart(page);
  const before = await view(page);
  const y0 = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0);
  expect(await view(page)).toEqual(before);
  // and a short note says how to zoom instead
  await expect(page.locator("#mainChart .chart-hint")).toHaveClass(/show/);
  await expect(page.locator("#mainChart .chart-hint")).toContainText("To zoom");
});

test("a sideways swipe moves the chart through time, not the page", async ({ page }) => {
  await openPage(page);
  await page.locator("#mainChart canvas").focus();
  await page.keyboard.press("+"); await page.keyboard.press("+");
  await page.keyboard.press("0"); await page.keyboard.press("+"); // zoomed in, away from both ends
  const before = await view(page);
  await overChart(page);
  const x0 = await page.evaluate(() => window.scrollX);
  await page.mouse.wheel(-200, 0); // fingers moving right = earlier dates
  await expect.poll(async () => (await view(page)).from).toBeLessThan(before.from);
  expect(span(await view(page))).toBeCloseTo(span(before), 5);
  expect(await page.evaluate(() => window.scrollX)).toBe(x0);
});

test("Shift + scroll moves the chart through time", async ({ page }) => {
  await openPage(page);
  await page.locator("#mainChart canvas").focus();
  await page.keyboard.press("0"); await page.keyboard.press("+");
  const before = await view(page);
  await overChart(page);
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 200);
  await page.keyboard.up("Shift");
  await expect.poll(async () => (await view(page)).from).toBeGreaterThan(before.from);
  expect(span(await view(page))).toBeCloseTo(span(before), 5);
});

test("⌘ + scroll zooms, like Ctrl + scroll", async ({ page }) => {
  await openPage(page);
  const before = await view(page);
  await overChart(page);
  await page.keyboard.down("Meta");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Meta");
  await expect.poll(async () => span(await view(page))).toBeLessThan(span(before));
});

test("the + and − buttons zoom in and out", async ({ page }) => {
  await openPage(page);
  const before = await view(page);
  await page.locator("#zoomIn").click();
  const zoomed = await view(page);
  expect(span(zoomed)).toBeLessThan(span(before));
  await page.locator("#zoomOut").click();
  expect(span(await view(page))).toBeGreaterThan(span(zoomed));
});

test("Mondays view draws one bar per week", async ({ page }) => {
  await openPage(page);
  const daily = await page.evaluate(() => window.__dashboard.view.dates.length);
  await page.locator('#cadenceSeg button[data-cadence="weekly"]').click();
  const weekly = await page.evaluate(() => window.__dashboard.view.dates.length);
  expect(weekly).toBeLessThan(daily / 4);
  // each bar is that week's Monday, or the week's first session when there is none:
  // a holiday Monday, or the first week of data, which starts on a Thursday
  const days = await page.evaluate(() => window.__dashboard.view.dates.map((d) => new Date(d + "T12:00:00Z").getUTCDay()));
  expect(days.slice(1).every((d) => d === 1 || d === 2)).toBe(true);
});

test("hovering a bar shows its numbers", async ({ page }) => {
  await openPage(page);
  const box = await overChart(page);
  await page.mouse.move(box.x + 400, box.y + 200);
  await expect(page.locator("#mainChart .chart-tip")).toBeVisible();
  await expect(page.locator("#mainChart .chart-tip")).toContainText("Open / Close");
});

test("dates sit in their own strip under the last panel, written as month names", async ({ page }) => {
  for (const q of ["?window=1m", "?window=12m"]) {
    await openPage(page, q);
    const { axisY, bottom, ticks } = await page.evaluate(() => {
      const c = window.__dashboard.charts.main, last = c.L.panes[c.L.panes.length - 1];
      return { axisY: c.L.xAxisY, bottom: last.y + last.h, ticks: c.ticks.map((t) => t.label) };
    });
    expect(axisY).toBeGreaterThanOrEqual(bottom); // not drawn over the volume bars
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    // "Oct", "Sep 25" or "Jan 2026" — never "09-25"
    for (const t of ticks) expect(t).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)( \d{1,2}| \d{4})?$/);
  }
});
