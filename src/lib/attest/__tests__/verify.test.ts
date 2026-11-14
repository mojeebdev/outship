/**
 * The save route stores an attestation only if what's onchain describes this
 * ship and this builder. These cover the comparison; the RPC half is a thin
 * wrapper around it.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { Address, Hex } from "viem";

import { attestationMismatch, type ExpectedShip, type OnchainAttestation } from "../verify";
import { encodeShipAttestationData, type ShipAttestationFields } from "../typed-data";

const SCHEMA: Hex = `0x${"5c".repeat(32)}`;
const WALLET: Address = "0x1111111111111111111111111111111111111111";
const FIELDS: ShipAttestationFields = {
  repo: "mojeebdev/outship",
  shipType: 0,
  identifier: "v1.0.0",
  commitSha: "5bcce31f5bcce31f5bcce31f5bcce31f5bcce31f",
  timestamp: BigInt(1_790_000_000),
  scoreSnapshot: 120,
  githubLogin: "mojeebdev",
  shipId: "cmship123",
  deadline: BigInt(1_790_000_900),
};
const EXPECTED: ExpectedShip = { ...FIELDS, wallet: WALLET };

function onchain(overrides: Partial<OnchainAttestation> = {}, fields: Partial<ShipAttestationFields> = {}) {
  return {
    uid: `0x${"aa".repeat(32)}`,
    schema: SCHEMA,
    recipient: WALLET,
    attester: WALLET,
    expirationTime: BigInt(0),
    revocationTime: BigInt(0),
    data: encodeShipAttestationData({ ...FIELDS, ...fields }, `0x${"01".repeat(65)}`),
    ...overrides,
  } satisfies OnchainAttestation;
}

test("a matching v2 attestation passes", () => {
  assert.equal(attestationMismatch(onchain(), EXPECTED, SCHEMA), null);
});

test("score and deadline aren't compared: they're whatever was signed", () => {
  assert.equal(attestationMismatch(onchain({}, { scoreSnapshot: 5, deadline: BigInt(1) }), EXPECTED, SCHEMA), null);
});

test("another schema is refused, including the legacy one", () => {
  assert.match(attestationMismatch(onchain({ schema: `0x${"00".repeat(32)}` }), EXPECTED, SCHEMA)!, /v2/);
  assert.match(attestationMismatch(onchain(), EXPECTED, "")!, /v2/);
});

test("a different wallet is refused", () => {
  const other: Address = "0x2222222222222222222222222222222222222222";
  assert.match(attestationMismatch(onchain({ recipient: other }), EXPECTED, SCHEMA)!, /recipient/);
  assert.match(attestationMismatch(onchain({ attester: other }), EXPECTED, SCHEMA)!, /attester/);
});

test("revoked or expiring attestations are refused", () => {
  assert.match(attestationMismatch(onchain({ revocationTime: BigInt(1) }), EXPECTED, SCHEMA)!, /revoked/);
  assert.match(attestationMismatch(onchain({ expirationTime: BigInt(1) }), EXPECTED, SCHEMA)!, /expires/);
});

test("each identifying field must match the ship", () => {
  const cases: [keyof ShipAttestationFields, unknown][] = [
    ["shipId", "cmother"],
    ["repo", "someone/else"],
    ["commitSha", "0".repeat(40)],
    ["githubLogin", "someone"],
    ["shipType", 2],
    ["identifier", "v9"],
    ["timestamp", BigInt(1)],
  ];
  for (const [field, value] of cases) {
    const mismatch = attestationMismatch(onchain({}, { [field]: value }), EXPECTED, SCHEMA);
    assert.ok(mismatch?.includes(field), `${field} should be checked (got ${mismatch})`);
  }
});

test("garbage data is refused", () => {
  assert.match(attestationMismatch(onchain({ data: "0x1234" }), EXPECTED, SCHEMA)!, /decode/);
});
