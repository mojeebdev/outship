import assert from "node:assert/strict";
import test from "node:test";

import { timingSafeEqual } from "../crypto";
import { createSessionCookieValue, verifySessionCookieValue } from "../auth/session";

test("timingSafeEqual matches only identical strings", () => {
  assert.equal(timingSafeEqual("abc", "abc"), true);
  assert.equal(timingSafeEqual("abc", "abd"), false);
  assert.equal(timingSafeEqual("abc", "abcd"), false);
  assert.equal(timingSafeEqual("", ""), true);
});

test("session cookies verify, and a tampered signature doesn't", async () => {
  const value = await createSessionCookieValue("builder-1", "secret");
  assert.equal((await verifySessionCookieValue(value, "secret"))?.builderId, "builder-1");
  const [payload, signature] = value.split(".");
  const flipped = `${payload}.${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
  assert.equal(await verifySessionCookieValue(flipped, "secret"), null);
  assert.equal(await verifySessionCookieValue(value, "other-secret"), null);
});
