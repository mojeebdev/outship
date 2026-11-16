/**
 * The one-time "install the GitHub App" reminder: who gets it, when, and only
 * once. Runs the real SQL against SQLite built from the real migrations,
 * through a small D1-shaped wrapper, with a fake EMAIL binding.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { sendInstallReminders } from "../email/install-reminder";
import { installReminderEmail } from "../email/templates";

const MIGRATIONS = join(process.cwd(), "migrations");
const NOW = new Date("2026-11-16T12:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

function d1(db: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    const statement = db.prepare(sql);
    const bound = (args: unknown[]) => ({
      bind: (...more: unknown[]) => bound([...args, ...more]),
      all: async () => ({ results: statement.all(...(args as never[])) }),
      run: async () => ({ meta: { changes: Number(statement.run(...(args as never[])).changes) } }),
    });
    return bound([]);
  };
  return { prepare } as unknown as D1Database;
}

function setup() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  }
  let n = 0;
  const builder = (fields: { email?: string | null; claimedAt?: string | null; installationId?: number | null; reminded?: string | null }) => {
    n += 1;
    db.prepare(
      `INSERT INTO "Builder" ("id", "githubId", "githubLogin", "email", "claimedAt", "installationId", "installReminderSentAt", "updatedAt")
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP)`,
    ).run(`b${n}`, n, `builder${n}`, fields.email === undefined ? `b${n}@example.com` : fields.email,
      fields.claimedAt === undefined ? minutesAgo(45) : fields.claimedAt, fields.installationId ?? null, fields.reminded ?? null);
    return `b${n}`;
  };
  const sentAt = (id: string) =>
    (db.prepare(`SELECT "installReminderSentAt" AS at FROM "Builder" WHERE "id" = ?1`).get(id) as { at: string | null }).at;
  return { db, builder, sentAt };
}

function fakeEmail(fail?: string) {
  const sent: { to: string; from: string; subject: string }[] = [];
  const binding = {
    async send(message: { to: string; from: { email: string }; subject: string }) {
      if (fail) throw Object.assign(new Error(fail), { code: fail });
      sent.push({ to: message.to, from: message.from.email, subject: message.subject });
    },
  } as unknown as SendEmail;
  return { binding, sent };
}

test("reminds a builder 30+ minutes after sign-in when the App isn't installed", async () => {
  const { db, builder, sentAt } = setup();
  const id = builder({ claimedAt: minutesAgo(31) });
  const { binding, sent } = fakeEmail();
  assert.deepEqual(await sendInstallReminders(d1(db), binding, NOW), { sent: 1, failed: 0 });
  assert.deepEqual(sent, [{ to: "b1@example.com", from: "reminder@mail.outship.dev", subject: "one step left: connect your repos to outship" }]);
  assert.equal(sentAt(id), NOW.toISOString());
});

test("only once: a second run sends nothing", async () => {
  const { db, builder } = setup();
  builder({});
  const { binding, sent } = fakeEmail();
  await sendInstallReminders(d1(db), binding, NOW);
  assert.deepEqual(await sendInstallReminders(d1(db), binding, new Date(NOW.getTime() + 600_000)), { sent: 0, failed: 0 });
  assert.equal(sent.length, 1);
});

test("skips: too soon, App installed, no email, unclaimed, already reminded, or signed in over a week ago", async () => {
  const { db, builder } = setup();
  builder({ claimedAt: minutesAgo(29) });
  builder({ installationId: 123 });
  builder({ email: null });
  builder({ claimedAt: null });
  builder({ reminded: minutesAgo(5) });
  builder({ claimedAt: minutesAgo(8 * 24 * 60) });
  const { binding, sent } = fakeEmail();
  assert.deepEqual(await sendInstallReminders(d1(db), binding, NOW), { sent: 0, failed: 0 });
  assert.equal(sent.length, 0);
});

test("reads claimedAt in the form Prisma writes it (+00:00), not just Z", async () => {
  const { db, builder } = setup();
  builder({ claimedAt: "2026-11-16T11:20:00.000+00:00" });
  const { binding, sent } = fakeEmail();
  await sendInstallReminders(d1(db), binding, NOW);
  assert.equal(sent.length, 1);
});

test("a failure that hits everyone stops the run and releases the claim for a retry", async () => {
  const { db, builder, sentAt } = setup();
  const first = builder({});
  builder({});
  const { binding } = fakeEmail("E_RATE_LIMIT_EXCEEDED");
  assert.deepEqual(await sendInstallReminders(d1(db), binding, NOW), { sent: 0, failed: 0, stoppedOn: "E_RATE_LIMIT_EXCEEDED" });
  assert.equal(sentAt(first), null);
});

test("a per-recipient failure stays marked, so it isn't retried forever", async () => {
  const { db, builder, sentAt } = setup();
  const id = builder({});
  const { binding } = fakeEmail("E_RECIPIENT_SUPPRESSED");
  assert.deepEqual(await sendInstallReminders(d1(db), binding, NOW), { sent: 0, failed: 1 });
  assert.equal(sentAt(id), NOW.toISOString());
});

test("the email has the install link, and the login escaped in HTML", () => {
  const email = installReminderEmail({ login: "a<b" });
  assert.match(email.text, /https:\/\/github\.com\/apps\/.+\/installations\/new/);
  assert.match(email.html, /@a&lt;b/);
  assert.match(email.text, /only reminder/);
});
