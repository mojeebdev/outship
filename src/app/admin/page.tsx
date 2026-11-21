import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BarSeries, KpiCard, fmt } from "@/components/admin/charts";
import { WINDOWS, delta, parseWindow, series, windowCounts, windowRanges, type WindowKey } from "@/lib/metrics";
import { IconArrowUpRight, IconActivity, IconBuilders, IconGlobe, IconPlatform } from "@/components/icons";

export const metadata: Metadata = { title: "admin — outship", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const key: WindowKey = parseWindow(Array.isArray(params.w) ? params.w[0] : params.w);
  const window = WINDOWS[key];
  const { env } = await getCloudflareContext({ async: true });
  const range = windowRanges(key);
  const [current, previous, ships, actives, signIns, newBuilders] = await Promise.all([
    windowCounts(env.DB, range.current),
    windowCounts(env.DB, range.previous),
    series(env.DB, "ships", range.current, window.bucketMs),
    series(env.DB, "activeBuilders", range.current, window.bucketMs),
    series(env.DB, "signIns", range.current, window.bucketMs),
    series(env.DB, "newBuilders", range.current, window.bucketMs),
  ]);
  const spark = (rows: { value: number }[]) => rows.slice(-16).map(({ value }) => value);
  const cards = [
    { href: "/admin/builders", title: "Builder health", text: "Claims, sign-ins, invitations, and retention.", Icon: IconBuilders },
    { href: "/admin/shipping", title: "Shipping activity", text: "Ship volume, code mix, consistency, and repositories.", Icon: IconActivity },
    { href: "/admin/platform", title: "Platform operations", text: "App installs, verified attestations, API keys, and backfills.", Icon: IconPlatform },
    { href: "/admin/traffic", title: "Audience traffic", text: "Visits, page views, sources, locations, and devices.", Icon: IconGlobe },
  ];
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="operational overview" section="overview" description={`The core Outship signals for the last ${window.label}.`} windowKey={key} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="key metrics">
        <KpiCard label="ships" value={fmt(current.ships)} deltaValue={delta(current.ships, previous.ships)} previous={fmt(previous.ships)} highlight spark={spark(ships)} />
        <KpiCard label="active builders" value={fmt(current.activeBuilders)} deltaValue={delta(current.activeBuilders, previous.activeBuilders)} previous={fmt(previous.activeBuilders)} spark={spark(actives)} />
        <KpiCard label="new builders" value={fmt(current.newBuilders)} deltaValue={delta(current.newBuilders, previous.newBuilders)} previous={fmt(previous.newBuilders)} spark={spark(newBuilders)} />
        <KpiCard label="builder sign-ins" value={fmt(current.signIns)} deltaValue={delta(current.signIns, previous.signIns)} previous={fmt(previous.signIns)} spark={spark(signIns)} />
      </section>
      <section className="grid gap-3 xl:grid-cols-2" aria-label="activity trends">
        <BarSeries title="ships over time" buckets={ships} bucketMs={window.bucketMs} unit="ships" />
        <BarSeries title="active builders over time" buckets={actives} bucketMs={window.bucketMs} unit="builder-periods" />
      </section>
      <section aria-labelledby="admin-areas-heading" className="flex flex-col gap-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-text-muted-2">workspaces</p><h2 id="admin-areas-heading" className="text-lg font-medium">Explore an area</h2></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map(({ href, title, text, Icon }) => <Link key={href} href={`${href}?w=${key}`} className="group flex min-h-32 flex-col justify-between gap-5 rounded-xl border border-border bg-white p-4 transition hover:border-base-blue sm:p-5"><span className="flex items-center justify-between"><Icon className="h-5 w-5 text-base-blue" aria-hidden="true" /><IconArrowUpRight className="h-4 w-4 text-text-muted-2 transition group-hover:text-base-blue" aria-hidden="true" /></span><span><strong className="block text-sm font-medium">{title}</strong><span className="mt-1 block max-w-sm text-xs leading-5 text-text-muted-1">{text}</span></span></Link>)}
        </div>
      </section>
      <p className="text-xs text-text-muted-2">Data window: {window.label} · compared with the previous matching period · {new Date().toUTCString().slice(5, 22)} UTC</p>
    </div>
  );
}
