// Text read from the data files must reach the page as text, never as HTML.
// Today the files come from this repository's own nightly job; these tests keep
// that safe if the data ever comes from somewhere less trusted (a price source
// returning something odd, or the planned any-ticker feature).
const { test, expect } = require("@playwright/test");
const { openPage, DATA } = require("./helpers");

const ATTACK = '<img src=x onerror="window.__injected=1">';

test("text in the data files cannot add HTML or run script on the page", async ({ page }) => {
  const data = JSON.parse(DATA);
  data.meta.source = ATTACK;
  data.meta.warnings = [ATTACK];
  data.meta.generated_utc = ATTACK;
  const changes = JSON.stringify({
    as_of: "2026-10-23", previous: "2026-10-22",
    items: [{ type: "new", text: ATTACK }, { type: ATTACK, text: "an item type the page does not know" }],
  });
  page.on("dialog", (d) => d.dismiss());
  await openPage(page, "", { data: JSON.stringify(data), changes });
  await expect(page.locator("#changes li")).toHaveCount(2);
  // the attack text is shown as text...
  await expect(page.locator("#changes")).toContainText("<img src=x");
  await expect(page.locator("#dataMeta")).toContainText("<img src=x");
  // ...and never becomes an element or runs
  expect(await page.locator("img[src='x']").count()).toBe(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
});
