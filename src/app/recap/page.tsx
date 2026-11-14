import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { getDb } from "@/lib/db";
import { subscriberState, type TokenState } from "@/lib/email/subscribers";

export const metadata: Metadata = {
  title: "weekly ship recap — outship",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const MESSAGES: Record<TokenState, { title: string; body: string }> = {
  confirmed: {
    title: "you're on the list",
    body: "the weekly ship recap lands every monday. every issue has a one-click unsubscribe.",
  },
  unsubscribed: {
    title: "you're unsubscribed",
    body: "no more recaps. changed your mind? sign up again from the bottom of any page.",
  },
  pending: {
    title: "check your inbox",
    body: "we sent a confirmation link. the recap starts once you confirm.",
  },
  invalid: {
    title: "that link doesn't work",
    body: "it may be mistyped or from an old email. you can sign up again from the bottom of any page.",
  },
};

function TokenForm({ action, token, label }: { action: string; token: string; label: string }) {
  return (
    <form method="post" action={action}>
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        className="rounded-md border border-base-blue bg-base-blue px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
      >
        {label}
      </button>
    </form>
  );
}

export default async function RecapPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string; unsubscribe?: string; status?: string }>;
}) {
  const { confirm, unsubscribe, status } = await searchParams;

  let title: string;
  let body: string;
  let action: React.ReactNode = null;

  if (confirm) {
    const state = await subscriberState(await getDb(), confirm);
    if (state === "pending") {
      title = "confirm your weekly ship recap";
      body = "one click and you're in. the first recap lands next monday.";
      action = <TokenForm action="/api/recap/confirm" token={confirm} label="confirm my email" />;
    } else {
      ({ title, body } = MESSAGES[state]);
    }
  } else if (unsubscribe) {
    const state = await subscriberState(await getDb(), unsubscribe);
    if (state === "pending" || state === "confirmed") {
      title = "unsubscribe from the weekly ship recap?";
      body = "you'll stop getting the recap. nothing else changes.";
      action = <TokenForm action="/api/recap/unsubscribe" token={unsubscribe} label="unsubscribe" />;
    } else {
      ({ title, body } = MESSAGES[state]);
    }
  } else {
    const state = (status && status in MESSAGES ? status : "invalid") as TokenState;
    ({ title, body } = MESSAGES[state]);
  }

  return (
    <SiteShell>
      <section className="mx-auto flex max-w-xl flex-col items-start gap-5 px-6 py-24">
        <h1 className="text-3xl font-medium">{title}</h1>
        <p className="text-text-muted-1">{body}</p>
        {action}
        <Link href="/" className="text-sm text-base-blue hover:underline">
          back to outship
        </Link>
      </section>
    </SiteShell>
  );
}
