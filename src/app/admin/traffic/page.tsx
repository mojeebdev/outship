import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { KpiCard, RankedBars, fmt } from "@/components/admin/charts";
import { loadCfAnalytics } from "@/lib/cf-analytics";
import { delta, parseWindow, windowRanges, WINDOWS, type WindowKey } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminTrafficPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const key: WindowKey = parseWindow(Array.isArray(params.w) ? params.w[0] : params.w);
  const window = WINDOWS[key];
  const { env } = await getCloudflareContext({ async: true });
  const visitors = await loadCfAnalytics(env, windowRanges(key).current);
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
    </div>
  );
}
