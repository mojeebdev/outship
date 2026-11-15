import assert from "node:assert/strict";
import test from "node:test";

import { renderBadge, renderNotFoundBadge } from "../badge";

test("the badge carries the numbers and the source", () => {
  const svg = renderBadge({ login: "mojeebdev", score: 142, streak: 12, rank: 3 });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  for (const text of ["mojeebdev", ">142<", ">12d<", ">#3<", ">deckhand<", "verified on github", "outship.dev"]) {
    assert.ok(svg.includes(text), `missing ${text}`);
  }
  // The real mark: three bars and the rising point.
  assert.equal((svg.match(/<rect x="(0|6|12)" y="(18|14|10)"/g) ?? []).length, 3);
  assert.ok(svg.includes('points="12,10 17,10 24,0"'));
});

test("unranked builders say so", () => {
  assert.ok(renderBadge({ login: "ghost", score: 4, streak: 0, rank: null }).includes(">unranked<"));
});

test("logins are escaped", () => {
  const svg = renderBadge({ login: "a<b>&\"c'", score: 1, streak: 1, rank: 1 });
  assert.ok(svg.includes("a&lt;b&gt;&amp;&quot;c&apos;"));
  assert.ok(!svg.includes("a<b>"));
});

test("the not-found badge names nobody", () => {
  const svg = renderNotFoundBadge();
  assert.ok(svg.includes("profile not found"));
});
