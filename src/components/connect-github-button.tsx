import type { ReactNode } from "react";
import { IconGithub } from "@/components/icons";

const LOGIN_PATH = "/api/auth/github/login";

type Props = {
  /** "button" is the filled call to action; "link" sits inside a sentence. */
  variant?: "button" | "link";
  children?: ReactNode;
};

// A plain <a>, not next/link: this route sets the OAuth state cookie and
// redirects off-site, so it must be a real navigation, never an RSC prefetch.
export function ConnectGithubButton({ variant = "button", children }: Props) {
  if (variant === "link") {
    return (
      <a
        href={LOGIN_PATH}
        className="inline-flex items-center gap-1.5 align-bottom text-base-blue hover:underline"
      >
        <IconGithub className="h-4 w-4 shrink-0" aria-hidden="true" />
        {children ?? "connect with github"}
      </a>
    );
  }

  return (
    <a
      href={LOGIN_PATH}
      className="inline-flex items-center justify-center gap-2.5 rounded-md border border-base-blue bg-base-blue px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-blue"
    >
      <IconGithub className="h-5 w-5 shrink-0" aria-hidden="true" />
      {children ?? "connect with github"}
    </a>
  );
}
