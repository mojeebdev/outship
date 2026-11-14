// Re-checks every schema v1 ("legacy") attestation row against Base and
// removes the ones that don't exist onchain: the transaction is missing or
// failed, it emitted no EAS Attested event for that UID, EAS has no
// attestation with that UID, or that attestation isn't under schema v1. v1 rows were stored on the browser's word alone,
// so some may never have happened.
//
// Dry run by default: it prints what it would delete. Pass --apply to delete.
// Rows it can't check (an RPC error) are always kept.
//
//   node scripts/verify-legacy-attestations.mjs            # local D1, dry run
//   node scripts/verify-legacy-attestations.mjs --remote   # production, dry run
//   node scripts/verify-legacy-attestations.mjs --remote --apply
//
// RPC: BASE_RPC_URL / BASE_SEPOLIA_RPC_URL, else Base's public endpoints.

import { createPublicClient, http, parseEventLogs } from "viem";
import { base, baseSepolia } from "viem/chains";
import { d1, d1Target, sqlString } from "./lib/d1.mjs";

const EAS = "0x4200000000000000000000000000000000000021";
// Schema v1, from src/lib/web3/eas.ts.
const LEGACY_SCHEMA_UID = "0x2edd7f1319a9f0197ca2edc42001c9f84134adce9b760e6481a80a2577d805d2";
const EAS_ABI = [
  {
    type: "event",
    name: "Attested",
    anonymous: false,
    inputs: [
      { indexed: true, name: "recipient", type: "address" },
      { indexed: true, name: "attester", type: "address" },
      { indexed: false, name: "uid", type: "bytes32" },
      { indexed: true, name: "schemaUID", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "getAttestation",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "schema", type: "bytes32" },
          { name: "time", type: "uint64" },
          { name: "expirationTime", type: "uint64" },
          { name: "revocationTime", type: "uint64" },
          { name: "refUID", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "attester", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
  },
];

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const target = d1Target(args);

const clients = {
  base: createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org") }),
  sepolia: createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  }),
};
const clientFor = (chain) => (/sepolia/i.test(chain) ? clients.sepolia : clients.base);
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

/** "ok", a reason it's gone, or { unknown } when the chain couldn't be asked. */
async function check(row) {
  const client = clientFor(row.chain);
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: row.txHash });
  } catch (error) {
    if (error?.name === "TransactionReceiptNotFoundError") return "transaction not found";
    return { unknown: error?.shortMessage ?? String(error) };
  }
  if (receipt.status !== "success") return "transaction failed";
  const logged = parseEventLogs({ abi: EAS_ABI, eventName: "Attested", logs: receipt.logs }).some(
    (log) => same(log.address, EAS) && same(log.args.uid, row.easUid),
  );
  if (!logged) return "transaction has no Attested event for this UID";
  try {
    const attestation = await client.readContract({
      address: EAS,
      abi: EAS_ABI,
      functionName: "getAttestation",
      args: [row.easUid],
    });
    if (!same(attestation.uid, row.easUid)) return "UID not found in EAS";
    // A real attestation, but not an outship ship receipt.
    if (!same(attestation.schema, LEGACY_SCHEMA_UID)) return "UID belongs to another schema";
  } catch (error) {
    return { unknown: error?.shortMessage ?? String(error) };
  }
  return "ok";
}

const [rows] = d1(
  `SELECT a."id", a."easUid", a."txHash", a."chain", s."repo", s."identifier"
     FROM "Attestation" a JOIN "Ship" s ON s."id" = a."shipId"
    WHERE a."schemaVersion" = 1`,
  target,
);
console.log(`${rows.length} legacy attestation(s) in ${target === "--remote" ? "production" : "local"} D1\n`);

const doomed = [];
let unknown = 0;
for (const row of rows) {
  const verdict = await check(row);
  if (verdict === "ok") {
    console.log(`  ok       ${row.easUid}  ${row.repo} ${row.identifier}`);
  } else if (typeof verdict === "object") {
    unknown++;
    console.log(`  unknown  ${row.easUid}  kept (${verdict.unknown})`);
  } else {
    doomed.push(row);
    console.log(`  missing  ${row.easUid}  ${row.repo} ${row.identifier}: ${verdict}`);
  }
}

console.log(`\n${rows.length - doomed.length - unknown} verified, ${doomed.length} missing, ${unknown} unchecked`);
if (doomed.length === 0) process.exit(0);

if (!apply) {
  console.log("dry run: nothing deleted. re-run with --apply to delete the missing rows.");
  process.exit(0);
}
d1(`DELETE FROM "Attestation" WHERE "id" IN (${doomed.map((row) => sqlString(row.id)).join(", ")})`, target);
console.log(`deleted ${doomed.length} row(s).`);
