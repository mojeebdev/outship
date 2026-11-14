# Registering the ship attestation schema on EAS

Onchain attestations use a custom schema on the [Ethereum Attestation
Service](https://attest.org). The schema has to be registered once, by a
human, before the "attest onchain" button will do anything — this is a
one-time on-chain transaction that costs a small amount of gas and can't be
done by Claude (it needs a funded wallet).

## Schema

```
string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,uint16 scoreSnapshot
```

- `recipient` is EAS's built-in top-level field (the builder's connected
  wallet) — it's not part of the schema string above.
- `shipType`: `0` = release, `1` = merged PR, `2` = push to the default branch.

## Steps

1. Go to the EAS schema registry UI for the target network:
   - Base mainnet: https://base.easscan.org/schema/create
   - Base Sepolia (testnet, recommended to try first): https://base-sepolia.easscan.org/schema/create
2. Paste the schema string above into the schema field exactly as written.
3. Leave "Resolver Contract" empty and "Revocable" checked.
4. Submit the transaction from your wallet and wait for it to confirm.
5. Copy the resulting schema UID (a `0x…` 32-byte hex string) from the
   confirmation page.

## Wiring it up

**Base mainnet is done.** The schema is registered as

```
0x2edd7f1319a9f0197ca2edc42001c9f84134adce9b760e6481a80a2577d805d2
```

(verified with `SchemaRegistry.getSchema` on Base: no resolver, revocable, and a
schema string identical to `SHIP_ATTESTATION_SCHEMA`). That UID is the default in
`src/lib/web3/eas.ts`, so the attest button is live on mainnet with no
configuration. It is a public onchain identifier, so it is committed rather than
supplied as a variable: `NEXT_PUBLIC_*` values are only inlined into the client
bundle if they are present while `next build` runs, and a variable set in the
wrong place of the Cloudflare dashboard silently leaves the button on
"attestations coming soon".

To use a different schema (for example one registered on Base Sepolia), set at
**build** time:

- `NEXT_PUBLIC_EAS_SCHEMA_UID` - that schema's UID. It overrides the default.
- `NEXT_PUBLIC_CHAIN` - `base-sepolia`. On Sepolia there is no default UID, so the
  button stays off until the override is set.

In Cloudflare these go under the Worker's **Settings -> Build -> Variables and
secrets** (Workers Builds), not the runtime Variables tab.
