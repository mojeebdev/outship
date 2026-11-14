import type { Metadata } from "next";
import Link from "next/link";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { SiteShell } from "@/components/site-shell";
import { getDb } from "@/lib/db";
import { IconSeal, IconShip, IconStreak } from "@/components/icons";
import { PUBLIC_BUILDER } from "@/lib/builders";
import { MERGE_POINTS, PUSH_POINTS, RELEASE_POINTS, REVIEWED_MERGE_POINTS } from "@/lib/score";
import { UnclaimedChip } from "@/components/builder-bits";

export const metadata: Metadata = {
  title: "leaderboard — outship",
};

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const db = await getDb();
  const builders = await db.builder.findMany({
    where: PUBLIC_BUILDER,
    orderBy: { score: "desc" },
    take: 50,
    select: {
      githubLogin: true,
      score: true,
      currentStreak: true,
      claimedAt: true,
      _count: { select: { ships: true } },
    },
  });
  // Only claimed builders take a rank; unclaimed ones are listed, unnumbered.
  let rank = 0;
  const rows = builders.map((builder) => ({ ...builder, rank: builder.claimedAt ? ++rank : null }));

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <div>
          <h1 className="text-3xl font-medium sm:text-4xl">the leaderboard</h1>
          <p className="mt-2 text-text-muted-1">
            ranked by verified ships, pulled straight from github: a release
            with notes {RELEASE_POINTS}, a merged PR {MERGE_POINTS} (or{" "}
            {REVIEWED_MERGE_POINTS} when someone else merged it), a push to
            main {PUSH_POINTS}, plus a point per streak day. daily caps keep
            it about shipping, not scripting.
          </p>
        </div>

        {builders.length === 0 ? (
          <p className="rounded-lg border border-border bg-white p-8 text-center text-text-muted-1">
            no builders yet — be the first to{" "}
            <ConnectGithubButton variant="link">connect github</ConnectGithubButton>
            .
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((builder) => (
              <li
                key={builder.githubLogin}
                className={`flex items-center gap-4 rounded-lg border border-border p-4 ${
                  builder.rank ? "bg-white" : "bg-white/50 text-text-muted-1"
                }`}
              >
                <span className="w-8 shrink-0 text-sm font-medium text-text-muted-2">
                  {builder.rank ? `#${builder.rank}` : "–"}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <Link
                    href={`/@${builder.githubLogin}`}
                    className="truncate font-medium hover:text-base-blue"
                  >
                    {builder.githubLogin}
                  </Link>
                  {!builder.rank && <UnclaimedChip />}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-text-muted-1">
                  <IconStreak className="h-3.5 w-3.5" />
                  {builder.currentStreak}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-text-muted-1">
                  <IconShip className="h-3.5 w-3.5" />
                  {builder._count.ships}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-base-blue">
                  <IconSeal className="h-3.5 w-3.5" />
                  {builder.score}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </SiteShell>
  );
}
