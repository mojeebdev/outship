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
  ExtractionError,
  extractTranslation,
  readBlocks,
  selectTranslationLines,
  stripEditorialNotes,
} from "../../../../scripts/benchmark-extract.mjs";
import {
  BENCHMARK,
  COUNTING_RULE_VERSION,
  compareToBenchmark,
  shareText,
} from "../benchmark";
import { countWords } from "../count";

const ETCSL_SHAPED_FIXTURE = `<!doctype html>
<html><head><title>The Exaltation of Inana: translation</title>
<style>.line { margin: 0; }</style></head>
<body>
  <div class="nav"><a href="/">ETCSL homepage</a> | <a href="/section4/">Section 4</a></div>
  <h1>The Exaltation of Inana (Inana B): translation</h1>
  <p>A version of this composition is also available.</p>
  <div class="translation">
    <p class="line"><sup>1-4.</sup> Lady of all the divine powers (or: of the divine powers), resplendent light.</p>
    <p class="line"><a name="5"></a>5-8. Woman, you are great, you are noble (uncertain reading).</p>
    <p class="line">9-153. Your right hand holds the storm,<br>and the foreign lands tremble.</p>
    <p class="line"><sup>154.</sup> Praise be to the destroyer of foreign lands</p>
  </div>
  <h2>Revision history</h2>
  <p>01.ii.1999 : first revision by an editor.</p>
  <div class="footer">Copyright notice and page footer text.</div>
</body></html>`;

test("the tokeniser follows the documented word rule", () => {
  assert.equal(countWords("Home About Contact"), 3);
  assert.equal(countWords("don't stop"), 2);
  assert.equal(countWords("state-of-the-art"), 1);
  assert.equal(countWords("Inana’s heart"), 2);
  // A comma is not an internal joiner, so "1,521" is two tokens.
  assert.equal(countWords("1,521 words"), 3);
  // Symbols and lone punctuation are not words.
  assert.equal(countWords("© 2026 Word"), 2);
  assert.equal(countWords("a — b"), 2);
  assert.equal(countWords(""), 0);
  assert.equal(countWords("!!! ??? ---"), 0);
});

test("only numbered translation lines are counted", () => {
  const text = extractTranslation(ETCSL_SHAPED_FIXTURE);

  assert.equal(
    text,
    "Lady of all the divine powers , resplendent light. " +
      "Woman, you are great, you are noble . " +
      "Your right hand holds the storm, and the foreign lands tremble. " +
      "Praise be to the destroyer of foreign lands",
  );

  // Nothing outside the numbered lines survives.
  for (const unwanted of [
    "ETCSL homepage",
    "Section 4",
    "Inana B",
    "also available",
    "Revision history",
    "first revision",
    "Copyright notice",
    "uncertain reading",
    "or: of the divine powers",
  ]) {
    assert.ok(!text.includes(unwanted), `expected "${unwanted}" to be removed`);
  }

  // The line numbers themselves are not words.
  assert.ok(!/\b(1-4|5-8|154)\b/.test(text));
});

test("line numbers are recognised as plain text, superscript and after an anchor", () => {
  const { lines, firstLine, lastLine } = selectTranslationLines(
    readBlocks(ETCSL_SHAPED_FIXTURE),
  );

  assert.equal(lines.length, 4);
  assert.equal(firstLine, 1);
  assert.equal(lastLine, 154);
  assert.match(lines[0], /^Lady of all/);
  assert.match(lines[3], /^Praise be/);
});

test("a wrapper element does not double-count its paragraphs", () => {
  const blocks = readBlocks(
    "<div><div><p>alpha</p><p>beta</p></div></div>",
  );
  assert.deepEqual(blocks, ["alpha", "beta"]);
});

test("blocks other than <p> can carry a line", () => {
  const html = "<ul><li>1. first line</li><li>2. second line</li></ul>";
  const { lines, firstLine, lastLine } = selectTranslationLines(readBlocks(html));
  assert.deepEqual(lines, ["first line", "second line"]);
  assert.equal(firstLine, 1);
  assert.equal(lastLine, 2);
});

test("text that merely starts with a number is not a translation line", () => {
  const { lines } = selectTranslationLines(
    readBlocks(
      "<p>01.ii.1999 : revision</p><p>2026 was a year</p><p>3.5 inches</p><p>7. a real line</p>",
    ),
  );
  assert.deepEqual(lines, ["a real line"]);
});

test("extraction fails loudly rather than counting the wrong thing", () => {
  // A page with no numbered lines at all.
  assert.throws(
    () => extractTranslation("<html><body><p>Some other page entirely.</p></body></html>"),
    (error: unknown) =>
      error instanceof ExtractionError &&
      /No numbered translation lines found/.test(error.message),
  );

  // A page that stops short of line 154 — a paginated or truncated copy.
  assert.throws(
    () => extractTranslation("<p>1-4. Lady of all</p><p>5-8. Woman, you are great</p>"),
    (error: unknown) =>
      error instanceof ExtractionError && /Found lines 1-8, expected 1-154/.test(error.message),
  );
});

test("a failed extraction carries the blocks it saw, for diagnosis", () => {
  try {
    extractTranslation("<html><body><p>alpha</p><p>beta</p></body></html>");
    assert.fail("expected extraction to fail");
  } catch (error) {
    assert.ok(error instanceof ExtractionError);
    assert.deepEqual(error.blocks, ["alpha", "beta"]);
  }
});

test("parenthetical editorial notes are removed, including nested ones", () => {
  const clean = (input: string) => stripEditorialNotes(input).replace(/\s+/g, " ").trim();
  assert.equal(clean("powers (or: of the powers) shine"), "powers shine");
  assert.equal(clean("great (uncertain (very) reading) indeed"), "great indeed");
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
