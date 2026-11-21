import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { getDb } from "@/lib/db";
import { loadProfileFacts } from "@/lib/profile-data";
import { change, profileOverview } from "@/lib/profile-overview";
import { tierFor } from "@/lib/tiers";
import { ProfilePageHeading } from "@/components/profile-page-heading";
import { TierSteps } from "@/components/profile-parts";
import { BarSeries, Donut, KpiCard, WeekHourHeatmap, fmt } from "@/components/admin/charts";
import { IconActivity, IconArrowUpRight, IconAward, IconShip } from "@/components/icons";

export const metadata: Metadata = { title: "profile — outship" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const builder = await getCurrentBuilder();
  if (!builder) return null;
  const db = await getDb();
  const [facts, ships] = await Promise.all([
    loadProfileFacts(db, builder, { publicOnly: false }),
    db.ship.findMany({
      where: { builderId: builder.id },
      select: { shipType: true, shippedAt: true, weightClass: true, releaseHasNotes: true, source: true },
    }),
  ]);
  const overview = profileOverview(ships);
  const rank = (value: number | null) => value ? `#${value}` : "–";

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ProfilePageHeading eyebrow="overview" title="your shipping record" description="A clear read on your score, recent pace, and the next milestone ahead." />
      <section aria-label="your overview" className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard highlight label="score" value={fmt(builder.score)} spark={overview.weeklyPoints} note={[tierFor(builder.score).tier.name, ...(builder.hidden ? ["hidden from the boards"] : [`${rank(facts.weekRank)} this week`, `${rank(facts.allTimeRank)} all time`])]} />
          <KpiCard label="points this week" value={fmt(overview.pointsThisWeek)} deltaValue={change(overview.pointsThisWeek, overview.pointsLastWeek)} note={`vs ${fmt(overview.pointsLastWeek)} last week`} spark={overview.dailyPoints.slice(-14).map((day) => day.value)} />
          <KpiCard label="ships this month" value={fmt(overview.shipsThisMonth)} deltaValue={change(overview.shipsThisMonth, overview.shipsLastMonth)} note={`vs ${fmt(overview.shipsLastMonth)} last month`} spark={overview.weeklyShips} />
          <KpiCard label="current streak" value={`${builder.currentStreak} day${builder.currentStreak === 1 ? "" : "s"}`} note={[`best ${builder.longestStreak}`, "the last 14 days"]} spark={overview.activeDays} />
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <BarSeries title="points, the last 30 days" buckets={overview.dailyPoints} bucketMs={86_400_000} unit="points" />
          <Donut title="your ships" unit="ships" rows={[{ label: "merged PRs", value: overview.byType.MERGE }, { label: "pushes", value: overview.byType.PUSH }, { label: "releases", value: overview.byType.RELEASE }]} />
        </div>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <TierSteps score={builder.score} />
          <WeekHourHeatmap grid={overview.weekHour} title="when you ship" />
        </div>
      </section>
      <section aria-label="profile shortcuts" className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/profile/activity", title: "Review your activity", detail: "See the full contribution calendar and imported totals.", Icon: IconActivity },
          { href: "/profile/shipmarks", title: "View your Shipmarks", detail: "Your earned milestones, each with its own record.", Icon: IconAward },
          { href: "/profile/ships", title: "Open your ship feed", detail: "Review verified ships and available attestations.", Icon: IconShip },
        ].map(({ href, title, detail, Icon }) => (
          <Link key={href} href={href} className="group flex min-h-28 flex-col justify-between gap-4 rounded-xl border border-border bg-white p-4 transition hover:border-base-blue">
            <span className="flex items-center justify-between"><Icon className="h-5 w-5 text-base-blue" aria-hidden="true" /><IconArrowUpRight className="h-4 w-4 text-text-muted-2 transition group-hover:text-base-blue" aria-hidden="true" /></span>
            <span><strong className="block text-sm font-medium">{title}</strong><span className="mt-1 block text-xs leading-5 text-text-muted-1">{detail}</span></span>
          </Link>
        ))}
      </section>
    </div>
  );
}
