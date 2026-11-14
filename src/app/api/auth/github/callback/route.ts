import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { authErrorPage } from "@/lib/auth/error-page";
import { createSessionCookieValue, readCookie, sessionCookieHeader } from "@/lib/auth/session";
import { fetchPrimaryEmail, fetchUserInstallationId } from "@/lib/github-app";
import { FROM_WELCOME, sendEmail } from "@/lib/email/send";
import { builderWelcomeEmail } from "@/lib/email/templates";
import { importContributionHistory, shouldSyncHistory } from "@/lib/history";

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
  try {
    return await signIn(request);
  } catch (error) {
    // A network failure talking to GitHub, or D1 hiccuping: still a page.
    console.error("auth callback failed", error);
    return authErrorPage({
      title: "sign-in hit a snag",
      message: "something went wrong on our side while signing you in. nothing was half-saved; try again.",
      status: 500,
    });
  }
}

async function signIn(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  if (!env.GITHUB_APP_CLIENT_ID || !env.GITHUB_APP_CLIENT_SECRET || !env.SESSION_SECRET) {
    console.error("auth callback: GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET or SESSION_SECRET is missing");
    return authErrorPage({
      title: "sign-in isn't available right now",
      message: "outship's github sign-in isn't set up on this server yet. nothing was saved. please try again later.",
      status: 501,
      retry: false,
    });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = readCookie(request.headers.get("cookie"), OAUTH_STATE_COOKIE);

  if (url.searchParams.get("error") === "access_denied") {
    return authErrorPage({
      title: "sign-in cancelled",
      message: "you cancelled on github, so nothing was connected. you can sign in whenever you like.",
      status: 400,
    });
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return authErrorPage({
      title: "that sign-in link expired",
      message: "sign-in links last ten minutes and only work in the browser that started them. start again and it'll go through.",
      status: 400,
    });
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
  const tokenData = (await tokenResponse.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
  };
  if (!tokenData.access_token) {
    console.warn(`auth callback: token exchange failed: ${tokenData.error_description ?? tokenResponse.status}`);
    return authErrorPage({
      title: "github didn't finish the sign-in",
      message: "github turned down the sign-in code, usually because it was already used or took too long. start again and it'll go through.",
      status: 400,
    });
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "outship",
    },
  });
  if (!userResponse.ok) {
    return authErrorPage({
      title: "couldn't read your github profile",
      message: "github didn't answer when outship asked who you are. that's usually brief; try again in a moment.",
      status: 502,
    });
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

  // A year of GitHub history, so the profile doesn't start blank. Off the
  // redirect's critical path; the token is used for this one call and dropped
  // with the request. At most once a day. Never part of score.
  if (shouldSyncHistory(builder.historySyncedAt)) {
    ctx.waitUntil(
      importContributionHistory(env.DB, builder.id, tokenData.access_token).catch((error) =>
        console.warn("history import failed", error),
      ),
    );
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
