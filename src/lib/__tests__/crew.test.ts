/**
 * "Your crew": unclaimed builders in your repos, and the nudge post for them.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { claimNudgeHref, crewFor } from "../crew";
import { d1, migratedDb } from "./sqlite-d1";

function setup() {
  const db = migratedDb();
  let n = 0;
  const builder = (login: string, claimed: boolean, hidden = 0) => {
    n += 1;
    db.prepare(
      `INSERT INTO "Builder" ("id", "githubId", "githubLogin", "claimedAt", "hidden", "updatedAt") VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)`,
    ).run(login, n, login, claimed ? "2026-11-01T00:00:00.000Z" : null, hidden);
  };
  const ship = (login: string, repo: string) =>
    db.prepare(
      `INSERT INTO "Ship" ("id", "builderId", "repo", "shipType", "identifier", "shippedAt") VALUES (?1, ?2, ?3, 'MERGE', ?1, '2026-11-01T00:00:00.000Z')`,
    ).run(crypto.randomUUID(), login, repo);
  return { db, builder, ship };
}

test("lists unclaimed builders in your repos and repos you own, most ships first", async () => {
  const { db, builder, ship } = setup();
  builder("ada", true);
  builder("bob", false);
  builder("cy", false);
  builder("dee", false);
  builder("eve", true); // claimed: already on outship
  builder("fay", false, 1); // hidden
  builder("claude", false); // an agent
  builder("gus", false); // only in someone else's repo
  ship("ada", "acme/api");
  ship("bob", "acme/api");
  ship("bob", "acme/api");
  ship("cy", "Ada/tools"); // ada's own account, any case
  ship("dee", "acme/api");
  ship("eve", "acme/api");
  ship("fay", "acme/api");
  ship("claude", "acme/api");
  ship("gus", "other/thing");
  const crew = await crewFor(d1(db), { id: "ada", githubLogin: "ada" });
  assert.deepEqual(crew.map((member) => [member.githubLogin, member.ships]), [
    ["bob", 2],
    ["cy", 1],
    ["dee", 1],
  ]);
});

test("the nudge names their login, not an X handle, and links their profile", () => {
  const url = new URL(claimNudgeHref("bob"));
  assert.match(url.searchParams.get("text") ?? "", /^bob, your github work is already on outship/);
  assert.equal(url.searchParams.get("url"), "https://outship.dev/@bob");
});
