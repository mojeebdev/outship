/**
 * Word — shared constants.
 *
 * Word is a sibling product to outship that lives on its own hostname
 * (word.outship.dev) but ships from this same Next.js app. Pages live under
 * `/word` in the App Router; `src/proxy.ts` rewrites the Word hostname onto
 * that prefix while keeping the public URL clean.
 */

/** Internal route prefix for every Word page. */
export const WORD_BASE_PATH = "/word";

/** Production hostname. Also the canonical origin for metadata and sharing. */
export const WORD_CANONICAL_HOST = "word.outship.dev";

export const WORD_CANONICAL_ORIGIN = `https://${WORD_CANONICAL_HOST}`;

/**
 * Hostnames that should serve Word at the root. Extra hosts (a preview
 * deployment, say) can be added at runtime with the `WORD_HOSTS` variable as a
 * comma-separated list — no code change needed.
 */
export function wordHosts(): string[] {
  const extra = (process.env.WORD_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return [WORD_CANONICAL_HOST, ...extra];
}

/**
 * The main site's production hostnames.
 *
 * Word is canonical at word.outship.dev, so `/word` on these hosts is
 * permanently redirected there. Anywhere else — local development, a preview
 * deployment — `/word` keeps serving directly, which is what makes it usable
 * without a subdomain. Extra hosts can be added with `MAIN_HOSTS`.
 */
export const MAIN_PRODUCTION_HOST = "outship.dev";

export function mainProductionHosts(): string[] {
  const extra = (process.env.MAIN_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return [MAIN_PRODUCTION_HOST, `www.${MAIN_PRODUCTION_HOST}`, ...extra];
}

/** Compare a `Host` header, with or without a port, against a host list. */
function hostMatches(hostHeader: string | null | undefined, hosts: string[]): boolean {
  if (!hostHeader) return false;
  const hostname = hostHeader.split(":")[0]!.trim().toLowerCase();
  return hosts.includes(hostname);
}

/** True when this request arrived on a hostname that serves Word at the root. */
export function isWordHost(hostHeader: string | null | undefined): boolean {
  return hostMatches(hostHeader, wordHosts());
}

/** True when this request arrived on the main site's production hostname. */
export function isMainProductionHost(hostHeader: string | null | undefined): boolean {
  return hostMatches(hostHeader, mainProductionHosts());
}

/** Safety and cost limits for the page-fetching endpoint. */
export const FETCH_LIMITS = {
  /** Redirect hops we are willing to follow. Each hop is re-validated. */
  maxRedirects: 3,
  /** Hard cap on downloaded HTML. Larger pages are rejected, not truncated. */
  maxBytes: 2_000_000,
  /** Per-hop network timeout. */
  requestTimeoutMs: 6_000,
  /** Budget for the whole scan: DNS checks, every hop, and the download. */
  totalTimeoutMs: 10_000,
} as const;

/** Per-IP rate limits for `/api/word/count` and leaderboard opt-in. */
export const RATE_LIMITS = [
  { name: "minute", windowSeconds: 60, max: 10 },
  { name: "hour", windowSeconds: 3_600, max: 100 },
] as const;

/** How long a successful scan is reused before we refetch the page. */
export const SCAN_CACHE_TTL_SECONDS = 300;

/** Sent on outbound fetches so site owners can identify us. */
export const WORD_USER_AGENT = `WordBot/1.0 (+${WORD_CANONICAL_ORIGIN}; word counter)`;
