// API keys: "os_live_" + 32 random bytes, base64url. Only the SHA-256 hash is
// stored, so a database leak doesn't leak working keys; the key itself is
// shown once, when it's issued.

export const KEY_PREFIX = "os_live_";
const KEY_PATTERN = /^os_live_[A-Za-z0-9_-]{43}$/;

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
  const key = KEY_PREFIX + base64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 4), hash: await hashApiKey(key) };
}

export function looksLikeApiKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

/** The key from "Authorization: Bearer os_live_…", null if absent, "invalid" if malformed. */
export function bearerKey(header: string | null): string | null | "invalid" {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  if (!match || !looksLikeApiKey(match[1])) return "invalid";
  return match[1];
}
