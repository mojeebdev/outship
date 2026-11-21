import type { Metadata } from "next";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { getDb } from "@/lib/db";
import { shipDetail, shipLabel } from "@/lib/ships";
import { attestationBlocker } from "@/lib/attest/ship-fields";
import { AttestShipButton } from "@/components/attest-ship-button";
import { AttestationBadge } from "@/components/attestation-badge";
import { ImportedNote } from "@/components/builder-bits";
import { IconLock, IconShip } from "@/components/icons";
import { ProfilePageHeading } from "@/components/profile-page-heading";

export const metadata: Metadata = { title: "ship feed · profile — outship" };
export const dynamic = "force-dynamic";

type FeedShip = {
  id: string;
  shipType: "RELEASE" | "MERGE" | "PUSH";
  shippedAt: Date;
  repo: string;
  identifier: string;
  commitSha: string | null;
  isPrivate: boolean;
  source: string;
  attestation: { chain: string; easUid: string; schemaVersion: number } | null;
};

export default async function ProfileShipsPage() {
  const builder = await getCurrentBuilder();
  if (!builder) return null;
  const db = await getDb();
  const ships: FeedShip[] = await db.ship.findMany({ where: { builderId: builder.id }, orderBy: { shippedAt: "desc" }, take: 20, include: { attestation: true } });
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ProfilePageHeading eyebrow="verified activity" title="your ship feed" description="The latest events recorded from your tracked GitHub repositories." />
      {ships.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-white p-5 text-sm leading-6 text-text-muted-1">
          {builder.installationId ? "nothing shipped yet — push to the default branch, merge a PR or publish a release on a tracked repo and it'll show up here." : "nothing shipped yet — install the GitHub App above, then push, merge or release."}
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-white px-4 sm:px-5">
          {ships.map((ship) => (
            <li key={ship.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4 sm:flex-nowrap">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream"><IconShip className="h-4 w-4 text-void" aria-hidden="true" /></span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium"><span>{shipLabel(ship)} · {ship.repo}</span>
                  {ship.isPrivate && <span className="inline-flex items-center gap-1 rounded-md bg-cream px-2 py-0.5 text-xs font-normal text-text-muted-1"><IconLock className="h-3 w-3" aria-hidden="true" /> private · hidden on your public profile</span>}
                </span>
                <span className="text-xs text-text-muted-2">{shipDetail(ship)}<ImportedNote source={ship.source} /></span>
              </div>
              <div className="flex w-full items-center justify-between gap-4 pl-13 sm:w-auto sm:shrink-0 sm:pl-0">
                <time dateTime={ship.shippedAt.toISOString()} className="whitespace-nowrap text-xs text-text-muted-2">{ship.shippedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>
                {ship.attestation ? <AttestationBadge chain={ship.attestation.chain} easUid={ship.attestation.easUid} schemaVersion={ship.attestation.schemaVersion} /> : attestationBlocker(ship) ? <span className="shrink-0 text-xs text-text-muted-2" title={attestationBlocker(ship) ?? undefined}>not attestable</span> : <AttestShipButton shipId={ship.id} />}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
