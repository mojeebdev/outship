// How the Worker's cron proves to an internal route that the call is its own.
//
// The token is a SHA-256 of SESSION_SECRET, in hex, rather than the secret
// itself: header values lose leading and trailing whitespace, so a secret
// saved with a trailing newline (easy to do with `wrangler secret put`)
// never matched itself once it had been through a header, and every cron
// call was refused. Hex survives a header untouched, and the secret itself
// never travels.
export const CRON_HEADER = "x-outship-cron";

export async function cronToken(secret: string | undefined): Promise<string> {
  if (!secret) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`outship-cron:${secret}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
