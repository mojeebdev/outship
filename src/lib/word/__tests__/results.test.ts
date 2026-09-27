/**
 * Tests for saved result ids and snapshot reconstruction.
 *
 * Run with: npm run test:word
 * Database-backed paths (`saveResult`, `getResult`) are exercised against the
 * live D1 binding in the dev/preview runtime; these cover the pure logic that
 * decides what a share link means.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { isValidResultId, newResultId, resultCardUrl, resultUrl } from "../results";

test("result ids are opaque, fixed length and unguessable-looking", () => {
  const id = newResultId();
  assert.equal(id.length, 16);
  assert.match(id, /^[0-9a-hjkmnp-tv-z]{16}$/);
  // No ambiguous characters that people misread when retyping a link.
  for (const character of ["i", "l", "o", "u"]) {
    assert.ok(!id.includes(character), `id should not contain "${character}"`);
  }
});

test("result ids do not collide across a large sample", () => {
  const ids = new Set(Array.from({ length: 5_000 }, () => newResultId()));
  assert.equal(ids.size, 5_000);
});

test("only well-formed ids are accepted", () => {
  assert.equal(isValidResultId(newResultId()), true);

  for (const bad of [
    "",
    "short",
    "0123456789abcdefg", // too long
    "0123456789abcdei", // contains an excluded character
    "0123456789ABCDEF", // uppercase
    "../../etc/passwd",
    "0123456789abcde ",
    "%00%00%00%00%00%0",
  ]) {
    assert.equal(isValidResultId(bad), false, `expected "${bad}" to be rejected`);
  }
});

test("public URLs always use the production origin", () => {
  const id = newResultId();
  assert.equal(resultUrl(id), `https://word.outship.dev/result/${id}`);
  assert.equal(resultCardUrl(id), `https://word.outship.dev/api/word/card/${id}`);
  // The card lives under /api/ so the hostname rewrite never touches it.
  assert.ok(resultCardUrl(id).includes("/api/word/card/"));
  assert.ok(!resultUrl(id).includes("/word/result/"));
});
