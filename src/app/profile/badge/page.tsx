import type { Metadata } from "next";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { ProfilePageHeading } from "@/components/profile-page-heading";
import { ReadmeBadgeBox } from "@/components/readme-badge-box";

export const metadata: Metadata = { title: "README badge · profile — outship" };
export const dynamic = "force-dynamic";

export default async function ProfileBadgePage() {
  const builder = await getCurrentBuilder();
  if (!builder) return null;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ProfilePageHeading eyebrow="share your record" title="README badge" description="Add a live Outship score card to your GitHub profile or project README." />
      <section className="rounded-xl border border-border bg-white p-4 sm:p-5"><ReadmeBadgeBox login={builder.githubLogin} hidden={builder.hidden} /></section>
    </div>
  );
}
