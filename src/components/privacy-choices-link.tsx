"use client";

export function PrivacyChoicesLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("outship:privacy-choices"))}
      className={className}
    >
      privacy choices
    </button>
  );
}
