import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { attestationIdentifier, shipDetail, shipLabel } from "@/lib/ships";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { getDb } from "@/lib/db";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { GITHUB_APP_INSTALL_URL } from "@/lib/github-app";
import {
  IconArrowUpRight,
  IconGithub,
  IconGrid,
  IconLock,
  IconLogout,
  IconNode,
  IconSeal,
  IconShip,
  IconStreak,
} from "@/components/icons";
import { AttestShipButton } from "@/components/attest-ship-button";
import { AttestationBadge } from "@/components/attestation-badge";

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
  const [rankAbove, totalShips, recentShips, subscriber] = await Promise.all([
    db.builder.count({ where: { score: { gt: builder.score } } }),
    db.ship.count({ where: { builderId: builder.id } }),
    db.ship.findMany({
      where: { builderId: builder.id },
      orderBy: { shippedAt: "desc" },
      take: 20,
      include: { attestation: true },
    }),
    builder.email ? db.subscriber.findUnique({ where: { email: builder.email } }) : null,
  ]);
  const recapOn = subscriber?.status === "CONFIRMED";

  const stats = [
    { label: "streak", value: builder.currentStreak, Icon: IconStreak },
    { label: "ships", value: totalShips, Icon: IconShip },
    { label: "rank", value: `#${rankAbove + 1}`, Icon: IconGrid },
    { label: "score", value: builder.score, Icon: IconSeal },
  ];

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-text-muted-1">welcome back</p>
            <h1 className="text-2xl font-medium">{builder.githubLogin}</h1>
          </div>
          <div className="flex items-center gap-4 whitespace-nowrap text-sm">
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
          <p className="-mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted-1">
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

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded bg-blue-tint">
                <Icon className="h-4 w-4 text-base-blue" />
              </span>
              <span className="text-2xl font-medium">{value}</span>
              <span className="text-sm text-text-muted-1">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
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
                  className="flex items-center gap-4 rounded-lg border border-border bg-white p-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-cream">
                    <IconShip className="h-4 w-4 text-void" />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                      <span>
                        {shipLabel(ship)} ·{" "}
                        {ship.repo}
                      </span>
                      {ship.isPrivate && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-xs font-normal text-text-muted-1">
                          <IconLock className="h-3 w-3" aria-hidden="true" />
                          private · hidden on your public profile
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-text-muted-2">
                      {shipDetail(ship)}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted-2">
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
                    />
                  ) : ship.isPrivate ? (
                    <span
                      className="shrink-0 text-xs text-text-muted-2"
                      title="An attestation would put this repo's name onchain, permanently."
                    >
                      not attestable
                    </span>
                  ) : (
                    <AttestShipButton
                      ship={{
                        id: ship.id,
                        repo: ship.repo,
                        shipType: ship.shipType,
                        identifier: attestationIdentifier(ship),
                        commitSha: ship.commitSha,
                        shippedAtIso: ship.shippedAt.toISOString(),
                      }}
                      score={builder.score}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

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
      </div>
    </SiteShell>
  );
}
