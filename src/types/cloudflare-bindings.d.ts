declare global {
  interface CloudflareEnv {
    GITHUB_WEBHOOK_SECRET?: string;
    GITHUB_APP_ID?: string;
    GITHUB_APP_PRIVATE_KEY?: string;
    GITHUB_APP_CLIENT_ID?: string;
    GITHUB_APP_CLIENT_SECRET?: string;
    SESSION_SECRET?: string;
    // Signs v2 ship attestations (EIP-712). Only signs, never sends a
    // transaction, so the account needs no funds. Its address is the
    // OutshipShipResolver's outshipSigner.
    OUTSHIP_ATTESTER_PRIVATE_KEY?: string;
    // Base JSON-RPC endpoint for verifying attestations; falls back to Base's
    // public endpoint when unset.
    BASE_RPC_URL?: string;
    // GitHub requests per 5-minute backfill run (default 12, safe on the
    // Workers free plan). Raise it on a paid plan to import history faster.
    BACKFILL_REQUEST_BUDGET?: string;
    // GitHub logins allowed into /admin, comma-separated (default: mojeebdev).
    ADMIN_GITHUB_LOGINS?: string;
    // Cloudflare Web Analytics, read for the admin panel (src/lib/cf-analytics.ts).
    CLOUDFLARE_ANALYTICS_TOKEN?: string;
    CF_WEB_ANALYTICS_SITE_TAG?: string;
  }
}

export {};
