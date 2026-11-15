import Link from "next/link";
import { ConnectGithubButton } from "@/components/connect-github-button";
import { BuilderAvatar, UnclaimedChip } from "@/components/builder-bits";
import { IconSeal, IconShip, IconStreak } from "@/components/icons";
import { getDb } from "@/lib/db";
import {
  PERIODS,
  PERIOD_LABELS,
  PERIOD_PATHS,
  PAGE_SIZE,
  RISING_MIN_SHIPS,
  loadLeaderboard,
  loadRising,
  type Period,
} from "@/lib/leaderboard";
import { tierFor } from "@/lib/tiers";
import { MERGE_POINTS, PUSH_POINTS, RELEASE_POINTS, REVIEWED_MERGE_POINTS, STREAK_CAP, STREAK_POINTS_PER_DAY } from "@/lib/score";

export type LeaderboardSearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function href(period: Period, { language, page }: { language?: string | null; page?: number }) {
  const query = new URLSearchParams();
  if (language) query.set("language", language);
  if (page && page > 1) query.set("page", String(page));
  const search = query.toString();
  return `${PERIOD_PATHS[period]}${search ? `?${search}` : ""}`;
}

const INTRO: Record<Period, string> = {
  week: "since monday 00:00 UTC, the same week as the monday recap. resets every week, so anyone can top it.",
  month: "since the 1st of the month, UTC.",
  all: `every verified ship since the start, plus ${STREAK_POINTS_PER_DAY} points per streak day (up to ${STREAK_CAP} days).`,
};

export async function LeaderboardView({
  period,
  searchParams,
}: {
  period: Period;
  searchParams: LeaderboardSearchParams;
}) {
  const params = await searchParams;
  const db = await getDb();
  const [board, rising] = await Promise.all([
    loadLeaderboard(db, {
      period,
      language: first(params.language) ?? null,
      page: Number(first(params.page) ?? 1) || 1,
    }),
    loadRising(db),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-3xl font-medium sm:text-4xl">the leaderboard</h1>
        <p className="mt-2 text-text-muted-1">
          ranked by verified ships, pulled straight from github: a release with
          notes {RELEASE_POINTS}, a merged PR {MERGE_POINTS} (or {REVIEWED_MERGE_POINTS} when
          someone else merged it), a push to main {PUSH_POINTS}. daily caps keep it
          about shipping, not scripting.
        </p>
      </div>

      <nav aria-label="leaderboard period" className="flex gap-1 rounded-lg border border-border bg-white p-1 text-sm">
        {PERIODS.map((option) => (
          <Link
            key={option}
            href={href(option, { language: board.language })}
            aria-current={option === period ? "page" : undefined}
            className={`flex-1 rounded-md px-3 py-2 text-center font-medium transition ${
              option === period ? "bg-base-blue text-white" : "text-text-muted-1 hover:text-base-blue"
            }`}
          >
            {PERIOD_LABELS[option]}
          </Link>
        ))}
      </nav>

      <p className="-mt-4 text-sm text-text-muted-2">{INTRO[period]}</p>

      {rising.length > 0 && (
        <section aria-labelledby="rising-heading" className="flex flex-col gap-3">
          <h2 id="rising-heading" className="text-sm font-medium">
            rising this week{" "}
            <span className="font-normal text-text-muted-2">
              · biggest gains on last week, {RISING_MIN_SHIPS}+ ships
            </span>
          </h2>
          <ol className="flex gap-3 overflow-x-auto pb-1">
            {rising.map((row) => (
              <li key={row.githubLogin} className="shrink-0">
                <Link
                  href={`/@${row.githubLogin}`}
                  className={`flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition hover:border-base-blue ${
                    row.claimed ? "bg-white" : "bg-white/50 text-text-muted-1"
                  }`}
                >
                  <BuilderAvatar githubId={row.githubId} login={row.githubLogin} size={28} />
                  <span className="flex flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {row.githubLogin}
                      {!row.claimed && <UnclaimedChip />}
                    </span>
                    <span className="text-xs text-base-blue">+{row.gain} on last week</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {board.languages.length > 0 && (
        <nav aria-label="language" className="flex flex-wrap gap-2 text-xs">
          <Link
            href={href(period, {})}
            aria-current={board.language === null ? "page" : undefined}
            className={`rounded-full border px-3 py-1 transition ${
              board.language === null ? "border-base-blue bg-blue-tint text-base-blue" : "border-border text-text-muted-1 hover:border-base-blue"
            }`}
          >
            every language
          </Link>
          {board.languages.map((language) => (
            <Link
              key={language}
              href={href(period, { language })}
              aria-current={board.language === language ? "page" : undefined}
              className={`rounded-full border px-3 py-1 transition ${
                board.language === language
                  ? "border-base-blue bg-blue-tint text-base-blue"
                  : "border-border text-text-muted-1 hover:border-base-blue"
              }`}
            >
              {language}
            </Link>
          ))}
        </nav>
      )}

      {board.rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-white p-8 text-center text-text-muted-1">
          {period === "all" && !board.language ? (
            <>
              no builders yet — be the first to{" "}
              <ConnectGithubButton variant="link">connect github</ConnectGithubButton>.
            </>
          ) : (
            <>nobody has shipped {board.language ? `${board.language} ` : ""}{PERIOD_LABELS[period]} yet. the board is open.</>
          )}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {board.rows.map((row) => (
            <li
              key={row.githubLogin}
              className={`flex items-center gap-4 rounded-lg border border-border p-4 ${
                row.claimed ? "bg-white" : "bg-white/50 text-text-muted-1"
              }`}
            >
              <span className="w-8 shrink-0 text-sm font-medium text-text-muted-2">
                {row.rank ? `#${row.rank}` : "–"}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <BuilderAvatar githubId={row.githubId} login={row.githubLogin} size={24} />
                <Link href={`/@${row.githubLogin}`} className="truncate font-medium hover:text-base-blue">
                  {row.githubLogin}
                </Link>
                {!row.claimed && <UnclaimedChip />}
                {/* Tiers read the all-time score, so they only mean something on that board. */}
                {period === "all" && (
                  <span className="hidden shrink-0 text-xs text-text-muted-2 sm:inline">{tierFor(row.score).tier.name}</span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-text-muted-1" title="current streak">
                <IconStreak className="h-3.5 w-3.5" aria-hidden="true" />
                {row.currentStreak}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-text-muted-1" title={`ships ${PERIOD_LABELS[period]}`}>
                <IconShip className="h-3.5 w-3.5" aria-hidden="true" />
                {row.ships}
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-base-blue" title={`score ${PERIOD_LABELS[period]}`}>
                <IconSeal className="h-3.5 w-3.5" aria-hidden="true" />
                {row.score}
              </span>
            </li>
          ))}
        </ol>
      )}

      {board.pageCount > 1 && (
        <nav aria-label="pages" className="flex items-center justify-between text-sm">
          {board.page > 1 ? (
            <Link href={href(period, { language: board.language, page: board.page - 1 })} className="text-base-blue hover:underline">
              ← previous {PAGE_SIZE}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-text-muted-2">
            page {board.page} of {board.pageCount} · {board.total} builders
          </span>
          {board.page < board.pageCount ? (
            <Link href={href(period, { language: board.language, page: board.page + 1 })} className="text-base-blue hover:underline">
              next {PAGE_SIZE} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      <p className="text-xs text-text-muted-2">
        unclaimed builders ship in repos with the outship app but haven&apos;t signed in. they&apos;re listed, not ranked.
        ties go to whoever reached the score first.
      </p>
    </div>
  );
}
