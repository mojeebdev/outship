import Link from "next/link";
import { BuilderAvatar } from "@/components/builder-bits";
import { IconX } from "@/components/icons";
import { claimNudgeHref, type CrewMember } from "@/lib/crew";

// "Your crew" on /profile: people who ship in this builder's repos but haven't
// claimed their outship profile. The builder knows them; outship doesn't email
// them. Two ways to tell them: a ready post on X, or an email invite (the
// friend's address is typed into the invite form below).
export function CrewPanel({ crew }: { crew: CrewMember[] }) {
  if (crew.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-base-blue bg-white p-5">
      <div>
        <p className="font-medium">your crew</p>
        <p className="mt-1 text-sm text-text-muted-1">
          {crew.length === 1 ? "someone who ships" : `${crew.length} people who ship`} in your repos{" "}
          {crew.length === 1 ? "isn't" : "aren't"} on outship yet. their work is already here: tell them to claim it.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {crew.map((member) => (
          <li key={member.githubLogin} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
            <Link
              href={`/@${member.githubLogin}`}
              className="flex w-full min-w-0 items-center gap-3 hover:text-base-blue sm:w-auto sm:flex-1"
            >
              <BuilderAvatar githubId={member.githubId} login={member.githubLogin} size={32} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{member.githubLogin}</span>
                <span className="block text-xs text-text-muted-2">
                  {member.ships} ship{member.ships === 1 ? "" : "s"} in your repos
                </span>
              </span>
            </Link>
            {/* Under the name on phones (lined up with it), beside it on wider screens. */}
            <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
              <a
                href={claimNudgeHref(member.githubLogin)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-void px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-85"
              >
                <IconX className="h-3 w-3" aria-hidden="true" />
                tell them on X
              </a>
              <a
                href="#invite-email"
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:border-void"
              >
                invite by email
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
