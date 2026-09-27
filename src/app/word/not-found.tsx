import Link from "next/link";

import { getWordBasePath, wordHref } from "@/lib/word/paths";

export default async function WordNotFound() {
  const home = wordHref(await getWordBasePath(), "/");

  return (
    <section className="word-notfound">
      <span className="word-notfound-code">404 · zero words here</span>
      <h1>We couldn&apos;t find that page.</h1>
      <p className="word-hero-sub">
        Word only has one page so far — the counter. Everything else is a typo.
      </p>
      <Link className="word-button" href={home}>
        Back to the counter
      </Link>
    </section>
  );
}
