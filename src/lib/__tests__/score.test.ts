/**
 * Scoring rules. Run with: npm test
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BARE_RELEASE_POINTS,
  DAILY_CAPS,
  MAX_DAILY_POINTS,
  MERGE_POINTS,
  PUSH_POINTS,
  RELEASE_POINTS,
  REVIEWED_MERGE_POINTS,
  STREAK_CAP,
  STREAK_POINTS_PER_DAY,
  computeScore,
  deriveStreak,
  scoreBuilder,
  shipPoints,
  shipWeight,
  type ScorableShip,
} from "../score";

const at = (iso: string) => new Date(iso);
const release = (iso: string, releaseHasNotes: boolean | null = true): ScorableShip => ({
  shipType: "RELEASE",
  shippedAt: at(iso),
  releaseHasNotes,
});
const merge = (iso: string, weightClass: ScorableShip["weightClass"] = "STANDARD"): ScorableShip => ({
  shipType: "MERGE",
  shippedAt: at(iso),
  weightClass,
});
const push = (iso: string): ScorableShip => ({ shipType: "PUSH", shippedAt: at(iso) });

// ── weights ──────────────────────────────────────────────────────────────────

test("merges are worth more with a second person involved", () => {
  assert.equal(shipWeight(merge("2026-11-01T10:00:00Z")), MERGE_POINTS);
  assert.equal(shipWeight(merge("2026-11-01T10:00:00Z", "REVIEWED")), REVIEWED_MERGE_POINTS);
  assert.equal(shipWeight(merge("2026-11-01T10:00:00Z", "EXTERNAL")), REVIEWED_MERGE_POINTS);
  assert.equal(shipWeight(merge("2026-11-01T10:00:00Z", null)), MERGE_POINTS);
  assert.equal(MERGE_POINTS, 20);
  assert.equal(REVIEWED_MERGE_POINTS, 30);
});

test("a release is worth full points only with notes or an asset", () => {
  assert.equal(shipWeight(release("2026-11-01T10:00:00Z", true)), RELEASE_POINTS);
  assert.equal(shipWeight(release("2026-11-01T10:00:00Z", false)), BARE_RELEASE_POINTS);
  assert.equal(RELEASE_POINTS, 50);
  assert.equal(BARE_RELEASE_POINTS, 20);
});

test("releases recorded before notes were checked keep their full weight", () => {
  assert.equal(shipWeight(release("2026-11-01T10:00:00Z", null)), RELEASE_POINTS);
});

test("a push is ten points", () => {
  assert.equal(shipWeight(push("2026-11-01T10:00:00Z")), PUSH_POINTS);
  assert.equal(PUSH_POINTS, 10);
});

// ── daily caps ───────────────────────────────────────────────────────────────

test("daily caps limit each type per UTC day", () => {
  const day = "2026-11-01";
  const ships = [
    ...Array.from({ length: 4 }, (_, i) => release(`${day}T0${i}:00:00Z`)),
    ...Array.from({ length: 8 }, (_, i) => merge(`${day}T1${i}:00:00Z`)),
    push(`${day}T20:00:00Z`),
    push(`${day}T21:00:00Z`),
  ];
  assert.equal(
    shipPoints(ships),
    DAILY_CAPS.RELEASE * RELEASE_POINTS + DAILY_CAPS.MERGE * MERGE_POINTS + DAILY_CAPS.PUSH * PUSH_POINTS,
  );
});

test("caps reset at UTC midnight, not local midnight", () => {
  const ships = [release("2026-11-01T23:59:59Z"), release("2026-11-01T23:00:00Z"), release("2026-11-02T00:00:01Z")];
  assert.equal(shipPoints(ships), 3 * RELEASE_POINTS);
});

test("past the cap, the ships worth most count, whatever order they arrive in", () => {
  const day = "2026-11-01";
  const bare = [release(`${day}T01:00:00Z`, false), release(`${day}T02:00:00Z`, false)];
  const rich = release(`${day}T03:00:00Z`, true);
  const expected = RELEASE_POINTS + BARE_RELEASE_POINTS;
  assert.equal(shipPoints([...bare, rich]), expected);
  assert.equal(shipPoints([rich, ...bare]), expected);

  const merges = [
    ...Array.from({ length: 5 }, (_, i) => merge(`${day}T0${i}:00:00Z`)),
    merge(`${day}T09:00:00Z`, "REVIEWED"),
  ];
  assert.equal(shipPoints(merges), REVIEWED_MERGE_POINTS + 4 * MERGE_POINTS);
});

test("the daily maximum is what the caps allow at the top weights", () => {
  assert.equal(MAX_DAILY_POINTS, 260);
  const day = "2026-11-01";
  const ships = [
    ...Array.from({ length: 9 }, (_, i) => release(`${day}T0${i}:00:00Z`)),
    ...Array.from({ length: 9 }, (_, i) => merge(`${day}T1${i}:00:00Z`, "EXTERNAL")),
    ...Array.from({ length: 3 }, (_, i) => push(`${day}T2${i}:00:00Z`)),
  ];
  assert.equal(shipPoints(ships), MAX_DAILY_POINTS);
});

test("score adds the streak, capped", () => {
  assert.equal(STREAK_POINTS_PER_DAY, 10);
  assert.equal(computeScore({ points: 100, currentStreak: 4 }), 100 + 4 * STREAK_POINTS_PER_DAY);
  assert.equal(computeScore({ points: 100, currentStreak: 400 }), 100 + STREAK_CAP * STREAK_POINTS_PER_DAY);
});

// ── streaks ──────────────────────────────────────────────────────────────────

const NOW = at("2026-11-14T12:00:00Z");

test("no ships, no streak", () => {
  assert.deepEqual(deriveStreak([], NOW), { currentStreak: 0, longestStreak: 0, lastShipDate: null });
});

test("consecutive UTC days make a streak; same-day ships count once", () => {
  const streak = deriveStreak(
    [at("2026-11-12T08:00:00Z"), at("2026-11-13T08:00:00Z"), at("2026-11-13T22:00:00Z"), at("2026-11-14T01:00:00Z")],
    NOW,
  );
  assert.deepEqual(streak, { currentStreak: 3, longestStreak: 3, lastShipDate: at("2026-11-14T01:00:00Z") });
});

test("a gap day ends a streak, and the longest is kept", () => {
  const streak = deriveStreak(
    [
      at("2026-11-01T10:00:00Z"),
      at("2026-11-02T10:00:00Z"),
      at("2026-11-03T10:00:00Z"),
      at("2026-11-04T10:00:00Z"),
      // gap on the 5th
      at("2026-11-13T10:00:00Z"),
      at("2026-11-14T10:00:00Z"),
    ],
    NOW,
  );
  assert.equal(streak.currentStreak, 2);
  assert.equal(streak.longestStreak, 4);
});

test("shipping yesterday keeps the streak alive today", () => {
  const streak = deriveStreak([at("2026-11-12T10:00:00Z"), at("2026-11-13T23:59:00Z")], NOW);
  assert.equal(streak.currentStreak, 2);
});

test("a whole missed UTC day expires the current streak but not the longest", () => {
  const streak = deriveStreak([at("2026-11-11T10:00:00Z"), at("2026-11-12T10:00:00Z")], NOW);
  assert.equal(streak.currentStreak, 0);
  assert.equal(streak.longestStreak, 2);
  assert.deepEqual(streak.lastShipDate, at("2026-11-12T10:00:00Z"));
});

test("out-of-order deliveries give the same streak", () => {
  const dates = [at("2026-11-10T10:00:00Z"), at("2026-11-11T10:00:00Z"), at("2026-11-12T10:00:00Z"), at("2026-11-13T10:00:00Z"), at("2026-11-14T10:00:00Z")];
  const forward = deriveStreak(dates, NOW);
  const shuffled = deriveStreak([dates[3], dates[0], dates[4], dates[2], dates[1]], NOW);
  assert.deepEqual(shuffled, forward);
  assert.equal(forward.currentStreak, 5);
});

test("an old event arriving late fills a gap instead of being ignored", () => {
  const before = deriveStreak([at("2026-11-12T10:00:00Z"), at("2026-11-14T10:00:00Z")], NOW);
  assert.equal(before.currentStreak, 1);
  const after = deriveStreak([at("2026-11-12T10:00:00Z"), at("2026-11-14T10:00:00Z"), at("2026-11-13T10:00:00Z")], NOW);
  assert.equal(after.currentStreak, 3);
});

test("UTC day boundaries, not 24-hour windows", () => {
  // 23:59 then 00:01: two minutes apart, two days, a two-day streak.
  const streak = deriveStreak([at("2026-11-13T23:59:00Z"), at("2026-11-14T00:01:00Z")], NOW);
  assert.equal(streak.currentStreak, 2);
});

test("scoreBuilder puts points and the capped streak together", () => {
  const ships = Array.from({ length: 40 }, (_, i) => push(new Date(NOW.getTime() - i * 86_400_000).toISOString()));
  const stats = scoreBuilder(ships, NOW);
  assert.equal(stats.points, 40 * PUSH_POINTS);
  assert.equal(stats.currentStreak, 40);
  assert.equal(stats.score, 40 * PUSH_POINTS + STREAK_CAP * STREAK_POINTS_PER_DAY);
});

test("expiry agrees with derivation: expiring removes exactly the streak bonus", () => {
  const ships = [push("2026-11-10T10:00:00Z"), push("2026-11-11T10:00:00Z")];
  const whileAlive = scoreBuilder(ships, at("2026-11-12T00:01:00Z"));
  const afterExpiry = scoreBuilder(ships, at("2026-11-13T00:05:00Z"));
  assert.equal(whileAlive.currentStreak, 2);
  assert.equal(afterExpiry.currentStreak, 0);
  // src/lib/expire-streaks.ts subtracts STREAK_POINTS_PER_DAY * min(streak, cap) from the stored score.
  assert.equal(afterExpiry.score, whileAlive.score - STREAK_POINTS_PER_DAY * Math.min(whileAlive.currentStreak, STREAK_CAP));
});
