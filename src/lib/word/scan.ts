/**
 * Word — scan orchestration.
 *
 * One entry point, `scanUrl`, used by both `/api/word/count` and the
 * leaderboard opt-in endpoint. The leaderboard therefore always stores a count
 * this server computed; a client-supplied number is never trusted.
 */

import { FETCH_LIMITS, SCAN_CACHE_TTL_SECONDS, WORD_CANONICAL_ORIGIN } from "./constants";
import { countHtml } from "./count";
import { PageFetchError, fetchPageHtml } from "./fetch-page";
import { createDeadline } from "./signals";
import { UnsafeUrlError, shareableUrl, validateSubmittedUrl } from "./url";

export type ScanResult = {
  /** The URL we actually counted, after redirects. */
  url: string;
  /** Same URL with the query string removed — what we show and share. */
  shareUrl: string;
  requestedUrl: string;
  words: number;
  characters: number;
  bytes: number;
  redirects: number;
  /** Server-side duration for the whole scan, in milliseconds. */
  scanMs: number;
  /** True when the result came from the short-lived cache. */
  cached: boolean;
  scannedAt: string;
};

export type ScanFailure = {
  code: string;
  message: string;
};

export class ScanError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ScanError";
    this.code = code;
  }
}

/** Cache key for a scan. Only successful scans are cached. */
function cacheKeyFor(url: string): string {
  return `${WORD_CANONICAL_ORIGIN}/__word/scan-cache/v1/${encodeURIComponent(url)}`;
}

type CacheLike = {
  match: (request: Request) => Promise<Response | undefined>;
  put: (request: Request, response: Response) => Promise<void>;
};

/**
 * The Workers Cache API, when we're running on Workers.
 *
 * Reused rather than adding another binding: `caches.default` needs no
 * configuration. Under `next dev` on Node it isn't there, and scans simply run
 * uncached.
 */
function edgeCache(): CacheLike | null {
  const store = (globalThis as { caches?: { default?: CacheLike } }).caches;
  return store?.default ?? null;
}

async function readCache(url: string): Promise<ScanResult | null> {
  const cache = edgeCache();
  if (!cache) return null;

  try {
    const hit = await cache.match(new Request(cacheKeyFor(url)));
    if (!hit) return null;
    const cached = (await hit.json()) as ScanResult;
    return { ...cached, cached: true };
  } catch {
    return null;
  }
}

async function writeCache(url: string, result: ScanResult): Promise<void> {
  const cache = edgeCache();
  if (!cache) return;

  try {
    await cache.put(
      new Request(cacheKeyFor(url)),
      new Response(JSON.stringify(result), {
        headers: {
          "content-type": "application/json",
          "cache-control": `max-age=${SCAN_CACHE_TTL_SECONDS}`,
        },
      }),
    );
  } catch {
    // A cache miss is never a reason to fail a scan.
  }
}

export type ScanPhase = "validating" | "fetching" | "counting";

/**
 * Fetch and count a page.
 *
 * `onPhase` is called as the scan actually moves between stages, so the UI can
 * report real progress instead of a synthetic animation.
 */
export async function scanUrl(
  input: string,
  options: { onPhase?: (phase: ScanPhase) => void; skipCache?: boolean } = {},
): Promise<ScanResult> {
  const startedAt = Date.now();
  const onPhase = options.onPhase ?? (() => {});

  onPhase("validating");

  let url: URL;
  try {
    url = validateSubmittedUrl(input);
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw new ScanError(error.reason, error.message);
    throw error;
  }

  if (!options.skipCache) {
    const cached = await readCache(url.href);
    if (cached) return cached;
  }

  onPhase("fetching");

  const deadline = createDeadline(FETCH_LIMITS.totalTimeoutMs);
  try {
    const page = await fetchPageHtml(url, deadline.signal);

    onPhase("counting");
    const counted = countHtml(page.html);

    if (counted.empty) {
      throw new ScanError(
        "no-text",
        "We fetched that page but found no readable text in it.",
      );
    }

    const result: ScanResult = {
      url: page.finalUrl,
      shareUrl: shareableUrl(page.finalUrl),
      requestedUrl: url.href,
      words: counted.words,
      characters: counted.characters,
      bytes: page.bytes,
      redirects: page.redirects,
      scanMs: Date.now() - startedAt,
      cached: false,
      scannedAt: new Date().toISOString(),
    };

    await writeCache(url.href, result);
    return result;
  } catch (error) {
    if (error instanceof PageFetchError) throw new ScanError(error.reason, error.message);
    if (error instanceof ScanError) throw error;
    if (error instanceof UnsafeUrlError) throw new ScanError(error.reason, error.message);
    throw new ScanError("unknown", "Something went wrong while counting that page.");
  } finally {
    deadline.release();
  }
}
