// Base's OP-stack predeploy addresses — identical on Base mainnet and Base
// Sepolia. Verified against the official eas-contracts deployment files:
// https://github.com/ethereum-attestation-service/eas-contracts/blob/master/deployments/base/EAS.json
export const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";
export const SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020";

const useTestnet = process.env.NEXT_PUBLIC_CHAIN === "base-sepolia";

// ── schema v2 (current) ──────────────────────────────────────────────────────
//
// Every v2 attestation carries outship's EIP-712 signature over the ship, and
// the schema's resolver (contracts/src/OutshipShipResolver.sol) refuses any
// attestation whose signature doesn't recover to outship's signer. So a v2
// receipt can only exist for a ship outship's database actually holds, while
// the builder still submits it from their own wallet and pays the gas.
//
// recipient and attester are EAS's built-in top-level fields, not part of the
// schema string. Append-only: the resolver decodes the fields in this order.
export const SHIP_ATTESTATION_SCHEMA =
  "string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,uint16 scoreSnapshot,string githubLogin,string shipId,uint64 deadline,bytes outshipSig";

// TODO(schema v2): after deploying OutshipShipResolver and registering the
// schema above with it (revocable off), paste the resolver address and the
// schema UID here. See docs/eas-schema.md. Both are public onchain values, so
// they live in source rather than in build variables (Next only inlines a
// NEXT_PUBLIC_* value that is present while `next build` runs). Until both are
// set, the attest button says "attestations coming soon".
const V2_DEPLOYMENTS = {
  base: {
    resolver: "", // TODO: OutshipShipResolver on Base mainnet
    schemaUid: "", // TODO: schema v2 UID on Base mainnet
  },
  "base-sepolia": {
    resolver: "", // TODO: OutshipShipResolver on Base Sepolia
    schemaUid: "", // TODO: schema v2 UID on Base Sepolia
  },
} as const;

const deployment = V2_DEPLOYMENTS[useTestnet ? "base-sepolia" : "base"];

// NEXT_PUBLIC_EAS_SCHEMA_UID / NEXT_PUBLIC_OUTSHIP_RESOLVER override the values
// above at build time, e.g. to try a fresh deployment on Base Sepolia.
export const OUTSHIP_RESOLVER_ADDRESS: string =
  process.env.NEXT_PUBLIC_OUTSHIP_RESOLVER || deployment.resolver;

export const SHIP_ATTESTATION_SCHEMA_UID: string =
  process.env.NEXT_PUBLIC_EAS_SCHEMA_UID || deployment.schemaUid;

// ── schema v1 (legacy) ───────────────────────────────────────────────────────
//
// The first schema had no resolver: anyone could attest anything with it, so a
// v1 attestation can't be told apart from a forged one. Existing v1 rows are
// shown as "legacy · unverified"; nothing new is written with it.
export const LEGACY_SHIP_ATTESTATION_SCHEMA =
  "string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,uint16 scoreSnapshot";
export const LEGACY_SHIP_ATTESTATION_SCHEMA_UID =
  "0x2edd7f1319a9f0197ca2edc42001c9f84134adce9b760e6481a80a2577d805d2";

/** Attestation.schemaVersion for rows written from now on. */
export const CURRENT_SCHEMA_VERSION = 2;

// The schema's uint8 shipType. Append-only: existing attestations keep
// whatever number they were written with.
export const SHIP_TYPE_CODE = { RELEASE: 0, MERGE: 1, PUSH: 2 } as const;

/** True once the v2 resolver and schema UID are both filled in. */
export function isAttestationConfigured(): boolean {
  return OUTSHIP_RESOLVER_ADDRESS.length > 0 && SHIP_ATTESTATION_SCHEMA_UID.length > 0;
}

export function easscanUrl(chain: string, uid: string): string {
  const sepolia = chain === "Base Sepolia" || chain === "base-sepolia";
  const host = sepolia ? "base-sepolia.easscan.org" : "base.easscan.org";
  return `https://${host}/attestation/view/${uid}`;
}
