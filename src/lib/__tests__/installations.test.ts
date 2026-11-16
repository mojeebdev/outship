/**
 * Installation events keep Builder.installationId in step, so a builder who
 * signs in first and installs the App after isn't left looking uninstalled.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { syncInstallation } from "../installations";

type Call = { where: Record<string, unknown>; data: Record<string, unknown> };

function fakeDb() {
  const updates: Call[] = [];
  const db = {
    installation: { upsert: async () => ({}) },
    builder: {
      updateMany: async (call: Call) => {
        updates.push(call);
        return { count: 1 };
      },
    },
  };
  return { db: db as unknown as Parameters<typeof syncInstallation>[0], updates };
}

type Account = { login: string; type: string; id: number };
const install = (action: string, account: Account, sender: number = account.id) => ({
  action,
  installation: { id: 77, account },
  sender: { id: sender },
});

test("a personal install links that account's builder", async () => {
  const { db, updates } = fakeDb();
  await syncInstallation(db, "installation", install("created", { login: "ada", type: "User", id: 5 }));
  assert.deepEqual(updates, [{ where: { githubId: 5 }, data: { installationId: 77 } }]);
});

test("an org install links whoever installed it, if they have no install yet", async () => {
  const { db, updates } = fakeDb();
  await syncInstallation(db, "installation", install("created", { login: "acme", type: "Organization", id: 900 }, 5));
  assert.deepEqual(updates, [{ where: { githubId: 5, installationId: null }, data: { installationId: 77 } }]);
});

test("uninstalling unlinks every builder on that install", async () => {
  const { db, updates } = fakeDb();
  await syncInstallation(db, "installation", install("deleted", { login: "ada", type: "User", id: 5 }));
  assert.deepEqual(updates, [{ where: { installationId: 77 }, data: { installationId: null } }]);
});

test("other events and actions don't touch builders", async () => {
  const { db, updates } = fakeDb();
  await syncInstallation(db, "installation", install("suspend", { login: "ada", type: "User", id: 5 }));
  await syncInstallation(db, "push", { installation: { id: 77 }, repository: { owner: { login: "ada" } }, sender: { id: 5 } });
  await syncInstallation(db, "installation_repositories", install("added", { login: "ada", type: "User", id: 5 }));
  assert.deepEqual(updates, []);
});
