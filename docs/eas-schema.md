# The ship attestation schema on EAS

Onchain attestations use a custom schema on the [Ethereum Attestation
Service](https://attest.org), on Base. Deploying the resolver and registering
the schema are one-time onchain transactions that cost a little gas, so a
human with a funded wallet does them; nothing in this repo holds a key.

## Schema v2 (current)

```
string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,uint16 scoreSnapshot,string githubLogin,string shipId,uint64 deadline,bytes outshipSig
```

- `recipient` and `attester` are EAS's built-in top-level fields. For a v2
  attestation they're both the builder's wallet: the builder sends it and
  pays the gas.
- `shipType`: `0` = release, `1` = merged PR, `2` = push to the default branch.
- `outshipSig` is outship's EIP-712 signature over everything else (plus
  `recipient` and `attester`). The schema's resolver,
  [`OutshipShipResolver`](../contracts/src/OutshipShipResolver.sol), refuses any
  attestation whose signature doesn't recover to outship's signer, whose
  `deadline` has passed, whose attester isn't its recipient, or whose digest
  was already used. So a v2 attestation can only exist for a ship that's in
  outship's database, with the details outship has for it.
- Registered **non-revocable**, and the resolver's `onRevoke` returns false:
  receipts are permanent.
- The fields are append-only. Changing what an attestation says means a new
  schema (and a new resolver if the signed struct changes).

### How an attestation is made

1. The builder clicks "attest onchain" on their profile and connects a wallet.
2. `POST /api/ships/{id}/attest/authorize` with `{ recipient }`: the server
   checks the builder owns the ship, that it's public, not yet attested and
   has a real commit SHA, links the wallet if none is linked yet, builds every
   field from the database, signs it with `OUTSHIP_ATTESTER_PRIVATE_KEY`
   (valid for 15 minutes) and returns the encoded schema data.
3. The wallet calls `EAS.attest` with that data. The resolver checks it.
4. `POST /api/ships/{id}/attest` with `{ txHash }`: the server reads the
   receipt and the attestation back from Base, checks they describe this ship
   and this builder, and only then stores it, with the score taken from the
   onchain data.

The signer key only signs; it never sends a transaction and needs no funds.

### Why a resolver and not delegated attestations

EAS delegated attestations are signed by the *attester* against a sequential
per-attester nonce. Base's predeploy reports `version()` = `1.4.1-beta.3` (the
OP Stack's vendored copy of eas-contracts v1.3.0; `VERSION()` doesn't exist and
reverts) and its `getAttestTypeHash()` is
`Attest(address attester,…,uint256 nonce,uint64 deadline)`, with the nonce
taken as `_nonces[attester]++`. With outship as the one attester, two builders
attesting at the same time would race for the same nonce. The resolver uses
the digest as its replay guard instead, so signatures never collide. See
[contracts/README.md](../contracts/README.md).

## Deploying v2

Try everything on Base Sepolia first.

1. **Make a signer key.** A fresh private key used for nothing else, e.g.
   `cast wallet new`. Store it as the Worker secret
   `OUTSHIP_ATTESTER_PRIVATE_KEY` (`wrangler secret put OUTSHIP_ATTESTER_PRIVATE_KEY`).
   Its address is the `OUTSHIP_SIGNER` below. It needs no ETH.
2. **Pick an owner.** A wallet you control and keep safe (ideally a hardware
   wallet or a Safe). It can rotate the signer and nothing else.
3. **Deploy and register** from a funded wallet in a forge keystore:

   ```bash
   cd contracts
   git submodule update --init --recursive lib
   OUTSHIP_OWNER=0xYourOwner OUTSHIP_SIGNER=0xSignerAddress \
     forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org \
     --account deployer --broadcast
   ```

   The script deploys `OutshipShipResolver` and registers the schema with it,
   non-revocable, in the same run, then prints the resolver address and the
   schema UID. (Add `--verify` with a BaseScan key to publish the source.)
4. **Wire it up.** Paste the resolver address and the UID into
   `V2_DEPLOYMENTS` in `src/lib/web3/eas.ts`, for the right network. The node
   tests check that the UID really is this schema registered with that
   resolver, non-revocable.
5. Repeat with `--rpc-url https://mainnet.base.org` for Base mainnet.

You can also register by hand at https://base.easscan.org/schema/create (or
base-sepolia): paste the schema string exactly, put the resolver address in
"Resolver Contract", and uncheck "Revocable".

### Rotating the signer

Generate a new key, set it as `OUTSHIP_ATTESTER_PRIVATE_KEY`, then from the
owner wallet call `setOutshipSigner(newAddress)`. Signatures from the old key
stop working immediately, including any not yet submitted (those builders just
re-authorize). The resolver emits `OutshipSignerRotated`.

## Build-time overrides

The UID and resolver are public onchain values, so they're committed rather
than supplied as variables: `NEXT_PUBLIC_*` values are only inlined into the
client bundle if they're present while `next build` runs. To point a build at
another deployment, set at **build** time (in Cloudflare: Worker **Settings ->
Build -> Variables and secrets**):

- `NEXT_PUBLIC_CHAIN` = `base-sepolia` for the testnet.
- `NEXT_PUBLIC_EAS_SCHEMA_UID` and `NEXT_PUBLIC_OUTSHIP_RESOLVER` to override
  the values in `V2_DEPLOYMENTS`.

Until both a UID and a resolver are set for the active chain, the attest
button says "attestations coming soon".

Runtime: `BASE_RPC_URL` (optional) is the JSON-RPC endpoint the server reads
receipts from; without it, Base's public endpoint is used.

## Schema v1 (legacy)

```
string repo,uint8 shipType,string identifier,string commitSha,uint64 timestamp,uint16 scoreSnapshot
```

Registered on Base mainnet as
`0x2edd7f1319a9f0197ca2edc42001c9f84134adce9b760e6481a80a2577d805d2`, with no
resolver and revocable. Because anyone can attest anything with it, a v1
attestation can't be told apart from a forged one, so outship no longer writes
it. Existing v1 rows (`Attestation.schemaVersion = 1`) show as "legacy ·
unverified".

`scripts/verify-legacy-attestations.mjs` re-checks those rows onchain and, with
`--apply`, deletes any whose transaction or attestation doesn't exist. It's a
dry run unless `--apply` is passed.
