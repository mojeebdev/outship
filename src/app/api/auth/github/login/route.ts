import { getCloudflareContext } from "@opennextjs/cloudflare";
import { authErrorPage } from "@/lib/auth/error-page";

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

  return new Response(null, { status: 302, headers });
}
