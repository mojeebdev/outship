"use client";

import { useState, type FormEvent } from "react";
import { IconArrowRight } from "@/components/icons";

type Status = "idle" | "submitting" | "submitted" | "limited" | "error";

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
      if (response.status === 429) {
        setStatus("limited");
        return;
      }
      if (!response.ok) throw new Error(await response.text());
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  if (status === "submitted") {
    return (
      <p className="text-sm text-white">
        almost there: check your inbox to confirm.
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
          className="w-full rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/55 focus:border-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          aria-label="Subscribe to the weekly ship recap"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-base-blue transition hover:bg-cream disabled:opacity-50"
        >
          <IconArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-white/70">
          something went wrong — try again in a bit.
        </p>
      )}
      {status === "limited" && (
        <p className="text-xs text-white/70">
          too many tries from here — give it a few minutes.
        </p>
      )}
    </form>
  );
}
