import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SiteShell } from "@/components/site-shell";
import { ContributionHeatmap } from "@/components/contribution-heatmap";
import { BarSeries, CohortTable, KpiCard, RankedBars, Ring, WeekHourHeatmap, fmt } from "@/components/admin/charts";
import { requireAdmin } from "@/lib/admin";
import { loadCfAnalytics } from "@/lib/cf-analytics";
import {
  WINDOWS,
  apiUsage,
  cohorts,
  delta,
  distributions,
  parseWindow,
  series,
  shipsPerDay,
  topLanguages,
  topRepos,
  totals,
  weekHourGrid,
  windowCounts,
  windowRanges,
  type WindowKey,
} from "@/lib/metrics";

export const metadata: Metadata = {
  title: "admin — outship",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const key: WindowKey = parseWindow(Array.isArray(params.w) ? params.w[0] : params.w);
  const window = WINDOWS[key];
  const { env } = await getCloudflareContext({ async: true });
  const d1 = env.DB;
  const now = new Date();
  const { current, previous } = windowRanges(key, now);
  // The weekday-hour heatmap needs enough ships to say anything: at least 30 days.
  const gridRange = window.ms >= 30 * 86_400_000 ? current : windowRanges("30d", now).current;

  const [now_, before, all, ships, actives, signIns, newBuilders, attestations, grid, perDay, languages, repos, dist, retention, api, visitors] =
    await Promise.all([
      windowCounts(d1, current),
      windowCounts(d1, previous),
      totals(d1),
      series(d1, "ships", current, window.bucketMs),
      series(d1, "activeBuilders", current, window.bucketMs),
      series(d1, "signIns", current, window.bucketMs),
      series(d1, "newBuilders", current, window.bucketMs),
      series(d1, "attestations", current, window.bucketMs),
      weekHourGrid(d1, gridRange),
      shipsPerDay(d1, now),
      topLanguages(d1, current),
      topRepos(d1, current),
      distributions(d1),
      cohorts(d1, 8, now),
      apiUsage(d1, now),
      loadCfAnalytics(env, current),
    ]);

  const spark = (buckets: { value: number }[]) => buckets.slice(-16).map((bucket) => bucket.value);
  const kpi = (label: string, field: keyof typeof now_, extra: Partial<Parameters<typeof KpiCard>[0]> = {}) => (
    <KpiCard
      label={label}
      value={fmt(now_[field])}
      deltaValue={delta(now_[field], before[field])}
      previous={fmt(before[field])}
      {...extra}
    />
  );

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-text-muted-1">admin</p>
            <h1 className="text-3xl font-medium">outship at a glance</h1>
            <p className="mt-1 text-sm text-text-muted-2">
              last {window.label}, compared with the {window.label} before · {now.toUTCString().slice(5, 22)} UTC
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="time window" className="flex flex-wrap gap-1 rounded-xl border border-border bg-white p-1 text-sm">
              {(Object.keys(WINDOWS) as WindowKey[]).map((option) => (
                <Link
                  key={option}
                  href={`/admin?w=${option}`}
                  aria-current={option === key ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 font-medium ${option === key ? "bg-base-blue text-white" : "text-text-muted-1 hover:text-base-blue"}`}
                >
                  {option}
                </Link>
              ))}
            </nav>
            <a href={`/admin/export?w=${key}`} className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium hover:border-void">
              export CSV
            </a>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpi("ships", "ships", { highlight: true, spark: spark(ships) })}
          {kpi("active builders (shipped)", "activeBuilders", { spark: spark(actives) })}
          {kpi("points awarded", "points")}
          {kpi("builders signed in", "signedInBuilders", { spark: spark(signIns) })}
          {kpi("new builders", "newBuilders", { spark: spark(newBuilders) })}
          {kpi("claimed profiles", "claims")}
          {kpi("attestations", "attestations", { spark: spark(attestations), note: `${fmt(now_.verifiedAttestations)} outship-signed` })}
          <KpiCard label="API requests" value={fmt(api.today)} note={`today (UTC) · ${fmt(api.last30)} in 30 days, ${fmt(api.anonymous30)} without a key`} />
        </section>

        <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {kpi("releases", "releases")}
          {kpi("merged PRs", "merges")}
          {kpi("pushes", "pushes")}
          {kpi("imported ships", "imported")}
          {kpi("installs", "installs", { note: `${fmt(now_.uninstalls)} uninstalled` })}
          {kpi("claim invites sent", "invites")}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <BarSeries title="ships" buckets={ships} bucketMs={window.bucketMs} unit="ships" />
          <BarSeries title="active builders" buckets={actives} bucketMs={window.bucketMs} unit="builder-periods" />
          <BarSeries title="sign-ins" buckets={signIns} bucketMs={window.bucketMs} unit="sign-ins" />
          <BarSeries title="new builders" buckets={newBuilders} bucketMs={window.bucketMs} unit="builders" />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-medium">visitors</h2>
          {!visitors.configured ? (
            <div className="rounded-2xl border border-dashed border-border bg-white p-5 text-sm text-text-muted-1">
              cloudflare web analytics isn&apos;t connected to the admin panel yet. set the Worker secret{" "}
              <code>CLOUDFLARE_ANALYTICS_TOKEN</code> to an API token with Account Analytics: Read. the account id is
              in wrangler.jsonc, and the site is found from the beacon&apos;s token.
            </div>
          ) : (
            <>
              {visitors.error && <p className="text-sm text-[#c2410c]">cloudflare: {visitors.error}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <KpiCard label="visits" value={fmt(visitors.visits)} deltaValue={delta(visitors.visits, visitors.previousVisits)} previous={fmt(visitors.previousVisits)} highlight />
                <KpiCard
                  label="page views"
                  value={fmt(visitors.pageViews)}
                  deltaValue={delta(visitors.pageViews, visitors.previousPageViews)}
                  previous={fmt(visitors.previousPageViews)}
                  note={visitors.clampedToDays ? `last ${visitors.clampedToDays} days (cloudflare's limit)` : undefined}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <RankedBars title="top pages" rows={visitors.pages} />
                <RankedBars title="referrers" rows={visitors.referrers} />
                <RankedBars title="countries" rows={visitors.countries} />
                <RankedBars title="devices" rows={visitors.devices} />
              </div>
            </>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Ring
            title="claim conversion"
            value={rate(all.claimedAfterInvite, all.invited)}
            label={`${fmt(all.claimedAfterInvite)} of ${fmt(all.invited)} invited builders claimed`}
            detail="after the one-time PR comment"
          />
          <Ring title="claimed profiles" value={rate(all.claimed, all.builders)} label={`${fmt(all.claimed)} of ${fmt(all.builders)} builders signed in`} detail={`${fmt(all.unclaimed)} unclaimed, ${fmt(all.hidden)} hidden`} />
          <Ring
            title="verified receipts"
            value={rate(all.verifiedAttestations, all.attestations)}
            label={`${fmt(all.verifiedAttestations)} of ${fmt(all.attestations)} attestations are outship-signed`}
            detail={`${fmt(all.wallets)} wallets linked`}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <figure className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-white p-5">
            <figcaption className="font-medium">every ship, the last year</figcaption>
            <ContributionHeatmap counts={perDay} unit="ship" label="all builders, UTC days" />
          </figure>
          <WeekHourHeatmap grid={grid} />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RankedBars title={`top languages · ${window.label}`} rows={languages} />
          <RankedBars title={`top repos · ${window.label}`} rows={repos} />
          <RankedBars title="current streaks" rows={dist.streaks} />
          <RankedBars title="tiers" rows={dist.tiers} />
        </section>

        <CohortTable cohorts={retention} />

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-medium">all time</h2>
          <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["builders", all.builders],
              ["claimed", all.claimed],
              ["ships", all.ships],
              ["public ships", all.publicShips],
              ["imported ships", all.importedShips],
              ["repos", all.repos],
              ["attestations", all.attestations],
              ["live installs", all.liveInstalls],
              ["recap subscribers", all.recapConfirmed],
              ["30-day club", all.thirtyDayClub],
              ["API keys", all.apiKeys],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl border border-border bg-white px-4 py-3">
                <dt className="text-xs text-text-muted-1">{label}</dt>
                <dd className="text-xl font-medium">{fmt(value as number)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="api" className="flex flex-col gap-4">
          <h2 className="text-xl font-medium">API keys</h2>
          <form method="post" action="/api/admin/keys" className="grid gap-3 rounded-2xl border border-border bg-white p-5 sm:grid-cols-5">
            <input name="name" required placeholder="what it's for" className="rounded-lg border border-border px-3 py-2 text-sm" />
            <input name="owner" required placeholder="issued to" className="rounded-lg border border-border px-3 py-2 text-sm" />
            <input name="contact" type="email" placeholder="contact email" className="rounded-lg border border-border px-3 py-2 text-sm" />
            <input name="rate" type="number" min={1} max={10000} defaultValue={120} className="rounded-lg border border-border px-3 py-2 text-sm" aria-label="requests per minute" />
            <button type="submit" className="rounded-lg bg-base-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              issue key
            </button>
          </form>
          {api.keys.length === 0 ? (
            <p className="text-sm text-text-muted-2">no keys issued yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-white">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-text-muted-2">
                  <tr>
                    {["key", "for", "issued to", "per minute", "requests (30d)", "last used", ""].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-normal">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {api.keys.map((apiKey) => (
                    <tr key={apiKey.id} className={`border-t border-border ${apiKey.revokedAt ? "text-text-muted-2" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs">{apiKey.prefix}…</td>
                      <td className="px-4 py-3">{apiKey.name}</td>
                      <td className="px-4 py-3">{apiKey.owner}</td>
                      <td className="px-4 py-3">{fmt(apiKey.ratePerMinute)}</td>
                      <td className="px-4 py-3">{fmt(apiKey.requests30d)}</td>
                      <td className="px-4 py-3 text-xs">{apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toUTCString().slice(5, 22) : "never"}</td>
                      <td className="px-4 py-3 text-right">
                        {apiKey.revokedAt ? (
                          "revoked"
                        ) : (
                          <form method="post" action="/api/admin/keys/revoke">
                            <input type="hidden" name="id" value={apiKey.id} />
                            <button type="submit" className="text-xs text-[#c2410c] hover:underline">
                              revoke
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </SiteShell>
  );
}
