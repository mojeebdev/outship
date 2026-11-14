"use client";

import { useState } from "react";
import { IconCopy } from "@/components/icons";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:border-void"
    >
      <IconCopy className="h-3.5 w-3.5" aria-hidden="true" />
      <span aria-live="polite">{copied ? "copied" : label}</span>
    </button>
  );
}
