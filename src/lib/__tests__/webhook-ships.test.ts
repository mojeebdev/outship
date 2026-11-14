/**
 * Which webhook payloads become ships, and how they're weighted.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { mergeWeightClass, shipFromPayload, type Repository } from "../webhook-ships";

const owner = { id: 1, login: "alice", type: "User" };
const repository: Repository = { owner, name: "app", default_branch: "main", language: "TypeScript" };
const alice = { id: 1, login: "alice", type: "User" };
const bob = { id: 2, login: "bob", type: "User" };

function mergedPr(overrides: Record<string, unknown> = {}) {
  return {
    action: "closed",
    repository,
    pull_request: {
      number: 7,
      merged: true,
      merged_at: "2026-11-14T10:00:00Z",
      merge_commit_sha: "a".repeat(40),
      base: { ref: "main" },
      user: alice,
      merged_by: alice,
      author_association: "OWNER",
      ...overrides,
    },
  };
}

test("an owner merging their own PR is a standard merge", () => {
  assert.equal(shipFromPayload("pull_request", mergedPr())?.weightClass, "STANDARD");
});

test("a PR merged by someone else is reviewed", () => {
  assert.equal(shipFromPayload("pull_request", mergedPr({ merged_by: bob }))?.weightClass, "REVIEWED");
});

test("a PR from outside the repo is external, even if its author merged it", () => {
  const ship = shipFromPayload("pull_request", mergedPr({ user: bob, merged_by: bob, author_association: "CONTRIBUTOR" }));
  assert.equal(ship?.weightClass, "EXTERNAL");
  assert.equal(ship?.credit.kind === "user" && ship.credit.githubLogin, "bob");
});

test("an org member merging their own PR isn't an outsider", () => {
  const orgRepo: Repository = { ...repository, owner: { id: 99, login: "acme", type: "Organization" } };
  assert.equal(mergeWeightClass({ user: bob, merged_by: bob, author_association: "MEMBER" }, orgRepo), "STANDARD");
  assert.equal(mergeWeightClass({ user: bob, merged_by: alice, author_association: "MEMBER" }, orgRepo), "REVIEWED");
  assert.equal(mergeWeightClass({ user: bob, merged_by: bob, author_association: "FIRST_TIME_CONTRIBUTOR" }, orgRepo), "EXTERNAL");
});

test("merges carry the repo's language", () => {
  assert.equal(shipFromPayload("pull_request", mergedPr())?.language, "TypeScript");
});

test("unmerged or non-default-branch PRs aren't ships", () => {
  assert.equal(shipFromPayload("pull_request", mergedPr({ merged: false })), null);
  assert.equal(shipFromPayload("pull_request", mergedPr({ base: { ref: "dev" } })), null);
  assert.equal(shipFromPayload("pull_request", mergedPr({ user: { ...bob, type: "Bot" } })), null);
});

function release(overrides: Record<string, unknown> = {}) {
  return {
    action: "published",
    repository,
    release: {
      draft: false,
      tag_name: "v1.0.0",
      target_commitish: "main",
      published_at: "2026-11-14T10:00:00Z",
      created_at: "2026-11-14T09:00:00Z",
      author: alice,
      body: "",
      assets: [],
      ...overrides,
    },
  };
}

test("a release records whether it had notes or assets", () => {
  assert.equal(shipFromPayload("release", release())?.releaseHasNotes, false);
  assert.equal(shipFromPayload("release", release({ body: "   \n" }))?.releaseHasNotes, false);
  assert.equal(shipFromPayload("release", release({ body: "fixes the thing" }))?.releaseHasNotes, true);
  assert.equal(shipFromPayload("release", release({ assets: [{ id: 1 }] }))?.releaseHasNotes, true);
});

test("drafts and bot releases aren't ships", () => {
  assert.equal(shipFromPayload("release", release({ draft: true })), null);
  assert.equal(shipFromPayload("release", release({ author: { ...alice, type: "Bot" } })), null);
});

test("a release keeps its commit only when the payload gives a full SHA", () => {
  assert.equal(shipFromPayload("release", release({ target_commitish: "main" }))?.commitSha, null);
  const sha = "b".repeat(40);
  assert.equal(shipFromPayload("release", release({ target_commitish: sha }))?.commitSha, sha);
});
