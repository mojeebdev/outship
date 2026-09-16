import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { ComingSoon } from "@/components/coming-soon";
import { IconStreak } from "@/components/icons";

export const metadata: Metadata = {
  title: "leaderboard — outship",
};

export default function LeaderboardPage() {
  return (
    <SiteShell>
      <ComingSoon
        Icon={IconStreak}
        title="the leaderboard"
        description="rank builders by verified ships, streaks, and diff size — pulled straight from GitHub, attested onchain."
        note="the v1 ranking formula (streak + verified ships + diff size) isn't locked yet — it goes live once GitHub App detection ships."
      />
    </SiteShell>
  );
}
