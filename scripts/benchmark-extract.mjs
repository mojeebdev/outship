/**
 * Extraction rules for the ETCSL translation of "The Exaltation of Inana".
 *
 * Used by `npm run verify:benchmark` and by the fixture test that proves these
 * rules behave. Kept out of `src/` on purpose: the app never fetches Oxford,
 * it reads the verified number from src/lib/word/benchmark.ts.
 *
 * What is counted: the main English translation, lines 1-154.
 * What is removed, in this order:
 *   1. Everything outside the translation body — page navigation, the title
 *      block, the footer and the revision history.
 *   2. Superscript line numbers.
 *   3. Parenthetical editorial notes: alternative manuscript readings and
 *      uncertainty markers.
 * Then HTML entities are decoded and whitespace is normalised.
 *
 * Parenthetical removal is specific to Oxford's editorial notes. The app does
 * NOT strip parentheses from users' websites.
 */

import { Parser } from "htmlparser2";

/** Elements whose text is never part of the translation. */
const DROPPED_ELEMENTS = new Set([
  "script",
  "style",
  "head",
  "title",
  "meta",
  "link",
  "noscript",
  "template",
  "svg",
  "sup", // superscript line numbers
  "nav",
]);

const INLINE_ELEMENTS = new Set([
  "a",
  "b",
  "i",
  "em",
  "strong",
  "span",
  "sub",
  "u",
  "small",
  "cite",
  "q",
]);

/**
 * Text that marks the start and end of the translation body on the ETCSL page.
 * These are checked rather than assumed: `extractTranslation` throws if it
 * can't find them, instead of silently counting the wrong thing.
 */
export const BODY_START_MARKERS = [
  "A version of this composition",
  "Lady of all the divine powers",
];
export const BODY_END_MARKERS = [
  "Revision history",
  "praise be to the destroyer of foreign lands",
];

/** Pull all readable text out of an HTML document, dropping the sets above. */
export function htmlToText(html) {
  const pieces = [];
  let skipDepth = 0;
  const skipStack = [];

  const parser = new Parser(
    {
      onopentag(name) {
        const tag = name.toLowerCase();
        if (skipDepth > 0) {
          skipStack.push(tag);
          skipDepth += 1;
          return;
        }
        if (DROPPED_ELEMENTS.has(tag)) {
          skipStack.push(tag);
          skipDepth = 1;
          return;
        }
        if (!INLINE_ELEMENTS.has(tag)) pieces.push(" ");
      },
      onclosetag(name) {
        const tag = name.toLowerCase();
        if (skipDepth > 0) {
          if (skipStack[skipStack.length - 1] === tag) {
            skipStack.pop();
            skipDepth -= 1;
          }
          return;
        }
        if (!INLINE_ELEMENTS.has(tag)) pieces.push(" ");
      },
      ontext(text) {
        if (skipDepth === 0) pieces.push(text);
      },
    },
    { decodeEntities: true, recognizeSelfClosing: true },
  );

  parser.write(html);
  parser.end();

  return pieces.join("");
}

/** Narrow the page text down to the translation body. */
export function sliceTranslationBody(text) {
  let start = -1;
  for (const marker of BODY_START_MARKERS) {
    const index = text.indexOf(marker);
    if (index !== -1) {
      start = index;
      break;
    }
  }
  if (start === -1) {
    throw new Error(
      `Could not find the start of the translation. Tried: ${BODY_START_MARKERS.join(", ")}`,
    );
  }

  let end = -1;
  for (const marker of BODY_END_MARKERS) {
    const index = text.indexOf(marker, start);
    if (index !== -1) {
      // The first marker is a heading that follows the body; the second is the
      // body's own last line, so keep it.
      end = marker === "Revision history" ? index : index + marker.length;
      break;
    }
  }
  if (end === -1) {
    throw new Error(
      `Could not find the end of the translation. Tried: ${BODY_END_MARKERS.join(", ")}`,
    );
  }

  return text.slice(start, end);
}

/** Remove line-number prefixes that are plain text rather than superscripts. */
export function stripLineNumbers(text) {
  // "12." / "1-4." / "145-154." at a segment boundary.
  return text.replace(/(^|\s)\d+(?:-\d+)?\.(?=\s)/g, "$1");
}

/** Remove Oxford's parenthetical editorial notes, including nested ones. */
export function stripEditorialNotes(text) {
  let previous;
  let current = text;
  do {
    previous = current;
    current = current.replace(/\([^()]*\)/g, " ");
  } while (current !== previous);
  return current;
}

const WHITESPACE = new RegExp(
  "[\\s\\u00a0\\u1680\\u2000-\\u200a\\u202f\\u205f\\u3000\\ufeff]+",
  "gu",
);

/** Full pipeline: raw ETCSL HTML in, countable translation text out. */
export function extractTranslation(html) {
  const body = sliceTranslationBody(htmlToText(html));
  return stripEditorialNotes(stripLineNumbers(body)).replace(WHITESPACE, " ").trim();
}
