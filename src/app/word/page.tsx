import { BlindspotLabBadge } from "@/components/word/blindspotlab-badge";
import { WordCounter } from "@/components/word/word-counter";
import { WordLeaderboard } from "@/components/word/word-leaderboard";
import { LEADERBOARD_SIZE, listLeaderboard } from "@/lib/word/leaderboard";

export const dynamic = "force-dynamic";

export default async function WordPage() {
  const entries = await listLeaderboard(LEADERBOARD_SIZE);

  return (
    <>
      <section className="word-hero">
        <BlindspotLabBadge />

        <h1>
          How wordy is your <em>website</em>?
        </h1>

        <p className="word-hero-sub">
          Paste an address and Word counts the readable text the page sends back —
          headings, paragraphs, navigation, footer, all of it.
        </p>

        <p className="word-scope-note">Counts this page, not the entire website.</p>

        <WordCounter />
      </section>

      <section className="word-section" id="leaderboard">
        <h2>Homepage leaderboard</h2>
        <p className="word-section-note">
          Homepages only, and only sites whose owners opted in after a scan. One entry per
          domain, ranked by the word count this server measured.
        </p>
        <WordLeaderboard entries={entries} />
      </section>

      <section className="word-section">
        <h2>What gets counted</h2>
        <p className="word-section-note">
          Word fetches the page on the server and counts the text in the HTML it receives.
        </p>
        <ul className="word-rules">
          <li>
            <strong>Counted:</strong> readable text anywhere in the page body, including
            navigation and footer text.
          </li>
          <li>
            <strong>Skipped:</strong> scripts, styles, HTML markup and comments, SVG
            internals, <code>&lt;template&gt;</code> content, and elements explicitly hidden
            with <code>hidden</code>, <code>aria-hidden</code> or an inline{" "}
            <code>display: none</code>.
          </li>
          <li>
            <strong>Words</strong> are runs of letters or numbers, which may hold
            apostrophes or hyphens inside them — <code>don&apos;t</code> and{" "}
            <code>state-of-the-art</code> each count once. Punctuation and symbols are
            not words. The same rule produced the historical benchmark, so the two
            numbers are always comparable.
          </li>
          <li>
            <strong>Characters</strong> are counted after entities are decoded and runs of
            whitespace are collapsed to a single space. Spaces count. For languages
            written without spaces, the character count is the more useful number.
          </li>
          <li>
            Word reads the HTML the server returns and does not run the page&apos;s
            JavaScript, so text a page loads afterwards in the browser isn&apos;t included.
          </li>
        </ul>
      </section>
    </>
  );
}
