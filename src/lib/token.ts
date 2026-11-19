// OUTSHIP is a community token launched separately through o1 Exchange on
// Base. Its contract address is a runtime Worker variable, not a NEXT_PUBLIC
// build-time value, so it can be added after launch without rebuilding.
//
// Hard rule: the token never touches scoring. Scoring, ranking, streaks and
// visibility must never read token holdings, balances or payments.
import { getAddress, isAddress } from "viem";

/** Return a checksummed address, or an empty string when unset or malformed. */
export function getTokenAddress(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  return isAddress(value) ? getAddress(value) : "";
}

export function basescanTokenUrl(address: string): string {
  return `https://basescan.org/token/${address}`;
}
