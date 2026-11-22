import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aiReferralSource,
  buildReferralQuery,
  logAiReferralVisit,
  logAiSignup,
  signupSourceFromReferer,
  summarizeReferrals,
  validAiSource,
} from "../ai-referral";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const html = () => new Response("<html></html>", { headers: { "content-type": "text/html; charset=utf-8" } });

test("?ref=ai, AI utm_source values and AI Referer hosts are recognised", () => {
  assert.equal(aiReferralSource(new URL("https://outship.dev/?ref=ai"), null), "ai");
  assert.equal(aiReferralSource(new URL("https://outship.dev/?utm_source=chatgpt.com"), null), "chatgpt");
  assert.equal(aiReferralSource(new URL("https://outship.dev/?utm_source=perplexity"), null), "perplexity");
  assert.equal(aiReferralSource(new URL("https://outship.dev/"), "https://gemini.google.com/app"), "gemini");
  assert.equal(aiReferralSource(new URL("https://outship.dev/"), "https://www.perplexity.ai/search?q=x"), "perplexity");
  assert.equal(aiReferralSource(new URL("https://outship.dev/"), "https://claude.ai/chat/1"), "claude");
});

test("ordinary search engines, invites and other sites are not AI", () => {
  assert.equal(aiReferralSource(new URL("https://outship.dev/"), "https://www.google.com/"), null);
  assert.equal(aiReferralSource(new URL("https://outship.dev/?ref=octocat"), null), null);
  assert.equal(aiReferralSource(new URL("https://outship.dev/"), "https://notchatgpt.com/"), null);
  assert.equal(aiReferralSource(new URL("https://outship.dev/"), "not a url"), null);
});

test("sign-up source is read only from a same-site Referer's parameters", () => {
  assert.equal(signupSourceFromReferer("https://outship.dev/?utm_source=chatgpt.com", "outship.dev"), "chatgpt");
  assert.equal(signupSourceFromReferer("https://outship.dev/for-ai?ref=ai", "outship.dev"), "ai");
  assert.equal(signupSourceFromReferer("https://outship.dev/leaderboard", "outship.dev"), null);
  assert.equal(signupSourceFromReferer("https://evil.example/?ref=ai", "outship.dev"), null);
  assert.equal(signupSourceFromReferer(null, "outship.dev"), null);
});

test("only known source names pass the cookie check", () => {
  assert.equal(validAiSource("chatgpt"), "chatgpt");
  assert.equal(validAiSource("chatgpt; x=1"), null);
  assert.equal(validAiSource(undefined), null);
});

test("a person's AI-referred visit to a public page is counted without query strings", () => {
  const points: { blobs?: string[] }[] = [];
  const env = { AI_REFERRAL_EVENTS: { writeDataPoint: (p: { blobs?: string[] }) => points.push(p) } };
  const req = new Request("https://outship.dev/leaderboard?utm_source=chatgpt.com&secret=1", { headers: { "user-agent": CHROME } });
  logAiReferralVisit(req, html(), env);
  assert.deepEqual(points[0].blobs, ["visit", "chatgpt", "/leaderboard"]);
  assert.ok(!JSON.stringify(points).includes("secret"));
});

test("crawlers, private routes, errors and non-HTML are not counted as visits", () => {
  const points: unknown[] = [];
  const env = { AI_REFERRAL_EVENTS: { writeDataPoint: (p: unknown) => points.push(p) } };
  logAiReferralVisit(new Request("https://outship.dev/?ref=ai", { headers: { "user-agent": "GPTBot/1.2" } }), html(), env);
  logAiReferralVisit(new Request("https://outship.dev/profile?ref=ai", { headers: { "user-agent": CHROME } }), html(), env);
  logAiReferralVisit(new Request("https://outship.dev/?ref=ai", { headers: { "user-agent": CHROME } }), new Response("x", { status: 404, headers: { "content-type": "text/html" } }), env);
  logAiReferralVisit(new Request("https://outship.dev/llms.txt?ref=ai", { headers: { "user-agent": CHROME } }), new Response("x", { headers: { "content-type": "text/plain" } }), env);
  assert.equal(points.length, 0);
});

test("logging never throws and a sign-up needs a source", () => {
  const broken = { AI_REFERRAL_EVENTS: { writeDataPoint: () => { throw new Error("boom"); } } };
  assert.doesNotThrow(() => logAiReferralVisit(new Request("https://outship.dev/?ref=ai", { headers: { "user-agent": CHROME } }), html(), broken));
  assert.doesNotThrow(() => logAiSignup(broken, "ai"));
  const points: unknown[] = [];
  logAiSignup({ AI_REFERRAL_EVENTS: { writeDataPoint: (p: unknown) => points.push(p) } }, null);
  assert.equal(points.length, 0);
});

test("the report sums visits and sign-ups by source and bounds the window", () => {
  const r = summarizeReferrals([
    { event: "visit", source: "chatgpt", path: "/", hits: 5 },
    { event: "visit", source: "chatgpt", path: "/leaderboard", hits: 2 },
    { event: "signup", source: "chatgpt", path: "", hits: 1 },
    { event: "visit", source: "perplexity", path: "/", hits: 1 },
  ]);
  assert.equal(r.visits, 8);
  assert.equal(r.signups, 1);
  assert.deepEqual(r.bySource[0], { source: "chatgpt", visits: 7, signups: 1 });
  assert.deepEqual(r.topLandings[0], { path: "/", visits: 6 });
  assert.match(buildReferralQuery(99999), /INTERVAL '2160' HOUR/);
});
