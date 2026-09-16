import { clearSessionCookieHeader } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = new Headers();
  headers.set("Location", new URL("/", request.url).toString());
  headers.append("Set-Cookie", clearSessionCookieHeader());
  return new Response(null, { status: 302, headers });
}
