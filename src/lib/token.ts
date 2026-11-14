// The outship token, launched separately on Clanker (Base). Nothing about it
// renders anywhere, and /token is a 404, until NEXT_PUBLIC_TOKEN_ADDRESS is
// set at build time.
//
// Hard rule: the token never touches scoring. Nothing in scoring, ranking,
// streaks or visibility imports this file or reads a wallet's holdings,
// balance or payments, and src/lib/__tests__/token.test.ts fails the build's
// tests if that ever changes.
import { getAddress, isAddress } from "viem";

const raw = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? "").trim();

/** The checksummed token address, or "" when the token isn't live (or the value is malformed). */
export const TOKEN_ADDRESS: string = isAddress(raw) ? getAddress(raw) : "";

export function isTokenLive(): boolean {
  return TOKEN_ADDRESS.length > 0;
}

const testnet = process.env.NEXT_PUBLIC_CHAIN === "base-sepolia";

export function basescanTokenUrl(address: string): string {
  return `https://${testnet ? "sepolia." : ""}basescan.org/token/${address}`;
}

export function clankerTokenUrl(address: string): string {
  return `https://www.clanker.world/clanker/${address}`;
}
