// Small pieces shared by every list of builders.
import { avatarUrl } from "@/lib/builders";

export function UnclaimedChip() {
  return (
    <span
      className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-normal text-text-muted-2"
      title="this person ships in a repo with the outship app installed but hasn't signed in. their ships count; they aren't ranked until they claim the profile."
    >
      unclaimed
    </span>
  );
}

export function BuilderAvatar({
  githubId,
  login,
  size = 32,
  className = "",
}: {
  githubId: number;
  login: string;
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- GitHub's CDN already sizes it; next/image's optimizer isn't available on Workers
    <img
      src={avatarUrl(githubId, size * 2)}
      alt={`${login} on github`}
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 rounded-full bg-cream ring-1 ring-border ${className}`}
    />
  );
}

/** Marks a ship that came from the 12-month import rather than a live webhook. */
export function ImportedNote({ source }: { source: string }) {
  if (source !== "BACKFILL") return null;
  return (
    <span title="imported from github history when the outship app was installed">
      {" "}· imported
    </span>
  );
}
