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

test("the page reads in order: key numbers, bottom line, then the chart", async ({ page }) => {
  await openPage(page);
  const tops = await page.evaluate(() => {
    const top = (s) => document.querySelector(s).getBoundingClientRect().top + scrollY;
    return ["#kpis", "#h-find", "#h-chart", "#h-table", "#h-ind", "#h-method"].map(top);
  });
  expect(tops).toEqual([...tops].sort((a, b) => a - b)); // each section starts below the one before
  expect(tops[0]).toBeGreaterThanOrEqual(12);            // a gap between the top bar and the first section
});

test("the legend, switches and chart description sit below the chart, the help last", async ({ page }) => {
  await openPage(page);
  const g = await page.evaluate(() => {
    const chart = document.querySelector("#mainChart"), card = chart.closest(".card");
    const after = (e) => !!(chart.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING);
    const parts = [card.querySelector("#legend"), ...card.querySelectorAll(".chips"), card.querySelector(".help.lede"), card.querySelector("#chartHelp")];
    const tops = parts.map((e) => e.getBoundingClientRect().top);
    return { all: parts.every(after), sorted: tops.every((t, i) => i === 0 || t >= tops[i - 1]), below: tops[0] >= chart.getBoundingClientRect().bottom };
  });
  expect(g).toEqual({ all: true, sorted: true, below: true });
});

test("what changed is the last row of the bottom line, with the day's items", async ({ page }) => {
  const changes = JSON.stringify({ as_of: "2026-10-23", previous: "2026-10-22", items: [
    { type: "broken", text: "Support at $70.26 broke — price closed below the zone." },
    { type: "rsi", text: "RSI moved from neutral to weak (35)." }] });
  await openPage(page, "", { changes });
  const row = page.locator("#blRows > div").last();
  await expect(row).toHaveId("blChanges");
  await expect(row.locator("dt")).toHaveText("Since the previous session");
  await expect(row.locator("#changes li")).toHaveText([/Broken\s*Support at \$70\.26 broke/, /RSI\s*RSI moved from neutral to weak/]);
  await expect(row.locator("#changesNote")).toContainText("Oct 23, 2026 compared with Oct 22, 2026, for the levels shown when the page opens (the last 200 sessions");
  await expect(page.locator("section[aria-labelledby='h-chg']")).toHaveCount(0); // no separate card any more
  // still there after a window change redraws the bottom line
  await page.click("#windowSeg [data-w='12m']");
  await expect(page.locator("#blChanges #changes li")).toHaveCount(2);
});

test("a quiet day is one line in the bottom line", async ({ page }) => {
  await openPage(page);  // the frozen comparison has no items
  await expect(page.locator("#blChanges #changes li")).toHaveText(["No changes to the support levels, trend or momentum labels."]);
});

test("the page opens on the settings the nightly comparison uses", async ({ page }) => {
  await openPage(page);
  const g = await page.evaluate(() => ({ window: window.__dashboard.opts.window, want: SR.PAGE_SETTINGS.window }));
  expect(g.window).toBe(g.want);
});

test("on a wide screen the bottom line's rows use the card's width, in two columns", async ({ page }, info) => {
  if (info.project.name !== "desktop") test.skip();
  await page.setViewportSize({ width: 1400, height: 900 });
  await openPage(page);
  const g = await page.evaluate(() => {
    const card = document.querySelector(".findings").getBoundingClientRect();
    const rows = [...document.querySelectorAll("#blRows > div")].map((r) => r.getBoundingClientRect());
    const last = document.querySelector("#blChanges").getBoundingClientRect();
    return { lefts: new Set(rows.slice(0, -1).map((r) => Math.round(r.left))).size, reach: Math.max(...rows.map((r) => r.right)) / card.right, spans: last.width > card.width * 0.9 };
  });
  expect(g.lefts).toBe(2);                    // two columns
  expect(g.reach).toBeGreaterThan(0.95);      // no empty right half
  expect(g.spans).toBe(true);                 // "Since the previous session" spans both
});

test("on a phone the bottom line's rows are one column", async ({ page }, info) => {
  if (info.project.name !== "phone") test.skip();
  await openPage(page);
  const lefts = await page.evaluate(() => new Set([...document.querySelectorAll("#blRows > div")].map((r) => Math.round(r.getBoundingClientRect().left))).size);
  expect(lefts).toBe(1);
});
