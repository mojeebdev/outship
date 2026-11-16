"use client";

import { useEffect, useRef } from "react";
import { IconGithub } from "@/components/icons";

const DISMISSED = "outship:install-prompt-dismissed";

// The pop-up on /profile for a builder who signed in but hasn't installed the
// GitHub App: until they do, nothing they ship counts, so it's worth one
// interruption. "later" hides it for the rest of the browser session; the
// banner on the page stays. A native <dialog>, so focus, Esc and the backdrop
// behave as people expect.
export function InstallAppPrompt({ installUrl }: { installUrl: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISSED) === "1";
    } catch {
      // Storage blocked: show it; "later" still closes it.
    }
    if (!dismissed) dialog.current?.showModal();
  }, []);

  const later = () => {
    try {
      sessionStorage.setItem(DISMISSED, "1");
    } catch {
      // Storage blocked: it just shows again next visit.
    }
    dialog.current?.close();
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="install-app-title"
      onCancel={later}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself, not its card.
        if (event.target === dialog.current) later();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-white p-0 text-void shadow-xl backdrop:bg-void/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-tint">
          <IconGithub className="h-5 w-5 text-base-blue" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 id="install-app-title" className="text-xl font-medium">
            one step left: install the github app
          </h2>
          <p className="text-sm text-text-muted-1">
            outship only counts what the app can see. pick the repos you want tracked: your last 12 months of
            releases, merged PRs and commits come in, and every new push, merge and release scores as it
            happens. private repos count too, and stay hidden.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          <a
            href={installUrl}
            className="inline-flex items-center justify-center gap-2.5 rounded-md bg-base-blue px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            <IconGithub className="h-4 w-4" aria-hidden="true" />
            install on github
          </a>
          <button
            type="button"
            onClick={later}
            className="rounded-md border border-border px-5 py-2.5 text-sm font-medium transition hover:border-void"
          >
            later
          </button>
        </div>
      </div>
    </dialog>
  );
}
