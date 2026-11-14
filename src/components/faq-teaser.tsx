import Link from "next/link";
import { FaqList } from "@/components/faq-list";
import { IconArrowRight } from "@/components/icons";
import { FEATURED_FAQS } from "@/lib/faq";

// The home page's short FAQ: the questions people ask first, from the same
// source as /faq. No FAQPage structured data here; that lives on /faq only.
export function FaqTeaser() {
  return (
    <section aria-labelledby="faq-teaser-heading" className="px-6 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div className="flex flex-col items-start gap-4">
          <h2 id="faq-teaser-heading" className="text-3xl font-medium">
            questions, answered
          </h2>
          <p className="text-text-muted-1">
            how ships are counted, what it costs and what stays private.
          </p>
          <Link
            href="/faq"
            className="group inline-flex min-h-11 items-center gap-2 text-sm font-medium text-base-blue"
          >
            all questions
            <IconArrowRight
              aria-hidden="true"
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none"
            />
          </Link>
        </div>
        <FaqList faqs={FEATURED_FAQS} />
      </div>
    </section>
  );
}
