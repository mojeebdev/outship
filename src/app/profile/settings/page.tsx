import type { Metadata } from "next";
import { getCurrentBuilder } from "@/lib/auth/current-builder";
import { getDb } from "@/lib/db";
import { ProfilePageHeading } from "@/components/profile-page-heading";

export const metadata: Metadata = { title: "settings · profile — outship" };
export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const builder = await getCurrentBuilder();
  if (!builder) return null;
  const db = await getDb();
  const [subscriber, installation] = await Promise.all([
    builder.email ? db.subscriber.findUnique({ where: { email: builder.email } }) : null,
    builder.installationId ? db.installation.findUnique({ where: { id: builder.installationId } }) : null,
  ]);
  const recapOn = subscriber?.status === "CONFIRMED";
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ProfilePageHeading eyebrow="account" title="profile settings" description="Control what other builders can see and which Outship updates reach you." />
      <div className="flex flex-col gap-3">
        <SettingForm action="/api/profile/visibility" name="hidden" on={builder.hidden} title="hide my profile" description={builder.hidden ? "hidden: your public page returns not found and you're off the leaderboard, index and streaks. your ships still count, and you see everything here." : "your profile is public at /@" + builder.githubLogin + ". hide it to take it off every public page; your ships keep counting privately."} onLabel="hide" offLabel="show again" />
        {installation && <SettingForm action="/api/profile/claim-invites" name="invites" on={installation.claimInvitesEnabled} title="claim invitations in your repos" description={installation.claimInvitesEnabled ? "on: when someone who isn't on outship gets a PR merged in a public repo you installed the app on, the app leaves one short comment inviting them to claim or hide their profile. once per person, ever." : "off: the app never comments in your repos."} onLabel="turn on" offLabel="turn off" />}
        {builder.email && (
          <form method="post" action="/api/recap/preference" className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-medium">weekly ship recap</p><p className="mt-1 text-sm text-text-muted-1">{recapOn ? `on: every monday to ${builder.email}.` : `off. who shipped, fresh releases and the longest streaks, every monday to ${builder.email}.`}</p></div>
            <input type="hidden" name="recap" value={recapOn ? "off" : "on"} />
            <button type="submit" className={recapOn ? "shrink-0 rounded-md border border-border px-5 py-2.5 text-sm font-medium transition hover:border-void" : "shrink-0 rounded-md border border-base-blue bg-base-blue px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"}>{recapOn ? "turn off" : "turn on"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function SettingForm({ action, name, on, title, description, onLabel, offLabel }: { action: string; name: string; on: boolean; title: string; description: string; onLabel: string; offLabel: string }) {
  return (
    <form method="post" action={action} className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-medium">{title}</p><p className="mt-1 text-sm leading-6 text-text-muted-1">{description}</p></div>
      <input type="hidden" name={name} value={on ? "off" : "on"} />
      <button type="submit" className={on ? "shrink-0 rounded-md border border-border px-5 py-2.5 text-sm font-medium transition hover:border-void" : "shrink-0 rounded-md border border-base-blue bg-base-blue px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"}>{on ? offLabel : onLabel}</button>
    </form>
  );
}
