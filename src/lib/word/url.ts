/**
 * Word — URL parsing, normalisation, and SSRF validation.
 *
 * The counting endpoint fetches user-supplied URLs, so every destination has to
 * be vetted before we touch the network, and re-vetted on every redirect hop.
 * Validation happens in two layers:
 *
 *   1. Syntactic: scheme, credentials, port, and obviously-unsafe hostnames.
 *   2. Resolved: the hostname is resolved over DNS-over-HTTPS and *every*
 *      returned address is classified. Literal IPs are classified directly.
 *
 * Known limitation (see docs/word.md): the Workers runtime has no IP-pinned
 * fetch, so there is a small window between validating the resolved addresses
 * and `fetch()` re-resolving the name — a DNS rebinding attacker could swap the
 * answer in between. It is documented rather than silently ignored.
 */

export type UrlRejection =
  | "empty"
  | "unparseable"
  | "scheme"
  | "credentials"
  | "port"
  | "hostname"
  | "private-address"
  | "dns-failed"
  | "dns-unverifiable";

export class UnsafeUrlError extends Error {
  readonly reason: UrlRejection;

  constructor(reason: UrlRejection, message: string) {
    super(message);
    this.name = "UnsafeUrlError";
    this.reason = reason;
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** Standard web ports only. `URL` strips the default port for each scheme. */
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

/** Exact hostnames that never reach the public internet. */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
  "instance-data.ec2.internal",
]);

/** Suffixes reserved for local/internal name resolution. */
const BLOCKED_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".intranet",
  ".private",
  ".corp",
  ".home",
  ".home.arpa",
  ".lan",
  ".test",
  ".invalid",
  ".example",
  ".onion",
  ".ec2.internal",
];

/**
 * Turn whatever someone typed into an absolute URL.
 *
 * A bare domain ("example.com") becomes "https://example.com/" — v1 counts the
 * homepage when no path is given. Nothing here decides whether the URL is
 * *safe*; that is `assertSafeUrl`.
 */
export function parseSubmittedUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new UnsafeUrlError("empty", "Enter a website address first.");
  }

  // Reject control characters and whitespace outright rather than letting the
  // URL parser silently strip them.
  if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new UnsafeUrlError(
      "unparseable",
      "That address contains characters we can't read. Check it and try again.",
    );
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new UnsafeUrlError(
      "unparseable",
      "That doesn't look like a website address. Try something like example.com.",
    );
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError(
      "scheme",
      "Only http and https addresses can be counted.",
    );
  }

  url.hash = "";
  return url;
}

/** Strip the query string and fragment — used for public sharing and listings. */
export function shareableUrl(url: URL | string): string {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.href);
  parsed.search = "";
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  return parsed.href;
}

/** Normalised hostname used as the leaderboard's one-entry-per-site key. */
export function normalizeHostname(url: URL | string): string {
  const parsed = typeof url === "string" ? new URL(url) : url;
  return parsed.hostname.replace(/^www\./, "").toLowerCase();
}

/** True when the URL points at a site's homepage (what the leaderboard ranks). */
export function isHomepage(url: URL | string): boolean {
  const parsed = typeof url === "string" ? new URL(url) : url;
  return parsed.pathname === "/" && !parsed.search;
}

function isIpv4Literal(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function isIpv6Literal(hostname: string): boolean {
  return hostname.startsWith("[") && hostname.endsWith("]");
}

/**
 * Classify an IPv4 address. Anything that isn't globally routable public
 * unicast is blocked: loopback, RFC1918, CGNAT, link-local (which covers cloud
 * metadata at 169.254.169.254), benchmarking, documentation, multicast, and
 * reserved space.
 */
export function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8 "this host on this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24 (docs)
  if (a === 192 && b === 88) return true; // 192.88.99/24 6to4 relay anycast
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51) return true; // 198.51.100/24 documentation
  if (a === 203 && b === 0) return true; // 203.0.113/24 documentation
  if (a >= 224) return true; // multicast, reserved, broadcast

  return false;
}

function expandIpv6(hostname: string): number[] | null {
  const raw = hostname.replace(/^\[/, "").replace(/\]$/, "").split("%")[0];
  const [head, tail] = raw.split("::");
  if (raw.includes("::") && raw.split("::").length > 2) return null;

  const parseGroups = (segment: string | undefined): number[] | null => {
    if (!segment) return [];
    const groups: number[] = [];
    for (const piece of segment.split(":")) {
      if (piece === "") return null;
      if (piece.includes(".")) {
        // Embedded IPv4 tail, e.g. ::ffff:127.0.0.1
        const octets = piece.split(".").map(Number);
        if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
          return null;
        }
        groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
        continue;
      }
      if (!/^[0-9a-fA-F]{1,4}$/.test(piece)) return null;
      groups.push(Number.parseInt(piece, 16));
    }
    return groups;
  };

  const headGroups = parseGroups(head);
  const tailGroups = raw.includes("::") ? parseGroups(tail) : [];
  if (headGroups === null || tailGroups === null) return null;

  if (!raw.includes("::")) {
    return headGroups.length === 8 ? headGroups : null;
  }

  const fill = 8 - headGroups.length - tailGroups.length;
  if (fill < 0) return null;
  return [...headGroups, ...new Array<number>(fill).fill(0), ...tailGroups];
}

/**
 * Classify an IPv6 address. Unspecified, loopback, ULA, link-local, multicast,
 * and documentation space are blocked, and IPv4-mapped / NAT64 / 6to4 / Teredo
 * addresses are unwrapped so an embedded private IPv4 can't slip through.
 */
export function isBlockedIpv6(hostname: string): boolean {
  const groups = expandIpv6(hostname);
  if (!groups) return true;

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const isZero = groups.every((group) => group === 0);
  if (isZero) return true; // ::
  if (groups.slice(0, 7).every((group) => group === 0) && g7 === 1) return true; // ::1

  const ipv4FromGroups = (hi: number, lo: number) =>
    `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

  // ::ffff:0:0/96 IPv4-mapped
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return isBlockedIpv4(ipv4FromGroups(g6, g7));
  }
  // 64:ff9b::/96 NAT64
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedIpv4(ipv4FromGroups(g6, g7));
  }
  // 2002::/16 6to4 tunnels an arbitrary IPv4 destination; blocked wholesale.
  if (g0 === 0x2002) return true;
  if (g0 === 0x2001 && g1 === 0) return true; // Teredo
  if (g0 === 0x2001 && g1 === 0xdb8) return true; // documentation
  if (g0 === 0x100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // discard-only
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  return false;
}

/** Syntactic checks that need no network access. */
export function assertSafeUrlSyntax(url: URL): void {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError("scheme", "Only http and https addresses can be counted.");
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError(
      "credentials",
      "Addresses with a username or password in them aren't allowed.",
    );
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    throw new UnsafeUrlError("port", "Only standard web ports (80, 443, 8080, 8443) are allowed.");
  }

  const hostname = url.hostname.toLowerCase();

  if (!hostname) {
    throw new UnsafeUrlError("hostname", "That address has no hostname.");
  }

  if (isIpv6Literal(hostname)) {
    if (isBlockedIpv6(hostname)) {
      throw new UnsafeUrlError(
        "private-address",
        "That address points somewhere private, so we can't scan it.",
      );
    }
    return;
  }

  if (isIpv4Literal(hostname)) {
    if (isBlockedIpv4(hostname)) {
      throw new UnsafeUrlError(
        "private-address",
        "That address points somewhere private, so we can't scan it.",
      );
    }
    return;
  }

  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_SUFFIXES.some((s) => hostname.endsWith(s))) {
    throw new UnsafeUrlError(
      "hostname",
      "That address points somewhere private, so we can't scan it.",
    );
  }

  // A public site always has a dot in its name. This also rejects single-label
  // intranet names that would resolve against a local search domain.
  if (!hostname.includes(".")) {
    throw new UnsafeUrlError(
      "hostname",
      "Use a full domain name, like example.com.",
    );
  }

  if (hostname.endsWith(".")) {
    // Trailing dots bypass naive suffix checks; normalise and re-check.
    const stripped = hostname.replace(/\.+$/, "");
    if (
      !stripped.includes(".") ||
      BLOCKED_HOSTNAMES.has(stripped) ||
      BLOCKED_SUFFIXES.some((s) => stripped.endsWith(s))
    ) {
      throw new UnsafeUrlError(
        "hostname",
        "That address points somewhere private, so we can't scan it.",
      );
    }
  }
}

type DnsAnswer = { name: string; type: number; data: string };

const DNS_A = 1;
const DNS_AAAA = 28;

async function resolveOverHttps(
  hostname: string,
  type: "A" | "AAAA",
  signal: AbortSignal,
): Promise<DnsAnswer[]> {
  const resolver = process.env.WORD_DNS_RESOLVER ?? "https://cloudflare-dns.com/dns-query";
  const endpoint = new URL(resolver);
  endpoint.searchParams.set("name", hostname);
  endpoint.searchParams.set("type", type);

  const response = await fetch(endpoint, {
    headers: { accept: "application/dns-json" },
    signal,
  });

  if (!response.ok) {
    throw new UnsafeUrlError(
      "dns-unverifiable",
      "We couldn't verify where that address points. Try again in a moment.",
    );
  }

  const payload = (await response.json()) as { Status?: number; Answer?: DnsAnswer[] };

  // NXDOMAIN (3) is a real answer: the name simply doesn't exist.
  if (payload.Status === 3) return [];
  if (typeof payload.Status === "number" && payload.Status !== 0) {
    throw new UnsafeUrlError(
      "dns-unverifiable",
      "We couldn't verify where that address points. Try again in a moment.",
    );
  }

  return payload.Answer ?? [];
}

/**
 * Resolve a hostname and confirm every returned address is public.
 *
 * Returns the resolved addresses so callers can log or surface them. Throws
 * `UnsafeUrlError` if the name doesn't resolve, resolves to anything private,
 * or can't be resolved at all (we fail closed).
 */
export async function assertResolvesToPublicAddress(
  hostname: string,
  signal: AbortSignal,
): Promise<string[]> {
  if (isIpv4Literal(hostname) || isIpv6Literal(hostname)) return [hostname];

  let answers: DnsAnswer[];
  try {
    const [a, aaaa] = await Promise.all([
      resolveOverHttps(hostname, "A", signal),
      resolveOverHttps(hostname, "AAAA", signal),
    ]);
    answers = [...a, ...aaaa];
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw error;
    throw new UnsafeUrlError(
      "dns-unverifiable",
      "We couldn't verify where that address points. Try again in a moment.",
    );
  }

  const addresses = answers
    .filter((answer) => answer.type === DNS_A || answer.type === DNS_AAAA)
    .map((answer) => answer.data.trim());

  if (addresses.length === 0) {
    throw new UnsafeUrlError("dns-failed", "That domain doesn't resolve to a server we can reach.");
  }

  for (const address of addresses) {
    const blocked = address.includes(":")
      ? isBlockedIpv6(`[${address}]`)
      : isBlockedIpv4(address);
    if (blocked) {
      throw new UnsafeUrlError(
        "private-address",
        "That address resolves to a private network, so we can't scan it.",
      );
    }
  }

  return addresses;
}

/** Full validation: syntax first, then resolved destination. */
export async function assertSafeUrl(url: URL, signal: AbortSignal): Promise<void> {
  assertSafeUrlSyntax(url);
  await assertResolvesToPublicAddress(url.hostname.toLowerCase(), signal);
}

/**
 * Parse and syntactically validate submitted input in one step.
 *
 * Callers use this so an unsafe address is reported with a precise reason
 * before any network call. `fetchPageHtml` re-runs the same checks (plus DNS)
 * on every hop regardless — this is a fast path, not the security boundary.
 */
export function validateSubmittedUrl(input: string): URL {
  const url = parseSubmittedUrl(input);
  assertSafeUrlSyntax(url);
  return url;
}
