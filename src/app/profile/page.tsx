import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { getDb } from "@/lib/db";
import { IconGrid, IconNode, IconSeal, IconShip, IconStreak } from "@/components/icons";

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
          <Link
            href="/api/auth/github/login"
            className="mt-2 rounded-md bg-base-blue px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            connect github →
          </Link>
        </section>
      </SiteShell>
    );
  }

  const db = await getDb();
  const [rankAbove, totalShips, recentShips] = await Promise.all([
    db.builder.count({ where: { score: { gt: builder.score } } }),
    db.ship.count({ where: { builderId: builder.id } }),
    db.ship.findMany({
      where: { builderId: builder.id },
      orderBy: { shippedAt: "desc" },
      take: 20,
    }),
  ]);

  const stats = [
    { label: "streak", value: builder.currentStreak, Icon: IconStreak },
    { label: "ships", value: totalShips, Icon: IconShip },
    { label: "rank", value: `#${rankAbove + 1}`, Icon: IconGrid },
    { label: "score", value: builder.score, Icon: IconSeal },
  ];

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted-1">welcome back</p>
            <h1 className="text-2xl font-medium">{builder.githubLogin}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href={`/@${builder.githubLogin}`}
              className="text-text-muted-1 hover:text-base-blue"
            >
              view public profile
            </Link>
            <Link
              href="/api/auth/logout"
              className="text-text-muted-1 hover:text-base-blue"
            >
              log out
            </Link>
          </div>
        </div>

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
              nothing shipped yet — merge a PR or publish a release and
              it&apos;ll show up here.
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
                    <span className="text-sm font-medium">
                      {ship.shipType === "RELEASE" ? "release" : "merge"} ·{" "}
                      {ship.repo}
                    </span>
                    <span className="text-xs text-text-muted-2">
                      {ship.identifier}
                    </span>
                  </div>
                  <span className="text-xs text-text-muted-2">
                    {ship.shippedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
