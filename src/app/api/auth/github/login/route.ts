import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authErrorPage } from "@/lib/auth/error-page";
import { REF_COOKIE, validRef } from "@/lib/invites";
import { SIGNUP_SOURCE_COOKIE, signupSourceFromReferer } from "@/lib/ai-referral";

export const dynamic = "force-dynamic";

const OAUTH_STATE_COOKIE = "outship_oauth_state";

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.GITHUB_APP_CLIENT_ID) {
    console.error("auth login: GITHUB_APP_CLIENT_ID is missing");
    return authErrorPage({
      title: "sign-in isn't available right now",
      message: "outship's github sign-in isn't set up on this server yet. please try again later.",
      status: 501,
      retry: false,
    });
  }

  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/auth/github/callback", request.url).toString();

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", env.GITHUB_APP_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const headers = new Headers();
  headers.set("Location", authorizeUrl.toString());
  headers.append(
    "Set-Cookie",
    `${OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );

  // An invite's join link: remember who invited them through the sign-in, so
  // the callback can record it (Builder.referredById) for a new builder.
  const ref = validRef(new URL(request.url).searchParams.get("ref"));
  if (ref) {
    headers.append("Set-Cookie", `${REF_COOKIE}=${ref}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  }

  // Signing in straight from a page reached through an AI assistant (?ref=ai or an AI utm_source on that page):
  // carry the source name through the sign-in so the callback can count the sign-up (src/lib/ai-referral.ts).
  const aiSource = signupSourceFromReferer(request.headers.get("referer"), new URL(request.url).hostname);
  if (aiSource) {
    headers.append("Set-Cookie", `${SIGNUP_SOURCE_COOKIE}=${aiSource}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  }

  return new Response(null, { status: 302, headers });
}
