/**
 * Bots and AI agents with user accounts are never credited as builders.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { isBotLogin } from "../bots";
import { parseCommitsPage } from "../backfill";

test("known agents, [bot] apps and -bot accounts are bots; people aren't", () => {
  for (const login of ["claude", "Claude", "v0", "netlify-bot", "dependabot[bot]", "snyk_bot", "devin-ai-integration"]) {
    assert.equal(isBotLogin(login), true, login);
  }
  for (const login of ["mojeebdev", "ace-coderr", "JamesVictor-O", "abbot", "robotics-lab"]) {
    assert.equal(isBotLogin(login), false, login);
  }
});

test("the history import skips commits by agents posing as users", () => {
  const node = (oid: string, login: string, id: number) => ({
    oid,
    committedDate: "2026-10-01T10:00:00Z",
    parents: { totalCount: 1 },
    author: { user: { __typename: "User", login, databaseId: id } },
  });
  const json = {
    data: {
      repository: {
        isPrivate: false,
        defaultBranchRef: {
          name: "main",
          target: {
            history: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [node("a".repeat(40), "claude", 1), node("b".repeat(40), "ada", 2), node("c".repeat(40), "netlify-bot", 3)],
            },
          },
        },
        primaryLanguage: null,
        owner: { __typename: "User", login: "ada", databaseId: 2 },
      },
    },
  };
  assert.deepEqual(parseCommitsPage(json).ships.map((ship) => ship.githubLogin), ["ada"]);
});
