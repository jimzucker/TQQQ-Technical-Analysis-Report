// Replays the support method over every session in the frozen fixture and compares the
// result with a recorded copy, so a change that moves any support level is caught.
//
//   node --test tests/                      check against tests/golden/levels.txt
//   UPDATE_GOLDEN=1 node --test tests/      re-record it after an intended change
//
// What is recorded, per session and per preset window: each support level's id, price,
// range, touches, score and status; the price of every zone the close is below; and
// the "what changed" items between consecutive daily snapshots.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const SR = require("../docs/js/support.js");

const FIXTURE = path.join(__dirname, "fixtures", "tqqq-2026-10-23.json");
const GOLDEN = path.join(__dirname, "golden", "levels.txt");
const WINDOWS = [21, 63, 126, 252];
const FIRST = 260; // the snapshot job needs this many sessions before it writes one

function replay() {
  const data = SR.fromPayload(JSON.parse(fs.readFileSync(FIXTURE, "utf8")));
  const lines = [];
  let prev = null;
  for (let end = FIRST; end < data.close.length; end++) {
    const t = SR.truncate(data, end);
    const day = data.dates[end];
    for (const w of WINDOWS) {
      const r = SR.analyze(t, { window: w });
      const sup = r.supports.map((z) =>
        [z.id, z.price.toFixed(4), z.low.toFixed(4), z.high.toFixed(4), z.touches, z.score, z.status].join(":"));
      const below = r.broken.map((z) => z.price.toFixed(4));
      lines.push(`${day} w${w} support ${sup.join(" ") || "-"} | close-below ${below.join(" ") || "-"}`);
    }
    const snap = SR.snapshot(t, {});
    const items = SR.diffSnapshots(prev, snap).map((x) => `${x.type}: ${x.text}`);
    lines.push(`${day} changes ${items.join(" / ") || "-"}`);
    prev = snap;
  }
  return lines.join("\n") + "\n";
}

test("support levels match the recorded copy for every session in the fixture", () => {
  const got = replay();
  if (process.env.UPDATE_GOLDEN) {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, got);
    return;
  }
  assert.ok(fs.existsSync(GOLDEN), "tests/golden/levels.txt is missing; record it with UPDATE_GOLDEN=1");
  const want = fs.readFileSync(GOLDEN, "utf8").split("\n");
  const have = got.split("\n");
  // report the first few differing lines rather than one unreadable string diff
  const diffs = [];
  for (let i = 0; i < Math.max(want.length, have.length) && diffs.length < 5; i++) {
    if (want[i] !== have[i]) diffs.push(`line ${i + 1}\n  recorded: ${want[i]}\n  now:      ${have[i]}`);
  }
  assert.equal(diffs.length, 0, "support output changed:\n" + diffs.join("\n"));
});

test("every level found is shown or counted, over the last 200 sessions and every window", () => {
  // A zone is either listed (S below or at the price, A above it) or counted in the
  // table's "not listed" line. None may be dropped silently or listed twice.
  const data = SR.fromPayload(JSON.parse(fs.readFileSync(FIXTURE, "utf8")));
  const last = data.close.length - 1;
  let checked = 0;
  for (let end = last - 199; end <= last; end++) {
    const t = SR.truncate(data, end);
    for (const w of [21, 63, 126, 189, 252]) {
      const r = SR.analyze(t, { window: w });
      const at = `${data.dates[end]}, ${w} sessions`;
      const listed = [...r.supports, ...r.above];
      assert.equal(new Set(listed).size, listed.length, `a level is listed twice on ${at}`);
      // count the levels left out on each side directly from every zone found, and check
      // the page is told exactly that many
      const below = r.zones.filter((z) => !z.broken), above = r.zones.filter((z) => z.broken);
      assert.equal(r.unlisted.below, below.filter((z) => !r.supports.includes(z)).length, `a level below the price went missing on ${at}`);
      assert.equal(r.unlisted.above, above.filter((z) => !r.above.includes(z)).length, `a level above the price went missing on ${at}`);
      // each list holds the strongest of its side, so nothing unlisted outscores a listed level
      for (const [shown, all] of [[r.supports, below], [r.above, above]]) {
        const weakestShown = Math.min(...shown.map((z) => z.score));
        for (const z of all) if (!shown.includes(z)) assert.ok(z.score <= weakestShown, `a stronger level was left out on ${at}`);
      }
      assert.ok(r.supports.every((z) => !z.broken) && r.above.every((z) => z.broken), `a level is on the wrong side on ${at}`);
      checked++;
    }
  }
  assert.equal(checked, 1000);
});
