// The page fits the screen: nothing makes the page scroll sideways.
const { test, expect } = require("@playwright/test");
const { openPage } = require("./helpers");

test("no sideways page scroll, and the chart fits the screen", async ({ page }) => {
  const errors = await openPage(page);
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(scroll).toBeLessThanOrEqual(inner);
  const box = await page.locator("#mainChart canvas").boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(inner);
  expect(errors).toEqual([]);
});
