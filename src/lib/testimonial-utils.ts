/**
 * What builders have said about outship, in their own words. Added with
 * `npm run testimonial` (scripts/add-testimonial.mjs), which saves the name
 * and a copy of the profile picture here, so the home page never calls X.
 */
export type Testimonial = {
  /** X handle, without the @. */
  handle: string;
  /** Display name, as it was when added. */
  name: string;
  /** A picture saved in /public/testimonials. */
  avatar: string;
  /** Their words, verbatim. */
  quote: string;
  /** The post itself, when we have it; otherwise the profile is linked. */
  url?: string;
};

/** Where a testimonial's attribution links to. */
export const testimonialHref = (t: Testimonial) => t.url ?? `https://x.com/${t.handle}`;

/** In random order, so a repeat visitor doesn't always meet the same one first. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
