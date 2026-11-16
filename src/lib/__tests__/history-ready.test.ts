/**
 * "Your last 12 months are in": sent once, from Mojeeb, when a builder's
 * import has nothing pending; with an apology for those who joined while it
 * was off.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HISTORY_RESTORED_AT, sendHistoryReadyEmails } from "../email/history-ready";
import { d1, fakeEmail, migratedDb } from "./sqlite-d1";

const NOW = new Date("2026-11-16T12:00:00.000Z");
const before = new Date(HISTORY_RESTORED_AT.getTime() - 86_400_000).toISOString();
const after = new Date(HISTORY_RESTORED_AT.getTime() + 600_000).toISOString();

function setup() {
  const db = migratedDb();
  let n = 0;
  const install = (id: number, queued = true) =>
    db.prepare(`INSERT INTO "Installation" ("id", "accountLogin", "accountType", "backfillQueuedAt") VALUES (?1, ?2, 'User', ?3)`)
      .run(id, `acct${id}`, queued ? NOW.toISOString() : null);
  const builder = (fields: { login?: string; installationId?: number | null; claimedAt?: string | null; email?: string | null; hidden?: number; imported?: number; score?: number }) => {
    n += 1;
    const id = `b${n}`;
    db.prepare(
      `INSERT INTO "Builder" ("id", "githubId", "githubLogin", "name", "email", "claimedAt", "installationId", "hidden", "score", "updatedAt")
       VALUES (?1, ?2, ?3, 'Ada Lovelace', ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP)`,
    ).run(id, n, fields.login ?? `builder${n}`, fields.email === undefined ? `b${n}@example.com` : fields.email,
      fields.claimedAt === undefined ? before : fields.claimedAt, fields.installationId === undefined ? 1 : fields.installationId,
      fields.hidden ?? 0, fields.score ?? 1234);
    for (let i = 0; i < (fields.imported ?? 3); i++) {
      db.prepare(
        `INSERT INTO "Ship" ("id", "builderId", "repo", "shipType", "identifier", "commitSha", "shippedAt", "source")
         VALUES (?1, ?2, 'r/r', 'MERGE', ?3, NULL, '2026-06-01T00:00:00.000Z', 'BACKFILL')`,
      ).run(`${id}-s${i}`, id, `${id}-${i}`);
    }
    return id;
  };
  const job = (installationId: number, status: string) =>
    db.prepare(`INSERT INTO "BackfillJob" ("id", "installationId", "kind", "repo", "since", "status") VALUES (?1, ?2, 'PULLS', ?3, ?4, ?5)`)
      .run(crypto.randomUUID(), installationId, crypto.randomUUID(), NOW.toISOString(), status);
  const emailedAt = (id: string) =>
    (db.prepare(`SELECT "historyEmailedAt" AS at FROM "Builder" WHERE "id" = ?1`).get(id) as { at: string | null }).at;
  return { db, install, builder, job, emailedAt };
}

test("emails once the import has nothing pending: points, ships, from Mojeeb, with an apology for early joiners", async () => {
  const { db, install, builder, job, emailedAt } = setup();
  install(1);
  job(1, "DONE");
  const id = builder({ imported: 3, score: 1234 });
  const { binding, sent } = fakeEmail();
  assert.deepEqual(await sendHistoryReadyEmails(d1(db), binding, { now: NOW }), { sent: 1, failed: 0 });
  assert.equal(sent[0].from, "mojeeb@mail.outship.dev");
  assert.equal(sent[0].fromName, "Mojeeb from outship");
  assert.equal(sent[0].replyTo, "mojeeb@mail.outship.dev");
  assert.match(sent[0].text, /^hey Ada,/);
  assert.match(sent[0].text, /i owe you an apology/);
  assert.match(sent[0].text, /1,234 points\n3 ships from the last 12 months/);
  assert.match(sent[0].text, /https:\/\/x\.com\/intent\/post\?/);
  assert.equal(emailedAt(id), NOW.toISOString());
  // Only once.
  assert.deepEqual(await sendHistoryReadyEmails(d1(db), binding, { now: NOW }), { sent: 0, failed: 0 });
});

test("builders who join after the fix get the same email without the apology", async () => {
  const { db, install, builder } = setup();
  install(1);
  builder({ claimedAt: after });
  const { binding, sent } = fakeEmail();
  await sendHistoryReadyEmails(d1(db), binding, { now: NOW });
  assert.doesNotMatch(sent[0].text, /apology/);
  assert.match(sent[0].text, /just finished importing/);
});

test("waits while anything is pending, and skips: not queued, nothing imported, no email, hidden, unclaimed, admins", async () => {
  const { db, install, builder, job } = setup();
  install(1);
  job(1, "PENDING");
  builder({ installationId: 1 });
  install(2, false);
  builder({ installationId: 2 });
  install(3);
  builder({ installationId: 3, imported: 0 });
  builder({ installationId: 3, email: null });
  builder({ installationId: 3, hidden: 1 });
  builder({ installationId: 3, claimedAt: null });
  builder({ installationId: 3, login: "mojeebdev" });
  builder({ installationId: null });
  const { binding, sent } = fakeEmail();
  assert.deepEqual(await sendHistoryReadyEmails(d1(db), binding, { now: NOW, skipLogins: ["MojeebDev"] }), { sent: 0, failed: 0 });
  assert.equal(sent.length, 0);
});

test("a failure that hits everyone releases the claim for the next run", async () => {
  const { db, install, builder, emailedAt } = setup();
  install(1);
  const id = builder({});
  const { binding } = fakeEmail("E_RATE_LIMIT_EXCEEDED");
  assert.deepEqual(await sendHistoryReadyEmails(d1(db), binding, { now: NOW }), { sent: 0, failed: 0, stoppedOn: "E_RATE_LIMIT_EXCEEDED" });
  assert.equal(emailedAt(id), null);
});
