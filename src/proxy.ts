/**
 * Hostname routing for this app.
 *
 * outship.dev keeps serving everything exactly as before. word.outship.dev is
 * mapped onto the `/word` subtree so Word's pages are served from the root of
 * its own hostname while the public URL stays on word.outship.dev.
 *
 * Next.js 16 renamed `middleware` to `proxy`; see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 */

import { NextResponse, type NextRequest } from "next/server";

import { WORD_BASE_PATH } from "@/lib/word/constants";
import { isWordHost } from "@/lib/word/paths";

export const config = {
  /**
   * Pages only. API routes (including `/api/word/count`), Next.js internals and
   * anything that looks like a static file are left untouched, so assets and
   * endpoints resolve identically on both hostnames.
   */
  matcher: ["/((?!api/|_next/|_vercel/|.*\\.[^/]+$).*)"],
};

export function proxy(request: NextRequest) {
  if (!isWordHost(request.headers.get("host"))) {
    // outship.dev and local development: unchanged routing.
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // `/word` is the internal prefix, not a public path on this hostname. Redirect
  // rather than rewrite so there is one canonical URL per page and no chance of
  // a doubled `/word/word` prefix.
  if (pathname === WORD_BASE_PATH || pathname.startsWith(`${WORD_BASE_PATH}/`)) {
    const canonical = request.nextUrl.clone();
    canonical.pathname = pathname.slice(WORD_BASE_PATH.length) || "/";
    return NextResponse.redirect(canonical, 308);
  }

  // Rewrite once, to the same path under `/word`. `clone()` keeps the query
  // string; the browser keeps showing the word.outship.dev URL.
  const rewritten = request.nextUrl.clone();
  rewritten.pathname = pathname === "/" ? WORD_BASE_PATH : `${WORD_BASE_PATH}${pathname}`;

  return NextResponse.rewrite(rewritten);
}
