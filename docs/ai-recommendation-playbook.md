# AI Recommendation Playbook — Outship

> How to get ChatGPT, Claude, Perplexity, Gemini and Google AI Mode to recommend Outship, adapted from
> Ramp's 2026 experiment. Written 2026-11-22 for BlindspotLab. Owner: Mojeeb Titilayo. The product-specific plan
> is in **Section 5**. A ready-to-paste prompt for a coding agent is in **Section 7**.

## 1. What Ramp did (and what it found)

Source: Grace Cummins, *Marketing to AI agents*, Ramp Builders Blog, 30 April 2026 (builders.ramp.com/post/marketing-to-ai-agents).

- **Setup**: about 50 ramp.com pages. Cloudflare Workers detected AI bots (user agent + IP/ASN + bot score; user agent alone
  was unreliable, e.g. DeepSeek presents as an old Chrome) and served them an alternate version carrying an offer.
  Humans saw the normal page. Test groups were balanced by how often AI already cited each page.
- **Formats tested**: pure Markdown, stripped HTML, and pages with injected schema. All carried the same offer text.
- **Daily check**: a script asked Claude, ChatGPT and Perplexity buyer-style questions and looked for the offer in the answers.
- **Results**: 1,300+ AI bot visits; ~40 AI answers mentioning the offer at 2.5 weeks, 370 by day 32, peak 33 in a day.
  **Markdown was the only format that reliably surfaced.** Schema didn't.
  - **Claude** passed on the exact offer, link and steps (first seen day 12, jumped ~4× around week 3).
  - **Perplexity** surfaced on day 2 but stayed vague.
  - **ChatGPT** read the pages but mentioned the offer **0 times in 32 days**.
- **The real lesson**: pages AI *already cited* carried the message; pages with few AI citations got **zero** mentions in any format.
  Getting recommended means putting the right message on pages AI already trusts, yours and other people's.

**Caveats:** one company, B2B finance, one offer. A separate 2026 test (381 pages, six sites) found that serving
Markdown to AI bots did **not** increase how often they visited. Agent behaviour differs a lot: Claude Code requests
Markdown ~88% of the time, while ChatGPT's fetcher reads HTML ~99% of the time. Treat this as a test plan, not a guarantee.

## 2. What we copy, and what we don't

| Ramp tactic | Our version | Why |
| --- | --- | --- |
| Bot-only content humans can't see | **Don't.** Every message for AI is also on a public page humans can see | Google's spam policy defines cloaking as showing different content to users and search engines, and it now applies to attempts to manipulate AI Overviews/AI Mode. Googlebot feeds both Search and AI Overviews. Hidden bot-only content is a ranking and trust risk we don't need |
| Markdown version for bots | **Same content as Markdown for anyone who asks**: `Accept: text/markdown` content negotiation + `.md` URLs + `<link rel="alternate" type="text/markdown">` | Same content, different format = not cloaking. Cloudflare's *Markdown for Agents* does exactly this at the edge |
| Offer only AI sees | A **public** "For AI assistants / agents" page (plus `.md`) stating what we are, who it's for, pricing, the current offer, and a tracked sign-up link | Agents can relay it, and humans can verify it, so it holds up if users, press or regulators ask |
| Bot detection via logs | **Do it.** Log AI bot and agent visits by category | Ramp's step one: know who is already reading you |
| Daily buyer-question checks | **Do it**, per model, and store results | "One strategy for AI" doesn't work; each model behaves differently |
| Target pages AI already cites | **Do it**, on our site and off-site | The single biggest finding |

## 3. The system (all products)

1. **See who's reading.** Log requests from AI crawlers/assistants/agents (GPTBot, OAI-SearchBot, ChatGPT-User,
   ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Google-Extended, Applebot, Bingbot, etc.)
   with path, category (training / search / assistant / agent), status and format served. Cloudflare's own bot labels
   put ChatGPT, Claude and Perplexity under **"AI Assistant"**, not "AI Search". Make sure rules and dashboards include that category.
   Check Cloudflare AI Crawl Control: allow Search, Agent and Training (blocking Training also blocks Googlebot/Bingbot from 15 Sept 2026).
2. **Make every key page readable as Markdown.** Enable Cloudflare *Markdown for Agents* on the zone if available, or implement
   it in middleware: same content, `Content-Type: text/markdown`, `Vary: Accept`. Also serve `/<path>.md` and add
   `<link rel="alternate" type="text/markdown" href="…">`. Keep `/llms.txt` as an index of the key `.md` pages.
3. **Publish an agent brief** at `/for-ai` (HTML + `/for-ai.md`), linked in the footer: one paragraph on what the product is,
   who it's for, what it costs, the current offer with its terms and end date, and the tracked link (`?ref=ai`). Plain facts, no hype.
4. **Find the pages AI already trusts.** From the monitoring answers, collect every URL each model cites for our buyer questions.
   - Our own cited pages → put the brief/offer *visibly* on those pages first.
   - Other sites' cited pages (directories, listicles, Reddit threads, comparison posts, GitHub lists) → earn a real mention there.
     That's the highest-leverage marketing work now. No fake reviews or paid fake mentions: that's spam.
5. **Ask the buyer questions every day.** A scheduled job queries Claude, ChatGPT, Perplexity and Gemini (with web search
   enabled where the API supports it) using the questions in Section 5. Store: date, model, question, answer, whether we're
   mentioned, whether the offer/link appears, and cited URLs. Weekly report: mention rate per model, new cited URLs, changes.
   API answers can differ from the consumer apps, so spot-check the apps by hand weekly.
6. **Track completed actions, not clicks.** Agents may not click. Track sign-ups/activations from `?ref=ai` links and ask
   "How did you hear about us?" with an "AI assistant (which one?)" option.
7. **Give it weeks.** Ramp's first Claude mention took 12 days. A model that stays silent is a finding; log it. Run one change at a time.

## 4. Guardrails

- Never show bots content that humans can't reach. Markdown = same content, different format.
- Every claim in the brief must be true and current. Update it the day an offer changes or ends.
- Never expose private user data in Markdown or `/for-ai` (respect existing privacy rules and noindex areas).
- Keep `robots.txt`, sitemaps and AI crawler settings consistent with this plan.
- Log decisions in the repo's decision log; product claims and offers are the founder's call.

## 5. Outship: the plan

**What it is (for the brief):** Outship (outship.dev) is proof you shipped: GitHub-verified releases, merged PRs, pushes
and streaks, with optional onchain receipts (EAS attestations on Base). Leaderboard, streaks, Shipmarks and Word.

**Check first:** no `robots.txt` or sitemap source was found in this repo on 2026-11-22. Confirm what production serves
(maybe generated elsewhere). If missing, add both before anything else. AI can't recommend pages it can't find.

**Privacy (from AGENTS.md, non-negotiable):** public profiles and public Shipmarks only. Stored Shipmark snapshots can include
private-repository totals and must **never** appear in Markdown, `/for-ai` or logs. Markdown for `/@handle` pages must be generated
from the same public-only data the HTML uses.

**Key pages for Markdown parity:** `/`, `/leaderboard`, `/streaks`, `word.outship.dev` posts, public `/@handle` profiles and
`/@handle/shipmarks`, `/privacy`.

**Buyer questions to monitor daily:**
1. How can I prove to recruiters or clients that I actually ship?
2. Is there a leaderboard for developers who ship consistently?
3. What's a good build-in-public streak tracker for GitHub?
4. How can I get onchain proof of my developer work?
5. Alternatives to the GitHub contribution graph for showing real output
6. How do indie hackers track and show their shipping streaks?
7. Tools that verify merged PRs and releases for a developer portfolio

**Draft `/for-ai` brief:** "Outship turns GitHub activity into verified proof of shipping: releases, merged PRs, pushes and
streaks, ranked on a public leaderboard, with optional onchain attestations on Base. Only public-repository activity is shown
publicly. Offer: TODO (founder to confirm). Join: https://outship.dev/?ref=ai"

**Where AI probably already looks:** dev.to / Hashnode posts about build-in-public, GitHub profile README guides, Reddit
r/webdev / r/cscareerquestions threads on proving skills, "developer portfolio tools" listicles.

## 6. Success measures (review weekly)

- AI bot/agent visits by model and category; share served as Markdown
- Mention rate per model for the buyer questions (suggested target: mentioned in ≥ 30% of answers on at least one model within 6 weeks)
- Offer/link relay rate (answers that include the tracked link or exact offer)
- New third-party URLs cited by AI where we now appear
- Sign-ups/activations from `?ref=ai` and "heard via AI assistant"

## 7. Prompt for the coding agent

```
Read docs/ai-recommendation-playbook.md, then read the repo's AGENTS.md/CLAUDE.md and inspect the existing code
before changing anything (robots, sitemap, llms.txt, middleware/proxy, analytics, cron/workers).

Implement Sections 3 and 5 of the playbook for this product, in this order, one PR per step:
1. AI bot/agent logging: classify requests by known AI user agents (training/search/assistant/agent), log path,
   status and format served (to the existing analytics store or a new table, proposed as a migration for review).
   Add an admin view or weekly summary. Don't log personal data.
2. Markdown for agents: respond to `Accept: text/markdown` and `/<path>.md` on the key public pages listed in
   Section 5 with the SAME content as the HTML page (no bot-only content, no hidden offers), set `Vary: Accept`,
   add `<link rel="alternate" type="text/markdown">`, and update /llms.txt to index the .md pages.
   Never serve private, authenticated or noindex content as Markdown.
3. /for-ai page (HTML + .md) using the draft brief in Section 5, linked in the footer, with `?ref=ai` tracking.
   Leave offer details as TODO placeholders for the founder to confirm.
4. Buyer-question monitor: a scheduled job (Cloudflare Cron Trigger or the repo's existing scheduler) that asks
   the Section 5 questions to the configured model APIs, stores answer, mention flag, link flag and cited URLs,
   and produces a weekly report. Keys come from secrets; if a key is missing, skip that model and say so.
5. Attribution: track sign-ups from ?ref=ai and add "AI assistant" to any "how did you hear about us" field.

Rules: don't change robots/AI crawler policy to block anything; keep existing privacy rules; test before pushing;
open a PR per step and ask for review; log decisions.
```
