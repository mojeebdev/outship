/**
 * Hostname routing decisions for Word.
 *
 * Pure logic, separated from `src/proxy.ts` so the rules can be tested
 * directly rather than through a request object. Three hostnames matter:
 *
 *   word.outship.dev  Word's canonical home. Serves Word from the root; the
 *                     internal `/word` prefix is redirected away.
 *   outship.dev       The main site. `/word` and `/word/*` are permanently
 *                     redirected to the canonical home.
 *   anything else     Untouched, so `/word` keeps working in local
 *                     development and on preview deployments.
 */

import {
  WORD_BASE_PATH,
  WORD_CANONICAL_ORIGIN,
  isMainProductionHost,
  isWordHost,
} from "./constants";

export type RouteDecision =
  /** Leave the request alone. */
  | { kind: "pass" }
  /** Serve a different path without changing the URL in the browser. */
  | { kind: "rewrite"; pathname: string }
  /** Send the visitor somewhere else. `location` may be relative or absolute. */
  | { kind: "redirect"; location: string; status: 308 };

/**
 * True for `/word` and `/word/...`, false for `/wordpress`.
 *
 * The exact-match-or-slash test is the whole point: a `startsWith("/word")`
 * would also capture `/wordpress`, `/words` and `/wordle`.
 */
export function isWordPath(pathname: string): boolean {
  return pathname === WORD_BASE_PATH || pathname.startsWith(`${WORD_BASE_PATH}/`);
}

/** `/word/result/abc` -> `/result/abc`, `/word` -> `/`. */
export function stripWordPrefix(pathname: string): string {
  return pathname.slice(WORD_BASE_PATH.length) || "/";
}

/**
 * Decide what to do with a request.
 *
 * @param host   The `Host` header, port included or not.
 * @param pathname Path only, no query string.
 * @param search Query string including the leading `?`, or empty.
 */
export function decideRoute(
  host: string | null | undefined,
  pathname: string,
  search = "",
): RouteDecision {
  if (isWordHost(host)) {
    // `/word` is the internal prefix, not a public path here. Redirecting
    // rather than rewriting keeps one canonical URL per page and makes a
    // doubled `/word/word` prefix impossible.
    if (isWordPath(pathname)) {
      return { kind: "redirect", location: `${stripWordPrefix(pathname)}${search}`, status: 308 };
    }

    // Rewrite once. The proxy runs a single time per request, so this cannot
    // loop, and the browser keeps showing the word.outship.dev URL.
    return {
      kind: "rewrite",
      pathname: pathname === "/" ? WORD_BASE_PATH : `${WORD_BASE_PATH}${pathname}`,
    };
  }

  // On the main site, Word lives at its own hostname. Send visitors there and
  // let search engines collapse the two addresses into one.
  if (isMainProductionHost(host) && isWordPath(pathname)) {
    return {
      kind: "redirect",
      location: `${WORD_CANONICAL_ORIGIN}${stripWordPrefix(pathname)}${search}`,
      status: 308,
    };
  }

  return { kind: "pass" };
}
