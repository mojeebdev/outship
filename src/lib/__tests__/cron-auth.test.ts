import { test } from "node:test";
import assert from "node:assert/strict";
import { CRON_HEADER, cronToken } from "../cron-auth";

test("a secret with a trailing newline still matches after a trip through a header", async () => {
  const secret = "s3cret-from-wrangler\n";
  // The old scheme sent the secret itself: headers trim it, so it never matched.
  const raw = new Headers({ [CRON_HEADER]: secret }).get(CRON_HEADER);
  assert.notEqual(raw, secret);
  // The token is hex, which a header leaves alone.
  const token = await cronToken(secret);
  assert.equal(new Headers({ [CRON_HEADER]: token }).get(CRON_HEADER), token);
  assert.match(token, /^[0-9a-f]{64}$/);
});

test("the token depends on the secret, and there is none without one", async () => {
  assert.notEqual(await cronToken("a"), await cronToken("b"));
  assert.equal(await cronToken("a"), await cronToken("a"));
  assert.equal(await cronToken(undefined), "");
  assert.equal(await cronToken(""), "");
});
