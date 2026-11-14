import { getDb } from "@/lib/db";
import { builderForHandle } from "@/lib/builders";
import { rankIn } from "@/lib/leaderboard";
import { renderBadge, renderNotFoundBadge } from "@/lib/badge";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  // An hour is fresh enough for a README and keeps GitHub's image proxy from
  // asking on every view.
  "Cache-Control": "public, max-age=3600",
  "X-Content-Type-Options": "nosniff",
  // The SVG is static text; nothing in it should ever run.
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
};

// /@handle/badge.svg. builderForHandle decodes the segment, which can arrive
// percent-encoded ("%40login") on Workers.
export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const db = await getDb();
  const builder = await builderForHandle(db, handle);
  if (!builder || builder.hidden) {
    return new Response(renderNotFoundBadge(), { status: 404, headers: HEADERS });
  }
  const rank = await rankIn(db, "all", builder);
  return new Response(
    renderBadge({ login: builder.githubLogin, score: builder.score, streak: builder.currentStreak, rank }),
    { headers: HEADERS },
  );
}
