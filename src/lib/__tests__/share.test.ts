/**
 * "share on X": the composer link quotes the launch article, and the profile
 * text carries the builder's facts and link.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { LAUNCH_POST_URL, profileShareText, shareOnXHref } from "../share";

test("the share link opens X's composer with the text and quotes the launch post", () => {
  const href = new URL(shareOnXHref("hello & welcome"));
  assert.equal(href.origin + href.pathname, "https://x.com/intent/post");
  assert.equal(href.searchParams.get("text"), "hello & welcome");
  assert.equal(href.searchParams.get("url"), LAUNCH_POST_URL);
});

test("the profile text has the tier, score, rank, streak and profile link", () => {
  const text = profileShareText({ login: "alice", tier: "first mate", score: 10640, weekRank: 1, streak: 14 });
  assert.equal(
    text,
    "i'm a first mate on outship: 10,640 points · #1 this week · 14-day streak.\n\n" +
      "every ship verified by github, attested on base.\n\n" +
      "https://outship.dev/@alice",
  );
});

test("no rank, and a streak of one day or less, are left out", () => {
  const text = profileShareText({ login: "bob", tier: "deckhand", score: 40, weekRank: null, streak: 1 });
  assert.match(text, /^i'm a deckhand on outship: 40 points\.\n/);
});

test("a tier starting with a vowel takes \"an\"", () => {
  const text = profileShareText({ login: "ada", tier: "admiral", score: 30000, weekRank: 3, streak: 0 });
  assert.match(text, /^i'm an admiral on outship: 30,000 points · #3 this week\.\n/);
});
