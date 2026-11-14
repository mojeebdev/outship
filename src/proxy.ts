/**
 * Hostname routing for this app.
 *
 * outship.dev keeps serving everything exactly as before, except `/word`,
 * which now redirects to Word's canonical home. word.outship.dev is mapped
 * onto the `/word` subtree so Word's pages are served from the root of its own
 * hostname while the public URL stays on word.outship.dev.
 *
 * The rules themselves live in `@/lib/word/routing` so they can be tested
 * without a request object; this file only translates a decision into a
 * response.
 *
 * Next.js 16 renamed `middleware` to `proxy`; see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 */

import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { SIGNED_IN_HINT_COOKIE, SIGNED_IN_HINT_MAX_AGE_SECONDS } from "@/lib/auth/signed-in-hint";
import { decideRoute } from "@/lib/word/routing";

export const config = {
  /**
   * Pages only. API routes (including `/api/word/count` and the share-card
   * endpoint), Next.js internals and anything that looks like a static file
   * are left untouched, so assets and endpoints resolve identically on both
   * hostnames.
   */
  matcher: ["/((?!api/|_next/|_vercel/|.*\\.[^/]+$).*)"],
};

/**
 * Keeps the navbar's readable "signed in" hint in step with the HttpOnly
 * session cookie: set while a session cookie is present, cleared once it's
 * gone (logout or expiry). It only decides which nav link to show; every page
 * that needs a builder still verifies the session itself.
 */
function syncSignedInHint(request: NextRequest, response: NextResponse): NextResponse {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const hasHint = request.cookies.has(SIGNED_IN_HINT_COOKIE);
  if (hasSession && !hasHint) {
    response.cookies.set(SIGNED_IN_HINT_COOKIE, "1", {
      path: "/",
      secure: true,
      sameSite: "lax",
      maxAge: SIGNED_IN_HINT_MAX_AGE_SECONDS,
    });
  } else if (!hasSession && hasHint) {
    response.cookies.set(SIGNED_IN_HINT_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}

export function proxy(request: NextRequest) {
  return syncSignedInHint(request, route(request));
}

function route(request: NextRequest): NextResponse {
  const decision = decideRoute(
    request.headers.get("host"),
    request.nextUrl.pathname,
    request.nextUrl.search,
  );

  switch (decision.kind) {
    case "redirect":
      // A relative location resolves against the current host; an absolute one
      // (the cross-hostname case) is used as-is.
      return NextResponse.redirect(new URL(decision.location, request.url), decision.status);

    case "rewrite": {
      const rewritten = request.nextUrl.clone();
      rewritten.pathname = decision.pathname;
      return NextResponse.rewrite(rewritten);
    }

    default:
      return NextResponse.next();
  }
}
