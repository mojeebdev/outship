// Base's OP-stack predeploy addresses — identical on Base mainnet and Base
// Sepolia. Verified against the official eas-contracts deployment files:
// https://github.com/ethereum-attestation-service/eas-contracts/blob/master/deployments/base/EAS.json
export const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";
export const SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020";

// recipient is a built-in top-level field on every EAS attestation, not
// part of the custom schema data below.
export const SHIP_ATTESTATION_SCHEMA =
  "string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,uint16 scoreSnapshot";

// The schema above, registered on Base mainnet; SchemaRegistry.getSchema
// returns exactly this string with no resolver. It's a public onchain
// identifier, so it lives in source rather than depending on a build variable
// that Next only inlines if it's present during the build.
const BASE_MAINNET_SCHEMA_UID =
  "0x2edd7f1319a9f0197ca2edc42001c9f84134adce9b760e6481a80a2577d805d2";

// NEXT_PUBLIC_EAS_SCHEMA_UID overrides it (e.g. a schema registered on Base
// Sepolia). On Sepolia there is no default, since the mainnet UID doesn't exist
// there — see docs/eas-schema.md.
export const SHIP_ATTESTATION_SCHEMA_UID =
  process.env.NEXT_PUBLIC_EAS_SCHEMA_UID ||
  (process.env.NEXT_PUBLIC_CHAIN === "base-sepolia" ? "" : BASE_MAINNET_SCHEMA_UID);

// The schema's uint8 shipType. Append-only: existing attestations keep
// whatever number they were written with.
export const SHIP_TYPE_CODE = { RELEASE: 0, MERGE: 1, PUSH: 2 } as const;

export function isAttestationConfigured(): boolean {
  return SHIP_ATTESTATION_SCHEMA_UID.length > 0;
}

export function easscanUrl(chain: string, uid: string): string {
  const host = chain === "Base Sepolia" ? "base-sepolia.easscan.org" : "base.easscan.org";
  return `https://${host}/attestation/view/${uid}`;
}
