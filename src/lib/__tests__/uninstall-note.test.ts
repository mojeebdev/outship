/**
 * The note to a builder who uninstalled the App: 30+ minutes after, once,
 * not if they came back, and never on top of the "you haven't installed"
 * reminder.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { sendInstallReminders } from "../email/install-reminder";
import { sendUninstallNotes } from "../email/uninstall-note";
import { d1, fakeEmail, migratedDb } from "./sqlite-d1";

const NOW = new Date("2026-11-16T13:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

function setup() {
  const db = migratedDb();
  let n = 0;
  const builder = (login: string, fields: { email?: string | null; installationId?: number | null } = {}) => {
    n += 1;
    db.prepare(
      `INSERT INTO "Builder" ("id", "githubId", "githubLogin", "name", "email", "claimedAt", "installationId", "updatedAt")
       VALUES (?1, ?2, ?3, 'Mr FOMO', ?4, ?5, ?6, CURRENT_TIMESTAMP)`,
    ).run(`b${n}`, n, login, fields.email === undefined ? `${login}@example.com` : fields.email, minutesAgo(120), fields.installationId ?? null);
    return `b${n}`;
  };
  const install = (id: number, login: string, deletedMinutesAgo: number | null) =>
    db.prepare(`INSERT INTO "Installation" ("id", "accountLogin", "accountType", "deletedAt") VALUES (?1, ?2, 'User', ?3)`)
      .run(id, login, deletedMinutesAgo === null ? null : minutesAgo(deletedMinutesAgo));
  return { db, builder, install };
}

test("a builder who uninstalled 30+ minutes ago gets one note from Mojeeb", async () => {
  const { db, builder, install } = setup();
  builder("mrfomoweb3");
  install(1, "MrFomoWeb3", 45);
  const { binding, sent } = fakeEmail();
  assert.deepEqual(await sendUninstallNotes(d1(db), binding, { now: NOW }), { sent: 1, failed: 0 });
  assert.equal(sent[0].from, "mojeeb@mail.outship.dev");
  assert.equal(sent[0].replyTo, "mojeeb@mail.outship.dev");
  assert.equal(sent[0].subject, "was something off with outship?");
  assert.match(sent[0].text, /^hey Mr,/);
  assert.match(sent[0].text, /installations\/new/);
  assert.deepEqual(await sendUninstallNotes(d1(db), binding, { now: NOW }), { sent: 0, failed: 0 });
});

test("waits 30 minutes, skips anyone who came back, and ignores old uninstalls", async () => {
  const { db, builder, install } = setup();
  builder("quick");
  install(1, "quick", 10);
  builder("back", { installationId: 3 });
  install(2, "back", 60);
  install(3, "back", null);
  builder("relinked");
  install(4, "relinked", 60);
  install(5, "relinked", null);
  builder("old");
  install(6, "old", 8 * 24 * 60);
  builder("noemail", { email: null });
  install(7, "noemail", 60);
  const { binding, sent } = fakeEmail();
  assert.deepEqual(await sendUninstallNotes(d1(db), binding, { now: NOW }), { sent: 0, failed: 0 });
  assert.equal(sent.length, 0);
});

test("someone who installed and removed the App isn't also sent the 'you haven't installed' reminder", async () => {
  const { db, builder, install } = setup();
  builder("removed");
  install(1, "removed", 60);
  builder("never");
  const { binding, sent } = fakeEmail();
  await sendInstallReminders(d1(db), binding, NOW);
  assert.deepEqual(sent.map((email) => email.to), ["never@example.com"]);
});
