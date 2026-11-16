import { IconX } from "@/components/icons";
import { shuffled, testimonialHref, TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

// A few quotes read best laid out; once there are more than this, they
// scroll slowly instead, so the row never looks sparse or runs off the page.
const SCROLL_FROM = 4;
// Seconds on screen per card, so adding more doesn't speed the row up.
const SECONDS_PER_CARD = 12;

function Card({ testimonial, scrolling }: { testimonial: Testimonial; scrolling: boolean }) {
  const { handle, name, avatar, quote } = testimonial;
  return (
    <figure
      className={`flex flex-col justify-between gap-5 rounded-lg border border-border bg-white p-5 ${
        scrolling ? "w-80 shrink-0 sm:w-96" : "w-full sm:w-96"
      }`}
    >
      <blockquote className="text-pretty">&ldquo;{quote}&rdquo;</blockquote>
      <figcaption>
        <a
          href={testimonialHref(testimonial)}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-base-blue"
        >
          {/* A copy saved with the site (see scripts/add-testimonial.mjs), already sized: nothing to optimise. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatar} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-full bg-cream object-cover" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-xs text-text-muted-1">@{handle}</span>
          </span>
          <IconX aria-label="on X" className="h-4 w-4 shrink-0 text-text-muted-2 transition group-hover:text-void" />
        </a>
      </figcaption>
    </figure>
  );
}

/** What builders say about outship, in their own words. Renders nothing until there's one. */
export function Testimonials({ items = TESTIMONIALS }: { items?: Testimonial[] }) {
  if (items.length === 0) return null;
  // Home is rendered per request, so the order differs from visit to visit.
  const order = shuffled(items);
  const scrolling = order.length >= SCROLL_FROM;

  return (
    <section aria-labelledby="testimonials-heading" className="overflow-hidden px-6 py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex flex-col gap-2">
          <h2 id="testimonials-heading" className="text-3xl font-medium">
            what builders are saying
          </h2>
          <p className="text-text-muted-1">real posts from builders on x, in their own words.</p>
        </div>

        {scrolling ? (
          // Fades out at the edges. With reduced motion the row doesn't move
          // and scrolls by hand, showing one copy only.
          <div
            className="-mx-6 overflow-x-auto px-6 motion-safe:overflow-hidden motion-safe:[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
          >
            <ul
              className="testimonial-track flex w-max"
              style={{ "--testimonial-duration": `${order.length * SECONDS_PER_CARD}s` } as React.CSSProperties}
            >
              {[0, 1].map((copy) => (
                <li key={copy} aria-hidden={copy === 1 || undefined} className={copy === 1 ? "motion-reduce:hidden" : ""}>
                  <ul className="flex gap-4 pr-4">
                    {order.map((testimonial, i) => (
                      <li key={`${testimonial.handle}-${i}`} className="flex">
                        <Card testimonial={testimonial} scrolling />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="flex flex-wrap justify-start gap-4">
            {order.map((testimonial, i) => (
              <li key={`${testimonial.handle}-${i}`} className="flex w-full sm:w-auto">
                <Card testimonial={testimonial} scrolling={false} />
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-text-muted-2">
          shipped something with outship? post about it and tag{" "}
          <a href="https://x.com/outshipdev" target="_blank" rel="noreferrer" className="text-base-blue hover:underline">
            @outshipdev
          </a>
          .
        </p>
      </div>
    </section>
  );
}
