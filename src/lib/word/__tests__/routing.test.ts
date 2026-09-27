/**
 * Tests for Word's hostname routing rules.
 *
 * Run with: npm run test:word
 *
 * These are the rules that decide which of three hostnames a request is on
 * and what happens to it, including the redirect that makes
 * word.outship.dev the canonical home for Word.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { decideRoute, isWordPath, stripWordPrefix, type RouteDecision } from "../routing";

/** Narrow a decision to a redirect, failing the test if it isn't one. */
function asRedirect(decision: RouteDecision) {
  assert.ok(decision.kind === "redirect", `expected a redirect, got "${decision.kind}"`);
  return decision;
}

const WORD = "word.outship.dev";
const MAIN = "outship.dev";

test("the Word hostname serves Word from its root", () => {
  assert.deepEqual(decideRoute(WORD, "/"), { kind: "rewrite", pathname: "/word" });
  assert.deepEqual(decideRoute(WORD, "/result/abc123"), {
    kind: "rewrite",
    pathname: "/word/result/abc123",
  });
  assert.deepEqual(decideRoute(WORD, "/anything/deep"), {
    kind: "rewrite",
    pathname: "/word/anything/deep",
  });
});

test("the internal prefix is redirected away on the Word hostname", () => {
  assert.deepEqual(decideRoute(WORD, "/word"), {
    kind: "redirect",
    location: "/",
    status: 308,
  });
  assert.deepEqual(decideRoute(WORD, "/word/result/abc123"), {
    kind: "redirect",
    location: "/result/abc123",
    status: 308,
  });
});

test("the main hostname redirects Word to its canonical home", () => {
  assert.deepEqual(decideRoute(MAIN, "/word"), {
    kind: "redirect",
    location: "https://word.outship.dev/",
    status: 308,
  });
  assert.deepEqual(decideRoute(MAIN, "/word/result/abc123"), {
    kind: "redirect",
    location: "https://word.outship.dev/result/abc123",
    status: 308,
  });
  // Any Word page, including ones added later.
  assert.deepEqual(decideRoute(MAIN, "/word/some/future/page"), {
    kind: "redirect",
    location: "https://word.outship.dev/some/future/page",
    status: 308,
  });
});

test("www on the main hostname redirects too", () => {
  assert.deepEqual(decideRoute("www.outship.dev", "/word"), {
    kind: "redirect",
    location: "https://word.outship.dev/",
    status: 308,
  });
});

test("query parameters survive every redirect", () => {
  assert.equal(
    asRedirect(decideRoute(MAIN, "/word", "?ref=newsletter")).location,
    "https://word.outship.dev/?ref=newsletter",
  );
  assert.equal(
    asRedirect(decideRoute(MAIN, "/word/result/abc123", "?utm_source=x&utm_medium=post")).location,
    "https://word.outship.dev/result/abc123?utm_source=x&utm_medium=post",
  );
  assert.equal(asRedirect(decideRoute(WORD, "/word", "?a=1&b=2")).location, "/?a=1&b=2");
});

test("only /word and /word/* are matched, never lookalikes", () => {
  for (const pathname of [
    "/wordpress",
    "/wordpress/wp-admin",
    "/words",
    "/wordle",
    "/word-count",
    "/sword",
    "/about/word",
  ]) {
    assert.equal(isWordPath(pathname), false, `${pathname} should not be a Word path`);
    assert.deepEqual(
      decideRoute(MAIN, pathname),
      { kind: "pass" },
      `${pathname} should be left alone on the main host`,
    );
  }

  assert.equal(isWordPath("/word"), true);
  assert.equal(isWordPath("/word/"), true);
  assert.equal(isWordPath("/word/result/abc"), true);
});

test("the main site's own routes are untouched", () => {
  for (const pathname of ["/", "/about", "/leaderboard", "/builders", "/manifesto"]) {
    assert.deepEqual(decideRoute(MAIN, pathname), { kind: "pass" });
  }
});

test("local development keeps /word working, with no redirect", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3000", "localhost"]) {
    assert.deepEqual(decideRoute(host, "/word"), { kind: "pass" });
    assert.deepEqual(decideRoute(host, "/word/result/abc123"), { kind: "pass" });
    assert.deepEqual(decideRoute(host, "/"), { kind: "pass" });
  }
});

test("preview deployments keep /word working, with no redirect", () => {
  const preview = "claude-loving-franklin-br7ef8-outship.mojeebdev.workers.dev";
  assert.deepEqual(decideRoute(preview, "/word"), { kind: "pass" });
  assert.deepEqual(decideRoute(preview, "/"), { kind: "pass" });
});

test("a port on the Host header does not defeat matching", () => {
  assert.deepEqual(decideRoute(`${MAIN}:443`, "/word"), {
    kind: "redirect",
    location: "https://word.outship.dev/",
    status: 308,
  });
  assert.deepEqual(decideRoute(`${WORD}:443`, "/"), { kind: "rewrite", pathname: "/word" });
});

test("a missing or unknown Host header is left alone", () => {
  assert.deepEqual(decideRoute(null, "/word"), { kind: "pass" });
  assert.deepEqual(decideRoute(undefined, "/"), { kind: "pass" });
  assert.deepEqual(decideRoute("example.com", "/word"), { kind: "pass" });
});

test("redirects cannot loop", () => {
  // The main host sends /word to the canonical origin...
  const fromMain = asRedirect(decideRoute(MAIN, "/word"));
  const target = new URL(fromMain.location);
  assert.equal(target.host, WORD);

  // ...and that destination rewrites rather than redirecting again.
  const atWord = decideRoute(WORD, target.pathname);
  assert.deepEqual(atWord, { kind: "rewrite", pathname: "/word" });

  // The same holds for a result page.
  const resultFromMain = asRedirect(decideRoute(MAIN, "/word/result/abc123"));
  const resultTarget = new URL(resultFromMain.location);
  assert.deepEqual(decideRoute(WORD, resultTarget.pathname), {
    kind: "rewrite",
    pathname: "/word/result/abc123",
  });
});

test("prefix stripping maps every Word path to its public form", () => {
  assert.equal(stripWordPrefix("/word"), "/");
  assert.equal(stripWordPrefix("/word/"), "/");
  assert.equal(stripWordPrefix("/word/result/abc"), "/result/abc");
});
