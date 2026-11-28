import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SiteShell } from "@/components/site-shell";
import { CopyButton } from "@/components/copy-button";
import { IconArrowUpRight } from "@/components/icons";
import { basescanTokenUrl, getTokenAddress } from "@/lib/token";
import { DISCLOSURE, TOKEN_NAME, TOKEN_SYMBOL } from "@/lib/token-disclosure";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OUTSHIP token — outship",
  description: "The OUTSHIP community token on Base.",
};

const link = "inline-flex items-center gap-1 text-base-blue hover:underline";

export default function TokenPage() {
  // Read the Worker binding at request time. The address is intentionally
  // added to wrangler.jsonc only after the o1 Exchange launch is complete.
  const { env } = getCloudflareContext();
  const tokenAddress = getTokenAddress(env.OUTSHIP_TOKEN_ADDRESS);

  return (
    <SiteShell>
      <article className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-20 leading-relaxed">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-text-muted-2">
            the outship community token · base
          </p>
          <h1 className="text-3xl font-medium sm:text-4xl">
            {TOKEN_NAME} <span className="text-text-muted-1">({TOKEN_SYMBOL})</span>
          </h1>
          <p className="text-text-muted-1">
            for the people who build, ship and move the ecosystem forward.
          </p>
        </div>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-white p-5">
          <h2 className="text-sm font-medium">contract address on base</h2>
          {tokenAddress ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-cream px-3 py-2 text-xs">
                  {tokenAddress}
                </code>
                <CopyButton text={tokenAddress} label="copy address" />
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <a
                  href="https://bankr.bot/trade?in=0xd9e9df0617b3c7564e5b365cb13a939aeab75ba3&out=0x9e9b0301b6dbea2d518f2bbaa9da49b819f9bba3&chain=base"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={link}
                >
                  trade on Bankr
                  <IconArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <a
                  href={basescanTokenUrl(tokenAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={link}
                >
                  verify on basescan
                  <IconArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted-1">
              the contract address will be published here after the official o1 Exchange launch.
              verify the address here before interacting with any token claiming to be OUTSHIP.
            </p>
          )}
          <p className="text-xs text-text-muted-2">
            outship will never ask you to send tokens or funds to claim an allocation.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">what it is</h2>
          <p>{DISCLOSURE.what}</p>
          <p>{DISCLOSURE.community}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">how it relates to outship</h2>
          <p>{DISCLOSURE.product}</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">trading and transparency</h2>
          <p>{DISCLOSURE.trading}</p>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-void bg-white p-5">
          <h2 className="text-lg font-medium">not an investment or ownership claim</h2>
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
