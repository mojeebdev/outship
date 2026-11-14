import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { shipDetail, shipLabel } from "@/lib/ships";
import { getDb } from "@/lib/db";
import { IconLock, IconShip } from "@/components/icons";
import { AttestationBadge } from "@/components/attestation-badge";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { builderForHandle, isClaimed } from "@/lib/builders";
import { loadHeatmap, loadProfileFacts } from "@/lib/profile-data";
import { ProfileHeader, ProfileStats } from "@/components/profile-parts";
import { ContributionHeatmap, HistoryTotals } from "@/components/contribution-heatmap";

export const dynamic = "force-dynamic";

const SUPPORT_EMAIL = "support@mail.outship.dev";

/** A builder who may be shown publicly, or null (unknown or hidden: both 404). */
async function loadBuilder(rawHandle: string) {
  const builder = await builderForHandle(await getDb(), rawHandle);
  return builder && !builder.hidden ? builder : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const builder = await loadBuilder(handle);
  if (!builder) return { title: "outship" };
  return {
    title: `${builder.githubLogin} — outship`,
    // An unclaimed profile is assembled from public GitHub activity by
    // someone who never signed up; it shouldn't be what a search for their
    // name turns up.
    ...(isClaimed(builder) ? {} : { robots: { index: false, follow: false } }),
  };
}

/**
 * A purely public profile — anyone can view this, logged in or not, and
 * it never branches on who's viewing. Your own private dashboard (with
 * log out, etc.) lives separately at /profile.
 */
export default async function BuilderProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const builder = await loadBuilder(handle);
  if (!builder) notFound();

  const db = await getDb();
  const claimed = isClaimed(builder);
  // Private ships count, but an unclaimed profile is public GitHub activity
  // only, so it leaves them out entirely, even from the count.
  const shipWhere = { builderId: builder.id, ...(claimed ? {} : { isPrivate: false }) };
  const [facts, totalShips, recentShips, heatmap] = await Promise.all([
    loadProfileFacts(db, builder, { publicOnly: !claimed }),
    db.ship.count({ where: shipWhere }),
    db.ship.findMany({
      where: shipWhere,
      orderBy: { shippedAt: "desc" },
      take: 20,
      include: { attestation: true },
    }),
    loadHeatmap(db, builder, { publicOnly: true }),
  ]);

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
        <ProfileHeader builder={builder} claimed={claimed} languages={facts.languages} />

        {!claimed && (
          <div className="flex flex-col gap-3 rounded-lg border border-base-blue bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">is this you? claim your profile</p>
                <p className="mt-1 text-sm text-text-muted-1">
                  this page was put together from your public github activity in
                  repos where the outship app is installed. sign in to keep your
                  streak, rank on the leaderboard and attest your ships.
                </p>
              </div>
              <div className="shrink-0">
                <ConnectGithubButton>claim with github</ConnectGithubButton>
              </div>
            </div>
            <p className="text-xs text-text-muted-2">
              rather not be here? sign in and switch on &ldquo;hide my
              profile&rdquo;, or email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-base-blue hover:underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              and we&apos;ll remove it.
            </p>
          </div>
        )}

        <ProfileStats builder={builder} facts={facts} totalShips={totalShips} unrankedLabel="unclaimed" />

        <div className="flex flex-col gap-4">
          <ContributionHeatmap counts={heatmap.counts} unit={heatmap.unit} label={heatmap.label} />
          {heatmap.totals && <HistoryTotals {...heatmap.totals} />}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">ship feed</h2>
          {recentShips.length === 0 ? (
            <p className="text-sm text-text-muted-1">
              nothing shipped yet — pushes, merged PRs and releases show up
              here.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {recentShips.map((ship) => (
                <li
                  key={ship.id}
                  className="flex items-center gap-4 rounded-lg border border-border bg-white p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-cream">
                    <IconShip className="h-4 w-4 text-void" />
                  </span>
                  <div className="flex flex-1 flex-col">
                    {/* Private ships count, but the repo and tag/PR never
                        appear on a public page. */}
                    <span className="text-sm font-medium">
                      {shipLabel(ship)} ·{" "}
                      {ship.isPrivate ? (
                        <span className="inline-flex items-center gap-1 text-text-muted-1">
                          <IconLock className="h-3.5 w-3.5" aria-hidden="true" />
                          private repo
                        </span>
                      ) : (
                        ship.repo
                      )}
                    </span>
                    {!ship.isPrivate && (
                      <span className="text-xs text-text-muted-2">
                        {shipDetail(ship)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-text-muted-2">
                    {ship.shippedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {ship.attestation && (
                    <AttestationBadge
                      chain={ship.attestation.chain}
                      easUid={ship.attestation.easUid}
                      schemaVersion={ship.attestation.schemaVersion}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
