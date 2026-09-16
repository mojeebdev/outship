import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { getDb } from "@/lib/db";
import { IconSeal, IconStreak } from "@/components/icons";

export const metadata: Metadata = {
  title: "streaks — outship",
};

export const dynamic = "force-dynamic";

const THIRTY_DAY_CLUB_THRESHOLD = 30;

export default async function StreaksPage() {
  const db = await getDb();
  const builders = await db.builder.findMany({
    where: { currentStreak: { gt: 0 } },
    orderBy: { currentStreak: "desc" },
    take: 50,
    select: {
      githubLogin: true,
      currentStreak: true,
      longestStreak: true,
    },
  });

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <div>
          <h1 className="text-3xl font-medium sm:text-4xl">streaks</h1>
          <p className="mt-2 text-text-muted-1">
            stay active daily and watch your streak climb. hit thirty days
            and you&apos;re in the 30-day club.
          </p>
        </div>

        {builders.length === 0 ? (
          <p className="rounded-lg border border-border bg-white p-8 text-center text-text-muted-1">
            no active streaks yet —{" "}
            <Link href="/api/auth/github/login" className="text-base-blue hover:underline">
              connect github
            </Link>{" "}
            and ship today to start one.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {builders.map((builder, index) => {
              const inThirtyDayClub = builder.currentStreak >= THIRTY_DAY_CLUB_THRESHOLD;
              return (
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
                  {inThirtyDayClub && (
                    <span className="flex items-center gap-1.5 rounded-full bg-blue-tint px-3 py-1 text-xs font-medium text-base-blue">
                      <IconSeal className="h-3 w-3" />
                      30-day club
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-sm font-medium text-base-blue">
                    <IconStreak className="h-3.5 w-3.5" />
                    {builder.currentStreak} day{builder.currentStreak === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-text-muted-2">
                    best: {builder.longestStreak}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </SiteShell>
  );
}
