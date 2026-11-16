import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "stop invite emails — outship",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

type Params = Promise<{ token?: string | string[]; done?: string | string[] }>;

export default async function InviteOptOutPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const done = params.done === "1";
  return (
    <SiteShell>
      <section className="mx-auto flex max-w-xl flex-col gap-5 px-6 py-24 text-center">
        <h1 className="text-3xl font-medium">{done ? "done. you won't hear from us again." : "stop outship emails?"}</h1>
        <p className="text-text-muted-1">
          {done
            ? "outship won't email this address again. if you ever join, that's your call."
            : "someone you know invited you to outship. outship only ever sends one invite per address, and this stops any email to you."}
        </p>
        {!done && token && (
          <form method="post" action="/api/invites/opt-out" className="flex justify-center">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="rounded-md border border-base-blue bg-base-blue px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              never email me again
            </button>
          </form>
        )}
      </section>
    </SiteShell>
  );
}
