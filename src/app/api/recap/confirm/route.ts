import { getDb } from "@/lib/db";
import { confirmByToken } from "@/lib/email/subscribers";

export const dynamic = "force-dynamic";

// Confirmation happens on a button press (a POST), not on opening the link,
// so mail scanners that prefetch links can't confirm on someone's behalf.
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const token = typeof form?.get("token") === "string" ? (form.get("token") as string) : "";
  const state = await confirmByToken(await getDb(), token);
  return Response.redirect(new URL(`/recap?status=${state}`, request.url), 303);
}
