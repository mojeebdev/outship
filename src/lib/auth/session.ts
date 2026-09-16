// A signed, self-contained session cookie — no server-side session store.
// Payload + HMAC signature are both base64url, joined by a dot.

const SESSION_COOKIE_NAME = "outship_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

type SessionPayload = {
  builderId: string;
  exp: number;
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "===".slice((padded.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createSessionCookieValue(
  builderId: string,
  secret: string,
): Promise<string> {
  const payload: SessionPayload = {
    builderId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await hmac(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionCookieValue(
  cookieValue: string,
  secret: string,
): Promise<SessionPayload | null> {
  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await hmac(secret, encodedPayload);
  if (expectedSignature !== signature) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload)),
    ) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieHeader(value: string): string {
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [cookieName, ...rest] = part.trim().split("=");
    if (cookieName === name) return rest.join("=");
  }
  return null;
}

export { SESSION_COOKIE_NAME };
