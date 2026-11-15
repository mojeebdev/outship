import { getDb } from "@/lib/db";
import { apiRoute, preflight } from "@/lib/api/guard";
import { loadLeaderboard, parsePeriod } from "@/lib/leaderboard";
import { tierFor } from "@/lib/tiers";

export const dynamic = "force-dynamic";

// GET /api/v1/leaderboard?period=week|month|all&language=&page=
// The same boards as outship.dev/leaderboard.
export const GET = apiRoute(async (request) => {
  const url = new URL(request.url);
  const board = await loadLeaderboard(await getDb(), {
    period: parsePeriod(url.searchParams.get("period")),
    language: url.searchParams.get("language"),
    page: Number(url.searchParams.get("page") ?? 1) || 1,
  });
  return Response.json({
    period: board.period,
    language: board.language,
    languages: board.languages,
    page: board.page,
    pages: board.pageCount,
    total: board.total,
    rows: board.rows.map((row) => ({
      rank: row.rank,
      login: row.githubLogin,
      claimed: row.claimed,
      score: row.score,
      ships: row.ships,
      streak: row.currentStreak,
      ...(board.period === "all" ? { tier: tierFor(row.score).tier.name } : {}),
    })),
  });
});

export const OPTIONS = preflight;
