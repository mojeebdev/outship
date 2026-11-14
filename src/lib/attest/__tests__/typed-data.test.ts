/**
 * The server's EIP-712 signing must produce the digest the resolver rebuilds
 * onchain. contracts/test/OutshipShipResolver.t.sol (test_DigestMatchesViem)
 * pins the same value from the Solidity side.
 *
 * Run with: npm test
 */

import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress, type Address } from "viem";

import {
  clampScoreSnapshot,
  decodeShipAttestationData,
  encodeShipAttestationData,
  schemaUid,
  shipDigest,
  shipTypedData,
  type ShipAttestationFields,
} from "../typed-data";
import {
  LEGACY_SHIP_ATTESTATION_SCHEMA,
  LEGACY_SHIP_ATTESTATION_SCHEMA_UID,
  OUTSHIP_RESOLVER_ADDRESS,
  SHIP_ATTESTATION_SCHEMA,
  SHIP_ATTESTATION_SCHEMA_UID,
} from "../../web3/eas";

const RESOLVER: Address = "0x00000000000000000000000000000000000057a1";
const WALLET: Address = "0x1111111111111111111111111111111111111111";
const FIELDS: ShipAttestationFields = {
  repo: "mojeebdev/outship",
  shipType: 1,
  identifier: "42",
  commitSha: "5bcce31f5bcce31f5bcce31f5bcce31f5bcce31f",
  timestamp: BigInt(1_790_000_000),
  scoreSnapshot: 77,
  githubLogin: "mojeebdev",
  shipId: "cmship123",
  deadline: BigInt(1_790_000_900),
};

test("digest matches the one the resolver computes in Solidity", () => {
  assert.equal(
    shipDigest(84_532, RESOLVER, WALLET, FIELDS),
    "0x05aaee51f6778d3aca0f0874eb975176b87d40245cff08143cfdd128fdd577c6",
  );
});

test("a signature over the typed data recovers to the signer", async () => {
  const signer = privateKeyToAccount(`0x${"11".repeat(32)}`);
  const typedData = shipTypedData(84_532, RESOLVER, WALLET, FIELDS);
  const signature = await signer.signTypedData(typedData);
  assert.equal(await recoverTypedDataAddress({ ...typedData, signature }), signer.address);
});

test("schema data round-trips in the resolver's decode order", () => {
  const sig = `0x${"ab".repeat(65)}` as const;
  const decoded = decodeShipAttestationData(encodeShipAttestationData(FIELDS, sig));
  assert.deepEqual(decoded, { ...FIELDS, outshipSig: sig });
});

test("score snapshots fit the schema's uint16", () => {
  assert.equal(clampScoreSnapshot(-4), 0);
  assert.equal(clampScoreSnapshot(142), 142);
  assert.equal(clampScoreSnapshot(70_000), 65_535);
  assert.equal(clampScoreSnapshot(Number.NaN), 0);
});

test("the schema string lists the fields in the resolver's order", () => {
  assert.equal(
    SHIP_ATTESTATION_SCHEMA,
    "string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,uint16 scoreSnapshot,string githubLogin,string shipId,uint64 deadline,bytes outshipSig",
  );
  // v2 only appends to v1.
  assert.ok(SHIP_ATTESTATION_SCHEMA.startsWith(`${LEGACY_SHIP_ATTESTATION_SCHEMA},`));
});

test("the legacy UID is the v1 schema with no resolver, revocable", () => {
  assert.equal(
    schemaUid(LEGACY_SHIP_ATTESTATION_SCHEMA, "0x0000000000000000000000000000000000000000", true),
    LEGACY_SHIP_ATTESTATION_SCHEMA_UID,
  );
});

test("a configured v2 UID belongs to the configured resolver, non-revocable", () => {
  // Skipped until the TODOs in src/lib/web3/eas.ts are filled in; from then on
  // it catches a UID pasted from the wrong deployment or network.
  if (!OUTSHIP_RESOLVER_ADDRESS || !SHIP_ATTESTATION_SCHEMA_UID) return;
  assert.equal(
    schemaUid(SHIP_ATTESTATION_SCHEMA, OUTSHIP_RESOLVER_ADDRESS as Address, false),
    SHIP_ATTESTATION_SCHEMA_UID.toLowerCase(),
  );
});
