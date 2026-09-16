import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { IconGithub, IconX } from "@/components/icons";

export const metadata: Metadata = {
  title: "contact — outship",
};

export default function ContactPage() {
  return (
    <SiteShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-20">
        <h1 className="text-3xl font-medium sm:text-4xl">contact</h1>
        <p className="text-text-muted-1">
          outship is early — the fastest way to reach us right now is
          github or x. email support opens once the domain&apos;s mail
          routing is wired up.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="https://github.com/mojeebdev/outship"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-cream"
          >
            <IconGithub className="h-4 w-4" />
            github
          </a>
          <a
            href="https://x.com/outshipdev"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-cream"
          >
            <IconX className="h-4 w-4" />
            x
          </a>
        </div>
      </div>
    </SiteShell>
  );
}
