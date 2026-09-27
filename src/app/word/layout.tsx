import type { Metadata } from "next";
import { Azeret_Mono, Figtree } from "next/font/google";
import Link from "next/link";

import { WORD_CANONICAL_ORIGIN } from "@/lib/word/constants";
import { getWordBasePath, wordHref } from "@/lib/word/paths";

import "./word.css";

/**
 * Word's own minimal layout.
 *
 * Deliberately does not use `SiteShell` — outship's marketing navigation and
 * footer stay on outship.dev. Only the root `html`/`body` element is shared.
 */

const figtree = Figtree({
  variable: "--font-word-body",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const azeretMono = Azeret_Mono({
  variable: "--font-word-accent",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/**
 * General Sans is a Fontshare face, so it loads from their CDN rather than
 * `next/font`. Deliberately rendered without React's `precedence` prop: a
 * stylesheet with a precedence blocks rendering until it loads, and Word should
 * never wait on a third party. `display=swap` plus the fallback chain in
 * word.css means text paints immediately in Figtree and swaps when it arrives.
 */
const GENERAL_SANS_CSS =
  "https://api.fontshare.com/v2/css?f%5B%5D=general-sans@500,600,700&display=swap";

export const metadata: Metadata = {
  metadataBase: new URL(WORD_CANONICAL_ORIGIN),
  title: {
    default: "Word — how wordy is your website?",
    template: "%s — Word",
  },
  description:
    "Count the words on any web page. Paste an address, get the word count, character count, and how long the scan took.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Word — how wordy is your website?",
    description: "Count the words on any web page.",
    url: WORD_CANONICAL_ORIGIN,
    siteName: "Word",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Word — how wordy is your website?",
    description: "Count the words on any web page.",
  },
};

export default async function WordLayout({ children }: LayoutProps<"/word">) {
  const basePath = await getWordBasePath();
  const home = wordHref(basePath, "/");

  return (
    <div className={`word-root ${figtree.variable} ${azeretMono.variable}`}>
      <link rel="preconnect" href="https://api.fontshare.com" />
      <link rel="stylesheet" href={GENERAL_SANS_CSS} />

      <a href="#word-main" className="word-sr-only word-skip-link">
        Skip to content
      </a>

      <header className="word-header">
        <Link href={home} className="word-wordmark">
          Word<span>.</span>
        </Link>
        <span className="word-header-note">one page, counted</span>
      </header>

      <main id="word-main" className="word-main">
        {children}
      </main>

      <footer className="word-footer">
        <span>Word — a BlindspotLab product</span>
        <span>
          <a href="https://blindspotlab.xyz" target="_blank" rel="noopener noreferrer">
            blindspotlab.xyz
          </a>
          {" · "}
          <a href="https://outship.dev">outship.dev</a>
        </span>
      </footer>
    </div>
  );
}
