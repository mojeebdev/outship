import assert from "node:assert/strict";
import test from "node:test";

import { claimInviteComment } from "../claim-invite";

test("the claim comment is the agreed one-time note", () => {
  assert.equal(
    claimInviteComment("octocat", 4),
    "@octocat, this merge counted as a ship on outship — the GitHub-verified shipping leaderboard. you have 4 ships waiting at outship.dev/@octocat. claim your profile to keep your streak, or hide it. (one-time note · repo owners can turn these off at outship.dev/profile)",
  );
});

test("one ship reads as one ship", () => {
  assert.match(claimInviteComment("octocat", 1), /you have 1 ship waiting/);
});
