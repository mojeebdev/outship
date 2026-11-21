import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { crewFor } from "@/lib/crew";
import { INVITES_PER_BUILDER, listInvites } from "@/lib/invites";
import { CrewPanel } from "@/components/crew-panel";
import { InviteFriends } from "@/components/invite-friends";
import { ProfilePageHeading } from "@/components/profile-page-heading";

export const metadata: Metadata = { title: "community · profile — outship" };
export const dynamic = "force-dynamic";

export default async function ProfileCommunityPage() {
  const builder = await getCurrentBuilder();
  if (!builder) return null;
  const { env } = await getCloudflareContext({ async: true });
  const [invites, used, crew] = await Promise.all([
    listInvites(env.DB, builder.id),
    env.DB.prepare('SELECT COUNT(*) AS n FROM "Invite" WHERE "inviterId" = ?1').bind(builder.id).first<{ n: number }>(),
    crewFor(env.DB, builder),
  ]);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ProfilePageHeading eyebrow="community" title="bring your crew aboard" description="Invite people you build with, and help them claim the work Outship has already recorded." />
      <div className="flex flex-col gap-3">
        <CrewPanel crew={crew} />
        <InviteFriends initial={invites} remaining={Math.max(0, INVITES_PER_BUILDER - Number(used?.n ?? 0))} limit={INVITES_PER_BUILDER} />
      </div>
    </div>
  );
}
