// A readable "signed in" hint for the navbar. The session cookie itself is
// HttpOnly, so the browser can't see it; this one carries no data and grants
// nothing, it only lets pre-rendered pages show "profile" instead of
// "sign in". src/proxy.ts keeps it in step with the session cookie.
export const SIGNED_IN_HINT_COOKIE = "outship_signed_in";

export const SIGNED_IN_HINT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
