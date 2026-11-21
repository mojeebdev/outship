import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CohortTable, KpiCard, Ring, BarSeries, fmt } from "@/components/admin/charts";
import { cohorts, delta, parseWindow, totals, series, windowCounts, windowRanges, WINDOWS, type WindowKey } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminBuildersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const key: WindowKey = parseWindow(Array.isArray(params.w) ? params.w[0] : params.w);
  const window = WINDOWS[key];
  const range = windowRanges(key);
  const { env } = await getCloudflareContext({ async: true });
  const [current, previous, all, signIns, newBuilders, retention] = await Promise.all([
    windowCounts(env.DB, range.current), windowCounts(env.DB, range.previous), totals(env.DB),
    series(env.DB, "signIns", range.current, window.bucketMs), series(env.DB, "newBuilders", range.current, window.bucketMs), cohorts(env.DB, 8),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="builder growth and retention" section="builders" description={`Understand account growth and return behavior across ${window.label}.`} windowKey={key} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="builder metrics">
        <KpiCard highlight label="new builders" value={fmt(current.newBuilders)} deltaValue={delta(current.newBuilders, previous.newBuilders)} previous={fmt(previous.newBuilders)} spark={newBuilders.slice(-16).map((row) => row.value)} />
        <KpiCard label="claimed profiles" value={fmt(current.claims)} deltaValue={delta(current.claims, previous.claims)} previous={fmt(previous.claims)} />
        <KpiCard label="builder sign-ins" value={fmt(current.signIns)} deltaValue={delta(current.signIns, previous.signIns)} previous={fmt(previous.signIns)} spark={signIns.slice(-16).map((row) => row.value)} />
        <KpiCard label="claim invitations" value={fmt(current.invites)} deltaValue={delta(current.invites, previous.invites)} previous={fmt(previous.invites)} />
      </section>
      <section className="grid gap-3 xl:grid-cols-2" aria-label="builder growth trends">
        <BarSeries title="builder sign-ins" buckets={signIns} bucketMs={window.bucketMs} unit="sign-ins" />
        <BarSeries title="new builder accounts" buckets={newBuilders} bucketMs={window.bucketMs} unit="builders" />
      </section>
      <section className="grid gap-3 sm:grid-cols-2" aria-label="builder conversion">
        <Ring title="claim invite conversion" value={all.invited ? all.claimedAfterInvite / all.invited : 0} label={`${fmt(all.claimedAfterInvite)} of ${fmt(all.invited)} invited builders claimed`} detail="after the one-time PR comment" />
        <Ring title="profile claims" value={all.builders ? all.claimed / all.builders : 0} label={`${fmt(all.claimed)} of ${fmt(all.builders)} builders signed in`} detail={`${fmt(all.unclaimed)} unclaimed · ${fmt(all.hidden)} hidden`} />
      </section>
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <CohortTable cohorts={retention} />
        <div className="rounded-xl border border-border bg-white p-4 sm:p-5"><h2 className="font-medium">all-time builder record</h2><dl className="mt-4 grid grid-cols-2 gap-3">{[["total profiles", all.builders], ["claimed", all.claimed], ["unclaimed", all.unclaimed], ["hidden", all.hidden], ["invited", all.invited], ["invite emails sent", all.invitesSent], ["joined via invite", all.joinedViaInvite], ["30-day club", all.thirtyDayClub]].map(([label, value]) => <div key={label as string} className="border-t border-border pt-2"><dt className="text-xs text-text-muted-1">{label}</dt><dd className="mt-1 text-xl font-medium">{fmt(value as number)}</dd></div>)}</dl></div>
      </section>
    </div>
  );
}
