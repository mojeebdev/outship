"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * `useLayoutEffect` on the client, `useEffect` on the server render.
 *
 * The animation has to start before the first paint, or the final number
 * flashes on screen and then jumps back to zero.
 */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A word count that counts up to its real value.
 *
 * The real number is what React renders, so it is in the server HTML and is
 * what someone sees with JavaScript off. The animation is a DOM-level
 * enhancement layered on afterwards, skipped entirely when the visitor asks for
 * reduced motion. The value exposed to assistive technology is the final one,
 * announced once rather than on every frame.
 */
export function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const digitsRef = useRef<HTMLSpanElement>(null);

  useIsomorphicLayoutEffect(() => {
    const node = digitsRef.current;
    if (!node) return;

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Leave the rendered number exactly as it is.
    if (prefersReducedMotion || value === 0) return;

    const format = (count: number) => count.toLocaleString("en-US");
    const duration = Math.min(1400, 500 + Math.log10(Math.max(value, 10)) * 250);
    const startedAt = performance.now();
    let frame = 0;

    node.textContent = "0";

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      // Ease out, so it decelerates onto the real number rather than snapping.
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = format(Math.round(value * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        node.textContent = format(value);
      }
    };

    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      node.textContent = format(value);
    };
  }, [value]);

  return (
    <span className={className}>
      <span ref={digitsRef} aria-hidden="true">
        {value.toLocaleString("en-US")}
      </span>
      <span className="word-sr-only">{value.toLocaleString("en-US")}</span>
    </span>
  );
}
