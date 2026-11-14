// Site-wide structured data (schema.org JSON-LD): who makes outship and who
// runs it. Pages that add their own JSON-LD (the FAQ) point back at these
// entities by @id instead of repeating them.

export const SITE_URL = "https://outship.dev";

export const SITE_ID = {
  website: `${SITE_URL}/#website`,
  app: `${SITE_URL}/#app`,
  organization: "https://blindspotlab.xyz/#organization",
  person: `${SITE_URL}/#mojeeb`,
} as const;

export const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": SITE_ID.organization,
      name: "BlindspotLab Limited",
      alternateName: "BlindspotLab",
      url: "https://blindspotlab.xyz",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/brand/blindspotlab-mark.svg`,
      },
      founder: { "@id": SITE_ID.person },
    },
    {
      "@type": "Person",
      "@id": SITE_ID.person,
      name: "Mojeeb Titilayo",
      alternateName: "Mojeeb",
      jobTitle: "Creative product engineer",
      url: `${SITE_URL}/@mojeebdev`,
      worksFor: { "@id": SITE_ID.organization },
      homeLocation: { "@type": "Place", name: "Lagos, Nigeria" },
      sameAs: ["https://github.com/mojeebdev", "https://x.com/MojeebMotion"],
    },
    {
      "@type": "WebSite",
      "@id": SITE_ID.website,
      name: "outship",
      url: SITE_URL,
      description:
        "GitHub-verified releases, merged PRs, pushes and streaks, with receipts you can put onchain on Base.",
      inLanguage: "en",
      publisher: { "@id": SITE_ID.organization },
      creator: { "@id": SITE_ID.person },
    },
    {
      "@type": "WebApplication",
      "@id": SITE_ID.app,
      name: "outship",
      url: SITE_URL,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      isAccessibleForFree: true,
      license: "https://www.apache.org/licenses/LICENSE-2.0",
      codeRepository: "https://github.com/mojeebdev/outship",
      sameAs: ["https://github.com/mojeebdev/outship", "https://x.com/outshipdev"],
      publisher: { "@id": SITE_ID.organization },
      creator: { "@id": SITE_ID.person },
    },
  ],
};

/** For a <script type="application/ld+json">: escapes "<" so data can never close the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
