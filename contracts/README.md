# outship contracts

A self-contained [Foundry](https://getfoundry.sh) project: its own
`foundry.toml` and `lib/`, kept out of the Next build, type check and lint.

| Path | What |
| --- | --- |
| `src/OutshipShipResolver.sol` | the EAS resolver for ship schema v2 |
| `test/OutshipShipResolver.t.sol` | tests, run against the real EAS v1.3.0 contracts |
| `script/Deploy.s.sol` | deploys the resolver and registers schema v2 |
| `remix/` | the resolver flattened into one file, plus the compiler config, for deploying from Remix (`npm run flatten:contracts` regenerates it) |

## Setup

```bash
git submodule update --init --recursive contracts/lib
cd contracts
forge test
```

## Dependencies (git submodules in `lib/`)

- **eas-contracts at tag `v1.3.0`** (`@ethereum-attestation-service/eas-contracts`,
  imported under that name through `remappings`). Base's EAS predeploy at
  `0x4200…0021` is the OP Stack's vendored copy of this release: onchain,
  `version()` returns `1.4.1-beta.3` (the OP monorepo's own semver; `VERSION()`
  doesn't exist and reverts) and `getDomainSeparator()` equals the EIP-712
  domain `("EAS", "1.3.0", 8453, 0x4200…0021)`. Its `ISchemaResolver`, the
  `Attestation` struct and the delegated-attestation logic match `v1.3.0`;
  `v1.4.0` and later changed the resolver base.
- **openzeppelin-contracts at `v4.9.3`**, the version eas-contracts v1.3.0 itself
  depends on.
- **forge-std at `v1.9.7`**.

## Why a resolver, not delegated attestations

In EAS v1.3.0 a delegated attestation is signed by the attester over
`Attest(address attester,…,uint256 nonce,uint64 deadline)`, where the nonce is
`_nonces[attester]++`: one sequential counter per attester. The typehash Base's
predeploy returns from `getAttestTypeHash()` is exactly that
(`0xfeb2925a…d988076`). With outship as the single attester, every signature
would claim the next nonce, so two builders attesting at once would collide and
one of them would revert. A delegated attestation would also make outship the
attester and need outship's wallet to send it.

The resolver instead lets the builder be the attester and pay their own gas,
and uses the EIP-712 digest itself as the replay guard, so any number of
signatures can be outstanding at once.

## Deploying

See [docs/eas-schema.md](../docs/eas-schema.md).
