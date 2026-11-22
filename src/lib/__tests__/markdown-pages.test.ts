import assert from "node:assert/strict";
import test from "node:test";
import { htmlPathForMarkdownUrl, htmlToMarkdown, isMarkdownPage, markdownUrlFor } from "../markdown-pages";
import { advertiseMarkdown, serveMarkdown } from "../markdown-for-agents";

const PAGE = `<!doctype html><html><head><title>Leaderboard · Outship</title>
<meta name="description" content="Who shipped most."></head>
<body><header><nav><a href="/">Home</a></nav></header>
<main><header><h1>Leaderboard</h1></header><p>Builders who <strong>ship</strong>. <a href="/streaks">Streaks</a></p>
<script>window.secret = 1</script><form><input name="q"><button>Search</button></form>
<ul><li>Alpha</li><li>Beta</li></ul></main>
<footer>© Outship</footer></body></html>`;

const htmlPage = (status = 200, extra: Record<string, string> = {}) =>
  new Response(PAGE, { status, headers: { "content-type": "text/html; charset=utf-8", ...extra } });

test("only key public pages have Markdown versions", () => {
  for (const path of ["/", "/leaderboard", "/streaks", "/@mojeebdev", "/@mojeebdev/shipmarks", "/@mojeebdev/shipmarks/daily", "/privacy", "/for-ai"]) {
    assert.equal(isMarkdownPage(path), true, path);
  }
  for (const path of ["/admin", "/admin/traffic", "/profile", "/profile/shipmarks", "/api/ships", "/invite/x", "/@mojeebdev/badge.svg", "/token"]) {
    assert.equal(isMarkdownPage(path), false, path);
  }
  assert.equal(isMarkdownPage("/some/post", "word.outship.dev"), true);
  assert.equal(isMarkdownPage("/api/word/count", "word.outship.dev"), false);
});

test(".md aliases map to their HTML page", () => {
  assert.equal(htmlPathForMarkdownUrl("/leaderboard.md"), "/leaderboard");
  assert.equal(htmlPathForMarkdownUrl("/index.md"), "/");
  assert.equal(htmlPathForMarkdownUrl("/@mojeebdev.md"), "/@mojeebdev");
  assert.equal(htmlPathForMarkdownUrl("/@mojeebdev/shipmarks.md"), "/@mojeebdev/shipmarks");
  assert.equal(htmlPathForMarkdownUrl("/profile.md"), null);
  assert.equal(htmlPathForMarkdownUrl("/index.md", "word.outship.dev"), "/");
  assert.equal(markdownUrlFor("/"), "/index.md");
  assert.equal(markdownUrlFor("/leaderboard/"), "/leaderboard.md");
});

test("conversion keeps the page content and drops scripts, forms and site chrome", () => {
  const md = htmlToMarkdown(PAGE, "https://outship.dev/leaderboard");
  assert.match(md, /^---\ntitle: "Leaderboard · Outship"\nurl: https:\/\/outship.dev\/leaderboard\ndescription: "Who shipped most."\n---/);
  assert.match(md, /# Leaderboard/);
  assert.match(md, /\*\*ship\*\*/);
  assert.match(md, /\[Streaks\]\(\/streaks\)/);
  assert.match(md, /- Alpha/);
  assert.doesNotMatch(md, /secret|Search|© Outship|\[Home\]/);
});

test(".md and Accept: text/markdown serve Markdown rendered without cookies", async () => {
  const seen: Request[] = [];
  const render = async (req: Request) => { seen.push(req); return htmlPage(); };

  const alias = await serveMarkdown(new Request("https://outship.dev/leaderboard.md", { headers: { cookie: "s=1", authorization: "Bearer x" } }), render);
  assert.equal(alias?.status, 200);
  assert.equal(alias?.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.equal(alias?.headers.get("vary"), "Accept");
  assert.equal(alias?.headers.get("link"), '<https://outship.dev/leaderboard>; rel="canonical"');
  assert.equal(new URL(seen[0].url).pathname, "/leaderboard");
  assert.equal(seen[0].headers.get("cookie"), null);
  assert.equal(seen[0].headers.get("authorization"), null);

  const negotiated = await serveMarkdown(new Request("https://outship.dev/leaderboard", { headers: { accept: "text/markdown, text/html;q=0.9" } }), render);
  assert.match(await negotiated!.text(), /# Leaderboard/);

  assert.equal(await serveMarkdown(new Request("https://outship.dev/leaderboard"), render), null);
  assert.equal(await serveMarkdown(new Request("https://outship.dev/admin", { headers: { accept: "text/markdown" } }), render), null);

  const word = await serveMarkdown(new Request("https://word.outship.dev/some-post.md"), render);
  assert.equal(word?.headers.get("link"), '<https://word.outship.dev/some-post>; rel="canonical"');
});

test("noindex, missing and non-HTML pages are never converted", async () => {
  const noindex = async () => htmlPage(200, { "x-robots-tag": "noindex, nofollow" });
  assert.equal((await serveMarkdown(new Request("https://outship.dev/leaderboard.md"), noindex))?.status, 404);
  assert.equal(await serveMarkdown(new Request("https://outship.dev/leaderboard", { headers: { accept: "text/markdown" } }), noindex), null);
  const missing = async () => htmlPage(404);
  assert.equal((await serveMarkdown(new Request("https://outship.dev/@nobody-here.md"), missing))?.status, 404);
});

test("key HTML pages vary on Accept; other responses are untouched", () => {
  const advertised = advertiseMarkdown(new Request("https://outship.dev/leaderboard"), htmlPage());
  assert.match(advertised.headers.get("vary") ?? "", /Accept/);
  const untouched = htmlPage();
  assert.equal(advertiseMarkdown(new Request("https://outship.dev/admin"), untouched), untouched);
});
