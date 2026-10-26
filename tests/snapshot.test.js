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
  assert.match(out, /^snapshot 2026-10-23: /);
  const snap = read(dir, "history", "2026-10-23.json");
  // the file holds exactly what the page's own method produces for that day
  const data = SR.fromPayload(read(FIXTURE));
  assert.deepEqual(snap, JSON.parse(JSON.stringify(SR.snapshot(data, {}))));
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
  const body = JSON.stringify(SR.snapshot(SR.fromPayload(read(FIXTURE)), {}));
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
