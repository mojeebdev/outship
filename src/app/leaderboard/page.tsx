import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { getDb } from "@/lib/db";
import { IconSeal, IconShip, IconStreak } from "@/components/icons";

export const metadata: Metadata = {
  title: "leaderboard — outship",
};

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const db = await getDb();
  const builders = await db.builder.findMany({
    orderBy: { score: "desc" },
    take: 50,
    select: {
      githubLogin: true,
      score: true,
      currentStreak: true,
      _count: { select: { ships: true } },
    },
  });

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <div>
          <h1 className="text-3xl font-medium sm:text-4xl">the leaderboard</h1>
          <p className="mt-2 text-text-muted-1">
            ranked by verified ships, streaks, and diff size — pulled
            straight from github.
          </p>
        </div>

        {builders.length === 0 ? (
          <p className="rounded-lg border border-border bg-white p-8 text-center text-text-muted-1">
            no builders yet — be the first to{" "}
            <Link href="/api/auth/github/login" className="text-base-blue hover:underline">
              connect github
            </Link>
            .
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {builders.map((builder, index) => (
              <li
                key={builder.githubLogin}
                className="flex items-center gap-4 rounded-lg border border-border bg-white p-4"
              >
                <span className="w-8 shrink-0 text-sm font-medium text-text-muted-2">
                  #{index + 1}
                </span>
                <Link
                  href={`/@${builder.githubLogin}`}
                  className="flex-1 font-medium hover:text-base-blue"
                >
                  {builder.githubLogin}
                </Link>
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
