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

import { WORD_BASE_PATH, wordHosts } from "./constants";

/** "" on the Word hostname, "/word" everywhere else. */
export type WordBasePath = "" | typeof WORD_BASE_PATH;

/** True when this request arrived on a hostname that serves Word at the root. */
export function isWordHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return false;
  const hostname = hostHeader.split(":")[0]!.trim().toLowerCase();
  return wordHosts().includes(hostname);
}

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
