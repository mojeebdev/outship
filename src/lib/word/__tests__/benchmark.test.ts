/**
 * Tests for the benchmark tokenisation and the ETCSL extraction rules.
 *
 * Run with: npm run test:word
 *
 * The HTML fixture below is SYNTHETIC — it reproduces the *shape* of an ETCSL
 * translation page (navigation, title, superscript line numbers, parenthetical
 * editorial notes, revision-history footer) so the extraction rules can be
 * checked deterministically offline. It is not a copy of Oxford's page, and
 * passing these tests is not the same as reproducing the live 1,521. That check
 * is `npm run verify:benchmark`, which needs network access to Oxford.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  extractTranslation,
  stripEditorialNotes,
  stripLineNumbers,
} from "../../../../scripts/benchmark-extract.mjs";
import {
  BENCHMARK,
  COUNTING_RULE_VERSION,
  compareToBenchmark,
  shareText,
} from "../benchmark";
import { countWords } from "../count";

const ETCSL_SHAPED_FIXTURE = `<!doctype html>
<html><head><title>The Exaltation of Inana: translation</title></head>
<body>
  <nav><a href="/">ETCSL homepage</a> | <a href="/section4/">Section 4</a></nav>
  <h1>The Exaltation of Inana (Inana B): translation</h1>
  <p>A version of this composition follows.</p>
  <p><sup>1-4.</sup> Lady of all the divine powers (or: of the divine powers), resplendent light.</p>
  <p><sup>5-8.</sup> Woman, you are great, you are noble (uncertain reading).</p>
  <p>9-12. Your right hand holds the storm, praise be to the destroyer of foreign lands</p>
  <h2>Revision history</h2>
  <p>01.ii.1999 : first revision by an editor.</p>
  <footer>Copyright notice and page footer text.</footer>
</body></html>`;

test("the tokeniser follows the documented word rule", () => {
  assert.equal(countWords("Home About Contact"), 3);
  assert.equal(countWords("don't stop"), 2);
  assert.equal(countWords("state-of-the-art"), 1);
  assert.equal(countWords("Inana’s heart"), 1 + 1);
  // A comma is not an internal joiner, so "1,521" is two tokens.
  assert.equal(countWords("1,521 words"), 3);
  // Symbols and lone punctuation are not words.
  assert.equal(countWords("© 2026 Word"), 2);
  assert.equal(countWords("a — b"), 2);
  assert.equal(countWords(""), 0);
  assert.equal(countWords("!!! ??? ---"), 0);
});

test("line-number prefixes are removed", () => {
  // Whitespace left behind is normalised later in the pipeline.
  const stripped = (input: string) => stripLineNumbers(input).replace(/\s+/g, " ").trim();

  assert.equal(stripped("1-4. Lady of all"), "Lady of all");
  assert.equal(stripped(" 1-4. Lady of all"), "Lady of all");
  assert.equal(stripped("12. Woman, you are great"), "Woman, you are great");
  assert.equal(stripped("145-154. Praise be"), "Praise be");
  // A number that is not a line-number prefix is left alone.
  assert.equal(stripped("revised in 1999."), "revised in 1999.");
  assert.equal(stripped("she had 12 names"), "she had 12 names");
});

test("parenthetical editorial notes are removed, including nested ones", () => {
  assert.equal(stripEditorialNotes("powers (or: of the powers) shine").trim().replace(/\s+/g, " "),
    "powers shine");
  assert.equal(
    stripEditorialNotes("great (uncertain (very) reading) indeed").trim().replace(/\s+/g, " "),
    "great indeed",
  );
});

test("extraction drops navigation, title, superscripts, notes and revision history", () => {
  const text = extractTranslation(ETCSL_SHAPED_FIXTURE);

  assert.equal(
    text,
    "A version of this composition follows. Lady of all the divine powers , resplendent light. Woman, you are great, you are noble . Your right hand holds the storm, praise be to the destroyer of foreign lands",
  );

  // Nothing from outside the translation body survives.
  for (const unwanted of [
    "ETCSL homepage",
    "Section 4",
    "Inana B",
    "Revision history",
    "first revision",
    "Copyright notice",
    "uncertain reading",
    "or: of the divine powers",
  ]) {
    assert.ok(!text.includes(unwanted), `expected "${unwanted}" to be removed`);
  }
});

test("extraction fails loudly when the page shape is wrong", () => {
  assert.throws(
    () => extractTranslation("<html><body><p>Some other page entirely.</p></body></html>"),
    /Could not find the start of the translation/,
  );
});

test("the benchmark configuration is complete and self-consistent", () => {
  assert.equal(BENCHMARK.words, 1521);
  assert.equal(BENCHMARK.countingRuleVersion, COUNTING_RULE_VERSION);
  assert.equal(BENCHMARK.title, "The Exaltation of Inana");
  assert.match(BENCHMARK.translationUrl, /^https:\/\/etcsl\.orinst\.ox\.ac\.uk\//);
  assert.match(BENCHMARK.authorDescription, /earliest author known by name/);
  assert.match(BENCHMARK.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test("comparison copy: below, equal and above", () => {
  assert.equal(
    compareToBenchmark(1000).headline,
    "Your page has 521 fewer words than Enheduanna's poem.",
  );
  assert.equal(
    compareToBenchmark(1521).headline,
    "An exact match. Your page and Enheduanna's poem both have 1,521 words.",
  );
  assert.equal(
    compareToBenchmark(2000).headline,
    "Your page has 479 more words than Enheduanna's poem.",
  );
  assert.equal(compareToBenchmark(1000).direction, "below");
  assert.equal(compareToBenchmark(1521).direction, "equal");
  assert.equal(compareToBenchmark(2000).direction, "above");
  assert.equal(compareToBenchmark(2000).difference, 479);
});

test("comparison copy: singular wording and thousands separators", () => {
  assert.equal(
    compareToBenchmark(1520).headline,
    "Your page has 1 fewer word than Enheduanna's poem.",
  );
  assert.equal(
    compareToBenchmark(1522).headline,
    "Your page has 1 more word than Enheduanna's poem.",
  );
  assert.match(compareToBenchmark(12000).headline, /10,479 more words/);
  assert.match(compareToBenchmark(0).headline, /1,521 fewer words/);
});

test("comparison copy never claims authorship or a record", () => {
  for (const words of [0, 1520, 1521, 1522, 50_000]) {
    const { headline } = compareToBenchmark(words);
    assert.match(headline, /^(Your page has|An exact match\.)/);
    assert.ok(!/you wrote/i.test(headline));
    assert.ok(!/record|beat|surpass/i.test(headline));
  }
});

test("share text matches the documented template", () => {
  assert.equal(
    shareText(2000, true),
    "My homepage has 2,000 words. That's 479 more than Enheduanna's poem. How wordy is yours?",
  );
  assert.equal(
    shareText(2000, false),
    "My page has 2,000 words. That's 479 more than Enheduanna's poem. How wordy is yours?",
  );
  assert.equal(
    shareText(1520, true),
    "My homepage has 1,520 words. That's 1 fewer than Enheduanna's poem. How wordy is yours?",
  );
  assert.equal(
    shareText(1521, true),
    "My homepage has 1,521 words — an exact match with Enheduanna's poem. How wordy is yours?",
  );
});
