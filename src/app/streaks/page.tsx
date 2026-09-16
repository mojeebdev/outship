import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { ComingSoon } from "@/components/coming-soon";
import { IconStreak } from "@/components/icons";

export const metadata: Metadata = {
  title: "streaks — outship",
};

export default function StreaksPage() {
  return (
    <SiteShell>
      <ComingSoon
        Icon={IconStreak}
        title="streaks"
        description="stay active daily and watch your streak climb — current streak, longest streak, and the days you kept shipping."
        note="the 30-day club opens once streak tracking is live and the first builders hit thirty days."
      />
    </SiteShell>
  );
}
