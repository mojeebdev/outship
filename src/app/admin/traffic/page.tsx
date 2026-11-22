import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { KpiCard, RankedBars, fmt } from "@/components/admin/charts";
import { loadCfAnalytics } from "@/lib/cf-analytics";
import { loadAiAgentReport } from "@/lib/ai-agent-report";
import { loadAiReferralReport } from "@/lib/ai-referral";
import { loadWeeklyReport } from "@/lib/ai-mentions";
import { delta, parseWindow, windowRanges, WINDOWS, type WindowKey } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminTrafficPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const key: WindowKey = parseWindow(Array.isArray(params.w) ? params.w[0] : params.w);
  const window = WINDOWS[key];
  const { env } = await getCloudflareContext({ async: true });
  const visitors = await loadCfAnalytics(env, windowRanges(key).current);
  const range = windowRanges(key).current;
  const ai = await loadAiAgentReport((range.end.getTime() - range.start.getTime()) / 3_600_000, {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    token: env.CLOUDFLARE_ANALYTICS_TOKEN,
  });
  const referrals = await loadAiReferralReport((range.end.getTime() - range.start.getTime()) / 3_600_000, {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    token: env.CLOUDFLARE_ANALYTICS_TOKEN,
  });
  const mentions = await loadWeeklyReport(env.DB as never, env as unknown as Record<string, unknown>).catch(() => null);
  const siteLookupFailed = visitors.configured && visitors.error?.includes("couldn't find the web analytics site");
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="traffic and reach" section="traffic" description={`Opt-in Cloudflare Web Analytics for the last ${window.label}; visitors who decline are not counted.`} windowKey={key} />
      {!visitors.configured ? (
        <section className="rounded-xl border border-border bg-white p-5" aria-labelledby="traffic-setup-title">
          <h2 id="traffic-setup-title" className="font-medium">connect Cloudflare Web Analytics</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted-1">Traffic data is unavailable until this Worker has an API token with Account Analytics: Read. Set the production Worker secret <code className="rounded bg-cream px-1">CLOUDFLARE_ANALYTICS_TOKEN</code>. The account ID is already in <code className="rounded bg-cream px-1">wrangler.jsonc</code>.</p>
        </section>
      ) : visitors.error ? (
        <section role="status" aria-labelledby="traffic-error-title" className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-5 text-[#7c2d12]">
          <h2 id="traffic-error-title" className="font-medium">{siteLookupFailed ? "connect the Web Analytics site" : "Cloudflare couldn’t return traffic data"}</h2>
          <p className="mt-2 break-words text-sm leading-6">{visitors.error}</p>
          <div className="mt-4 border-t border-[#fed7aa] pt-4 text-sm leading-6">
            {siteLookupFailed ? (
              <>
                <p className="font-medium">To connect the site, update the production Worker:</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>Ensure the <code>CLOUDFLARE_ANALYTICS_TOKEN</code> secret is an API token with <code>Account Analytics: Read</code> for the account in <code>wrangler.jsonc</code>.</li>
                  <li>In Cloudflare Web Analytics, copy the site tag for <code>outship.dev</code> and set it as the <code>CF_WEB_ANALYTICS_SITE_TAG</code> Worker variable if automatic site lookup still fails.</li>
                </ol>
              </>
            ) : (
              <p>Check that <code>CLOUDFLARE_ANALYTICS_TOKEN</code> has <code>Account Analytics: Read</code> for the configured account, then reload. If Cloudflare is temporarily unavailable, try again later.</p>
            )}
            <p className="mt-3 text-xs text-[#9a3412]">{siteLookupFailed ? "Reload this page after the Worker configuration has been deployed." : "Reload this page to try the request again."} Metrics are hidden while the request fails, so an error can&apos;t be mistaken for zero visits.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2" aria-label="visitor metrics">
            <KpiCard highlight label="visits" value={fmt(visitors.visits)} deltaValue={delta(visitors.visits, visitors.previousVisits)} previous={fmt(visitors.previousVisits)} />
            <KpiCard label="page views" value={fmt(visitors.pageViews)} deltaValue={delta(visitors.pageViews, visitors.previousPageViews)} previous={fmt(visitors.previousPageViews)} note={visitors.clampedToDays ? `last ${visitors.clampedToDays} days (Cloudflare query limit)` : undefined} />
          </section>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="traffic breakdowns">
            <RankedBars title="top pages" rows={visitors.pages} />
            <RankedBars title="referrers" rows={visitors.referrers} />
            <RankedBars title="countries" rows={visitors.countries} />
            <RankedBars title="devices" rows={visitors.devices} />
          </section>
          <p className="text-xs text-text-muted-2">The beacon records page loads without cookies. Visits are Cloudflare&apos;s estimated sessions, not unique people.</p>
        </>
      )}
      <section className="flex flex-col gap-3" aria-labelledby="ai-agents-title">
        <h2 id="ai-agents-title" className="font-medium">AI crawlers, assistants and agents</h2>
        {!ai.configured ? (
          <p role="status" className="text-sm leading-6 text-text-muted-1">{ai.reason}</p>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-3" aria-label="AI agent metrics">
              <KpiCard highlight label="AI requests" value={fmt(ai.total)} />
              <KpiCard label="asked for Markdown" value={fmt(ai.askedForMarkdown)} />
              <KpiCard label="served Markdown" value={fmt(ai.servedMarkdown)} />
            </section>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="AI agent breakdowns">
              <RankedBars title="by category" rows={ai.byCategory.map((row) => ({ label: row.category, value: row.hits }))} />
              <RankedBars title="by agent" rows={ai.byAgent.slice(0, 12).map((row) => ({ label: `${row.agent} (${row.category})`, value: row.hits }))} />
              <RankedBars title="most-read pages" rows={ai.topPaths.slice(0, 12).map((row) => ({ label: row.path, value: row.hits }))} />
              <RankedBars title="response status" rows={ai.statuses.map((row) => ({ label: String(row.status), value: row.hits }))} />
            </section>
            <p className="text-xs text-text-muted-2">Counted at the Worker from user agents: training, search, assistant (a person asked an AI) and agent. No IPs, cookies or query strings are stored, and private pages are never logged. AI fetchers that look like ordinary browsers aren&apos;t counted.</p>
          </>
        )}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="ai-referrals-title">
        <h2 id="ai-referrals-title" className="font-medium">people arriving from AI assistants</h2>
        {!referrals.configured ? (
          <p role="status" className="text-sm leading-6 text-text-muted-1">{referrals.reason}</p>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2" aria-label="AI referral metrics">
              <KpiCard highlight label="visits from AI assistants" value={fmt(referrals.visits)} />
              <KpiCard label="first sign-ins from AI assistants" value={fmt(referrals.signups)} />
            </section>
            <section className="grid gap-3 sm:grid-cols-2" aria-label="AI referral breakdowns">
              <RankedBars title="by assistant (visits)" empty="none yet" rows={referrals.bySource.map((row) => ({ label: `${row.source}${row.signups ? ` · ${row.signups} sign-ups` : ""}`, value: row.visits }))} />
              <RankedBars title="landing pages" empty="none yet" rows={referrals.topLandings.slice(0, 12).map((row) => ({ label: row.path, value: row.visits }))} />
            </section>
            <p className="text-xs text-text-muted-2">From ?ref=ai, an AI utm_source (ChatGPT adds utm_source=chatgpt.com) or an AI assistant Referer. Totals only: no cookies for visits, no IPs, no user ids. A sign-up counts only when the person signs in from the page they landed on.</p>
          </>
        )}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="ai-mentions-title">
        <h2 id="ai-mentions-title" className="font-medium">AI answers to buyer questions (last 7 days)</h2>
        {!mentions ? (
          <p role="status" className="text-sm leading-6 text-text-muted-1">Not set up yet: review and apply <code className="rounded bg-cream px-1">migrations/0025_ai_mention_checks.sql</code>, add model API keys, then set <code className="rounded bg-cream px-1">AI_MENTION_MONITOR_ENABLED=true</code>. See docs/AI_AGENTS.md.</p>
        ) : (
          <>
            {mentions.missing.length ? (
              <p role="status" className="text-sm text-text-muted-1">Not asked (no key): {mentions.missing.map((m) => `${m.provider} (${m.key})`).join(", ")}.</p>
            ) : null}
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="AI mention breakdowns">
              <RankedBars title="mention rate by model (%)" empty="no answers stored yet" rows={mentions.models.map((m) => ({ label: `${m.provider} · ${m.model}${m.errors ? ` (${m.errors} errors)` : ""}`, value: Math.round(m.mentionRate * 100) }))} />
              <RankedBars title="questions that mention outship" empty="none yet" rows={mentions.questions.filter((q) => q.mentionedBy.length).map((q) => ({ label: q.question, value: q.mentionedBy.length }))} />
              <RankedBars title="sites AI cites (earn mentions here)" empty="no citations yet" rows={mentions.citedDomains.slice(0, 12).map((d) => ({ label: d.domain, value: d.citations }))} />
            </section>
            <p className="text-xs text-text-muted-2">Mention = the word &ldquo;outship&rdquo; or an outship.dev link in the answer or its citations. API answers can differ from the consumer apps; spot-check those weekly. A model that stays silent is a finding.</p>
          </>
        )}
      </section>
    </div>
  );
}
