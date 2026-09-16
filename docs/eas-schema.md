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
- `shipType`: `0` = release, `1` = merge.

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

Set these as build-time env vars (they're `NEXT_PUBLIC_*`, so they get
baked into the client bundle — not secrets):

- `NEXT_PUBLIC_EAS_SCHEMA_UID` — the schema UID from step 5.
- `NEXT_PUBLIC_CHAIN` — `base-sepolia` while testing, unset (or `base`) once
  you switch to mainnet.

Locally: add them to `.env`. In production: add them in the Cloudflare
dashboard under the Worker's Settings → Variables and redeploy (dashboard
build/deploy commands are what Cloudflare's hosted CI actually reads —
see the deployment notes for `wrangler.jsonc` vs. dashboard settings).

Until `NEXT_PUBLIC_EAS_SCHEMA_UID` is set, `isAttestationConfigured()`
returns `false` and the UI shows "attestations coming soon" instead of the
attest button, so it's safe to ship this feature ahead of registering the
schema.
