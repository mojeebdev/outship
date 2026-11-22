<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Current implementation notes

### Admin and profile workspaces

- Admin destinations are `/admin`, `/admin/builders`, `/admin/shipping`, `/admin/platform`, and `/admin/traffic`.
- Profile destinations are `/profile`, `/profile/activity`, `/profile/shipmarks`, `/profile/shipmarks/firsts`, `/profile/shipmarks/daily`, `/profile/shipmarks/weekly`, `/profile/shipmarks/monthly`, `/profile/shipmarks/streaks`, `/profile/ships`, `/profile/badge`, `/profile/community`, and `/profile/settings`.
- Keep dashboard navigation on these paths rather than hash-based section links. The shared admin layout must continue to call `requireAdmin()`; admin API and export handlers keep their own checks.
- Reuse the current Outship design tokens and custom SVG icon set. Avoid emoji as decorative UI icons. Shipmarks use the approved Forged Signal Marks direction.
- Keep profile privacy rules, existing settings actions, ship attestation behavior, and metrics definitions intact when changing these routes.
- The Shipmarks index is category-first; category pages use ordinary path segments and paginated records. Stored Shipmark snapshots can include private repository totals, so never render them on public profiles. Public Shipmarks need a separate calculation based only on public-repository activity and explicit product approval.
- Public profiles now show public-only Shipmarks at `/@handle/shipmarks`, grouped under `/@handle/shipmarks/{firsts,daily,weekly,monthly,streaks}`. Recompute activity marks from `Ship` rows filtered with `isPrivate = 0`; never read stored activity snapshots for public pages. The Founding Builder mark is the exception: it uses only `claimedAt` inside the approved Nov 15–22, 2026 UTC launch window. Keep the privacy-policy description aligned when award rules change.
- Shipmark SVG motifs share a 34-unit maximum painted edge inside the 100-unit viewBox. Update the measured bounds in `shipmark-collection.tsx` whenever a glyph path changes so the symbols stay optically balanced within the shield.
- Cloudflare Web Analytics must stay unloaded until a visitor opts in. Keep accept/reject equally easy, expose the persistent privacy-choice control on both Outship and Word footers, and update `/privacy` when browser storage or analytics behavior changes.
- Admin traffic must not present zero metrics when Cloudflare returns an error. Explain the production Worker configuration needed to identify the Web Analytics site, without exposing its API token.

### Shipmark email and backfill status

- Production Shipmark backfill was run successfully: 1,839 Shipmarks were created. The backfill script is available as `npm run backfill:shipmarks`; check its dry-run output before applying another remote run.
- The Founding Builder email copy and send action are approved. Use the existing Cloudflare `EMAIL` binding from `shipmarks@mail.outship.dev`. The one-time mark/email are gated until after 2026-11-22 23:59:59 UTC; rerun the cohort query after that cutoff before any manual send. The scheduled send selects only `FOUNDING_COHORT` marks and never emails historical `BACKFILL` marks.
- Earned Shipmark award notices are default-on through `Builder.shipmarkEmailsEnabled` and can be switched off in profile settings. Send only `SCHEDULED` and approved `FOUNDING_COHORT` rows; never email `BACKFILL` rows. Add the builder's earned Shipmarks to Monday's recap only for confirmed recap subscribers whose Shipmark notices remain enabled.
- Keep weekly recap signup double-confirmed. Missed-day check-ins are re-engagement mail: do not send them by default or through Cloudflare Email Service without a consent/provider decision. Use an explicit opt-in preference when that feature is implemented.

### Public repository hygiene

- `docs/previews/`, the Shipmark inspiration concept files, and `*audit.md` are local-only review materials and are ignored by Git. Keep implementation notes in this file when the audit itself should remain private.
- Never force-add `.env*`, `.dev.vars`, private keys, or other credentials. The repository-wide `*.pem` ignore rule protects local signing keys.
- The standalone dashboard mockups are review artifacts, not production assets. Build future changes in the live components instead of committing alternate mockups.

### AI recommendation playbook

- `docs/ai-recommendation-playbook.md` is the plan; `docs/AI_AGENTS.md` records what was built for each step and why.
- AI crawler/agent logging lives in `worker.js` → `src/lib/ai-agent-log.ts` (Analytics Engine `AI_AGENT_EVENTS`). Never log query strings, IPs, cookies or private routes, and never read the response body there.
