"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "submitting" | "submitted" | "error";

export function EmailCaptureForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = new FormData(form).get("email");

    setStatus("submitting");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error(await response.text());
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  if (status === "submitted") {
    return (
      <p className="text-sm text-blue-tint">
        you&apos;re on the list — first recap lands soon.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-2">
      <div className="flex w-full gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          aria-label="Email address"
          className="w-full rounded-md border border-white/20 bg-transparent px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-base-blue focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          aria-label="Subscribe to the weekly ship recap"
          className="flex shrink-0 items-center justify-center rounded-md bg-base-blue px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          →
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-white/60">
          something went wrong — try again in a bit.
        </p>
      )}
    </form>
  );
}
