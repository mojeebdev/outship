import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SiteShell } from "@/components/site-shell";
import { BarSeries, KpiCard, RankedBars, fmt } from "@/components/admin/charts";
import { WINDOWS, series, topLanguages, totals, windowCounts, windowRanges } from "@/lib/metrics";

export const metadata: Metadata = {
  title: "stats — outship",
  description: "outship in numbers: verified ships, active builders and onchain receipts, live from the database.",
};

export const dynamic = "force-dynamic";

// Public, aggregate numbers only (no names, no repos), live from the
// database: the page to link in a grant application or an ecosystem report.
export default async function StatsPage() {
  const { env } = await getCloudflareContext({ async: true });
  const d1 = env.DB;
  const month = windowRanges("30d");
  const year = windowRanges("12mo");
  const [all, thisMonth, lastMonth, weekly, languages] = await Promise.all([
    totals(d1),
    windowCounts(d1, month.current),
    windowCounts(d1, month.previous),
    series(d1, "ships", year.current, WINDOWS["12mo"].bucketMs),
    topLanguages(d1, year.current, 8),
  ]);

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16">
        <div>
          <h1 className="text-3xl font-medium sm:text-4xl">outship in numbers</h1>
          <p className="mt-2 text-text-muted-1">
            live from the database. every ship is reported by github itself, as it happens or from github&apos;s own
            history, and every attestation is a receipt on base.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="verified ships, all time" value={fmt(all.ships)} highlight />
          <KpiCard label="builders" value={fmt(all.builders)} note={`${fmt(all.claimed)} signed in`} />
          <KpiCard label="repos" value={fmt(all.repos)} />
          <KpiCard label="onchain receipts" value={fmt(all.attestations)} note={`${fmt(all.verifiedAttestations)} outship-signed`} />
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="ships, last 30 days" value={fmt(thisMonth.ships)} note={`${fmt(lastMonth.ships)} the 30 days before`} />
          <KpiCard label="active builders, last 30 days" value={fmt(thisMonth.activeBuilders)} note={`${fmt(lastMonth.activeBuilders)} the 30 days before`} />
          <KpiCard label="new builders, last 30 days" value={fmt(thisMonth.newBuilders)} note={`${fmt(all.thirtyDayClub)} in the 30-day club now`} />
        </section>

        <BarSeries title="ships per week, the last 12 months" buckets={weekly} bucketMs={WINDOWS["12mo"].bucketMs} unit="ships" />

        <RankedBars title="languages shipped, the last 12 months" rows={languages} />
      </div>
    </SiteShell>
  );
}
