// Sender identities. The EMAIL binding in wrangler.jsonc may only send as
// these (allowed_sender_addresses); replies go to the Zoho support inbox.
export const FROM_WELCOME = { email: "welcome@mail.outship.dev", name: "outship" };
export const FROM_RECAP = { email: "recap@mail.outship.dev", name: "outship recap" };
export const FROM_REMINDER = { email: "reminder@mail.outship.dev", name: "outship reminder" };
/** Personal mail from outship's founder; replies go to the same inbox. */
export const FROM_FOUNDER = { email: "mojeeb@mail.outship.dev", name: "Mojeeb from outship" };
/** Friend invites. The name is set per invite: "{inviter} via outship". */
export const INVITE_ADDRESS = "invite@mail.outship.dev";
export const REPLY_TO = { email: "support@mail.outship.dev", name: "outship support" };

export const SITE_URL = "https://outship.dev";

export type Email = {
  subject: string;
  html: string;
  text: string;
};

/** 256 random bits, base64url: unguessable confirm/unsubscribe tokens. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type SendOutcome = { ok: true } | { ok: false; code: string };

// Failures that will hit every recipient, so a batch sender stops and leaves
// the rest for its next run.
export const STOP_CODES = new Set([
  "E_NO_BINDING",
  "E_RATE_LIMIT_EXCEEDED",
  "E_DAILY_LIMIT_EXCEEDED",
  "E_SENDER_NOT_VERIFIED",
  "E_SENDER_DOMAIN_NOT_AVAILABLE",
  "E_ACCOUNT_SUSPENDED",
  "E_INTERNAL_SERVER_ERROR",
]);

/**
 * Sends one email and never throws: a failed welcome must not break sign-in.
 * The error code (e.g. E_RATE_LIMIT_EXCEEDED) is returned so batch senders
 * can decide whether to stop.
 */
export async function sendEmail(
  binding: SendEmail | undefined,
  message: {
    to: string;
    from: { email: string; name: string };
    email: Email;
    headers?: Record<string, string>;
    /** Where replies go; support@ unless set. */
    replyTo?: { email: string; name: string };
  },
): Promise<SendOutcome> {
  if (!binding) {
    console.warn("email: no EMAIL binding, not sending", message.email.subject);
    return { ok: false, code: "E_NO_BINDING" };
  }
  try {
    await binding.send({
      to: message.to,
      from: message.from,
      replyTo: message.replyTo ?? REPLY_TO,
      subject: message.email.subject,
      html: message.email.html,
      text: message.email.text,
      headers: message.headers,
    });
    return { ok: true };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : "E_UNKNOWN";
    console.error("email: send failed", code, error instanceof Error ? error.message : error);
    return { ok: false, code };
  }
}

/** RFC 8058 one-click unsubscribe headers, required by Gmail and Yahoo for bulk mail. */
export function unsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${SITE_URL}/api/recap/unsubscribe?token=${encodeURIComponent(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "List-Id": "outship weekly ship recap <recap.mail.outship.dev>",
  };
}
