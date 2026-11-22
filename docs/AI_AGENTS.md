# AI agents: logging, Markdown, /for-ai, monitor, attribution

Implementation notes for `docs/ai-recommendation-playbook.md`. One section per step; each step ships as its own PR.

## Step 1: AI crawler / assistant / agent logging

**What it does.** `worker.js` passes every response through `logAiAgentRequest` (`src/lib/ai-agent-log.ts`). Requests
whose User-Agent (or Web Bot Auth `Signature-Agent`) matches a known AI or search agent (`src/lib/ai-agents.ts`) are
written to the Workers Analytics Engine dataset `outship_ai_agents`: agent, operator, category (training / search /
assistant / agent), path (no query string), format served, host, whether Markdown was requested, HTTP status.
People's requests are never recorded; no IPs, cookies or query strings are stored. `/api`, `/admin`, `/profile`,
`/invite` and `/token/claim` are never logged.

**Where to see it.** `/admin/traffic` → "AI crawlers, assistants and agents", for the selected window (Analytics
Engine keeps 90 days).

**Setup.** Nothing new: it reuses `CLOUDFLARE_ACCOUNT_ID` (wrangler.jsonc) and the `CLOUDFLARE_ANALYTICS_TOKEN`
secret (Account Analytics: Read) that the traffic page already uses. The dataset is created on first write after deploy.
Until the token is set, the section says so instead of showing zeros.

**Decisions (2026-11-22).** Analytics Engine, not D1: no write per crawler hit on the app database and no migration.
Logged after the response, so status and format are what the agent got. Googlebot/Bingbot/Applebot count as "search"
(they also ground AI answers). AI fetchers that look like ordinary browsers can't be detected and aren't counted.
No change to crawler policy.

## Step 2: Markdown for agents

**What it does.** `worker.js` → `src/lib/markdown-for-agents.ts`:
- `GET /<path>.md` for a key public page returns Markdown (`/index.md` for home); `Accept: text/markdown` on the page's
  own URL does the same.
- Key HTML pages get `Vary: Accept` and `<link rel="alternate" type="text/markdown">`; Markdown responses carry
  `Link: <html-url>; rel="canonical"`.
- New `/llms.txt` indexes the Markdown pages.

Key pages (`src/lib/markdown-pages.ts`): `/`, `/leaderboard`, `/streaks`, `/builders`, `/stats`, `/about`, `/manifesto`,
`/faq`, `/developers`, `/changelog`, `/privacy`, `/terms`, `/for-ai`, public profiles `/@handle`, their public Shipmarks
`/@handle/shipmarks[/firsts|daily|weekly|monthly|streaks]`, and every page on `word.outship.dev`.

**Privacy.** The Markdown is converted from the same public HTML, rendered without cookies or credentials, so a
profile's Markdown shows exactly the public-only data its HTML shows. It never reads stored Shipmark snapshots.
`/profile/*`, `/admin/*` and `/api/*` are never converted, and neither is any non-200, non-HTML or noindex response.

**Decisions (2026-11-22).** Same content, never bot-only; anyone can request it. Converter: `node-html-markdown`.
No robots.txt or sitemap exists in this repo today. This PR doesn't add them (that's a separate decision), so
crawlers keep the default "allow all".

## Step 3: /for-ai brief

`src/app/for-ai/page.tsx`: plain facts (what outship is, who it's for, cost, current offer, privacy, how to join, how
agents read it), identical for everyone and also at `/for-ai.md`. Linked in the footer ("for AI assistants") and in
`/llms.txt`. The join link carries `?ref=ai`.

**Founder TODO.** Set `FOR_AI_OFFER` at the top of the page. Until then it says "there is no special offer right now."

**Decisions (2026-11-22).** Facts come only from existing public copy (about, FAQ: "outship doesn't charge anything",
the optional Base attestation fee, public-repo-only display).
