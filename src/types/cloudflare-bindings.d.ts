declare global {
  interface CloudflareEnv {
    GITHUB_WEBHOOK_SECRET?: string;
    GITHUB_APP_ID?: string;
    GITHUB_APP_PRIVATE_KEY?: string;
    GITHUB_APP_CLIENT_ID?: string;
    GITHUB_APP_CLIENT_SECRET?: string;
    SESSION_SECRET?: string;
  }
}

export {};
