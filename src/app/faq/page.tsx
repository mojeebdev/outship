import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { FaqList } from "@/components/faq-list";
import { FAQ_GROUPS } from "@/lib/faq";
import { SITE_ID, SITE_URL, jsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "faq — outship",
  description:
    "how outship works: what counts as a ship, how points and streaks are scored, private repos, onchain attestations and the weekly recap.",
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${SITE_URL}/faq#faq`,
  url: `${SITE_URL}/faq`,
  isPartOf: { "@id": SITE_ID.website },
  publisher: { "@id": SITE_ID.organization },
  mainEntity: FAQ_GROUPS.flatMap(({ faqs }) =>
    faqs.map(({ question, text }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text },
    })),
  ),
};

export default function FaqPage() {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        // Built from the constants above, never from user input.
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-12 px-6 py-20">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-medium sm:text-4xl">faq</h1>
          <p className="text-text-muted-1">
            how outship works. anything missing?{" "}
            <Link href="/contact" className="text-base-blue hover:underline">
              ask us
            </Link>
            .
          </p>
        </div>

        {FAQ_GROUPS.map(({ heading, faqs }) => (
          <section
            key={heading}
            id={heading.replace(/\s+/g, "-")}
            className="flex scroll-mt-24 flex-col gap-3"
          >
            <h2 className="text-xs uppercase tracking-wide text-text-muted-2">{heading}</h2>
            <FaqList faqs={faqs} />
          </section>
        ))}
      </div>
    </SiteShell>
  );
}
