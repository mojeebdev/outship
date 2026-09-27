/**
 * Word — public path helpers.
 *
 * Word's pages live under `/word` internally, but on word.outship.dev the proxy
 * serves them from the root. Links therefore have to be written against the
 * host we're being viewed on: "/" on the subdomain, "/word" during local
 * development. Both sides derive the prefix from the same host header, so
 * server and client markup agree.
 */

import { headers } from "next/headers";

import { WORD_BASE_PATH, isWordHost } from "./constants";

// The host predicates themselves live in ./constants, which stays free of
// server-only imports so the routing rules can be used and tested anywhere.
export { isMainProductionHost, isWordHost } from "./constants";

/** "" on the Word hostname, "/word" everywhere else. */
export type WordBasePath = "" | typeof WORD_BASE_PATH;

/** Read the base path for the current request. Server components only. */
export async function getWordBasePath(): Promise<WordBasePath> {
  const requestHeaders = await headers();
  return isWordHost(requestHeaders.get("host")) ? "" : WORD_BASE_PATH;
}

/**
 * Join a Word-relative path onto a base path.
 *
 * `wordHref(base, "/")` gives "/" on the subdomain and "/word" locally.
 */
export function wordHref(basePath: WordBasePath, path: string): string {
  const suffix = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${suffix}` || "/";
}
