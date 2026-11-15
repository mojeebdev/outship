import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { shipDetail, shipLabel } from "@/lib/ships";
import { attestationBlocker } from "@/lib/attest/ship-fields";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { getDb } from "@/lib/db";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";
import {
  IconArrowUpRight,
  IconGithub,
  IconLock,
  IconLogout,
  IconNode,
  IconShip,
  IconX,
} from "@/components/icons";
import { AttestShipButton } from "@/components/attest-ship-button";
import { AttestationBadge } from "@/components/attestation-badge";
import { loadHeatmap, loadProfileFacts } from "@/lib/profile-data";
import { ProfileHeader, TierSteps } from "@/components/profile-parts";
import { BarSeries, Donut, KpiCard, WeekHourHeatmap, fmt } from "@/components/admin/charts";
import { change, profileOverview } from "@/lib/profile-overview";
import { tierFor } from "@/lib/tiers";
import { profileShareText, shareOnXHref } from "@/lib/share";
import { ReadmeBadgeBox } from "@/components/readme-badge-box";
import { ImportedNote } from "@/components/builder-bits";
import { ContributionHeatmap, HistoryTotals } from "@/components/contribution-heatmap";
import { ProfileSidebar } from "@/components/profile-sidebar";

export const metadata: Metadata = {
  title: "profile — outship",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const builder = await getCurrentBuilder();

  if (!builder) {
    return (
      <SiteShell>
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-tint">
            <IconNode className="h-6 w-6 text-base-blue" />
          </span>
          <h1 className="text-3xl font-medium sm:text-4xl">your builder profile</h1>
          <p className="text-base text-text-muted-1 sm:text-lg">
            connect github to see your streak, ships, and score.
          </p>
          <div className="mt-2">
            <ConnectGithubButton />
          </div>
        </section>
      </SiteShell>
    );
  }

  const db = await getDb();
  const [facts, allShips, recentShips, subscriber, installation, heatmap] = await Promise.all([
    loadProfileFacts(db, builder, { publicOnly: false }),
    db.ship.findMany({
      where: { builderId: builder.id },
      select: { shipType: true, shippedAt: true, weightClass: true, releaseHasNotes: true, source: true },
    }),
    db.ship.findMany({
      where: { builderId: builder.id },
      orderBy: { shippedAt: "desc" },
      take: 20,
      include: { attestation: true },
    }),
    builder.email ? db.subscriber.findUnique({ where: { email: builder.email } }) : null,
    builder.installationId ? db.installation.findUnique({ where: { id: builder.installationId } }) : null,
    loadHeatmap(db, builder, { publicOnly: false }),
  ]);
  const recapOn = subscriber?.status === "CONFIRMED";
  const overview = profileOverview(allShips);
  const rank = (value: number | null) => (value ? `#${value}` : "–");
  // The sidebar's list, in page order. scroll-mt leaves room for the sticky
  // strip of pills that stands in for the sidebar on narrow screens.
  const sections = [
    { id: "overview", label: "overview" },
    { id: "activity", label: "activity" },
    { id: "ships", label: "ship feed" },
    { id: "badge", label: "README badge" },
    { id: "settings", label: "settings" },
  ];
  const sectionClass = "flex scroll-mt-20 flex-col gap-4 lg:scroll-mt-6";

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-16 pt-6 sm:pt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ProfileHeader builder={builder} claimed languages={facts.languages} eyebrow="welcome back" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 whitespace-nowrap text-sm">
            {/* Off while hidden: the shared link would land on "not found". */}
            {!builder.hidden && (
              <a
                href={shareOnXHref(
                  profileShareText({
                    login: builder.githubLogin,
                    tier: tierFor(builder.score).tier.name,
                    score: builder.score,
                    weekRank: facts.weekRank,
                    streak: builder.currentStreak,
                  }),
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-void px-4 py-2 font-medium text-white transition hover:opacity-85"
              >
                <IconX className="h-3.5 w-3.5" aria-hidden="true" />
                share on X
              </a>
            )}
            <Link
              href={`/@${builder.githubLogin}`}
              className="inline-flex items-center gap-1.5 text-text-muted-1 hover:text-base-blue"
            >
              view public profile
              <IconArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              href="/api/auth/logout"
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-text-muted-1 hover:text-base-blue"
            >
              <IconLogout className="h-3.5 w-3.5" aria-hidden="true" />
              log out
            </Link>
          </div>
        </div>

        {builder.installationId ? (
          <p className="-mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted-1">
            <IconGithub className="h-4 w-4" aria-hidden="true" />
            tracking your repos through the outship GitHub App ·
            <a
              href={GITHUB_APP_INSTALL_URL}
              className="inline-flex items-center gap-1 text-base-blue hover:underline"
            >
              manage repos
              <IconArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </p>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg border border-base-blue bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-blue-tint">
                <IconNode className="h-4 w-4 text-base-blue" aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium">one more step: install the GitHub App</p>
                <p className="mt-1 text-sm text-text-muted-1">
                  pick the repos outship should watch. pushes and merged PRs on
                  the default branch, and published releases, become ships.
                </p>
              </div>
            </div>
            <a
              href={GITHUB_APP_INSTALL_URL}
              className="inline-flex shrink-0 items-center justify-center gap-2.5 rounded-md border border-base-blue bg-base-blue px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              <IconGithub className="h-4 w-4" aria-hidden="true" />
              install on github
            </a>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[10rem_minmax(0,1fr)]">
          <ProfileSidebar sections={sections} />
          <div className="flex min-w-0 flex-col gap-8">
            {/* The overview: what a builder checks first. Every number is from
                their own ships, private ones included (this page is theirs). */}
            <section id="overview" aria-label="your overview" className={sectionClass}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  highlight
                  label="score"
                  value={fmt(builder.score)}
                  spark={overview.weeklyPoints}
                  note={[
                    tierFor(builder.score).tier.name,
                    ...(builder.hidden
                      ? ["hidden from the boards"]
                      : [`${rank(facts.weekRank)} this week`, `${rank(facts.allTimeRank)} all time`]),
                  ]}
                />
                <KpiCard
                  label="points this week"
                  value={fmt(overview.pointsThisWeek)}
                  deltaValue={change(overview.pointsThisWeek, overview.pointsLastWeek)}
                  note={`vs ${fmt(overview.pointsLastWeek)} last week`}
                  spark={overview.dailyPoints.slice(-14).map((day) => day.value)}
                />
                <KpiCard
                  label="ships this month"
                  value={fmt(overview.shipsThisMonth)}
                  deltaValue={change(overview.shipsThisMonth, overview.shipsLastMonth)}
                  note={`vs ${fmt(overview.shipsLastMonth)} last month`}
                  spark={overview.weeklyShips}
                />
                <KpiCard
                  label="streak"
                  value={`${builder.currentStreak} day${builder.currentStreak === 1 ? "" : "s"}`}
                  note={[`best ${builder.longestStreak}`, "the last 14 days"]}
                  spark={overview.activeDays}
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <BarSeries title="points, the last 30 days" buckets={overview.dailyPoints} bucketMs={86_400_000} unit="points" />
                <Donut
                  title="your ships"
                  unit="ships"
                  rows={[
                    { label: "merged PRs", value: overview.byType.MERGE },
                    { label: "pushes", value: overview.byType.PUSH },
                    { label: "releases", value: overview.byType.RELEASE },
                  ]}
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                <TierSteps score={builder.score} />
                <WeekHourHeatmap grid={overview.weekHour} title="when you ship" />
              </div>
            </section>

            <section id="activity" aria-label="your activity" className={sectionClass}>
              <ContributionHeatmap counts={heatmap.counts} unit={heatmap.unit} label={heatmap.label} />
              {heatmap.totals && <HistoryTotals {...heatmap.totals} />}
            </section>

            <section id="ships" className={sectionClass}>
              <h2 className="text-lg font-medium">ship feed</h2>
              {recentShips.length === 0 ? (
                <p className="text-sm text-text-muted-1">
                  {builder.installationId
                    ? "nothing shipped yet — push to the default branch, merge a PR or publish a release on a tracked repo and it'll show up here."
                    : "nothing shipped yet — install the GitHub App above, then push, merge or release."}
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {recentShips.map((ship) => (
                    <li
                      key={ship.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-border bg-white p-4 sm:flex-nowrap"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-cream">
                        <IconShip className="h-4 w-4 text-void" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                          <span>
                            {shipLabel(ship)} ·{" "}
                            {ship.repo}
                          </span>
                          {ship.isPrivate && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-cream px-2 py-0.5 text-xs font-normal text-text-muted-1">
                              <IconLock className="h-3 w-3" aria-hidden="true" />
                              private · hidden on your public profile
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-text-muted-2">
                          {shipDetail(ship)}
                          <ImportedNote source={ship.source} />
                        </span>
                      </div>
                      {/* On phones the date and the attest action drop to a line of
                          their own under the text, lined up with it, instead of
                          squeezing the repo name into a narrow column. */}
                      <div className="flex w-full items-center justify-between gap-4 pl-13 sm:w-auto sm:shrink-0 sm:pl-0">
                        <span className="whitespace-nowrap text-xs text-text-muted-2">
                          {ship.shippedAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {ship.attestation ? (
                          <AttestationBadge
                            chain={ship.attestation.chain}
                            easUid={ship.attestation.easUid}
                            schemaVersion={ship.attestation.schemaVersion}
                          />
                        ) : attestationBlocker(ship) ? (
                          <span
                            className="shrink-0 text-xs text-text-muted-2"
                            title={attestationBlocker(ship) ?? undefined}
                          >
                            not attestable
                          </span>
                        ) : (
                          <AttestShipButton shipId={ship.id} />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section id="badge" aria-label="README badge" className={sectionClass}>
              <ReadmeBadgeBox login={builder.githubLogin} hidden={builder.hidden} />
            </section>

            <section id="settings" className={sectionClass}>
              <h2 className="text-lg font-medium">settings</h2>
              <SettingForm
                action="/api/profile/visibility"
                name="hidden"
                on={builder.hidden}
                title="hide my profile"
                description={
                  builder.hidden
                    ? "hidden: your public page returns not found and you're off the leaderboard, index and streaks. your ships still count, and you see everything here."
                    : "your profile is public at /@" + builder.githubLogin + ". hide it to take it off every public page; your ships keep counting privately."
                }
                onLabel="hide"
                offLabel="show again"
              />

              {installation && (
                <SettingForm
                  action="/api/profile/claim-invites"
                  name="invites"
                  on={installation.claimInvitesEnabled}
                  title="claim invitations in your repos"
                  description={
                    installation.claimInvitesEnabled
                      ? "on: when someone who isn't on outship gets a PR merged in a public repo you installed the app on, the app leaves one short comment inviting them to claim or hide their profile. once per person, ever."
                      : "off: the app never comments in your repos."
                  }
                  onLabel="turn on"
                  offLabel="turn off"
                />
              )}

              {builder.email && (
                <form
                  method="post"
                  action="/api/recap/preference"
                  className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">weekly ship recap</p>
                    <p className="mt-1 text-sm text-text-muted-1">
                      {recapOn
                        ? `on: every monday to ${builder.email}.`
                        : `off. who shipped, fresh releases and the longest streaks, every monday to ${builder.email}.`}
                    </p>
                  </div>
                  <input type="hidden" name="recap" value={recapOn ? "off" : "on"} />
                  <button
                    type="submit"
                    className={
                      recapOn
                        ? "shrink-0 rounded-md border border-border px-5 py-2.5 text-sm font-medium transition hover:border-void"
                        : "shrink-0 rounded-md border border-base-blue bg-base-blue px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
                    }
                  >
                    {recapOn ? "turn off" : "turn on"}
                  </button>
                </form>
              )}
            </section>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

/** An on/off switch posted as a plain form, like the recap one. */
function SettingForm({
  action,
  name,
  on,
  title,
  description,
  onLabel,
  offLabel,
}: {
  action: string;
  name: string;
  on: boolean;
  title: string;
  description: string;
  /** The button when the setting is off (it turns it on). */
  onLabel: string;
  /** The button when the setting is on. */
  offLabel: string;
}) {
  return (
    <form
      method="post"
      action={action}
      className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
      <p className="font-medium">{title}</p>
    <p className="mt-1 text-sm text-text-muted-1">{description}</p>
  </div>
  <input type="hidden" name={name} value={on ? "off" : "on"} />
  <button
    type="submit"
    className="shrink-0 rounded-md border border-border px-5 py-2.5 text-sm font-medium transition hover:border-void"
  >
    {on ? offLabel : onLabel}
  </button>
</form>
  );
}
