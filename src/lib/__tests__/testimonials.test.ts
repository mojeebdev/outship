/**
 * The testimonials file is edited by a script (scripts/add-testimonial.mjs)
 * and rendered on the home page, so a bad entry shouldn't reach production.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { shuffled, testimonialHref, type Testimonial } from "../testimonial-utils";

const entries: Testimonial[] = JSON.parse(readFileSync(new URL("../testimonials.json", import.meta.url), "utf8"));
const publicDir = new URL("../../../public/", import.meta.url);

test("every testimonial is complete and its picture is in /public", () => {
  for (const { handle, name, avatar, quote, url } of entries) {
    assert.match(handle, /^[A-Za-z0-9_]{1,15}$/, `handle ${handle}`);
    assert.ok(name.trim(), `${handle} has a name`);
    assert.ok(quote.trim() && quote.length <= 280, `${handle}'s quote is 1–280 characters`);
    assert.match(avatar, /^\/testimonials\/[a-z0-9_]+\.(jpg|png|webp)$/, `${handle}'s avatar path`);
    assert.ok(existsSync(new URL(avatar.slice(1), publicDir)), `${avatar} exists`);
    if (url) assert.match(url, /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]+\/status\/\d+/, `${handle}'s post link`);
  }
});

test("a testimonial links to its post, or else to the profile", () => {
  const base = { handle: "alice", name: "Alice", avatar: "/testimonials/alice.jpg", quote: "hi" };
  assert.equal(testimonialHref(base), "https://x.com/alice");
  assert.equal(testimonialHref({ ...base, url: "https://x.com/alice/status/1" }), "https://x.com/alice/status/1");
});

test("shuffling keeps every item and leaves the original alone", () => {
  const items = [1, 2, 3, 4, 5];
  const out = shuffled(items);
  assert.deepEqual([...out].sort(), items);
  assert.deepEqual(items, [1, 2, 3, 4, 5]);
  // A fixed "random" that always picks the first slot is a rotation, never a loss.
  assert.deepEqual([...shuffled(items, () => 0)].sort(), items);
});
