"use client";

import Link from "next/link";
import { useSignedIn } from "@/components/use-signed-in";

export const PROFILE_LINK = { href: "/profile", label: "profile" } as const;
export const SIGN_IN_LINK = { href: "/api/auth/github/login", label: "sign in" } as const;

// "profile" for a signed-in builder, "sign in" for everyone else. Sign-in is
// an API route that redirects to GitHub, so it's a plain anchor: next/link
// would try to prefetch it.
export function AccountNavLink({ className }: { className?: string }) {
  const signedIn = useSignedIn();
  if (signedIn === null) return null;
  return signedIn ? (
    <Link href={PROFILE_LINK.href} className={className}>
      {PROFILE_LINK.label}
    </Link>
  ) : (
    <a href={SIGN_IN_LINK.href} className={className}>
      {SIGN_IN_LINK.label}
    </a>
  );
}
