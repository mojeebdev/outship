/**
 * The /profile overview: points per day and week with the scoring's caps,
 * ships per month, active days and the weekday × hour grid.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { change, profileOverview, type OverviewShip } from "../profile-overview";
import { DAILY_CAPS, MERGE_POINTS, PUSH_POINTS, RELEASE_POINTS } from "../score";

// A Wednesday, so "this week" (from Monday) has a few days in it.
const NOW = new Date("2026-11-18T12:00:00Z");
const ship = (iso: string, shipType: OverviewShip["shipType"] = "MERGE"): OverviewShip => ({
  shipType,
  shippedAt: new Date(iso),
  weightClass: "STANDARD",
  releaseHasNotes: true,
});

test("points per day use the daily caps, like the score", () => {
  const pushes = [ship("2026-11-18T08:00:00Z", "PUSH"), ship("2026-11-18T09:00:00Z", "PUSH")];
  const overview = profileOverview(pushes, NOW);
  assert.equal(overview.dailyPoints.length, 30);
  assert.equal(overview.dailyPoints.at(-1)!.value, DAILY_CAPS.PUSH * PUSH_POINTS);
  assert.equal(overview.dailyPoints.at(-1)!.start.toISOString(), "2026-11-18T00:00:00.000Z");
});

test("this week starts on monday (UTC), and last week is the seven days before", () => {
  const overview = profileOverview(
    [
      ship("2026-11-16T00:30:00Z"), // monday this week
      ship("2026-11-15T23:30:00Z"), // sunday: last week
      ship("2026-11-09T10:00:00Z", "RELEASE"), // monday last week
      ship("2026-11-08T10:00:00Z"), // two weeks ago
    ],
    NOW,
  );
  assert.equal(overview.pointsThisWeek, MERGE_POINTS);
  assert.equal(overview.pointsLastWeek, MERGE_POINTS + RELEASE_POINTS);
  assert.equal(overview.weeklyPoints.length, 8);
  assert.equal(overview.weeklyPoints[5], MERGE_POINTS);
  assert.deepEqual(overview.weeklyShips.slice(-3), [1, 2, 1]);
});

test("ships this month and last month are calendar months", () => {
  const overview = profileOverview(
    [ship("2026-11-01T00:00:00Z"), ship("2026-10-31T23:59:00Z"), ship("2026-10-01T00:00:00Z"), ship("2026-09-30T23:00:00Z")],
    NOW,
  );
  assert.equal(overview.shipsThisMonth, 1);
  assert.equal(overview.shipsLastMonth, 2);
});

test("active days mark the last 14 days, and the grid counts by weekday and hour", () => {
  const overview = profileOverview([ship("2026-11-18T09:15:00Z"), ship("2026-11-18T09:45:00Z"), ship("2026-11-05T09:00:00Z")], NOW);
  assert.equal(overview.activeDays.length, 14);
  assert.equal(overview.activeDays.at(-1), 1);
  assert.equal(overview.activeDays[0], 1); // nov 5 is 13 days before nov 18
  assert.equal(overview.weekHour[3][9], 2); // wednesday 09:00
  assert.equal(overview.weekHour[4][9], 1); // thursday 09:00
  assert.deepEqual(overview.byType, { RELEASE: 0, MERGE: 3, PUSH: 0 });
});

test("change is relative, and new when there was nothing before", () => {
  assert.equal(change(15, 10), 0.5);
  assert.equal(change(5, 10), -0.5);
  assert.equal(change(0, 0), 0);
  assert.equal(change(3, 0), null);
});
