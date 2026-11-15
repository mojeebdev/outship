// Pieces shared by the public profile (/@handle) and the dashboard (/profile).
import type { ComponentType } from "react";
import { BuilderAvatar, UnclaimedChip } from "@/components/builder-bits";
import { IconArrowUpRight, IconGrid, IconSeal, IconShip, IconStreak, IconX, type IconProps } from "@/components/icons";
import type { ProfileFacts } from "@/lib/profile-data";
import { TIERS, tierFor } from "@/lib/tiers";

type HeaderBuilder = {
  githubId: number;
  githubLogin: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  blog: string | null;
  twitterUsername: string | null;
};

/** GitHub's "website" field is free text; only show it if it's a web URL. */
export function blogHref(blog: string | null): string | null {
  if (!blog) return null;
  const candidate = /^https?:\/\//i.test(blog) ? blog : `https://${blog}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const TWITTER_HANDLE = /^[A-Za-z0-9_]{1,15}$/;

export function ProfileHeader({
  builder,
  claimed,
  languages,
  eyebrow,
}: {
  builder: HeaderBuilder;
  claimed: boolean;
  languages: string[];
  eyebrow?: string;
}) {
  const blog = blogHref(builder.blog);
  const twitter = builder.twitterUsername && TWITTER_HANDLE.test(builder.twitterUsername) ? builder.twitterUsername : null;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <BuilderAvatar githubId={builder.githubId} login={builder.githubLogin} size={72} />
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <p className="text-sm text-text-muted-1">{eyebrow}</p>}
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-medium">
          {builder.name ? (
            <>
              {builder.name} <span className="text-lg font-normal text-text-muted-1">@{builder.githubLogin}</span>
            </>
          ) : (
            builder.githubLogin
          )}
          {!claimed && <UnclaimedChip />}
        </h1>
        {builder.bio && <p className="max-w-xl text-sm text-text-muted-1">{builder.bio}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted-1">
          {builder.location && <span>{builder.location}</span>}
          {blog && (
            <a href={blog} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-base-blue">
              {new URL(blog).host}
              <IconArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          {twitter && (
            <a
              href={`https://x.com/${twitter}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1 hover:text-base-blue"
            >
              <IconX className="h-3.5 w-3.5" aria-hidden="true" />@{twitter}
            </a>
          )}
          <a
            href={`https://github.com/${builder.githubLogin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-base-blue"
          >
            github
            <IconArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
        {languages.length > 0 && (
          <ul aria-label="top languages" className="flex flex-wrap gap-1.5">
            {languages.map((language) => (
              <li key={language} className="rounded-full bg-blue-tint px-2.5 py-0.5 text-xs text-base-blue">
                {language}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, Icon }: { label: string; value: string | number; Icon: ComponentType<IconProps> }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded bg-blue-tint">
        <Icon className="h-4 w-4 text-base-blue" aria-hidden="true" />
      </span>
      <span className="text-2xl font-medium">{value}</span>
      <span className="text-sm text-text-muted-1">{label}</span>
    </div>
  );
}

export function ProfileStats({
  builder,
  facts,
  totalShips,
  unrankedLabel,
}: {
  builder: { score: number; currentStreak: number; longestStreak: number };
  facts: ProfileFacts;
  totalShips: number;
  /** What to show instead of a rank: "unclaimed" or "hidden". */
  unrankedLabel: string;
}) {
  const rank = (value: number | null, fallback: string) => (value ? `#${value}` : fallback);
  const standing = tierFor(builder.score);
  return (
    <div className="flex flex-col gap-4">
      <TierBar standing={standing} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={`streak · best ${builder.longestStreak}`} value={builder.currentStreak} Icon={IconStreak} />
        <Stat label="score" value={builder.score.toLocaleString("en-US")} Icon={IconSeal} />
        <Stat label="rank this week" value={rank(facts.weekRank, facts.allTimeRank ? "–" : unrankedLabel)} Icon={IconGrid} />
        <Stat label="rank all time" value={rank(facts.allTimeRank, unrankedLabel)} Icon={IconGrid} />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-white px-5 py-4 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <IconShip className="h-4 w-4 text-base-blue" aria-hidden="true" />
          {totalShips} ship{totalShips === 1 ? "" : "s"}
        </span>
        <span className="text-text-muted-1">{facts.byType.RELEASE} releases</span>
        <span className="text-text-muted-1">{facts.byType.MERGE} merged PRs</span>
        <span className="text-text-muted-1">{facts.byType.PUSH} pushes</span>
      </div>
    </div>
  );
}

/** The builder's tier and how far they are through it, straight from their score. */
export function TierBar({ standing }: { standing: ReturnType<typeof tierFor> }) {
  const percent = Math.round(standing.progress * 100);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-white px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-lg font-medium">{standing.tier.name}</span>
        <span className="text-sm text-text-muted-1">
          {standing.next
            ? `${standing.toNext.toLocaleString("en-US")} points to ${standing.next.name}`
            : "the top tier. nowhere left to climb."}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`progress to ${standing.next?.name ?? "the top"}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-blue-tint"
      >
        <div className="h-full rounded-full bg-base-blue" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * Every tier as a segment, filled up to where the builder stands: the climb
 * at a glance, with the points to the next tier. Tiers are uneven in size,
 * so each segment is one step, not a share of the points.
 */
export function TierSteps({ score }: { score: number }) {
  const standing = tierFor(score);
  const current = TIERS.findIndex((tier) => tier.name === standing.tier.name);
  return (
    <section className="flex min-w-0 flex-col justify-between gap-6 rounded-2xl border border-border bg-white p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm text-text-muted-1">the climb</h2>
        <p className="text-3xl font-medium tracking-tight">{standing.tier.name}</p>
        <p className="text-sm text-text-muted-1">
          {standing.next
            ? `${score.toLocaleString("en-US")} of ${standing.next.min.toLocaleString("en-US")} · ${standing.toNext.toLocaleString("en-US")} points to ${standing.next.name}`
            : "the top tier. nowhere left to climb."}
        </p>
      </div>
      <ol className="grid grid-cols-3 gap-x-1.5 gap-y-4 sm:grid-cols-6">
        {TIERS.map((tier, i) => {
          const fill = i < current ? 100 : i === current ? Math.max(6, Math.round(standing.progress * 100)) : 0;
          return (
            <li key={tier.name} className="flex min-w-0 flex-col gap-2">
              <span
                className="h-3 overflow-hidden rounded-full bg-blue-tint"
                role="img"
                aria-label={`${tier.name}: ${i < current ? "reached" : i === current ? "you are here" : "ahead"}`}
              >
                <span className="block h-full rounded-full bg-base-blue" style={{ width: `${fill}%` }} />
              </span>
              <span className={`text-xs leading-tight ${i === current ? "font-medium text-void" : "text-text-muted-2"}`}>
                {tier.name}
                <span className="block text-[11px] font-normal tabular-nums text-text-muted-2">{tier.min.toLocaleString("en-US")}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
