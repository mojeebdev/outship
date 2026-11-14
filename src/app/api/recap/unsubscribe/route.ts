import { getDb } from "@/lib/db";
import { unsubscribeByToken } from "@/lib/email/subscribers";

export const dynamic = "force-dynamic";

// Two callers:
// - mailbox providers doing RFC 8058 one-click unsubscribe: a POST to the
//   List-Unsubscribe URL (token in the query) with List-Unsubscribe=One-Click;
// - the button on /recap?unsubscribe=..., which posts the token as a form field.
// A plain GET never unsubscribes, so link scanners can't do it by accident.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData().catch(() => null);
  const formToken = form?.get("token");
  const token = url.searchParams.get("token") ?? (typeof formToken === "string" ? formToken : "");
  const state = await unsubscribeByToken(await getDb(), token);

  if (form?.get("List-Unsubscribe") === "One-Click") {
    return new Response(state === "invalid" ? "unknown subscription" : "unsubscribed", {
      status: state === "invalid" ? 404 : 200,
    });
  }
  return Response.redirect(new URL(`/recap?status=${state}`, request.url), 303);
}
