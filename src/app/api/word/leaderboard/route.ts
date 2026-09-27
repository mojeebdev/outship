/**
 * Word's homepage leaderboard.
 *
 *   GET  /api/word/leaderboard — the public ranking.
 *   POST /api/word/leaderboard — opt in to being listed.
 *
 * The POST body carries a URL and nothing else. The count is recomputed here,
 * server-side, so a client can never supply or influence its own number.
 */

import { getDb } from "@/lib/db";
import { LEADERBOARD_SIZE, listLeaderboard } from "@/lib/word/leaderboard";
import { clientIdentifier, consumeRateLimit } from "@/lib/word/rate-limit";
import { ScanError, scanUrl } from "@/lib/word/scan";
import {
  UnsafeUrlError,
  isHomepage,
  normalizeHostname,
  validateSubmittedUrl,
} from "@/lib/word/url";

export const dynamic = "force-dynamic";

export async function GET() {
  const entries = await listLeaderboard(LEADERBOARD_SIZE);
  return Response.json({ entries }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const input = typeof body?.url === "string" ? body.url : "";

  let submitted: URL;
  try {
    submitted = validateSubmittedUrl(input);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return Response.json({ code: error.reason, message: error.message }, { status: 400 });
    }
    throw error;
  }

  if (!isHomepage(submitted)) {
    return Response.json(
      {
        code: "not-a-homepage",
        message: "The leaderboard only lists homepages. Scan a bare domain to be listed.",
      },
      { status: 400 },
    );
  }

  const verdict = await consumeRateLimit(clientIdentifier(request), "word-list");
  if (!verdict.allowed) {
    return Response.json(
      { code: "rate-limited", message: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "retry-after": String(verdict.retryAfterSeconds ?? 60) } },
    );
  }

  let result;
  try {
    // Recomputed here rather than trusted from the client. Usually a cache hit
    // from the scan the visitor just ran, so this is cheap.
    result = await scanUrl(submitted.href);
  } catch (error) {
    if (error instanceof ScanError) {
      return Response.json({ code: error.code, message: error.message }, { status: 422 });
    }
    throw error;
  }

  const hostname = normalizeHostname(result.url);
  const now = new Date();
  const db = await getDb();

  await db.wordSite.upsert({
    where: { hostname },
    create: {
      hostname,
      url: result.shareUrl,
      wordCount: result.words,
      charCount: result.characters,
      lastScannedAt: now,
    },
    update: {
      url: result.shareUrl,
      wordCount: result.words,
      charCount: result.characters,
      lastScannedAt: now,
      scanCount: { increment: 1 },
    },
  });

  const entries = await listLeaderboard(LEADERBOARD_SIZE);

  return Response.json({
    ok: true,
    hostname,
    entries,
  });
}
