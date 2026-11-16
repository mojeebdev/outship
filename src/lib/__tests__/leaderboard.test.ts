import assert from "node:assert/strict";
import test from "node:test";

import {
  PERIODS,
  parsePeriod,
  pointsWithReachedAt,
  filterRows,
  parseShow,
  rankBuilders,
  risingBuilders,
  startOfMonth,
  startOfWeek,
  topLanguages,
  type LeaderboardBuilder,
  type LeaderboardShip,
} from "../leaderboard";
import { MERGE_POINTS, PUSH_POINTS, RELEASE_POINTS, STREAK_CAP, STREAK_POINTS_PER_DAY } from "../score";

const NOW = new Date("2026-11-14T12:00:00Z"); // Saturday

const builder = (id: string, overrides: Partial<LeaderboardBuilder> = {}): LeaderboardBuilder => ({
  id,
  githubId: id.length,
  githubLogin: id,
  currentStreak: 0,
  claimedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});
const ship = (builderId: string, iso: string, shipType: LeaderboardShip["shipType"] = "MERGE", language: string | null = "TypeScript"): LeaderboardShip => ({
  builderId,
  shipType,
  shippedAt: new Date(iso),
  weightClass: "STANDARD",
  releaseHasNotes: true,
  language,
});

test("weeks start Monday 00:00 UTC; months on the 1st", () => {
  assert.equal(startOfWeek(NOW).toISOString(), "2026-11-09T00:00:00.000Z");
  assert.equal(startOfWeek(new Date("2026-11-09T00:00:00Z")).toISOString(), "2026-11-09T00:00:00.000Z");
  assert.equal(startOfWeek(new Date("2026-11-08T23:59:59Z")).toISOString(), "2026-11-02T00:00:00.000Z");
  assert.equal(startOfMonth(NOW).toISOString(), "2026-11-01T00:00:00.000Z");
});

test("unknown periods fall back to this week", () => {
  assert.equal(parsePeriod("month"), "month");
  assert.equal(parsePeriod("forever"), "week");
  assert.deepEqual([...PERIODS], ["week", "month", "all"]);
});

test("window scores use the same caps", () => {
  const ships = Array.from({ length: 3 }, (_, i) => ship("a", `2026-11-14T0${i}:00:00Z`, "PUSH"));
  assert.equal(pointsWithReachedAt(ships).points, PUSH_POINTS);
});

test("reachedAt is when the score last went up, not the last ship", () => {
  const ships = [ship("a", "2026-11-14T01:00:00Z", "PUSH"), ship("a", "2026-11-14T05:00:00Z", "PUSH")];
  assert.deepEqual(pointsWithReachedAt(ships).reachedAt, new Date("2026-11-14T01:00:00Z"));
});

test("ties go to whoever reached the score first, then login", () => {
  const rows = rankBuilders(
    [builder("zed"), builder("amy"), builder("bob")],
    [ship("zed", "2026-11-10T01:00:00Z"), ship("amy", "2026-11-12T01:00:00Z"), ship("bob", "2026-11-12T01:00:00Z")],
    { includeStreak: false },
  );
  assert.deepEqual(rows.map((row) => [row.githubLogin, row.rank]), [["zed", 1], ["amy", 2], ["bob", 3]]);
});

test("only claimed builders take a rank; unclaimed are listed without one", () => {
  const rows = rankBuilders(
    [builder("claimed"), builder("ghost", { claimedAt: null }), builder("late")],
    [
      ship("ghost", "2026-11-10T01:00:00Z", "RELEASE"),
      ship("claimed", "2026-11-10T01:00:00Z", "MERGE"),
      ship("late", "2026-11-11T01:00:00Z", "PUSH"),
    ],
    { includeStreak: false },
  );
  assert.deepEqual(rows.map((row) => [row.githubLogin, row.rank, row.score]), [
    ["ghost", null, RELEASE_POINTS],
    ["claimed", 1, MERGE_POINTS],
    ["late", 2, PUSH_POINTS],
  ]);
});

test("the streak bonus is for all time only, and capped", () => {
  const builders = [builder("a", { currentStreak: 50 })];
  const ships = [ship("a", "2026-11-14T01:00:00Z")];
  assert.equal(rankBuilders(builders, ships, { includeStreak: false })[0].score, MERGE_POINTS);
  assert.equal(rankBuilders(builders, ships, { includeStreak: true })[0].score, MERGE_POINTS + STREAK_CAP * STREAK_POINTS_PER_DAY);
});

test("windows list only builders who shipped in them", () => {
  assert.equal(rankBuilders([builder("idle")], [], { includeStreak: false }).length, 0);
});

test("all time lists every signed-in builder, at 0 and ranked last, matching their profile's rank", () => {
  const builders = [builder("shipper"), builder("joined"), builder("ghost", { claimedAt: null })];
  const rows = rankBuilders(builders, [ship("shipper", "2026-11-14T01:00:00Z")], { includeStreak: true });
  assert.deepEqual(
    rows.map((row) => [row.githubLogin, row.rank, row.score]),
    [
      ["shipper", 1, MERGE_POINTS],
      ["joined", 2, 0],
    ],
  );
});

test("the week and month boards still list only builders who shipped in them", () => {
  const rows = rankBuilders([builder("shipper"), builder("joined")], [ship("shipper", "2026-11-14T01:00:00Z")], { includeStreak: false });
  assert.deepEqual(rows.map((row) => row.githubLogin), ["shipper"]);
});

test("top languages are by ship count", () => {
  const ships = [
    ship("a", "2026-11-14T01:00:00Z", "PUSH", "Rust"),
    ship("a", "2026-11-14T02:00:00Z", "PUSH", "Go"),
    ship("b", "2026-11-14T02:00:00Z", "PUSH", "Go"),
    ship("b", "2026-11-14T03:00:00Z", "PUSH", null),
  ];
  assert.deepEqual(topLanguages(ships), ["Go", "Rust"]);
  assert.deepEqual(topLanguages(ships, 1), ["Go"]);
});

test("rising: biggest gain over last week, with at least three ships this week", () => {
  const builders = [builder("riser"), builder("steady"), builder("one-hit")];
  const ships = [
    // riser: nothing last week, three merges on three days this week
    ship("riser", "2026-11-10T01:00:00Z"),
    ship("riser", "2026-11-11T01:00:00Z"),
    ship("riser", "2026-11-12T01:00:00Z"),
    // steady: same three merges both weeks, no gain
    ship("steady", "2026-11-03T01:00:00Z"),
    ship("steady", "2026-11-04T01:00:00Z"),
    ship("steady", "2026-11-05T01:00:00Z"),
    ship("steady", "2026-11-10T01:00:00Z"),
    ship("steady", "2026-11-11T01:00:00Z"),
    ship("steady", "2026-11-12T01:00:00Z"),
    // one-hit: a big release but only one ship
    ship("one-hit", "2026-11-10T01:00:00Z", "RELEASE"),
  ];
  assert.deepEqual(
    risingBuilders(builders, ships, NOW).map((row) => [row.githubLogin, row.gain]),
    [["riser", 3 * MERGE_POINTS]],
  );
});

test("the claimed and unclaimed filters keep everyone's rank", () => {
  const builders = [builder("a"), builder("b", { claimedAt: null }), builder("c")];
  const ships = [ship("a", "2026-11-14T01:00:00Z"), ship("b", "2026-11-13T01:00:00Z"), ship("c", "2026-11-12T01:00:00Z", "PUSH")];
  const rows = rankBuilders(builders, ships, { includeStreak: false });
  assert.deepEqual(filterRows(rows, "all").map((r) => r.githubLogin), ["b", "a", "c"]);
  assert.deepEqual(filterRows(rows, "claimed").map((r) => [r.githubLogin, r.rank]), [["a", 1], ["c", 2]]);
  assert.deepEqual(filterRows(rows, "unclaimed").map((r) => [r.githubLogin, r.rank]), [["b", null]]);
  assert.equal(parseShow("claimed"), "claimed");
  assert.equal(parseShow("everyone"), "all");
});
