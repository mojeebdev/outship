import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { bearerKey, generateApiKey, hashApiKey, looksLikeApiKey } from "../api/keys";
import { parseShipType, shipJson } from "../api/serialize";
import { RELEASE_POINTS } from "../score";

test("keys are os_live_ plus 32 random bytes, and only their hash is kept", async () => {
  const { key, prefix, hash } = await generateApiKey();
  assert.ok(looksLikeApiKey(key));
  assert.equal(prefix, key.slice(0, 12));
  assert.equal(hash, createHash("sha256").update(key).digest("hex"));
  assert.equal(await hashApiKey(key), hash);
  assert.notEqual((await generateApiKey()).key, key);
});

test("the Authorization header is read strictly", async () => {
  const { key } = await generateApiKey();
  assert.equal(bearerKey(null), null);
  assert.equal(bearerKey(`Bearer ${key}`), key);
  assert.equal(bearerKey(`bearer ${key}`), key);
  assert.equal(bearerKey("Bearer nope"), "invalid");
  assert.equal(bearerKey(key), "invalid");
});

test("ships are described publicly: day-only push identifiers, points before caps", () => {
  const base = {
    id: "s1",
    repo: "a/b",
    commitSha: "c".repeat(40),
    shippedAt: new Date("2026-11-14T10:00:00Z"),
    weightClass: "STANDARD" as const,
    releaseHasNotes: true,
    attestation: null,
  };
  const push = shipJson({ ...base, shipType: "PUSH", identifier: "2026-11-14:builder-internal-id" });
  assert.equal(push.identifier, "2026-11-14");
  assert.equal(push.type, "push");
  const release = shipJson({
    ...base,
    shipType: "RELEASE",
    identifier: "v1.0.0",
    attestation: { easUid: "0xabc", chain: "Base", schemaVersion: 1 },
  });
  assert.equal(release.points, RELEASE_POINTS);
  assert.deepEqual(release.attestation, { uid: "0xabc", chain: "Base", verified: false, url: "https://base.easscan.org/attestation/view/0xabc" });
});

test("ship types are spelled out", () => {
  assert.equal(parseShipType("release"), "RELEASE");
  assert.equal(parseShipType("PUSH"), null);
  assert.equal(parseShipType(null), null);
});
