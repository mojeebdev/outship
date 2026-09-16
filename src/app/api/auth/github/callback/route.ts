import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { createSessionCookieValue, readCookie, sessionCookieHeader } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const OAUTH_STATE_COOKIE = "outship_oauth_state";

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.GITHUB_APP_CLIENT_ID || !env.GITHUB_APP_CLIENT_SECRET || !env.SESSION_SECRET) {
    return new Response(
      "GitHub App isn't configured yet — set GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, and SESSION_SECRET.",
      { status: 501 },
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request.headers.get("cookie"), OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return new Response("Invalid OAuth state — try connecting again.", { status: 400 });
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_APP_CLIENT_ID,
      client_secret: env.GITHUB_APP_CLIENT_SECRET,
      code,
      redirect_uri: new URL("/api/auth/github/callback", request.url).toString(),
    }),
  });
  const tokenData = (await tokenResponse.json()) as {
    access_token?: string;
    error_description?: string;
  };
  if (!tokenData.access_token) {
    return new Response(
      `GitHub sign-in failed: ${tokenData.error_description ?? "unknown error"}`,
      { status: 400 },
    );
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "outship",
    },
  });
  if (!userResponse.ok) {
    return new Response("Couldn't read your GitHub profile — try again.", { status: 400 });
  }
  const user = (await userResponse.json()) as { id: number; login: string };

  const db = await getDb();
  const builder = await db.builder.upsert({
    where: { githubId: user.id },
    update: { githubLogin: user.login },
    create: { githubId: user.id, githubLogin: user.login },
  });

  const sessionValue = await createSessionCookieValue(builder.id, env.SESSION_SECRET);

  const headers = new Headers();
  headers.set(
    "Location",
    new URL(`/@${builder.githubLogin}`, request.url).toString(),
  );
  headers.append("Set-Cookie", sessionCookieHeader(sessionValue));
  headers.append(
    "Set-Cookie",
    `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  );

  return new Response(null, { status: 302, headers });
}
