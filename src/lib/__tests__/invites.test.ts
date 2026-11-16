/**
 * Friend invites: who can be invited, how many, once per address, opting
 * out, the email's display name and wording, and the ?ref= login check.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { inviteEmail } from "../email/templates";
import {
  INVITES_PER_BUILDER,
  createInvite,
  dropInvite,
  inviterDisplayName,
  listInvites,
  markInviteSent,
  normalizeEmail,
  optOutOfInvites,
  validRef,
} from "../invites";
import { d1, migratedDb } from "./sqlite-d1";

function setup() {
  const db = migratedDb();
  const builder = (id: string, email: string | null, claimed = true) =>
    db.prepare(
      `INSERT INTO "Builder" ("id", "githubId", "githubLogin", "email", "claimedAt", "updatedAt") VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)`,
    ).run(id, Math.floor(Math.random() * 1e9), id, email, claimed ? "2026-11-01T00:00:00.000Z" : null);
  builder("ada", "ada@example.com");
  return { db, D1: d1(db), builder };
}
const ada = { id: "ada", email: "ada@example.com" };

test("emails are trimmed, lowercased and checked", () => {
  assert.equal(normalizeEmail("  Friend@Example.COM "), "friend@example.com");
  for (const bad of ["", "nope", "a@b", "a b@c.d", "<x@y.z>", 42, null]) assert.equal(normalizeEmail(bad), null, String(bad));
});

test("an invite is created once per address, ever, whoever asks", async () => {
  const { D1, builder } = setup();
  builder("bob", "bob@example.com");
  const first = await createInvite(D1, ada, "Friend@Example.com");
  assert.equal(first.ok, true);
  assert.deepEqual(await createInvite(D1, { id: "bob", email: "bob@example.com" }, "friend@example.com"), { ok: false, reason: "taken" });
});

test("refuses: bad email, yourself, someone already on outship", async () => {
  const { D1, builder } = setup();
  builder("cy", "cy@example.com");
  assert.deepEqual(await createInvite(D1, ada, "not an email"), { ok: false, reason: "invalid" });
  assert.deepEqual(await createInvite(D1, ada, "ADA@example.com"), { ok: false, reason: "self" });
  assert.deepEqual(await createInvite(D1, ada, "cy@example.com"), { ok: false, reason: "member" });
});

test(`at most ${INVITES_PER_BUILDER} invites per builder`, async () => {
  const { D1 } = setup();
  for (let i = 0; i < INVITES_PER_BUILDER; i++) assert.equal((await createInvite(D1, ada, `f${i}@example.com`)).ok, true);
  assert.deepEqual(await createInvite(D1, ada, "one-more@example.com"), { ok: false, reason: "limit" });
});

test("an invite that couldn't be sent gives the address and the allowance back", async () => {
  const { D1 } = setup();
  const result = await createInvite(D1, ada, "friend@example.com");
  assert.ok(result.ok);
  await dropInvite(D1, result.id);
  assert.equal((await createInvite(D1, ada, "friend@example.com")).ok, true);
});

test("the list shows sent invites, and who joined", async () => {
  const { D1, builder } = setup();
  const a = await createInvite(D1, ada, "dee@example.com");
  const b = await createInvite(D1, ada, "eve@example.com");
  await createInvite(D1, ada, "unsent@example.com");
  assert.ok(a.ok && b.ok);
  await markInviteSent(D1, a.id);
  await markInviteSent(D1, b.id);
  builder("dee", "dee@example.com");
  const rows = await listInvites(D1, "ada");
  assert.deepEqual(rows.sort((x, y) => x.email.localeCompare(y.email)), [
    { email: "dee@example.com", joined: true },
    { email: "eve@example.com", joined: false },
  ]);
});

test("opting out records it, only for a real token", async () => {
  const { D1, db } = setup();
  const result = await createInvite(D1, ada, "friend@example.com");
  assert.ok(result.ok);
  assert.equal(await optOutOfInvites(D1, "not-a-token"), false);
  assert.equal(await optOutOfInvites(D1, result.token), true);
  const row = db.prepare(`SELECT "optedOutAt" AS at FROM "Invite" WHERE "id" = ?1`).get(result.id) as { at: string | null };
  assert.ok(row.at);
});

test("the display name can't break out of the From header", () => {
  assert.equal(inviterDisplayName('Ada "Lovelace" <x@y.z>\r\nBcc: z', "ada"), "Ada Lovelace x@y.z Bcc: z");
  assert.equal(inviterDisplayName(null, "ada"), "@ada");
  assert.equal(inviterDisplayName("   ", "ada"), "@ada");
  assert.equal(inviterDisplayName("x".repeat(80), "ada").length, 40);
});

test("the invite email has the join link with ?ref=, their profile, and the opt-out", () => {
  const email = inviteEmail({ inviterLogin: "ada", inviterDisplay: "Ada <b>", token: "tok" });
  assert.equal(email.subject, "Ada <b> invited you to outship");
  assert.match(email.text, /https:\/\/outship\.dev\/api\/auth\/github\/login\?ref=ada/);
  assert.match(email.text, /https:\/\/outship\.dev\/@ada/);
  assert.match(email.text, /never email me again: https:\/\/outship\.dev\/invite\/opt-out\?token=tok/);
  assert.match(email.html, /Ada &lt;b&gt;/);
});

test("?ref= only takes a GitHub login", () => {
  assert.equal(validRef("mojeebdev"), "mojeebdev");
  assert.equal(validRef("Jamesvictor-O"), "Jamesvictor-O");
  for (const bad of ["", "-x", "a/b", "x".repeat(40), "<script>", null]) assert.equal(validRef(bad), null, String(bad));
});
