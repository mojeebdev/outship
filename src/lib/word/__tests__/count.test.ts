/**
 * Fixture tests for the Word counting engine.
 *
 * Run with: npm run test:word
 * (Node's built-in test runner, type stripping, no extra dependencies.)
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  countCharacters,
  countHtml,
  countWords,
  extractReadableText,
} from "../count";

const FIXTURE = `<!doctype html>
<html lang="en">
<head>
  <title>Ignored title</title>
  <meta name="description" content="ignored attribute text">
  <style>body { color: red; }</style>
</head>
<body>
  <nav>Home About Contact</nav>
  <h1>Hello&nbsp;world</h1>
  <p>This is a <b>test</b> page &amp; it has <span>inline</span>text.</p>
  <script>var words = "not counted";</script>
  <div hidden>Hidden words here</div>
  <div aria-hidden="true">Aria hidden words</div>
  <div style="display:none">Styled hidden words</div>
  <svg width="10" height="10"><text>Svg internals</text></svg>
  <template><p>Template words</p></template>
  <!-- a comment with words -->
  <footer>&copy; 2026 Word</footer>
</body>
</html>`;

const EXPECTED_TEXT =
  "Home About Contact Hello world This is a test page & it has inlinetext. © 2026 Word";

test("extracts readable text and drops everything unreadable", () => {
  assert.equal(extractReadableText(FIXTURE), EXPECTED_TEXT);
});

test("counts words and characters for the fixture", () => {
  const result = countHtml(FIXTURE);

  // Home About Contact Hello world This is a test page it has inlinetext 2026
  // Word = 15 word-like segments ("&", "©" and "." are not words).
  assert.equal(result.words, 15);
  assert.equal(result.characters, EXPECTED_TEXT.length);
  assert.equal(result.empty, false);
});

test("navigation and footer text is included", () => {
  const text = extractReadableText("<nav>alpha</nav><main>beta</main><footer>gamma</footer>");
  assert.equal(text, "alpha beta gamma");
  assert.equal(countWords(text), 3);
});

test("block boundaries separate words, inline boundaries do not", () => {
  assert.equal(extractReadableText("<p>one</p><p>two</p>"), "one two");
  assert.equal(extractReadableText("<p><b>on</b>e</p>"), "one");
  assert.equal(extractReadableText("<p>one<br>two</p>"), "one two");
  assert.equal(countWords(extractReadableText("<p><b>on</b>e</p>")), 1);
});

test("entities are decoded and whitespace normalised", () => {
  const text = extractReadableText("<p>a&nbsp;&nbsp;b\n\n  c&#233;</p>");
  assert.equal(text, "a b cé");
  assert.equal(countCharacters(text), 6);
});

test("scripts written without spaces count as one token per run", () => {
  const text = extractReadableText("<p>你好世界</p>");
  assert.equal(text, "你好世界");
  assert.equal(countCharacters(text), 4);
  // The word rule is "a run of letters or numbers", and this is one unbroken
  // run. Documented in docs/word.md: character count is the better signal for
  // languages written without spaces.
  assert.equal(countWords(text), 1);
});

test("reports pages with no extractable text", () => {
  const result = countHtml("<html><body><script>var a = 1;</script><img src=x></body></html>");
  assert.equal(result.words, 0);
  assert.equal(result.characters, 0);
  assert.equal(result.empty, true);
});

test("void elements in skipped sets do not swallow the document", () => {
  const text = extractReadableText(
    '<head><meta charset="utf-8"><link rel="stylesheet" href="a.css"></head><body><p>kept</p></body>',
  );
  assert.equal(text, "kept");
});

test("characters count code points, not UTF-16 units", () => {
  const text = extractReadableText("<p>a😀b</p>");
  assert.equal(countCharacters(text), 3);
});
