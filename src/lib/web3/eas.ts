// Base's OP-stack predeploy addresses — identical on Base mainnet and Base
// Sepolia. Verified against the official eas-contracts deployment files:
// https://github.com/ethereum-attestation-service/eas-contracts/blob/master/deployments/base/EAS.json
export const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";
export const SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020";

// recipient is a built-in top-level field on every EAS attestation, not
// part of the custom schema data below.
export const SHIP_ATTESTATION_SCHEMA =
  "string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,uint16 scoreSnapshot";

// Set once the schema above has actually been registered on-chain via
// SchemaRegistry.register() — see docs/eas-schema.md.
export const SHIP_ATTESTATION_SCHEMA_UID = process.env.NEXT_PUBLIC_EAS_SCHEMA_UID ?? "";

export function isAttestationConfigured(): boolean {
  return SHIP_ATTESTATION_SCHEMA_UID.length > 0;
}

export function easscanUrl(chain: string, uid: string): string {
  const host = chain === "Base Sepolia" ? "base-sepolia.easscan.org" : "base.easscan.org";
  return `https://${host}/attestation/view/${uid}`;
}
