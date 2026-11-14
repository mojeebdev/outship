import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { CopyButton } from "@/components/copy-button";
import { IconArrowUpRight } from "@/components/icons";
import { TOKEN_ADDRESS, basescanTokenUrl, clankerTokenUrl, isTokenLive } from "@/lib/token";
import { DISCLOSURE, FEE_RECIPIENTS, TOKEN_NAME, TOKEN_SYMBOL } from "@/lib/token-disclosure";

export const metadata: Metadata = {
  title: "token — outship",
};

const link = "inline-flex items-center gap-1 text-base-blue hover:underline";

export default function TokenPage() {
  // Built without NEXT_PUBLIC_TOKEN_ADDRESS, this page doesn't exist.
  if (!isTokenLive()) notFound();

  return (
    <SiteShell>
      <article className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-20 leading-relaxed">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium sm:text-4xl">
            {TOKEN_NAME} <span className="text-text-muted-1">({TOKEN_SYMBOL})</span>
          </h1>
          <p className="font-medium text-base-blue">{DISCLOSURE.noScore}</p>
        </div>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-medium">contract address on base</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-cream px-3 py-2 text-xs">
              {TOKEN_ADDRESS}
            </code>
            <CopyButton text={TOKEN_ADDRESS} label="copy address" />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <a href={basescanTokenUrl(TOKEN_ADDRESS)} target="_blank" rel="noopener noreferrer" className={link}>
              basescan
              <IconArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a href={clankerTokenUrl(TOKEN_ADDRESS)} target="_blank" rel="noopener noreferrer" className={link}>
              clanker
              <IconArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
          <p className="text-xs text-text-muted-2">
            check the address here before trusting any other. outship never asks you to send it funds.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">what it is</h2>
          <p>{DISCLOSURE.what}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">where trading fees go</h2>
          <p>{DISCLOSURE.fees}</p>
          <ul className="flex flex-col gap-2">
            {FEE_RECIPIENTS.map((recipient) => (
              <li key={recipient.label} className="rounded-lg border border-border bg-white px-4 py-3 text-sm">
                <span className="font-medium">{recipient.label}</span> · {recipient.share}
                <code className="mt-1 block overflow-x-auto whitespace-nowrap text-xs text-text-muted-1">
                  {recipient.address}
                </code>
              </li>
            ))}
          </ul>
          <p>{DISCLOSURE.fixed}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">the team allocation</h2>
          <p>{DISCLOSURE.team}</p>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-void bg-white p-5">
          <h2 className="text-lg font-medium">not an investment</h2>
          <p>{DISCLOSURE.notInvestment}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">it never affects score or rank</h2>
          <p>{DISCLOSURE.noScore}</p>
        </section>
      </article>
    </SiteShell>
  );
}
