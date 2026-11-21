import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BarSeries, KpiCard, Ring, fmt } from "@/components/admin/charts";
import { apiUsage, delta, parseWindow, series, totals, windowCounts, windowRanges, WINDOWS, type WindowKey } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminPlatformPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const key: WindowKey = parseWindow(Array.isArray(params.w) ? params.w[0] : params.w);
  const window = WINDOWS[key];
  const range = windowRanges(key);
  const { env } = await getCloudflareContext({ async: true });
  const [current, previous, all, attestations, api] = await Promise.all([
    windowCounts(env.DB, range.current), windowCounts(env.DB, range.previous), totals(env.DB),
    series(env.DB, "attestations", range.current, window.bucketMs), apiUsage(env.DB),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="platform operations" section="platform" description="App adoption, onchain receipts, API access, and background backfills." windowKey={key} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="platform metrics">
        <KpiCard highlight label="live app installs" value={fmt(all.liveInstalls)} note={`${fmt(all.joinedNotInstalled)} signed-in builders without an install`} />
        <KpiCard label="app installs this period" value={fmt(current.installs)} deltaValue={delta(current.installs, previous.installs)} previous={fmt(previous.installs)} note={`${fmt(current.uninstalls)} uninstalled`} />
        <KpiCard label="attestations" value={fmt(current.attestations)} deltaValue={delta(current.attestations, previous.attestations)} previous={fmt(previous.attestations)} spark={attestations.slice(-16).map((row) => row.value)} />
        <KpiCard label="API requests today" value={fmt(api.today)} note={`${fmt(api.last30)} in 30 days`} />
        <KpiCard label="active API keys" value={fmt(all.apiKeys)} note={`${fmt(api.anonymous30)} anonymous API requests in 30 days`} />
      </section>
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <BarSeries title="attestations over time" buckets={attestations} bucketMs={window.bucketMs} unit="attestations" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><Ring title="app installed" value={all.claimed ? (all.claimed - all.joinedNotInstalled) / all.claimed : 0} label={`${fmt(all.claimed - all.joinedNotInstalled)} of ${fmt(all.claimed)} signed-in builders installed the app`} detail={`${fmt(all.joinedNotInstalled)} yet to install · ${fmt(all.installReminded)} reminded by email`} /><Ring title="verified receipts" value={all.attestations ? all.verifiedAttestations / all.attestations : 0} label={`${fmt(all.verifiedAttestations)} of ${fmt(all.attestations)} attestations are Outship-signed`} detail={`${fmt(all.wallets)} wallets linked`} /></div>
      </section>
      <section aria-labelledby="api-keys-heading" className="flex flex-col gap-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-text-muted-2">access</p><h2 id="api-keys-heading" className="text-lg font-medium">API keys</h2></div>
        <form method="post" action="/api/admin/keys" className="grid gap-2 rounded-xl border border-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1.1fr_.55fr_auto] sm:p-5">
          <input name="name" required placeholder="what it's for" className="min-w-0 rounded-lg border border-border px-3 py-2 text-sm" />
          <input name="owner" required placeholder="issued to" className="min-w-0 rounded-lg border border-border px-3 py-2 text-sm" />
          <input name="contact" type="email" placeholder="contact email" className="min-w-0 rounded-lg border border-border px-3 py-2 text-sm" />
          <input name="rate" type="number" min={1} max={10000} defaultValue={120} className="min-w-0 rounded-lg border border-border px-3 py-2 text-sm" aria-label="requests per minute" />
          <button type="submit" className="rounded-lg bg-base-blue px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">issue key</button>
        </form>
        {api.keys.length === 0 ? <p className="rounded-xl border border-dashed border-border bg-white p-5 text-sm text-text-muted-2">No API keys have been issued.</p> : (
          <div className="overflow-x-auto rounded-xl border border-border bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-cream/70 text-left text-xs text-text-muted-2"><tr>{["key", "for", "issued to", "per minute", "requests (30d)", "last used", ""].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
              <tbody>{api.keys.map((apiKey) => <tr key={apiKey.id} className={`border-t border-border ${apiKey.revokedAt ? "text-text-muted-2" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs">{apiKey.prefix}…</td><td className="px-4 py-3">{apiKey.name}</td><td className="px-4 py-3">{apiKey.owner}</td><td className="px-4 py-3">{fmt(apiKey.ratePerMinute)}</td><td className="px-4 py-3">{fmt(apiKey.requests30d)}</td><td className="px-4 py-3 text-xs">{apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toUTCString().slice(5, 22) : "never"}</td>
                <td className="px-4 py-3 text-right">{apiKey.revokedAt ? "revoked" : <form method="post" action="/api/admin/keys/revoke"><input type="hidden" name="id" value={apiKey.id} /><button type="submit" className="text-xs text-[#c2410c] hover:underline">revoke</button></form>}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
      <section className="rounded-xl border border-border bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.16em] text-text-muted-2">data maintenance</p><h2 className="mt-1 font-medium">Shipmark backfills</h2><p className="mt-1 text-sm text-text-muted-1">Current state of historical badge jobs.</p></div><p className="text-sm text-text-muted-1">{fmt(all.backfill.pending)} pending · {fmt(all.backfill.done)} complete · {fmt(all.backfill.failed)} failed</p></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-3 xl:grid-cols-4">{[["all-time ships", all.ships], ["public ships", all.publicShips], ["imported ships", all.importedShips], ["distinct repos", all.repos], ["all attestations", all.attestations], ["verified attestations", all.verifiedAttestations], ["confirmed recaps", all.recapConfirmed], ["wallets linked", all.wallets]].map(([label, value]) => <div key={label as string}><dt className="text-xs text-text-muted-1">{label}</dt><dd className="mt-1 text-lg font-medium">{fmt(value as number)}</dd></div>)}</dl>
      </section>
    </div>
  );
}
