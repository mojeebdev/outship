/**
 * Compares two strings in time that depends only on their length, not on
 * where they first differ, so a signature check can't be timed byte by byte.
 * The length itself isn't secret here: every value compared is a fixed-size
 * hex or base64url digest.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
