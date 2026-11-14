export const dynamic = "force-dynamic";

// The GitHub App's "Setup URL": GitHub sends people here after they install
// or reconfigure the App. The installation_id GitHub appends is deliberately
// ignored, since anyone can edit a URL; instead this goes back through sign-in,
// whose callback asks GitHub which installations the user can actually see.
export function GET(request: Request) {
  return Response.redirect(new URL("/api/auth/github/login", request.url), 302);
}
