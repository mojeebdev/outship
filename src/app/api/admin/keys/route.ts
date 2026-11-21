import { getDb } from "@/lib/db";
import { currentAdmin } from "@/lib/admin";
import { generateApiKey } from "@/lib/api/keys";
import { escapeHtml } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

// Issues an API key from the admin panel. The key is shown on the page this
// returns, once; only its hash is stored. Like every form here, it relies on
// the SameSite=Lax session cookie, which a cross-site POST doesn't carry.
export async function POST(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return new Response("not found", { status: 404 });

  const form = await request.formData().catch(() => null);
  const field = (name: string) => String(form?.get(name) ?? "").trim().slice(0, 200);
  const name = field("name");
  const owner = field("owner");
  const contact = field("contact") || null;
  const rate = Math.min(10_000, Math.max(1, Math.floor(Number(field("rate")) || 120)));
  if (!name || !owner) return Response.redirect(new URL("/admin/platform", request.url), 303);

  const { key, prefix, hash } = await generateApiKey();
  await (await getDb()).apiKey.create({ data: { name, owner, contact, prefix, hash, ratePerMinute: rate } });

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>new API key — outship</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
main{max-width:560px;margin:24px 16px;padding:28px;background:#fff;border:1px solid #e0e0e0;border-radius:12px}
code{display:block;word-break:break-all;background:#f5f5f0;padding:12px;border-radius:8px;font-size:14px}
p{line-height:1.55;color:#444}a{color:#0000ff}</style></head><body><main>
<h1 style="font-size:20px;font-weight:500;margin:0 0 8px">key for ${escapeHtml(owner)}</h1>
<p>${escapeHtml(name)} · ${rate} requests a minute</p>
<code>${escapeHtml(key)}</code>
<p><strong>copy it now: this is the only time it's shown.</strong> outship keeps only its hash. send it to them over a private channel.</p>
<p><a href="/admin/platform">back to platform operations</a></p></main></body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
