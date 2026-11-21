import type { Metadata } from "next";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { getDb } from "@/lib/db";
import { loadHeatmap } from "@/lib/profile-data";
import { ContributionHeatmap, HistoryTotals } from "@/components/contribution-heatmap";
import { ProfilePageHeading } from "@/components/profile-page-heading";

export const metadata: Metadata = { title: "activity · profile — outship" };
export const dynamic = "force-dynamic";

export default async function ProfileActivityPage() {
  const builder = await getCurrentBuilder();
  if (!builder) return null;
  const db = await getDb();
  const heatmap = await loadHeatmap(db, builder, { publicOnly: false });
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ProfilePageHeading eyebrow="activity" title="your contribution history" description="A daily view of the work Outship has recorded for your account." />
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-white p-4 sm:p-5" aria-label="contribution history">
        <ContributionHeatmap counts={heatmap.counts} unit={heatmap.unit} label={heatmap.label} />
        {heatmap.totals && <HistoryTotals {...heatmap.totals} />}
      </section>
    </div>
  );
}
