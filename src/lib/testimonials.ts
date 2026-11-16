import data from "./testimonials.json";
import type { Testimonial } from "./testimonial-utils";

export { shuffled, testimonialHref, type Testimonial } from "./testimonial-utils";

/** Everything builders have said, from testimonials.json (see scripts/add-testimonial.mjs). */
export const TESTIMONIALS: Testimonial[] = data;
