import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { getDb } from "@/lib/db";
import { IconGrid, IconShip, IconStreak } from "@/components/icons";

export const metadata: Metadata = {
  title: "index — outship",
};

export const dynamic = "force-dynamic";

export default async function IndexPage() {
  const db = await getDb();
  const builders = await db.builder.findMany({
    orderBy: { githubLogin: "asc" },
    select: {
      githubLogin: true,
      currentStreak: true,
      _count: { select: { ships: true } },
    },
  });

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
        <div>
          <h1 className="text-3xl font-medium sm:text-4xl">the builder index</h1>
          <p className="mt-2 text-text-muted-1">
            every builder on outship, browsable by repo, streak, and score.
          </p>
        </div>

        {builders.length === 0 ? (
          <p className="rounded-lg border border-border bg-white p-8 text-center text-text-muted-1">
            the directory opens once the first cohort connects github —{" "}
            <Link href="/api/auth/github/login" className="text-base-blue hover:underline">
              be the first
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {builders.map((builder) => (
              <Link
                key={builder.githubLogin}
                href={`/@${builder.githubLogin}`}
                className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4 transition hover:border-base-blue"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded bg-blue-tint">
                  <IconGrid className="h-4 w-4 text-base-blue" />
                </span>
                <span className="font-medium">{builder.githubLogin}</span>
                <div className="flex items-center gap-3 text-xs text-text-muted-1">
                  <span className="flex items-center gap-1">
                    <IconStreak className="h-3 w-3" />
                    {builder.currentStreak}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconShip className="h-3 w-3" />
                    {builder._count.ships}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
