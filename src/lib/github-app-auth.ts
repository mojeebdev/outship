// Acting as the outship GitHub App itself, rather than as a signed-in user:
// an RS256 App JWT made with WebCrypto, exchanged for a short-lived
// installation access token. Used to post the one-time claim comment and to
// resolve release tags to commits.
//
// GitHub hands out App private keys as PKCS#1 PEM ("BEGIN RSA PRIVATE KEY"),
// which WebCrypto can't import; those are rewrapped as PKCS#8 here. PKCS#8
// PEM ("BEGIN PRIVATE KEY") is used as is.

const API = "https://api.github.com";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function derLength(length: number): number[] {
  if (length < 0x80) return [length];
  const bytes: number[] = [];
  for (let rest = length; rest > 0; rest >>= 8) bytes.unshift(rest & 0xff);
  return [0x80 | bytes.length, ...bytes];
}

function der(tag: number, content: Uint8Array): Uint8Array {
  return new Uint8Array([tag, ...derLength(content.length), ...content]);
}

// AlgorithmIdentifier { rsaEncryption (1.2.840.113549.1.1.1), NULL }
const RSA_ALGORITHM_IDENTIFIER = new Uint8Array([
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
]);

/** PKCS#8 PrivateKeyInfo { version 0, rsaEncryption, OCTET STRING pkcs1 }. */
export function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const body = new Uint8Array([...version, ...RSA_ALGORITHM_IDENTIFIER, ...der(0x04, pkcs1)]);
  return der(0x30, body);
}

/** The DER bytes of a PEM private key, as PKCS#8 whichever format it came in. */
export function privateKeyPemToPkcs8(pem: string): Uint8Array {
  // Secrets pasted into a dashboard often arrive with literal "\n"s.
  const normalized = pem.replace(/\\n/g, "\n").trim();
  const match = normalized.match(/-----BEGIN ((?:RSA )?PRIVATE KEY)-----([\s\S]+?)-----END \1-----/);
  if (match) {
    const bytes = base64Decode(match[2].replace(/\s+/g, ""));
    return match[1] === "RSA PRIVATE KEY" ? pkcs1ToPkcs8(bytes) : bytes;
  }

  // No PEM armour. Two ways a key commonly gets saved like that: the whole
  // .pem file base64-encoded (some deploy tools want secrets on one line), or
  // just the base64 body with the BEGIN/END lines lost in copying.
  const body = normalized.replace(/\s+/g, "");
  if (body.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(body)) {
    const bytes = base64Decode(body);
    const text = new TextDecoder().decode(bytes);
    if (text.includes("-----BEGIN")) return privateKeyPemToPkcs8(text);
    const kind = derKeyKind(bytes);
    if (kind === "pkcs8") return bytes;
    if (kind === "pkcs1") return pkcs1ToPkcs8(bytes);
  }

  // Say what was found, never what it contains: this message reaches logs.
  throw new Error(
    `GITHUB_APP_PRIVATE_KEY isn't a PEM private key (it's ${normalized.length} characters with no ` +
      "-----BEGIN RSA PRIVATE KEY----- line; save the downloaded .pem file's contents)",
  );
}

// An RSA private key in DER: SEQUENCE { INTEGER 0, ... }. In PKCS#1 the next
// field is another INTEGER (the modulus); in PKCS#8 it's the AlgorithmIdentifier
// SEQUENCE. Anything else isn't a key.
function derKeyKind(bytes: Uint8Array): "pkcs1" | "pkcs8" | null {
  if (bytes.length < 16 || bytes[0] !== 0x30) return null;
  const lengthBytes = bytes[1] & 0x80 ? 1 + (bytes[1] & 0x7f) : 1;
  const i = 1 + lengthBytes;
  if (bytes[i] !== 0x02 || bytes[i + 1] !== 0x01 || bytes[i + 2] !== 0x00) return null; // INTEGER 0
  if (bytes[i + 3] === 0x02) return "pkcs1";
  if (bytes[i + 3] === 0x30) return "pkcs8";
  return null;
}

/** A JWT that authenticates as the App for up to nine minutes. */
export async function createAppJwt(appId: string, privateKeyPem: string, now = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyPemToPkcs8(privateKeyPem) as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const seconds = Math.floor(now / 1000);
  const encode = (value: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
  // iat is backdated a minute for clock drift; GitHub caps exp at ten minutes.
  // The App ID is trimmed: a Worker secret saved with a trailing newline
  // would otherwise put "123456\n" in iss, and GitHub refuses the token.
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: seconds - 60, exp: seconds + 540, iss: appId.trim() })}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

type CachedToken = { token: string; expiresAt: number };

// Per isolate. Installation tokens last an hour; refreshing five minutes early
// means a token is never used in its last moments.
const tokenCache = new Map<number, CachedToken>();
const REFRESH_MARGIN_MS = 5 * 60_000;

export type AppCredentials = { appId?: string; privateKey?: string };

/** An installation access token, or null if the App isn't configured or GitHub refused. */
export async function getInstallationToken(
  installationId: number,
  credentials: AppCredentials,
): Promise<string | null> {
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.token;
  if (!credentials.appId || !credentials.privateKey) return null;

  const jwt = await createAppJwt(credentials.appId, credentials.privateKey);
  const response = await fetch(`${API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "outship",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    console.warn(`github-app-auth: installation ${installationId} token request answered ${response.status}`);
    return null;
  }
  const data = (await response.json()) as { token: string; expires_at: string };
  tokenCache.set(installationId, { token: data.token, expiresAt: Date.parse(data.expires_at) });
  return data.token;
}

/** A GitHub REST call as the installation. */
export async function installationFetch(
  installationId: number,
  credentials: AppCredentials,
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const token = await getInstallationToken(installationId, credentials);
  if (!token) return null;
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "outship",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
}
