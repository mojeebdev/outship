/**
 * Tests for Word's URL parsing and SSRF address classification.
 *
 * Run with: npm run test:word
 * These cover the checks that need no network. DNS resolution is exercised
 * against the live resolver in production; see docs/word.md.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  UnsafeUrlError,
  assertSafeUrlSyntax,
  isBlockedIpv4,
  isBlockedIpv6,
  isHomepage,
  normalizeHostname,
  parseSubmittedUrl,
  shareableUrl,
} from "../url";

function rejection(input: string): string {
  try {
    assertSafeUrlSyntax(parseSubmittedUrl(input));
  } catch (error) {
    assert.ok(error instanceof UnsafeUrlError, `expected UnsafeUrlError for ${input}`);
    return error.reason;
  }
  return assert.fail(`expected ${input} to be rejected`);
}

test("a bare domain becomes an https homepage URL", () => {
  assert.equal(parseSubmittedUrl("example.com").href, "https://example.com/");
  assert.equal(parseSubmittedUrl("  Example.COM/blog  ").href, "https://example.com/blog");
  assert.equal(parseSubmittedUrl("http://example.com/a?b=1").href, "http://example.com/a?b=1");
});

test("fragments are dropped, query strings are kept for the scan", () => {
  const url = parseSubmittedUrl("https://example.com/a?b=1#top");
  assert.equal(url.href, "https://example.com/a?b=1");
});

test("accepts plain public addresses", () => {
  for (const input of ["example.com", "https://example.com/a/b", "http://example.com:8080/"]) {
    assert.doesNotThrow(() => assertSafeUrlSyntax(parseSubmittedUrl(input)));
  }
});

test("rejects non-web schemes", () => {
  assert.equal(rejection("file:///etc/passwd"), "scheme");
  assert.equal(rejection("ftp://example.com/"), "scheme");
  assert.equal(rejection("gopher://example.com/"), "scheme");
  assert.equal(rejection("data:text/html,<p>hi</p>"), "scheme");
});

test("rejects embedded credentials", () => {
  assert.equal(rejection("https://user:pass@example.com/"), "credentials");
  assert.equal(rejection("https://user@example.com/"), "credentials");
});

test("rejects non-standard ports", () => {
  assert.equal(rejection("http://example.com:22/"), "port");
  assert.equal(rejection("http://example.com:6379/"), "port");
  assert.equal(rejection("http://example.com:11211/"), "port");
});

test("rejects localhost and internal-only names", () => {
  assert.equal(rejection("http://localhost:8080/"), "hostname");
  assert.equal(rejection("http://app.localhost/"), "hostname");
  assert.equal(rejection("http://db.internal/"), "hostname");
  assert.equal(rejection("http://printer.local/"), "hostname");
  assert.equal(rejection("http://metadata.google.internal/"), "hostname");
  assert.equal(rejection("http://intranet/"), "hostname");
});

test("rejects private and reserved IPv4 literals, in any notation", () => {
  // The URL parser normalises decimal, hex and short forms to dotted quads.
  assert.equal(rejection("http://127.0.0.1/"), "private-address");
  assert.equal(rejection("http://2130706433/"), "private-address");
  assert.equal(rejection("http://0x7f000001/"), "private-address");
  assert.equal(rejection("http://127.1/"), "private-address");
  assert.equal(rejection("http://10.0.0.5/"), "private-address");
  assert.equal(rejection("http://172.16.4.1/"), "private-address");
  assert.equal(rejection("http://192.168.1.1/"), "private-address");
  assert.equal(rejection("http://169.254.169.254/latest/meta-data/"), "private-address");
  assert.equal(rejection("http://100.100.100.200/"), "private-address");
  assert.equal(rejection("http://0.0.0.0/"), "private-address");
});

test("rejects loopback, link-local and mapped IPv6 literals", () => {
  assert.equal(rejection("http://[::1]/"), "private-address");
  assert.equal(rejection("http://[::]/"), "private-address");
  assert.equal(rejection("http://[fe80::1]/"), "private-address");
  assert.equal(rejection("http://[fd00::1]/"), "private-address");
  assert.equal(rejection("http://[::ffff:127.0.0.1]/"), "private-address");
  assert.equal(rejection("http://[::ffff:169.254.169.254]/"), "private-address");
  assert.equal(rejection("http://[64:ff9b::a00:1]/"), "private-address");
  assert.equal(rejection("http://[2002:c0a8:101::1]/"), "private-address");
});

test("classifies public addresses as allowed", () => {
  assert.equal(isBlockedIpv4("93.184.216.34"), false);
  assert.equal(isBlockedIpv4("8.8.8.8"), false);
  assert.equal(isBlockedIpv6("[2606:2800:220:1:248:1893:25c8:1946]"), false);
  assert.equal(isBlockedIpv6("[2001:4860:4860::8888]"), false);
});

test("rejects malformed and empty input", () => {
  assert.equal(rejection(""), "empty");
  assert.equal(rejection("   "), "empty");
  assert.equal(rejection("https://exam ple.com/"), "unparseable");
  assert.equal(rejection("notadomain"), "hostname");
});

test("sharing strips query strings, fragments and credentials", () => {
  assert.equal(
    shareableUrl("https://example.com/page?token=secret#x"),
    "https://example.com/page",
  );
});

test("hostnames normalise to one leaderboard key per site", () => {
  assert.equal(normalizeHostname("https://WWW.Example.com/"), "example.com");
  assert.equal(normalizeHostname("https://example.com/deep/page"), "example.com");
});

test("only bare homepages count as homepages", () => {
  assert.equal(isHomepage("https://example.com/"), true);
  assert.equal(isHomepage("https://example.com/about"), false);
  assert.equal(isHomepage("https://example.com/?utm=1"), false);
});
