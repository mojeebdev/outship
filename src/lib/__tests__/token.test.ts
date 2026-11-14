/**
 * The token must never be able to change score, rank, streak or visibility.
 * This is a tripwire: none of the code that decides those may import the
 * token modules or read a wallet balance.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isTokenLive } from "../token";

const SCORING_FILES = [
  "../score.ts",
  "../rescore.ts",
  "../leaderboard.ts",
  "../builders.ts",
  "../expire-streaks.ts",
  "../webhook-ships.ts",
  "../profile-data.ts",
  "../../app/api/github/webhooks/route.ts",
  "../../../scripts/rescore-all.mjs",
];

test("scoring, ranking, streaks and visibility never touch the token or balances", () => {
  for (const relative of SCORING_FILES) {
    const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
    assert.doesNotMatch(source, /lib\/token|token-disclosure|TOKEN_ADDRESS/, `${relative} imports the token`);
    assert.doesNotMatch(source, /getBalance|balanceOf|walletAddress/, `${relative} reads wallets or balances`);
  }
});

test("without NEXT_PUBLIC_TOKEN_ADDRESS the token isn't live", () => {
  // The test environment never sets it.
  assert.equal(isTokenLive(), false);
});
