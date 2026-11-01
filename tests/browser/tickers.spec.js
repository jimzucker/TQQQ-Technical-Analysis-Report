// More than one ticker: the picker, links, remembering the choice, and ticker-specific text.
// Frozen data, 2026-10-23: TQQQ $66.29 (3x, vs QQQ), QQQ $704.40 (1x, vs SPY), SPY $759.97 (1x, vs QQQ).
const { test, expect } = require("@playwright/test");
const { openPage } = require("./helpers");

const ready = (page) => page.waitForFunction(() => window.__dashboard && window.__dashboard.res);
const visibleText = (page) => page.evaluate(() => {
  // every word a reader can see, except the picker's own list of tickers
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll("#tickerForm, script, [hidden]").forEach((el) => el.remove());
  return clone.innerText;
});

const lines = (page) => page.locator("#tickerList li").evaluateAll((li) => li.map((x) => x.innerText.replace(/\s+/g, " ").trim()));

test("one labelled ticker field lists the tickers on the list when clicked, with TQQQ shown by default", async ({ page }) => {
  const errors = await openPage(page);
  await expect(page.locator('label[for="tickerInput"]')).toHaveText("Ticker");
  await expect(page.locator("#tickerInput")).toHaveValue("TQQQ");
  await expect(page.locator("#tickerList")).toBeHidden();
  await page.locator("#tickerInput").click();
  await expect(page.getByRole("listbox", { name: "Tickers" })).toBeVisible();
  expect(await lines(page)).toEqual(["TQQQ ProShares UltraPro QQQ", "QQQ Invesco QQQ Trust", "SPY SPDR S&P 500 ETF Trust"]);
  await expect(page.getByRole("option", { selected: true })).toHaveText(/TQQQ/);
  await expect(page.locator("h1")).toHaveText("TQQQ support levels");
  expect(new URL(page.url()).searchParams.has("ticker")).toBe(false); // the default needs nothing in the address
  await expect(page.locator("#tickerDesc")).toHaveText("ProShares UltraPro QQQ (3× Nasdaq-100)");
  expect(errors).toEqual([]);
});

test("choosing QQQ shows QQQ's own data and wording, with no TQQQ or 3x left on the page", async ({ page }) => {
  const errors = await openPage(page);
  await page.locator("#tickerInput").fill("QQQ");
  await Promise.all([page.waitForNavigation(), page.locator("#tickerInput").press("Enter")]);
  await ready(page);
  expect(new URL(page.url()).searchParams.get("ticker")).toBe("QQQ");
  await expect(page.locator("#blHeadline")).toContainText("QQQ closed at $704.40");
  await expect(page.locator("#h-bench")).toHaveText("QQQ vs SPY");
  await expect(page.locator("h1")).toHaveText("QQQ support levels");
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
  await expect(page.locator("#tickerInput")).toHaveValue("SPY");
  await expect(page.locator("#blHeadline")).toContainText("SPY closed at $759.97");
  await page.goto("index.html"); await ready(page); // a bookmark of the plain address
  await expect(page.locator("#tickerInput")).toHaveValue("SPY");
  await page.goto("index.html?ticker=QQQ"); await ready(page);
  await expect(page.locator("#tickerInput")).toHaveValue("QQQ");
});

test("a ticker not on the list says so and shows the default when lookups are not switched on", async ({ page }) => {
  const errors = await openPage(page, "?ticker=ZZZZ");
  await expect(page.locator("#tickerNote")).toBeVisible();
  // the lookup service is not set up in the shipped list ("proxy": ""), so it says that too
  await expect(page.locator("#tickerNoteText")).toHaveText("ZZZZ is not on the daily list. Showing or adding other tickers needs the lookup service, which is not set up on this site yet. TQQQ is shown instead.");
  await expect(page.locator("#addTicker")).toBeHidden();
  await expect(page.locator("#tickerInput")).toHaveValue("TQQQ");
  expect(errors).toEqual([]);
});

test("clicking the field selects the ticker, so typing replaces it; Escape and leaving put it back", async ({ page }) => {
  await openPage(page, "?ticker=QQQ");
  const input = page.locator("#tickerInput");
  await input.click();
  expect(await input.evaluate((el) => [el.selectionStart, el.selectionEnd])).toEqual([0, 3]);
  await input.pressSequentially("S");
  await expect(input).toHaveValue("S");
  await input.press("Escape");
  await expect(page.locator("#tickerList")).toBeHidden();
  await expect(input).toHaveValue("QQQ");
  await input.pressSequentially("SP");
  await input.blur();
  await expect(input).toHaveValue("QQQ");
  await expect(input).toHaveAttribute("aria-expanded", "false");
});

test("typing narrows the list by symbol or name; a symbol not on the list says the lookup service is not set up", async ({ page }) => {
  await openPage(page);
  const input = page.locator("#tickerInput");
  await input.click();
  await input.pressSequentially("QQ");
  // TQQQ is there by a word of its name, "QQQ"
  // the shipped list has no lookup service ("proxy": ""), so the last line says so instead of offering it
  expect(await lines(page)).toEqual(["TQQQ ProShares UltraPro QQQ", "QQQ Invesco QQQ Trust", "QQ is not on the daily list. Showing or adding other tickers needs the lookup service, which is not set up on this site yet."]);
  await expect(page.locator("#tickerList li.active")).toHaveCount(0); // Enter has nothing to open
  await input.fill("");
  await input.pressSequentially("invesco");
  expect(await lines(page)).toEqual(["QQQ Invesco QQQ Trust", "INVESCO is not on the daily list. Showing or adding other tickers needs the lookup service, which is not set up on this site yet."]);
  await input.fill("");
  await input.pressSequentially("$$");
  expect(await lines(page)).toEqual(['"$$" is not a ticker symbol']);
  await page.waitForTimeout(300);
  expect(new URL(page.url()).searchParams.get("ticker")).toBe(null); // typing alone opens nothing
  // Enter on a symbol not on the list says why at once, without reloading the page
  await input.fill("");
  await input.pressSequentially("YMAG");
  await input.press("Enter");
  await expect(page.locator("#tickerNoteText")).toHaveText("YMAG is not on the daily list. Showing or adding other tickers needs the lookup service, which is not set up on this site yet.");
  await expect(page.locator("h1")).toHaveText("TQQQ support levels");
});

test("clicking a line opens that ticker", async ({ page }) => {
  await openPage(page);
  const input = page.locator("#tickerInput");
  await input.click();
  await input.pressSequentially("SP");
  await Promise.all([page.waitForNavigation(), page.getByRole("option", { name: /SPY/ }).click()]);
  await ready(page);
  expect(new URL(page.url()).searchParams.get("ticker")).toBe("SPY");
  await expect(input).toHaveValue("SPY");
});

test("the arrow keys move through the list and Enter opens the highlighted line", async ({ page }) => {
  await openPage(page);
  const input = page.locator("#tickerInput");
  await input.click();
  await expect(page.locator("#tickerList li.active")).toContainText("TQQQ"); // starts on the current ticker
  await input.press("ArrowDown");
  await expect(page.locator("#tickerList li.active")).toContainText("QQQ");
  await expect(input).toHaveAttribute("aria-activedescendant", "tickerOpt1");
  await input.press("ArrowUp");
  await input.press("ArrowUp");                           // wraps round to the last line
  await expect(page.locator("#tickerList li.active")).toContainText("SPY");
  await Promise.all([page.waitForNavigation(), input.press("Enter")]);
  await ready(page);
  expect(new URL(page.url()).searchParams.get("ticker")).toBe("SPY");
});

test("Enter on the ticker already shown just closes the list", async ({ page }) => {
  await openPage(page);
  const input = page.locator("#tickerInput");
  await input.click();
  await input.press("Enter");
  await expect(page.locator("#tickerList")).toBeHidden();
  await expect(input).toHaveValue("TQQQ");
  expect(await page.evaluate(() => window.__dashboard.res !== undefined)).toBe(true);
});

test("the list fits on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await openPage(page);
  await page.locator("#tickerInput").click();
  const box = await page.locator("#tickerList").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
