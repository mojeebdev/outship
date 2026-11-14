// Sign-in errors as a small outship page instead of a bare text response, so
// someone who hits one knows what happened and how to try again. Plain HTML
// with inline styles: these routes are API handlers, outside the app layout.
import { escapeHtml } from "@/lib/email/templates";

const LOGIN_PATH = "/api/auth/github/login";

export function authErrorPage({
  title,
  message,
  status,
  retry = true,
}: {
  title: string;
  message: string;
  status: number;
  /** Offer "try again" (another trip through GitHub). */
  retry?: boolean;
}): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} — outship</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f5f0; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  main { max-width: 420px; margin: 24px 16px; padding: 32px 28px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; }
  .brand { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 500; color: #000; text-decoration: none; }
  h1 { margin: 24px 0 8px; font-size: 22px; font-weight: 500; }
  p { margin: 0 0 24px; line-height: 1.55; color: #555; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; }
  a.button { display: inline-block; padding: 10px 18px; border-radius: 6px; border: 1px solid #0000ff; background: #0000ff; color: #fff; text-decoration: none; font-size: 14px; font-weight: 500; }
  a.secondary { background: #fff; color: #000; border-color: #e0e0e0; }
</style>
</head>
<body>
<main>
  <a class="brand" href="/">
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="0" y="18" width="5" height="6"/><rect x="6" y="14" width="5" height="10"/><rect x="12" y="10" width="5" height="14"/><polygon points="12,10 17,10 24,0" fill="#0000ff"/></svg>
    outship
  </a>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
  <div class="actions">
    ${retry ? `<a class="button" href="${LOGIN_PATH}">try again</a>` : ""}
    <a class="button secondary" href="/">back to outship</a>
  </div>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
