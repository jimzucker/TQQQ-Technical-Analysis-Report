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
  expect(await view(page)).toEqual(await full(page));
});

test("current behaviour: the chart opens on the window, but reset shows all the history", async ({ page }) => {
  // The chart opens on the chosen window (12 months by default), while Reset view,
  // double-click and the 0 key show every loaded session (about two years).
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
  await page.keyboard.press("+");
  await page.locator("#resetZoom").click();
  expect(await view(page)).toEqual(await full(page));
  await page.locator("#mainChart canvas").focus(); // the click moved focus to the button
  await page.keyboard.press("+");
  expect(span(await view(page))).toBeLessThan(span(await full(page)));
  await page.locator("#mainChart canvas").dblclick({ position: { x: 300, y: 150 } });
  expect(await view(page)).toEqual(await full(page));
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

test("current behaviour: a plain scroll over the main chart zooms it", async ({ page }) => {
  // Records how main behaves today. The scrolling change replaces this test.
  await openPage(page);
  const before = await view(page);
  await overChart(page);
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => span(await view(page))).toBeLessThan(span(before));
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
