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

test("every window up to 9 months lists the same levels, from the last 200 sessions", async ({ page }) => {
  const errors = await openPage(page);
  for (const w of ["1m", "3m", "6m", "9m"]) {
    await page.locator(`#windowSeg button[data-w="${w}"]`).click();
    await expect(page.locator("#levels tbody .lvl.above")).toHaveText(["A2", "A1"]);
    await expect(page.locator("#levels tbody .lvl.support")).toHaveText(["S1", "S2", "S3", "S4", "S5", "S6"]);
    await expect(page.locator("#levels tbody tr", { hasText: "S6" })).toContainText("$37.16");
    await expect(page.locator("#levels tbody tr.price-row")).toContainText("levels from the last 200 sessions");
    await expect(page.locator("#levels tbody tr.foot-row")).toHaveCount(0); // nothing left unlisted
  }
  // 12 months looks back further, 252 sessions, and finds one more level below
  await page.locator('#windowSeg button[data-w="12m"]').click();
  await expect(page.locator("#levels tbody .lvl.support")).toHaveCount(7);
  await expect(page.locator("#levels tbody tr.price-row")).toContainText("levels from the last 252 sessions");
  expect(errors).toEqual([]);
});

test("the window still sets how much of the chart opens, and the returns period", async ({ page }) => {
  await openPage(page);
  const span = await page.evaluate(() => { const v = window.__dashboard.charts.main.view; return v.to - v.from; });
  expect(span).toBeLessThan(30); // about 21 sessions plus a little context
  expect(await page.evaluate(() => window.__dashboard.res.start)).toBe(await page.evaluate(() => window.__dashboard.res.end - 20));
  await expect(page.locator("#benchStats")).toContainText("TQQQ return");
});
test("levels above price are on the chart by default; the switch hides all but the nearest", async ({ page }) => {
  const errors = await openPage(page, "?window=12m");
  const sw = page.locator('input[data-pane="above"]');
  await expect(sw).toBeChecked();
  const above = () => page.evaluate(() => window.__dashboard.shownLevels.above.map((z) => z.id));
  expect(await above()).toEqual(["A1", "A2"]);
  await sw.uncheck();
  expect(await above()).toEqual(["A1"]); // the nearest level above always stays
  await expect(page.locator("#levels tbody .lvl.above")).toHaveCount(2); // the table keeps them all
  await page.reload();
  await page.waitForFunction(() => window.__dashboard && window.__dashboard.res);
  await expect(sw).not.toBeChecked(); // the choice is remembered
  expect(errors).toEqual([]);
});
test("the CSV download includes the levels above price", async ({ page }) => {
  await openPage(page, "?window=12m");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#dlCsv").click()]);
  const lines = require("fs").readFileSync(await download.path(), "utf8").split("\n");
  expect(lines.slice(2, 9).map((l) => l.split(",")[0])).toEqual(["A2", "A1", "S1", "S2", "S3", "S4", "S5"]);
  expect(lines[3]).toMatch(/^A1,70\.26,.*,Above price,/);
});

test("every level is listed, even when there are many above the price", async ({ page }) => {
  // The frozen data cut off at 2026-03-27: with the narrowest cluster distance, 9 zones
  // sit above that day's close. The table lists all 9, with nothing left unlisted.
  const full = JSON.parse(DATA);
  const end = full.dates.indexOf("2026-03-27");
  const cut = { ...full, dates: full.dates.slice(0, end + 1), series: {} };
  for (const [k, v] of Object.entries(full.series)) cut.series[k] = v.slice(0, end + 1);
  cut.meta = { ...full.meta, as_of: "2026-03-27", rows: end + 1 };
  const errors = await openPage(page, "?window=9m&cluster=0.25", { data: JSON.stringify(cut) });
  await expect(page.locator("#levels tbody .lvl.above")).toHaveText(["A9", "A8", "A7", "A6", "A5", "A4", "A3", "A2", "A1"]);
  await expect(page.locator("#levels tbody tr.foot-row")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("the 12-month table lists all 7 levels below the price", async ({ page }) => {
  const errors = await openPage(page, "?window=12m");
  await expect(page.locator("#levels tbody .lvl.support")).toHaveText(["S1", "S2", "S3", "S4", "S5", "S6", "S7"]);
  await expect(page.locator("#levels tbody tr.foot-row")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the chart reaches down to the next floor below the current one", async ({ page }) => {
  // 1 month: prices run about $64.6-$87.4; S1 $66.72 is the current floor and the next one,
  // S2 $57.48, needs the scale to grow by about 35% - within the 50% limit, so it is drawn
  const errors = await openPage(page);
  const state = () => page.evaluate(() => {
    const p = window.__dashboard.charts.main.L.panes[0], r = window.__dashboard.res;
    const levels = [...r.supports, ...r.above];
    return {
      lo: p.S.lo, s2low: r.supports[1].low - r.tol / 2, off: window.__dashboard.offChart,
      expected: { above: levels.filter((z) => z.price > p.S.hi).length, below: levels.filter((z) => z.price < p.S.lo).length },
    };
  });
  let c = await state();
  expect(c.lo).toBeLessThanOrEqual(c.s2low);           // S2's whole band is on the chart
  expect(c.off).toMatchObject(c.expected);              // every level out of view is counted
  expect(c.off).toMatchObject({ below: 4, nearestBelow: "S3" }); // S3-S6 are out of view; the tag names S3
  // zoomed out to 12 months every level is in range, and no edge tag is needed
  await page.locator('#windowSeg button[data-w="12m"]').click();
  c = await state();
  expect(c.off).toMatchObject({ above: 0, below: 0 });
  expect(errors).toEqual([]);
});

test("a next floor too far away is named in the edge tag instead of squashing the candles", async ({ page }) => {
  // zoomed in to the last few sessions, reaching S2 would more than double the scale,
  // so the scale stays on the prices and the bottom tag names S2 (bands off: they widen the scale)
  await openPage(page);
  await page.locator('input[data-pane="bb"]').uncheck();
  await page.locator("#mainChart canvas").focus();
  const measure = () => page.evaluate(() => {
    const ch = window.__dashboard.charts.main, d = window.__dashboard.view.data, p = ch.L.panes[0];
    const [a, b] = [Math.ceil(ch.view.from), Math.floor(ch.view.to)];
    let lo = Infinity, hi = -Infinity;
    const bb = window.__dashboard.panes.bb; // the bands count towards the scale only when shown
    for (let i = a; i <= b; i++) {
      lo = Math.min(lo, d.low[i], bb ? d.bb_lower[i] ?? Infinity : Infinity);
      hi = Math.max(hi, d.high[i], bb ? d.bb_upper[i] ?? -Infinity : -Infinity);
    }
    const r = window.__dashboard.res;
    return { needed: (hi - (r.supports[1].low - r.tol / 2)) / (hi - lo), lo: p.S.lo, s2: r.supports[1].price, off: window.__dashboard.offChart };
  });
  let c = await measure();
  for (let k = 0; k < 10 && c.needed <= 1.5; k++) { await page.keyboard.press("+"); c = await measure(); }
  expect(c.needed).toBeGreaterThan(1.5);   // reaching S2 would stretch the scale by more than half
  expect(c.lo).toBeGreaterThan(c.s2);      // so S2 stays off the chart
  expect(c.off.nearestBelow).toBe("S2");   // and the bottom tag names it
});

test("the last-price tag stays on its price, and tags that do not fit are folded into the edge tag", async ({ page }) => {
  // the narrowest settings find 18 levels for 6 months: far more tags than fit beside the price
  const errors = await openPage(page, "?window=6m&period=2&cluster=0.25");
  const t = await page.evaluate(() => {
    const st = window.__dashboard, boxes = st.tagBoxes;
    const price = boxes.find((b) => /^\$/.test(b.text));
    const moved = boxes.filter((b) => b.target != null && Math.abs(b.y - b.target) > 2);
    const levels = st.res.supports.length + st.res.above.length;
    const ownTags = boxes.filter((b) => !b.edge && !/^\$/.test(b.text)).length;
    return { priceOff: Math.abs(price.y - price.target), moved: moved.length, joined: moved.filter((b) => b.leader).length,
      levels, ownTags, folded: st.offChart.above + st.offChart.below };
  });
  expect(t.priceOff).toBeLessThanOrEqual(1);       // the one number that must be exact
  expect(t.joined).toBe(t.moved);                   // every tag moved off its line is joined back to it
  expect(t.ownTags + t.folded).toBe(t.levels);      // every level is tagged or counted in an edge tag
  expect(errors).toEqual([]);
});

test("when the price sits at the bottom edge, the edge tag moves to the left corner", async ({ page }) => {
  // 1 month, Mondays, Bollinger Bands off: the scale fits the prices only, reaching S2 would
  // stretch it by more than half, so S2 is folded into the edge tag - and the last price sits
  // near the bottom of the chart, where that tag would go
  await openPage(page);
  await page.locator('input[data-pane="bb"]').uncheck();
  await page.locator('#cadenceSeg button[data-cadence="weekly"]').click();
  const t = await page.evaluate(() => {
    const st = window.__dashboard, S = st.charts.main.L.panes[0].S, boxes = st.tagBoxes;
    const price = boxes.find((b) => /^\$/.test(b.text)), edge = boxes.find((b) => b.edge && b.text.startsWith("▼"));
    return { priceOff: Math.abs(price.y - price.target), edgeText: edge?.text, edgeLeft: edge?.left, plotLeft: S.left, overlap: edge && edge.top < price.bottom && price.top < edge.bottom && edge.left < price.right && price.left < edge.right };
  });
  expect(t.priceOff).toBeLessThanOrEqual(1);      // the crowded bottom does not push the price tag
  expect(t.edgeText).toMatch(/^▼ S2 \$57\.48/);   // S2 is the folded level it names
  expect(t.edgeLeft).toBeLessThan(t.plotLeft + 10); // in the left-hand corner
  expect(t.overlap).toBe(false);
});
