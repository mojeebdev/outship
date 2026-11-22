import assert from "node:assert/strict";
import test from "node:test";
import { classifyAiAgent, loggablePath, prefersMarkdown, servedFormat } from "../ai-agents";
import { buildQuery, loadAiAgentReport, rangeHours, summarize, type AiAgentRow } from "../ai-agent-report";
import { logAiAgentRequest } from "../ai-agent-log";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

test("known AI user agents are classified into training, search, assistant and agent", () => {
  const cases: Array<[string, string, string]> = [
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)", "GPTBot", "training"],
    ["Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)", "OAI-SearchBot", "search"],
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot", "ChatGPT-User", "assistant"],
    ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", "ClaudeBot", "training"],
    ["Claude-User (claude-code/2.1.0; +https://support.anthropic.com/)", "Claude-User", "assistant"],
    ["Mozilla/5.0 (compatible; Claude-SearchBot/1.0)", "Claude-SearchBot", "search"],
    ["Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", "PerplexityBot", "search"],
    ["Mozilla/5.0 (compatible; Perplexity-User/1.0)", "Perplexity-User", "assistant"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Googlebot", "search"],
    ["Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", "Bingbot", "search"],
    ["CCBot/2.0 (https://commoncrawl.org/faq/)", "CCBot", "training"],
    ["opencode/0.9 (+https://opencode.ai)", "OpenCode", "agent"],
  ];
  for (const [ua, name, category] of cases) {
    const agent = classifyAiAgent(ua);
    assert.equal(agent?.name, name, ua);
    assert.equal(agent?.category, category, ua);
  }
});

test("ordinary browsers are not counted; signed agents are", () => {
  assert.equal(classifyAiAgent(CHROME), null);
  assert.equal(classifyAiAgent(null), null);
  const signed = classifyAiAgent(CHROME, '"https://chatgpt.com"');
  assert.equal(signed?.category, "agent");
  assert.equal(signed?.operator, "chatgpt.com");
});

test("private, authenticated and tracking routes are never logged; query strings are dropped", () => {
  for (const path of ["/api/ships", "/admin", "/admin/traffic", "/profile", "/profile/settings", "/invite/abc"]) {
    assert.equal(loggablePath(path), null, path);
  }
  assert.equal(loggablePath("/leaderboard"), "/leaderboard");
  assert.equal(loggablePath("/@mojeebdev/shipmarks"), "/@mojeebdev/shipmarks");
});

test("served format comes from Content-Type and Markdown preference from Accept", () => {
  assert.equal(servedFormat("text/markdown; charset=utf-8"), "markdown");
  assert.equal(servedFormat("text/html; charset=utf-8"), "html");
  assert.equal(servedFormat("application/json"), "json");
  assert.equal(servedFormat(null), "other");
  assert.equal(prefersMarkdown("text/markdown, text/html;q=0.9"), true);
  assert.equal(prefersMarkdown("text/html,application/xhtml+xml"), false);
});

test("the worker logs agent requests with status and format, and nothing personal", () => {
  const points: Array<{ blobs?: string[]; doubles?: number[]; indexes?: string[] }> = [];
  const env = { AI_AGENT_EVENTS: { writeDataPoint: (point: (typeof points)[number]) => points.push(point) } };
  const agentRequest = new Request("https://outship.dev/leaderboard?email=someone%40example.com", {
    headers: { "user-agent": "Claude-User/1.0", accept: "text/markdown", cookie: "session=secret" },
  });
  logAiAgentRequest(agentRequest, new Response("ok", { status: 200, headers: { "content-type": "text/html" } }), env);
  logAiAgentRequest(new Request("https://outship.dev/leaderboard", { headers: { "user-agent": CHROME } }), new Response("ok"), env);
  logAiAgentRequest(new Request("https://outship.dev/admin", { headers: { "user-agent": "GPTBot/1.2" } }), new Response("no", { status: 403 }), env);

  assert.equal(points.length, 1);
  assert.deepEqual(points[0].blobs, ["Claude-User", "Anthropic", "assistant", "/leaderboard", "html", "outship.dev", "accept-markdown"]);
  assert.deepEqual(points[0].doubles, [200]);
  assert.deepEqual(points[0].indexes, ["assistant"]);
  assert.equal(JSON.stringify(points).includes("example.com"), false);
  assert.equal(JSON.stringify(points).includes("secret"), false);
});

test("a missing binding or a failing write never throws", () => {
  const request = new Request("https://outship.dev/", { headers: { "user-agent": "GPTBot/1.2" } });
  assert.doesNotThrow(() => logAiAgentRequest(request, new Response("ok"), {}));
  assert.doesNotThrow(() =>
    logAiAgentRequest(request, new Response("ok"), { AI_AGENT_EVENTS: { writeDataPoint: () => { throw new Error("boom"); } } }),
  );
});

test("the report aggregates by category, agent, path and status", () => {
  const rows: AiAgentRow[] = [
    { agent: "ClaudeBot", operator: "Anthropic", category: "training", path: "/", format: "html", status: 200, acceptMarkdown: false, hits: 10 },
    { agent: "Claude-User", operator: "Anthropic", category: "assistant", path: "/registry", format: "markdown", status: 200, acceptMarkdown: true, hits: 4 },
    { agent: "GPTBot", operator: "OpenAI", category: "training", path: "/registry", format: "html", status: 404, acceptMarkdown: false, hits: 1 },
  ];
  const report = summarize(rows, 168);
  assert.equal(report.total, 15);
  assert.deepEqual(report.byCategory, [{ category: "training", hits: 11 }, { category: "assistant", hits: 4 }]);
  assert.equal(report.byAgent[0].agent, "ClaudeBot");
  assert.equal(report.byAgent.find((a) => a.agent === "Claude-User")?.markdownShare, 1);
  assert.deepEqual(report.topPaths[0], { path: "/", hits: 10, agents: 1 });
  assert.deepEqual(report.topPaths[1], { path: "/registry", hits: 5, agents: 2 });
  assert.deepEqual(report.statuses, [{ status: 200, hits: 14 }, { status: 404, hits: 1 }]);
  assert.equal(report.askedForMarkdown, 4);
  assert.equal(report.servedMarkdown, 4);
});

test("ranges map to Analytics Engine's 90-day window and the query is bounded", () => {
  assert.equal(rangeHours("24h"), 24);
  assert.equal(rangeHours("all"), 24 * 90);
  assert.equal(rangeHours("nonsense"), 24 * 7);
  assert.match(buildQuery(999999), /INTERVAL '2160' HOUR/);
});

test("without secrets, or when Cloudflare fails, the report says so instead of showing zeros", async () => {
  const missing = await loadAiAgentReport("7d", {});
  assert.equal((await loadAiAgentReport(48, { accountId: "a", token: "t" }, async (_url, init) => { assert.match(String(init?.body), /INTERVAL '48' HOUR/); return Response.json({ data: [] }); })).configured, true);
  assert.equal(missing.configured, false);
  const failing = await loadAiAgentReport("7d", { accountId: "a", token: "t" }, async () => new Response("no", { status: 403 }));
  assert.equal(failing.configured, false);
  const ok = await loadAiAgentReport("7d", { accountId: "a", token: "t" }, async () =>
    Response.json({ data: [{ agent: "GPTBot", operator: "OpenAI", category: "training", path: "/", format: "html", status: 200, accept: "", hits: 3 }] }),
  );
  assert.equal(ok.configured, true);
  if (ok.configured) assert.equal(ok.total, 3);
});
