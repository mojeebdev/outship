import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ContributionHeatmap } from "@/components/contribution-heatmap";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BarSeries, KpiCard, RankedBars, WeekHourHeatmap, fmt } from "@/components/admin/charts";
import { delta, distributions, parseWindow, series, shipsPerDay, topLanguages, topRepos, windowCounts, windowRanges, WINDOWS, weekHourGrid, type WindowKey } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminShippingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const key: WindowKey = parseWindow(Array.isArray(params.w) ? params.w[0] : params.w);
  const window = WINDOWS[key];
  const range = windowRanges(key);
  const gridRange = window.ms >= 30 * 86_400_000 ? range.current : windowRanges("30d").current;
  const { env } = await getCloudflareContext({ async: true });
  const [current, previous, ships, grid, perDay, languages, repos, dist] = await Promise.all([
    windowCounts(env.DB, range.current), windowCounts(env.DB, range.previous),
    series(env.DB, "ships", range.current, window.bucketMs),
    weekHourGrid(env.DB, gridRange), shipsPerDay(env.DB), topLanguages(env.DB, range.current), topRepos(env.DB, range.current), distributions(env.DB),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="shipping activity" section="shipping" description={`Volume, work mix, consistency, and repositories over ${window.label}.`} windowKey={key} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="shipping metrics">
        <KpiCard highlight label="ships" value={fmt(current.ships)} deltaValue={delta(current.ships, previous.ships)} previous={fmt(previous.ships)} spark={ships.slice(-16).map((row) => row.value)} />
        <KpiCard label="points awarded" value={fmt(current.points)} deltaValue={delta(current.points, previous.points)} previous={fmt(previous.points)} />
        <KpiCard label="merged PRs" value={fmt(current.merges)} deltaValue={delta(current.merges, previous.merges)} previous={fmt(previous.merges)} />
        <KpiCard label="releases" value={fmt(current.releases)} deltaValue={delta(current.releases, previous.releases)} previous={fmt(previous.releases)} />
        <KpiCard label="pushes" value={fmt(current.pushes)} deltaValue={delta(current.pushes, previous.pushes)} previous={fmt(previous.pushes)} />
        <KpiCard label="imported ships" value={fmt(current.imported)} deltaValue={delta(current.imported, previous.imported)} previous={fmt(previous.imported)} />
      </section>
      <BarSeries title="ships over time" buckets={ships} bucketMs={window.bucketMs} unit="ships" />
      <section className="grid gap-3 xl:grid-cols-2"><RankedBars title={`top languages · ${window.label}`} rows={languages} /><RankedBars title={`top public repos · ${window.label}`} rows={repos} /></section>
      <section className="grid gap-3 xl:grid-cols-2">
        <figure className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:p-5"><figcaption className="font-medium">every ship, the last year</figcaption><ContributionHeatmap counts={perDay} unit="ship" label="all builders, UTC days" /></figure>
        <WeekHourHeatmap grid={grid} />
      </section>
      <section className="grid gap-3 sm:grid-cols-2"><RankedBars title="current streaks" rows={dist.streaks} /><RankedBars title="builder tiers" rows={dist.tiers} /></section>
    </div>
  );
}
