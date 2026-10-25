// Support levels the price has fallen below are shown as "levels above price" (A1, A2, …).
// Frozen data: close $66.29; the 12-month window has A1 $70.26 and A2 $75.47.
const { test, expect } = require("@playwright/test");
const { openPage, DATA } = require("./helpers");

test("the table lists levels above the price first, highest at the top", async ({ page }) => {
  const errors = await openPage(page, "?window=12m");
  const rows = page.locator("#levels tbody tr");
  const first = await rows.evaluateAll((trs) => trs.slice(0, 4).map((tr) => tr.cells[0].textContent.trim()));
  expect(first).toEqual(["A2", "A1", "Last close", "S1"]);
  const a1 = page.locator("#levels tbody tr", { hasText: "A1" });
  await expect(a1).toContainText("$70.26");
  await expect(a1).toContainText("Above price");
  await expect(a1).toContainText("price closed below it");
  await expect(a1.locator(".num").nth(2)).toContainText("+"); // distance is above the close
  expect(errors).toEqual([]);
});

test("a 1-month window with no floor below still names the level above", async ({ page }) => {
  const errors = await openPage(page, "?window=1m");
  await expect(page.locator("#levels tbody .lvl.support")).toHaveCount(0);
  await expect(page.locator("#levels tbody .lvl.above")).toHaveText(["A2", "A1"]);
  await expect(page.locator("#blHeadline")).toContainText("the nearest level is above the price");
  await expect(page.locator("#blRows dt", { hasText: "Above the price" })).toBeVisible();
  // the table says why there is nothing below, instead of claiming there were too few swing lows
  await expect(page.locator("#levels tbody")).toContainText("No support below the price in a 1 month window: the levels it found are all above the price (A1, A2)");
  await expect(page.locator("#levels tbody")).not.toContainText("not put in enough swing lows");
  expect(errors).toEqual([]);
});

test("levels above price are on the chart by default, and the switch hides them", async ({ page }) => {
  const errors = await openPage(page);
  const sw = page.locator('input[data-pane="above"]');
  await expect(sw).toBeChecked();
  await expect(page.locator("#legend")).toContainText("Level above price");
  await sw.uncheck();
  expect(await page.evaluate(() => window.__dashboard.panes.above)).toBe(false);
  await expect(page.locator("#legend")).not.toContainText("Level above price");
  // the table keeps them: the switch is about the chart only
  await expect(page.locator("#levels tbody .lvl.above")).toHaveCount(2);
  // and the choice is remembered
  await page.reload();
  await page.waitForFunction(() => window.__dashboard && window.__dashboard.res);
  await expect(sw).not.toBeChecked();
  expect(errors).toEqual([]);
});

test("the CSV download includes the levels above price", async ({ page }) => {
  await openPage(page, "?window=12m");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#dlCsv").click()]);
  const lines = require("fs").readFileSync(await download.path(), "utf8").split("\n");
  expect(lines.slice(2, 9).map((l) => l.split(",")[0])).toEqual(["A2", "A1", "S1", "S2", "S3", "S4", "S5"]);
  expect(lines[3]).toMatch(/^A1,70\.26,.*,Above price,/);
});

test("when more than five levels sit above the price, the table says how many are not listed", async ({ page }) => {
  // The frozen data cut off at 2026-03-27: with a 9-month window and the narrowest
  // cluster distance, 9 zones sit above that day's close. The table lists the 5 strongest.
  const full = JSON.parse(DATA);
  const end = full.dates.indexOf("2026-03-27");
  const cut = { ...full, dates: full.dates.slice(0, end + 1), series: {} };
  for (const [k, v] of Object.entries(full.series)) cut.series[k] = v.slice(0, end + 1);
  cut.meta = { ...full.meta, as_of: "2026-03-27", rows: end + 1 };
  const errors = await openPage(page, "?window=9m&cluster=0.25", { data: JSON.stringify(cut) });
  await expect(page.locator("#levels tbody .lvl.above")).toHaveText(["A5", "A4", "A3", "A2", "A1"]);
  await expect(page.locator("#levels tbody tr.foot-row")).toContainText("4 weaker levels above the price are not listed; only the strongest 5 are shown.");
  expect(errors).toEqual([]);
});

test("the 12-month table counts the weaker levels below the price that it does not list", async ({ page }) => {
  // the frozen data has 7 levels below the 12-month close; the table lists the strongest 5
  const errors = await openPage(page, "?window=12m");
  await expect(page.locator("#levels tbody .lvl.support")).toHaveCount(5);
  await expect(page.locator("#levels tbody tr.foot-row")).toContainText("2 weaker levels below the price are not listed; only the strongest 5 are shown.");
  expect(errors).toEqual([]);
});
