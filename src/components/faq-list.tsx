import type { Faq } from "@/lib/faq";

// An accordion of questions. Plain <details>, so it works without JavaScript
// and with the keyboard.
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-white">
      {faqs.map(({ question, text, answer }) => (
        <details key={question} className="group px-5 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:hidden [&::-webkit-details-marker]:hidden">
            {question}
            <span
              aria-hidden="true"
              className="text-xl leading-none text-text-muted-2 transition-transform group-open:rotate-45 motion-reduce:transition-none"
            >
              +
            </span>
          </summary>
          <p className="pt-3 leading-relaxed text-text-muted-1">{answer ?? text}</p>
        </details>
      ))}
    </div>
  );
}
