import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { createSessionCookieValue, readCookie, sessionCookieHeader } from "@/lib/auth/session";
import { fetchPrimaryEmail, fetchUserInstallationId } from "@/lib/github-app";
import { FROM_WELCOME, sendEmail } from "@/lib/email/send";
import { builderWelcomeEmail } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

const OAUTH_STATE_COOKIE = "outship_oauth_state";

type GithubUser = {
  id: number;
  login: string;
  email?: string | null;
  name?: string | null;
  bio?: string | null;
  location?: string | null;
  blog?: string | null;
  twitter_username?: string | null;
};

// Public profile fields, refreshed on every sign-in so an edit on GitHub
// shows up here the next time. Trimmed and length-capped: they're shown on
// public pages and GitHub's own limits are generous.
function profileFields(user: GithubUser) {
  const clean = (value: string | null | undefined, max: number) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed.slice(0, max) : null;
  };
  return {
    name: clean(user.name, 100),
    bio: clean(user.bio, 300),
    location: clean(user.location, 100),
    blog: clean(user.blog, 200),
    twitterUsername: clean(user.twitter_username, 40),
  };
}

export async function GET(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
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
  const user = (await userResponse.json()) as GithubUser;

  const [installationId, email] = await Promise.all([
    fetchUserInstallationId(tokenData.access_token, user.id),
    fetchPrimaryEmail(tokenData.access_token, user.email),
  ]);

  const db = await getDb();
  const profile = profileFields(user);
  let builder = await db.builder.upsert({
    where: { githubId: user.id },
    // undefined (GitHub didn't answer) leaves the stored value as it was.
    update: { githubLogin: user.login, installationId, ...(email ? { email } : {}), ...profile },
    create: {
      githubId: user.id,
      githubLogin: user.login,
      installationId: installationId ?? null,
      email,
      claimedAt: new Date(),
      ...profile,
    },
  });

  // A profile the webhook created before they ever signed in: this sign-in
  // claims it. Only the first time, so claimedAt keeps its meaning.
  if (!builder.claimedAt) {
    await db.builder.updateMany({ where: { id: builder.id, claimedAt: null }, data: { claimedAt: new Date() } });
    builder = { ...builder, claimedAt: new Date() };
  }

  // First sign-in with a known email: welcome them, once. Claiming welcomedAt
  // before sending means two simultaneous sign-ins can't both send it, and
  // waitUntil keeps email off the redirect's critical path.
  if (builder.email && !builder.welcomedAt) {
    const { count } = await db.builder.updateMany({
      where: { id: builder.id, welcomedAt: null },
      data: { welcomedAt: new Date() },
    });
    if (count === 1) {
      ctx.waitUntil(
        sendEmail(env.EMAIL, {
          to: builder.email,
          from: FROM_WELCOME,
          email: builderWelcomeEmail({ login: builder.githubLogin, appInstalled: Boolean(builder.installationId) }),
        }),
      );
    }
  }

  const sessionValue = await createSessionCookieValue(builder.id, env.SESSION_SECRET);

  const headers = new Headers();
  headers.set("Location", new URL("/profile", request.url).toString());
  headers.append("Set-Cookie", sessionCookieHeader(sessionValue));
  headers.append(
    "Set-Cookie",
    `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
  );

  return new Response(null, { status: 302, headers });
}
