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

test("the time buttons (1M-12M) sit in a toolbar directly above the chart", async ({ page }) => {
  await openPage(page);
  const g = await page.evaluate(() => {
    const seg = document.querySelector("#windowSeg"), chart = document.querySelector("#mainChart");
    const bar = seg.closest(".chart-toolbar"), a = bar.getBoundingClientRect(), b = chart.getBoundingClientRect();
    return { inBar: !!bar, sameCard: seg.closest(".card") === chart.closest(".card"), gap: b.top - a.bottom, barNext: bar.nextElementSibling === chart };
  });
  expect(g.inBar && g.sameCard && g.barNext).toBe(true); // the toolbar is the element right before the chart
  expect(g.gap).toBeGreaterThanOrEqual(0);
  expect(g.gap).toBeLessThan(20);     // nothing between them, on a desktop and a phone (where the toolbar wraps)
});
