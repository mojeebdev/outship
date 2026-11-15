/**
 * The App JWT has to be a real RS256 JWT GitHub accepts, whether the private
 * key is in GitHub's PKCS#1 format or PKCS#8.
 */

import assert from "node:assert/strict";
import { createPrivateKey, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";

import { createAppJwt, privateKeyPemToPkcs8 } from "../github-app-auth";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PKCS1 = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
const PKCS8 = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

function verifyJwt(jwt: string) {
  const [header, payload, signature] = jwt.split(".");
  const ok = verify(
    "RSA-SHA256",
    Buffer.from(`${header}.${payload}`),
    publicKey,
    Buffer.from(signature, "base64url"),
  );
  return { ok, header: JSON.parse(Buffer.from(header, "base64url").toString()), payload: JSON.parse(Buffer.from(payload, "base64url").toString()) };
}

test("PKCS#1 keys are rewrapped as the same key in PKCS#8", () => {
  const converted = privateKeyPemToPkcs8(PKCS1);
  const fromPkcs8 = privateKeyPemToPkcs8(PKCS8);
  assert.deepEqual(Buffer.from(converted), Buffer.from(fromPkcs8));
  // And node agrees it's a valid key with the same public half.
  const roundTrip = createPublicKey(createPrivateKey({ key: Buffer.from(converted), format: "der", type: "pkcs8" }));
  assert.equal(roundTrip.export({ type: "spki", format: "pem" }), publicKey.export({ type: "spki", format: "pem" }));
});

test("a PEM pasted with literal \\n sequences still parses", () => {
  const escaped = PKCS1.trim().replace(/\n/g, "\\n");
  assert.deepEqual(Buffer.from(privateKeyPemToPkcs8(escaped)), Buffer.from(privateKeyPemToPkcs8(PKCS8)));
});

test("App JWTs verify as RS256 with the App id as issuer, for both key formats", async () => {
  const now = Date.UTC(2026, 10, 14, 12, 0, 0);
  for (const pem of [PKCS1, PKCS8]) {
    const { ok, header, payload } = verifyJwt(await createAppJwt("123456", pem, now));
    assert.equal(ok, true);
    assert.deepEqual(header, { alg: "RS256", typ: "JWT" });
    assert.equal(payload.iss, "123456");
    assert.equal(payload.iat, now / 1000 - 60);
    assert.ok(payload.exp - payload.iat <= 600, "GitHub rejects JWTs that live over ten minutes");
  }
});

test("an App ID saved with surrounding whitespace still signs as that App", async () => {
  const { ok, payload } = verifyJwt(await createAppJwt(" 123456\n", PKCS1));
  assert.equal(ok, true);
  assert.equal(payload.iss, "123456");
});

test("keys saved without their PEM armour still parse", () => {
  const expected = Buffer.from(privateKeyPemToPkcs8(PKCS8));
  const body = (pem: string) => pem.replace(/-----[A-Z ]+-----/g, "").trim();
  // The base64 body with the BEGIN/END lines lost in copying, either format,
  // with or without its line breaks.
  assert.deepEqual(Buffer.from(privateKeyPemToPkcs8(body(PKCS1))), expected);
  assert.deepEqual(Buffer.from(privateKeyPemToPkcs8(body(PKCS1).replace(/\s+/g, ""))), expected);
  assert.deepEqual(Buffer.from(privateKeyPemToPkcs8(body(PKCS8))), expected);
  // The whole .pem file base64-encoded onto one line.
  assert.deepEqual(Buffer.from(privateKeyPemToPkcs8(Buffer.from(PKCS1).toString("base64"))), expected);
});

test("something that isn't a key is refused, without echoing it", () => {
  assert.throws(() => privateKeyPemToPkcs8("not a key"), /PEM/);
  // A file name typed at wrangler's prompt instead of the file's contents.
  assert.throws(() => privateKeyPemToPkcs8("outship.2026-11-15.private-key.pem"), (error: Error) => {
    assert.match(error.message, /34 characters/);
    assert.doesNotMatch(error.message, /outship\.2026/);
    return true;
  });
  // Valid base64 that decodes to something other than a key.
  assert.throws(() => privateKeyPemToPkcs8(Buffer.from("hello world, not a key at all").toString("base64")), /PEM/);
});
