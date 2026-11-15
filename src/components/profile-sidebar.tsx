"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

export type ProfileSection = { id: string; label: string };

// /profile runs long: the badge and the settings sit far below the first
// screen, where nobody finds them by scrolling. This lists every section and
// marks the one on screen, as a sticky column on wide screens and a sticky
// strip of pills on narrow ones (a column would squeeze the cards there).
export function ProfileSidebar({ sections }: { sections: ProfileSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const strip = useRef<HTMLElement>(null);

  useEffect(() => {
    const targets = sections
      .map(({ id }) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    // A section counts as current once its top passes a line a quarter of the
    // way down the screen, so the mark moves as you read, not when a heading
    // first peeks in at the bottom.
    const pick = () => {
      const line = window.innerHeight * 0.25;
      let current = targets[0]?.id;
      for (const el of targets) if (el.getBoundingClientRect().top <= line) current = el.id;
      // At the very bottom the last section may never reach the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = targets[targets.length - 1]?.id;
      }
      setActive(current);
    };
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, [sections]);

  // Opening /profile#settings: the browser jumps there while the page loads,
  // but anything that resets the scroll afterwards (seen on the live site, not
  // reproduced locally) would leave you at the top with #settings in the bar.
  // Going there again once the page is up makes the link land either way.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!sections.some((section) => section.id === id)) return;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, [sections]);

  // A click scrolls to the section here rather than leaving it to the
  // browser's own jump, for the same reason, and marks it at once. The href
  // stays, so the links still work before the script loads.
  const go = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", `#${id}`);
    setActive(id);
  };

  // On phones the strip is wider than the screen: keep the current pill in
  // view. scrollLeft, not scrollIntoView, so the page itself never jumps.
  useEffect(() => {
    const nav = strip.current;
    const pill = nav?.querySelector<HTMLElement>(`a[href="#${active}"]`);
    if (!nav || !pill) return;
    const left = pill.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    if (left < nav.scrollLeft || left + pill.offsetWidth > nav.scrollLeft + nav.clientWidth) {
      nav.scrollTo({ left: left - 24, behavior: "smooth" });
    }
  }, [active]);

  const link = (id: string, wide: boolean) => {
    const on = id === active;
    const base = wide
      ? "block rounded-md border-l-2 px-3 py-2 text-sm transition"
      : "block shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition";
    const state = wide
      ? on
        ? "border-base-blue bg-blue-tint font-medium text-base-blue"
        : "border-transparent text-text-muted-1 hover:text-void"
      : on
        ? "border-base-blue bg-base-blue font-medium text-white"
        : "border-border bg-white text-text-muted-1 hover:text-void";
    return `${base} ${state}`;
  };

  return (
    <>
      <nav
        ref={strip}
        aria-label="profile sections"
        className="sticky top-0 z-10 -mx-6 overflow-x-auto bg-cream/95 px-6 py-3 backdrop-blur lg:hidden"
      >
        <ul className="flex gap-2">
          {sections.map(({ id, label }) => (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                onClick={(event) => go(event, id)}
                aria-current={id === active ? "true" : undefined}
                className={link(id, false)}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="profile sections" className="sticky top-6 hidden self-start lg:block">
        <p className="px-3 pb-2 text-xs font-medium text-text-muted-2">on this page</p>
        <ul className="flex flex-col gap-0.5">
          {sections.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={(event) => go(event, id)}
                aria-current={id === active ? "true" : undefined}
                className={link(id, true)}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
