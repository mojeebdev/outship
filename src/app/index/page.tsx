import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { ComingSoon } from "@/components/coming-soon";
import { IconGrid } from "@/components/icons";

export const metadata: Metadata = {
  title: "index — outship",
};

export default function IndexPage() {
  return (
    <SiteShell>
      <ComingSoon
        Icon={IconGrid}
        title="the builder index"
        description="browse every builder on outship — searchable by repo, streak, and score."
        note="opens once the first cohort connects github and the directory has someone in it."
      />
    </SiteShell>
  );
}
