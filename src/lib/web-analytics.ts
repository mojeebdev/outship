// Cloudflare Web Analytics: cookieless page-load counts, no personal data and
// no fingerprinting. The beacon token is public by design (it's printed into
// every page), so it lives in source rather than in a build variable that Next
// only inlines if it's present during the build. NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN
// overrides it; setting that to "off" turns the beacon off.
const DEFAULT_TOKEN = "7be86433b16d48e99f0d83ba2c602157";

const configured = process.env.NEXT_PUBLIC_CF_WEB_ANALYTICS_TOKEN;

export const WEB_ANALYTICS_TOKEN: string | null =
  configured === "off" ? null : configured || DEFAULT_TOKEN;
