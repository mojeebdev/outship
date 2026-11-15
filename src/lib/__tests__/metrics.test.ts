import assert from "node:assert/strict";
import test from "node:test";

import { adminLogins, isAdminLogin } from "../admin-logins";
import { cohortTable, delta, fillBuckets, parseWindow, weekStart, windowRanges } from "../metrics";

const NOW = new Date("2026-11-15T12:00:00Z"); // a Sunday

test("windows are the last N, compared with the N before", () => {
  const { current, previous } = windowRanges("24h", NOW);
  assert.equal(current.start.toISOString(), "2026-11-14T12:00:00.000Z");
  assert.equal(current.end.toISOString(), NOW.toISOString());
  assert.equal(previous.start.toISOString(), "2026-11-13T12:00:00.000Z");
  assert.equal(previous.end.toISOString(), current.start.toISOString());
  assert.equal(parseWindow("30m"), "30m");
  assert.equal(parseWindow("forever"), "24h");
});

test("deltas are relative, with nothing to compare against called out", () => {
  assert.equal(delta(15, 10), 0.5);
  assert.equal(delta(5, 10), -0.5);
  assert.equal(delta(0, 0), 0);
  assert.equal(delta(3, 0), null);
});

test("empty buckets are filled with zero", () => {
  const { current } = windowRanges("1h", NOW);
  const buckets = fillBuckets(current, 2 * 60_000, [{ b: 0, v: 3 }, { b: 29, v: 1 }]);
  assert.equal(buckets.length, 30);
  assert.equal(buckets[0].value, 3);
  assert.equal(buckets[1].value, 0);
  assert.equal(buckets[29].value, 1);
  assert.equal(buckets[1].start.toISOString(), "2026-11-15T11:02:00.000Z");
});

test("weeks start on monday UTC", () => {
  assert.equal(weekStart(NOW).toISOString(), "2026-11-09T00:00:00.000Z");
  assert.equal(weekStart(new Date("2026-11-09T00:00:00Z")).toISOString(), "2026-11-09T00:00:00.000Z");
});

test("cohorts: the share of each week's sign-ins still shipping N weeks later", () => {
  const at = (iso: string) => new Date(iso);
  const joins = [
    { builderId: "a", joinedAt: at("2026-11-03T10:00:00Z") }, // week of nov 2
    { builderId: "b", joinedAt: at("2026-11-04T10:00:00Z") }, // week of nov 2
    { builderId: "c", joinedAt: at("2026-11-10T10:00:00Z") }, // week of nov 9
  ];
  const ships = [
    { builderId: "a", shippedAt: at("2026-11-03T12:00:00Z") },
    { builderId: "b", shippedAt: at("2026-11-05T12:00:00Z") },
    { builderId: "a", shippedAt: at("2026-11-11T12:00:00Z") },
    { builderId: "c", shippedAt: at("2026-11-12T12:00:00Z") },
  ];
  const table = cohortTable(joins, ships, 3, NOW);
  assert.deepEqual(table.map((row) => row.week.toISOString().slice(0, 10)), ["2026-10-26", "2026-11-02", "2026-11-09"]);
  assert.deepEqual(table[0], { week: new Date("2026-10-26T00:00:00Z"), size: 0, retained: [null, null, null] });
  assert.deepEqual(table[1].retained, [1, 0.5, null]);
  assert.equal(table[1].size, 2);
  assert.deepEqual(table[2].retained, [1, null, null]);
});

test("admins: the configured logins, case-insensitive, else the owner", () => {
  assert.deepEqual(adminLogins(undefined), ["mojeebdev"]);
  assert.deepEqual(adminLogins(" Alice, bob ,"), ["alice", "bob"]);
  assert.equal(isAdminLogin("MojeebDev", undefined), true);
  assert.equal(isAdminLogin("mallory", undefined), false);
  assert.equal(isAdminLogin("bob", "alice,bob"), true);
});
