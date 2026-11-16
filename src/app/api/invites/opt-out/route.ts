import { getCloudflareContext } from "@opennextjs/cloudflare";
import { optOutOfInvites } from "@/lib/invites";

export const dynamic = "force-dynamic";

// "Never email me again". POST only: mail scanners open every link in an
// email, so a GET could opt someone out who never asked. The link in the
// email opens /invite/opt-out, whose button posts here; mail apps' one-click
// unsubscribe (RFC 8058) posts here directly.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? url.searchParams.get("token") ?? "");
  const { env } = await getCloudflareContext({ async: true });
  await optOutOfInvites(env.DB, token);
  return Response.redirect(new URL("/invite/opt-out?done=1", request.url), 303);
}
