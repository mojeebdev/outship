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
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="traffic and reach" section="traffic" description={`Cookieless Cloudflare Web Analytics for the last ${window.label}.`} windowKey={key} />
      {!visitors.configured ? (
        <div className="rounded-xl border border-dashed border-border bg-white p-5 text-sm leading-6 text-text-muted-1">Cloudflare Web Analytics is not connected to the admin panel. Set the Worker secret <code className="rounded bg-cream px-1">CLOUDFLARE_ANALYTICS_TOKEN</code> to an API token with Account Analytics: Read. The account ID is in wrangler.jsonc; the site is identified from the beacon token.</div>
      ) : (
        <>
          {visitors.error && <p role="status" className="rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-3 text-sm text-[#9a3412]">Cloudflare analytics: {visitors.error}</p>}
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
