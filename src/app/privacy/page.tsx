import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "privacy — outship",
};

export default function PrivacyPage() {
  return (
    <SiteShell>
      <article className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-20">
        <h1 className="text-3xl font-medium sm:text-4xl">privacy policy</h1>
        <p className="text-text-muted-1">
          outship is in early development. the only data collected today is
          the email addresses submitted through the weekly ship recap
          signup. a full privacy policy — covering github data, onchain
          attestations, and wallet addresses — will be published here
          before those features go live.
        </p>
        <p className="text-sm text-text-muted-2">
          questions in the meantime — see{" "}
          <a href="/contact" className="text-base-blue hover:underline">
            contact
          </a>
          . outship is built by BlindspotLab Limited.
        </p>
      </article>
    </SiteShell>
  );
}
