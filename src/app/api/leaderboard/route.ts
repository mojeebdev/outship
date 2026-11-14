import { getDb } from "@/lib/db";
import { loadLeaderboard, parsePeriod } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

// The same boards as /leaderboard: ?period=week|month|all (default week),
// &language=, &page=. Hidden builders never appear; unclaimed ones have
// claimed: false and rank: null.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const board = await loadLeaderboard(await getDb(), {
    period: parsePeriod(url.searchParams.get("period")),
    language: url.searchParams.get("language"),
    page: Number(url.searchParams.get("page") ?? 1) || 1,
  });
  return Response.json({
    ...board,
    rows: board.rows.map((row) => ({ ...row, reachedAt: row.reachedAt?.toISOString() ?? null })),
  });
}
