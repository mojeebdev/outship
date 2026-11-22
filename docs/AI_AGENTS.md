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
