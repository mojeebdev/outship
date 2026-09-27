import { notFound } from "next/navigation";

/**
 * Catch-all for unknown Word routes.
 *
 * Without this, an unmatched path on word.outship.dev would fall through to the
 * app's root not-found and show outship's 404 instead of Word's. Static Word
 * routes take precedence over this catch-all.
 */
export default function WordCatchAll(): never {
  notFound();
}
