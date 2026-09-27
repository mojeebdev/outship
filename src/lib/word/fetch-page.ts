/**
 * Word — safe server-side page fetching.
 *
 * Every hop is validated before the request goes out (see ./url.ts), the
 * response has to be HTML, and the download is capped by time and by bytes.
 * Nothing from the visitor's request is forwarded: no cookies, no
 * authorization, no client headers. The HTML is never returned to the browser,
 * only counted.
 */

import { FETCH_LIMITS, WORD_USER_AGENT } from "./constants";
import { combineSignals, createDeadline, isAbortLike } from "./signals";
import { UnsafeUrlError, assertSafeUrl, type UrlRejection } from "./url";

export type FetchFailure =
  | "unsafe-url"
  | "unreachable"
  | "timeout"
  | "http-error"
  | "too-many-redirects"
  | "unsupported-content-type"
  | "too-large";

export class PageFetchError extends Error {
  /** Why the fetch failed. URL rejections keep their own, more precise reason. */
  readonly reason: FetchFailure | UrlRejection;
  readonly status?: number;

  constructor(reason: FetchFailure | UrlRejection, message: string, status?: number) {
    super(message);
    this.name = "PageFetchError";
    this.reason = reason;
    this.status = status;
  }
}

export type FetchedPage = {
  /** The URL that actually served the HTML, after redirects. */
  finalUrl: string;
  html: string;
  bytes: number;
  contentType: string;
  /** Redirect hops followed to get here. */
  redirects: number;
  fetchMs: number;
};

const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

function parseContentType(header: string | null): { mime: string; charset?: string } {
  if (!header) return { mime: "" };
  const [mime, ...params] = header.split(";");
  const charsetParam = params
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith("charset="));

  return {
    mime: mime.trim().toLowerCase(),
    charset: charsetParam?.slice("charset=".length).trim().replace(/^["']|["']$/g, ""),
  };
}

function decodeBody(bytes: Uint8Array, charset: string | undefined): string {
  // Fall back to UTF-8 for missing or unknown labels rather than failing the
  // scan; TextDecoder throws on labels it doesn't recognise.
  for (const label of [charset, "utf-8"]) {
    if (!label) continue;
    try {
      return new TextDecoder(label, { fatal: false }).decode(bytes);
    } catch {
      continue;
    }
  }
  return new TextDecoder().decode(bytes);
}

async function readCappedBody(
  response: Response,
  maxBytes: number,
  deadlineSignal: AbortSignal,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PageFetchError(
      "too-large",
      `That page is larger than our ${Math.round(maxBytes / 1_000_000)}MB limit.`,
    );
  }

  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      if (deadlineSignal.aborted) {
        throw new PageFetchError("timeout", "That page took too long to respond.");
      }

      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        throw new PageFetchError(
          "too-large",
          `That page is larger than our ${Math.round(maxBytes / 1_000_000)}MB limit.`,
        );
      }
      chunks.push(value);
    }
  } finally {
    // Release the connection whether we finished or bailed out early.
    await reader.cancel().catch(() => {});
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Fetch a page's HTML, following (and re-validating) a limited number of
 * redirects.
 *
 * @param url A URL that has already been parsed by `parseSubmittedUrl`.
 * @param deadlineSignal Aborts the whole scan when the total budget runs out.
 */
export async function fetchPageHtml(url: URL, deadlineSignal: AbortSignal): Promise<FetchedPage> {
  const startedAt = Date.now();
  let current = new URL(url.href);
  let redirects = 0;

  for (;;) {
    try {
      await assertSafeUrl(current, deadlineSignal);
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        // Keep the specific reason ("private-address", "dns-unverifiable", …)
        // so API consumers can tell these cases apart.
        throw new PageFetchError(error.reason, error.message);
      }
      throw error;
    }

    const hopTimeout = createDeadline(FETCH_LIMITS.requestTimeoutMs);
    const hop = combineSignals(deadlineSignal, hopTimeout.signal);

    let response: Response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: hop.signal,
        // A deliberately minimal header set. Nothing from the visitor's
        // request is passed along.
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-language": "en",
          "user-agent": WORD_USER_AGENT,
        },
      });
    } catch (error) {
      if (deadlineSignal.aborted || hopTimeout.expired() || isAbortLike(error)) {
        throw new PageFetchError("timeout", "That page took too long to respond.");
      }
      throw new PageFetchError("unreachable", "We couldn't reach that page.");
    } finally {
      hop.release();
      hopTimeout.release();
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new PageFetchError("http-error", "That page redirected us nowhere.", response.status);
      }

      if (redirects >= FETCH_LIMITS.maxRedirects) {
        throw new PageFetchError("too-many-redirects", "That page redirects too many times.");
      }

      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new PageFetchError("http-error", "That page redirected somewhere we can't read.");
      }

      next.hash = "";
      redirects += 1;
      current = next;
      // Loop round: the new destination is validated from scratch at the top.
      continue;
    }

    if (!response.ok) {
      throw new PageFetchError(
        "http-error",
        `That page returned HTTP ${response.status}.`,
        response.status,
      );
    }

    const { mime, charset } = parseContentType(response.headers.get("content-type"));
    if (!HTML_CONTENT_TYPES.includes(mime)) {
      throw new PageFetchError(
        "unsupported-content-type",
        mime
          ? `We can only count HTML pages — that address served ${mime}.`
          : "That address didn't say it was HTML, so we didn't count it.",
      );
    }

    const bytes = await readCappedBody(response, FETCH_LIMITS.maxBytes, deadlineSignal);

    return {
      finalUrl: current.href,
      html: decodeBody(bytes, charset),
      bytes: bytes.byteLength,
      contentType: mime,
      redirects,
      fetchMs: Date.now() - startedAt,
    };
  }
}
