// Shared set-up: serve the frozen data instead of the live files, fix the clock to
// the evening of the fixture's last session, and collect every error the page reports.
const path = require("path");
const fs = require("fs");

const FIX = path.join(__dirname, "..", "fixtures");
const DATA = fs.readFileSync(path.join(FIX, "tqqq-2026-10-23.json"), "utf8");
const CHANGES = fs.readFileSync(path.join(FIX, "changes-2026-10-23.json"), "utf8");

async function openPage(page, query = "", { data = DATA, changes = CHANGES } = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.clock.setFixedTime(new Date("2026-10-23T20:00:00-04:00"));
  await page.route("**/data/tqqq.json*", (r) => (data === null
    ? r.fulfill({ status: 404, body: "" })
    : r.fulfill({ contentType: "application/json", body: data })));
  await page.route("**/data/changes.json*", (r) => r.fulfill({ contentType: "application/json", body: changes }));
  await page.goto("index.html" + query);
  if (data !== null) {
    try {
      await page.waitForFunction(() => window.__dashboard && window.__dashboard.res, null, { timeout: 10000 });
    } catch (e) {
      const state = await page.evaluate(() => ({
        ready: document.readyState, dashboard: !!window.__dashboard, webdriver: navigator.webdriver,
        headline: document.querySelector("#blHeadline")?.textContent, asOf: document.querySelector("#asOf")?.textContent,
        scripts: [...document.scripts].map((s) => s.src),
      }));
      throw new Error(`page did not finish loading: ${JSON.stringify(state)}; errors: ${JSON.stringify(errors)}`);
    }
  }
  return errors;
}

/** The main chart's visible range, in bars: { from, to }. */
const view = (page) => page.evaluate(() => ({ ...window.__dashboard.charts.main.view }));

/** Scroll the chart into view and move the mouse to the middle of the price pane. */
async function overChart(page) {
  const canvas = page.locator("#mainChart canvas");
  await canvas.evaluate((c) => c.scrollIntoView({ block: "start" }));
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 150);
  return box;
}

module.exports = { openPage, view, overChart, DATA };
