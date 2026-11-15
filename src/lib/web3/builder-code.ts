// outship's Base Builder Code (from the Base Dashboard: Settings, Project
// Settings, Builder Code). It's appended to the calldata of every transaction
// outship asks a wallet to send, as an ERC-8021 suffix, so Base can attribute
// that onchain activity to outship. Contracts ignore trailing calldata, so
// the EAS attest call and its resolver run exactly as before; it costs about
// 16 gas per byte. Not a secret: it's public in every transaction's input.
import { Attribution } from "ox/erc8021";

export const BASE_BUILDER_CODE = "bc_heied7wj";

/** The ERC-8021 data suffix, passed as `dataSuffix` on every write. */
export const BUILDER_CODE_SUFFIX = Attribution.toDataSuffix({ codes: [BASE_BUILDER_CODE] });
