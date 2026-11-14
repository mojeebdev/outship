import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { LeaderboardView, type LeaderboardSearchParams } from "@/components/leaderboard-view";
import { PERIOD_LABELS } from "@/lib/leaderboard";

export const metadata: Metadata = {
  title: `leaderboard · ${PERIOD_LABELS.month} — outship`,
};

export const dynamic = "force-dynamic";

export default function LeaderboardPage({ searchParams }: { searchParams: LeaderboardSearchParams }) {
  return (
    <SiteShell>
      <LeaderboardView period="month" searchParams={searchParams} />
    </SiteShell>
  );
}
