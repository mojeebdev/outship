import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { ComingSoon } from "@/components/coming-soon";
import { IconNode } from "@/components/icons";

export const metadata: Metadata = {
  title: "profile — outship",
};

export default function ProfilePage() {
  return (
    <SiteShell>
      <ComingSoon
        Icon={IconNode}
        title="your builder profile"
        description="your github, ranked — streak, total ships, rank, and score, with a chronological ship feed underneath."
        note="lands right after github connect ships, since a profile needs a real github account behind it."
      />
    </SiteShell>
  );
}
