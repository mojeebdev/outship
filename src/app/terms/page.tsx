import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";

export const metadata: Metadata = {
  title: "terms — outship",
};

export default function TermsPage() {
  return (
    <SiteShell>
      <article className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-20">
        <h1 className="text-3xl font-medium sm:text-4xl">terms of service</h1>
        <p className="text-text-muted-1">
          outship is in early development and does not yet process
          accounts, payments, or wallet connections. a full terms of
          service will be published here before any of that goes live.
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
