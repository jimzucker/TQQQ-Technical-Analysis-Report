// The page reopens with the reader's last choices, in the same browser.
const { test, expect } = require("@playwright/test");
const { openPage } = require("./helpers");

const ready = (page) => page.waitForFunction(() => window.__dashboard && window.__dashboard.res);
const now = (page) => page.evaluate(() => ({
  window: window.__dashboard.res.opts.window, period: window.__dashboard.res.opts.period,
  theme: document.documentElement.dataset.theme, panes: window.__dashboard.panes, cadence: window.__dashboard.cadence,
}));

test("every choice survives reopening the page from its plain address", async ({ page }) => {
  const errors = await openPage(page);
  await page.locator('#windowSeg button[data-w="6m"]').click();
  await page.locator("#themeBtn").click();
  await page.locator('input[data-pane="rsi"]').uncheck();
  await page.locator('input[data-pane="macd"]').check();
  await page.locator('#cadenceSeg button[data-cadence="weekly"]').click();
  await page.locator("#settings summary").click();
  await page.locator("#period").fill("5");
  const chosen = await now(page);
  await page.goto("index.html"); // as from a bookmark: nothing in the address
  await ready(page);
  expect(await now(page)).toEqual(chosen);
  await expect(page.locator('#windowSeg button[data-w="6m"]')).toHaveAttribute("aria-checked", "true");
  expect(errors).toEqual([]);
});

test("a link that carries settings wins over the remembered ones", async ({ page }) => {
  await openPage(page);
  await page.locator('#windowSeg button[data-w="6m"]').click();
  await page.goto("index.html?window=3m");
  await ready(page);
  expect((await now(page)).window).toBe(63);
  // and that becomes the remembered choice
  await page.goto("index.html");
  await ready(page);
  expect((await now(page)).window).toBe(63);
});

test("Reset to defaults clears the method settings but keeps the window", async ({ page }) => {
  await openPage(page, "?window=6m&period=5");
  await page.locator("#settings summary").click();
  await page.locator("#resetSettings").click();
  await page.goto("index.html");
  await ready(page);
  expect(await now(page)).toMatchObject({ window: 126, period: 3 });
});

test("the page still works when the browser blocks storage", async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() {} };
    Object.defineProperty(window, "localStorage", { get: () => blocked });
  });
  const errors = await openPage(page);
  expect((await now(page)).window).toBe(21); // the page's own default
  await page.locator('#windowSeg button[data-w="3m"]').click();
  expect((await now(page)).window).toBe(63);
  expect(errors).toEqual([]);
});
