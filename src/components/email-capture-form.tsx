"use client";

import { useState, type FormEvent } from "react";

export function EmailCaptureForm() {
  const [status, setStatus] = useState<"idle" | "submitted">("idle");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitted");
  }

  if (status === "submitted") {
    return (
      <p className="text-sm text-blue-tint">
        you&apos;re on the list — first recap lands soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm gap-2">
      <input
        type="email"
        required
        placeholder="you@example.com"
        aria-label="Email address"
        className="w-full rounded-md border border-white/20 bg-transparent px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-base-blue focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Subscribe to the weekly ship recap"
        className="flex shrink-0 items-center justify-center rounded-md bg-base-blue px-4 text-sm font-medium text-white transition hover:opacity-90"
      >
        →
      </button>
    </form>
  );
}
