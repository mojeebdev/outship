/**
 * The backfill's reading of GitHub: which PRs and releases count, how they're
 * weighted, and when paging stops.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { importedMergeWeight, parsePullsPage, parseReleasesPage } from "../backfill";

const SINCE = new Date("2025-11-15T00:00:00Z");
const SHA = "a".repeat(40);
const alice = { __typename: "User", login: "alice", databaseId: 1 };
const bob = { __typename: "User", login: "bob", databaseId: 2 };
const bot = { __typename: "Bot", login: "dependabot" };

const repository = (connection: string, nodes: unknown[], hasNextPage = true) => ({
  data: {
    repository: {
      isPrivate: false,
      defaultBranchRef: { name: "main" },
      primaryLanguage: { name: "TypeScript" },
      owner: { __typename: "User", login: "alice", databaseId: 1 },
      [connection]: { pageInfo: { hasNextPage, endCursor: "CURSOR" }, nodes },
    },
  },
});

const pr = (overrides: Record<string, unknown> = {}) => ({
  number: 7,
  mergedAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
  baseRefName: "main",
  authorAssociation: "OWNER",
  mergeCommit: { oid: SHA },
  author: alice,
  mergedBy: alice,
  ...overrides,
});

test("merged PRs into the default branch within the year are imported", () => {
  const page = parsePullsPage(repository("pullRequests", [pr()]), SINCE);
  assert.deepEqual(page.ships, [
    {
      githubId: 1,
      githubLogin: "alice",
      shipType: "MERGE",
      identifier: "7",
      commitSha: SHA,
      shippedAt: new Date("2026-10-01T10:00:00Z"),
      weightClass: "STANDARD",
      releaseHasNotes: null,
    },
  ]);
  assert.equal(page.nextCursor, "CURSOR");
  assert.deepEqual(page.repo, { private: false, defaultBranch: "main", language: "TypeScript", ownerId: 1 });
});

test("PRs into other branches, by bots, or merged before the year are skipped", () => {
  const page = parsePullsPage(
    repository("pullRequests", [
      pr({ number: 1, baseRefName: "dev" }),
      pr({ number: 2, author: bot }),
      pr({ number: 3, author: null }),
      pr({ number: 4, mergedAt: "2025-10-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }),
    ]),
    SINCE,
  );
  assert.deepEqual(page.ships, []);
});

test("paging stops once PRs were last touched before the year", () => {
  const page = parsePullsPage(repository("pullRequests", [pr({ updatedAt: "2025-01-01T00:00:00Z", mergedAt: "2025-01-01T00:00:00Z" })]), SINCE);
  assert.equal(page.nextCursor, null);
  assert.equal(parsePullsPage(repository("pullRequests", [pr()], false), SINCE).nextCursor, null);
});

test("imported merges are weighted like live ones", () => {
  assert.equal(parsePullsPage(repository("pullRequests", [pr({ mergedBy: bob })]), SINCE).ships[0].weightClass, "REVIEWED");
  assert.equal(
    parsePullsPage(repository("pullRequests", [pr({ author: bob, mergedBy: bob, authorAssociation: "CONTRIBUTOR" })]), SINCE).ships[0].weightClass,
    "EXTERNAL",
  );
  assert.equal(importedMergeWeight({ id: 2 }, { id: 2 }, "MEMBER", 99), "STANDARD");
});

const release = (overrides: Record<string, unknown> = {}) => ({
  tagName: "v1.0.0",
  isDraft: false,
  publishedAt: "2026-09-01T10:00:00Z",
  createdAt: "2026-09-01T09:00:00Z",
  description: "notes",
  releaseAssets: { totalCount: 0 },
  tagCommit: { oid: SHA },
  author: alice,
  ...overrides,
});

test("releases carry their tag's commit and whether they had notes", () => {
  const ships = parseReleasesPage(
    repository("releases", [
      release(),
      release({ tagName: "v0.9", description: "  ", releaseAssets: { totalCount: 0 } }),
      release({ tagName: "v0.8", description: "", releaseAssets: { totalCount: 2 } }),
    ]),
    SINCE,
  ).ships;
  assert.deepEqual(ships.map((ship) => [ship.identifier, ship.releaseHasNotes, ship.commitSha]), [
    ["v1.0.0", true, SHA],
    ["v0.9", false, SHA],
    ["v0.8", true, SHA],
  ]);
});

test("drafts, authorless and year-old releases are skipped, and paging stops", () => {
  const page = parseReleasesPage(
    repository("releases", [
      release({ tagName: "draft", isDraft: true, publishedAt: null }),
      release({ tagName: "ghost", author: null }),
      release({ tagName: "old", publishedAt: "2025-06-01T00:00:00Z", createdAt: "2025-06-01T00:00:00Z" }),
    ]),
    SINCE,
  );
  assert.deepEqual(page.ships, []);
  assert.equal(page.nextCursor, null);
});

test("a repo GitHub won't show gives no page", () => {
  assert.deepEqual(parsePullsPage({ data: { repository: null } }, SINCE), { ships: [], repo: null, nextCursor: null });
});
