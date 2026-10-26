// Runs the nightly snapshot job (pipeline/snapshot.js) end to end on a temporary folder.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const SR = require("../docs/js/support.js");

const FIXTURE = path.join(__dirname, "fixtures", "tqqq-2026-10-23.json");
const JOB = path.join(__dirname, "..", "pipeline", "snapshot.js");

function workdir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-test-"));
  fs.copyFileSync(FIXTURE, path.join(dir, "tqqq.json"));
  return dir;
}
const run = (dir, ...extra) => execFileSync(process.execPath, [JOB, "--data", dir, ...extra], { encoding: "utf8" });
const read = (...p) => JSON.parse(fs.readFileSync(path.join(...p), "utf8"));

test("snapshot job writes the day's snapshot, the index and the what-changed file", () => {
  const dir = workdir();
  const out = run(dir);
  assert.match(out, /^snapshot TQQQ 2026-10-23: /);
  const snap = read(dir, "history", "2026-10-23.json");
  // the file holds exactly what the page's own method produces for that day
  const data = SR.fromPayload(read(FIXTURE));
  assert.deepEqual(snap, JSON.parse(JSON.stringify(SR.snapshot(data, SR.PAGE_SETTINGS))));
  assert.equal(snap.settings.top, "all");  // every level, as the page shows when it opens
  assert.equal(snap.settings.levels_from, 200);
  assert.deepEqual(read(dir, "history", "index.json"), { dates: ["2026-10-23"] });
  const changes = read(dir, "changes.json");
  assert.equal(changes.as_of, "2026-10-23");
  assert.equal(changes.previous, null); // first snapshot: nothing to compare with
  assert.deepEqual(changes.items, []);
});

test("snapshot job backfills earlier sessions and compares the last two", () => {
  const dir = workdir();
  run(dir, "--backfill", "30");
  const { dates } = read(dir, "history", "index.json");
  assert.equal(dates.length, 31);
  assert.equal(dates[dates.length - 1], "2026-10-23");
  const changes = read(dir, "changes.json");
  assert.equal(changes.previous, dates[dates.length - 2]);
  const want = SR.diffSnapshots(read(dir, "history", `${changes.previous}.json`), read(dir, "history", "2026-10-23.json"));
  assert.deepEqual(changes.items, want);
});

test("snapshot job keeps at most 400 snapshots, dropping the oldest", () => {
  const dir = workdir();
  fs.mkdirSync(path.join(dir, "history"));
  // 405 old snapshots, dated well before the fixture; each a real snapshot, because
  // the job compares the newest one with the one before it
  const body = JSON.stringify(SR.snapshot(SR.fromPayload(read(FIXTURE)), SR.PAGE_SETTINGS));
  const start = Date.UTC(2020, 0, 1);
  for (let k = 0; k < 405; k++) {
    const day = new Date(start + k * 864e5).toISOString().slice(0, 10);
    fs.writeFileSync(path.join(dir, "history", `${day}.json`), body);
  }
  run(dir);
  const files = fs.readdirSync(path.join(dir, "history")).filter((f) => f !== "index.json");
  assert.equal(files.length, 400);
  assert.ok(!files.includes("2020-01-01.json"), "the oldest snapshot is removed first");
  assert.ok(files.includes("2026-10-23.json"));
});

test("a previous snapshot saved with older settings is rebuilt, so no change is reported falsely", () => {
  const dir = workdir();
  run(dir, "--backfill", "1");
  const data = SR.fromPayload(read(FIXTURE)), at = data.dates.indexOf("2026-10-22");
  // the file as the old method saved it: 12-month window, strongest five levels
  fs.writeFileSync(path.join(dir, "history", "2026-10-22.json"), JSON.stringify(SR.snapshot(SR.truncate(data, at), {})));
  run(dir);
  const fresh = SR.diffSnapshots(JSON.parse(JSON.stringify(SR.snapshot(SR.truncate(data, at), SR.PAGE_SETTINGS))), read(dir, "history", "2026-10-23.json"));
  const unfixed = SR.diffSnapshots(read(dir, "history", "2026-10-22.json"), read(dir, "history", "2026-10-23.json"));
  assert.deepEqual(read(dir, "changes.json").items, fresh);
  assert.notDeepEqual(unfixed, fresh); // comparing with the old file as saved would report differences in settings
});

test("snapshot job runs for another ticker on the list, and stops for one that is not", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-test-"));
  fs.copyFileSync(path.join(__dirname, "fixtures", "qqq-2026-10-23.json"), path.join(dir, "qqq.json"));
  const out = execFileSync(process.execPath, [JOB, "--symbol", "QQQ", "--data", dir], { encoding: "utf8" });
  assert.match(out, /^snapshot QQQ 2026-10-23: /);
  assert.equal(read(dir, "history", "2026-10-23.json").as_of, "2026-10-23");
  assert.throws(() => execFileSync(process.execPath, [JOB, "--symbol", "ZZZZ", "--data", dir], { encoding: "utf8", stdio: "pipe" }), /ZZZZ is not on/);
});
