import assert from "node:assert/strict";
import test from "node:test";

import { TIERS, tierFor } from "../tiers";

test("tiers climb with the score", () => {
  assert.equal(tierFor(0).tier.name, "deckhand");
  assert.equal(tierFor(499).tier.name, "deckhand");
  assert.equal(tierFor(500).tier.name, "sailor");
  assert.equal(tierFor(12_000).tier.name, "captain");
  assert.equal(tierFor(1_000_000).tier.name, "admiral");
});

test("the distance to the next tier is exact", () => {
  const standing = tierFor(1_250);
  assert.equal(standing.next?.name, "navigator");
  assert.equal(standing.toNext, 750);
  assert.equal(standing.progress, 0.5);
});

test("the top tier has nowhere left to climb", () => {
  assert.deepEqual(tierFor(25_000), { tier: TIERS[TIERS.length - 1], next: null, toNext: 0, progress: 1 });
});

test("thresholds only go up", () => {
  for (let i = 1; i < TIERS.length; i++) assert.ok(TIERS[i].min > TIERS[i - 1].min);
});

test("negative or fractional scores don't break it", () => {
  assert.equal(tierFor(-5).tier.name, "deckhand");
  assert.equal(tierFor(499.9).tier.name, "deckhand");
});
