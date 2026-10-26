// More than one ticker: the picker, links, remembering the choice, and ticker-specific text.
// Frozen data, 2026-10-23: TQQQ $66.29 (3x, vs QQQ), QQQ $704.40 (1x, vs SPY), SPY $759.97 (1x, vs QQQ).
const { test, expect } = require("@playwright/test");
const { openPage } = require("./helpers");

const ready = (page) => page.waitForFunction(() => window.__dashboard && window.__dashboard.res);
const visibleText = (page) => page.evaluate(() => {
  // every word a reader can see, except the picker's own list of tickers
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll("#tickerPick, script, [hidden]").forEach((el) => el.remove());
  return clone.innerText;
});

test("the picker lists the tickers on the list, with TQQQ shown by default", async ({ page }) => {
  const errors = await openPage(page);
  await expect(page.locator("#tickerPick option")).toHaveText(["TQQQ", "QQQ", "SPY"]);
  await expect(page.locator("#tickerPick")).toHaveValue("TQQQ");
  expect(new URL(page.url()).searchParams.has("ticker")).toBe(false); // the default needs nothing in the address
  await expect(page.locator("#tickerDesc")).toHaveText("ProShares UltraPro QQQ (3× Nasdaq-100)");
  expect(errors).toEqual([]);
});

test("choosing QQQ shows QQQ's own data and wording, with no TQQQ or 3x left on the page", async ({ page }) => {
  const errors = await openPage(page);
  await Promise.all([page.waitForNavigation(), page.locator("#tickerPick").selectOption("QQQ")]);
  await ready(page);
  expect(new URL(page.url()).searchParams.get("ticker")).toBe("QQQ");
  await expect(page.locator("#blHeadline")).toContainText("QQQ closed at $704.40");
  await expect(page.locator("#h-bench")).toHaveText("QQQ vs SPY");
  await expect(page.locator("#tickerDesc")).toHaveText("Invesco QQQ Trust · tracks the Nasdaq-100");
  await expect(page.locator("#benchStats")).toContainText("Daily beta to SPY");
  await page.locator("#findingsSummary").click();
  const text = await visibleText(page);
  expect(text).not.toMatch(/\bTQQQ\b/);
  expect(text).not.toMatch(/3×|three times|daily resetting|leveraged ETF/i);
  expect(await page.evaluate(() => window.__dashboard.data.meta.symbol)).toBe("QQQ");
  expect(errors).toEqual([]);
});

test("TQQQ keeps its leverage wording", async ({ page }) => {
  await openPage(page);
  await page.locator("#findingsSummary").click();
  const text = await visibleText(page);
  expect(text).toMatch(/three times as much as the Nasdaq-100/);
  expect(text).toMatch(/daily resetting cost/);
  await expect(page.locator("#riskNote")).toContainText("3× leveraged ETF");
});

test("the chosen ticker is remembered, and a link with ?ticker= wins", async ({ page }) => {
  await openPage(page, "?ticker=SPY");
  await expect(page.locator("#tickerPick")).toHaveValue("SPY");
  await expect(page.locator("#blHeadline")).toContainText("SPY closed at $759.97");
  await page.goto("index.html"); await ready(page); // a bookmark of the plain address
  await expect(page.locator("#tickerPick")).toHaveValue("SPY");
  await page.goto("index.html?ticker=QQQ"); await ready(page);
  await expect(page.locator("#tickerPick")).toHaveValue("QQQ");
});

test("a ticker not on the list says so and shows the default", async ({ page }) => {
  const errors = await openPage(page, "?ticker=ZZZZ");
  await expect(page.locator("#tickerNote")).toBeVisible();
  await expect(page.locator("#tickerNote")).toHaveText("ZZZZ is not on the list of tickers this report covers yet, so TQQQ is shown.");
  await expect(page.locator("#tickerPick")).toHaveValue("TQQQ");
  expect(errors).toEqual([]);
});
