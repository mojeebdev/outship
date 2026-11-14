// The slice of the EAS ABI outship uses, plus OutshipShipResolver's errors:
// EAS bubbles a resolver's revert data up unchanged, so listing them here lets
// viem name the reason (an expired signature, say) when a simulation fails.
export const EAS_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "schema", type: "bytes32" },
          {
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
            name: "data",
            type: "tuple",
          },
        ],
        name: "request",
        type: "tuple",
      },
    ],
    name: "attest",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "uid", type: "bytes32" }],
    name: "getAttestation",
    outputs: [
      {
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
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "recipient", type: "address" },
      { indexed: true, name: "attester", type: "address" },
      { indexed: false, name: "uid", type: "bytes32" },
      { indexed: true, name: "schemaUID", type: "bytes32" },
    ],
    name: "Attested",
    type: "event",
  },
  // EAS's own errors that a builder can realistically hit.
  { inputs: [], name: "InvalidSchema", type: "error" },
  { inputs: [], name: "InvalidAttestation", type: "error" },
  { inputs: [], name: "NotPayable", type: "error" },
  // OutshipShipResolver's errors.
  { inputs: [], name: "SignatureExpired", type: "error" },
  { inputs: [], name: "InvalidOutshipSignature", type: "error" },
  { inputs: [], name: "RecipientNotAttester", type: "error" },
  { inputs: [], name: "DigestAlreadyUsed", type: "error" },
  { inputs: [], name: "ExpiringAttestation", type: "error" },
  { inputs: [{ name: "uid", type: "bytes32" }], name: "ShipAlreadyAttested", type: "error" },
] as const;

/** OutshipShipResolver's read of which attestation a ship already has. */
export const RESOLVER_ABI = [
  {
    inputs: [{ name: "shipKey", type: "bytes32" }],
    name: "attestationForShip",
    outputs: [{ name: "uid", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
