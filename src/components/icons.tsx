import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

/** Full logo mark — ascending bars breaking into a rising point. */
export function LogoMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <rect x="0" y="18" width="5" height="6" />
      <rect x="6" y="14" width="5" height="10" />
      <rect x="12" y="10" width="5" height="14" />
      <polygon points="12,10 17,10 24,0" />
    </svg>
  );
}

/** i-ship — a single ship/release event. */
export function IconShip(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <polygon points="10,2 18,17 2,17" />
    </svg>
  );
}

/** i-streak — consistency / active streak. */
export function IconStreak(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <rect x="2" y="12" width="4" height="6" />
      <rect x="8" y="7" width="4" height="11" />
      <rect x="14" y="2" width="4" height="16" />
    </svg>
  );
}

/** i-seal — onchain / verified / attested. */
export function IconSeal(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <rect
        x="2"
        y="2"
        width="16"
        height="16"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="7" y="7" width="6" height="6" />
    </svg>
  );
}

/** i-node — commit / connection. */
export function IconNode(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <rect x="7" y="1" width="6" height="6" />
      <line x1="10" y1="7" x2="10" y2="13" stroke="currentColor" strokeWidth="2" />
      <rect x="7" y="13" width="6" height="6" />
    </svg>
  );
}

/** i-grid — index / builder directory. */
export function IconGrid(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <rect x="2" y="2" width="7" height="7" />
      <rect x="11" y="2" width="7" height="7" />
      <rect x="2" y="11" width="7" height="7" />
      <rect x="11" y="11" width="7" height="7" />
    </svg>
  );
}

/** GitHub brand mark — third-party icon, left as-is. */
export function IconGithub(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.78 1.19 1.78 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 2.87-.39c.97.01 1.95.13 2.87.39 2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.73.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.13 0 1.54-.01 2.79-.01 3.17 0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

/** X (Twitter) brand mark — third-party icon, left as-is. */
export function IconX(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.24 2H21.5l-7.3 8.34L22.8 22h-6.75l-5.29-6.92L4.7 22H1.44l7.8-8.92L1 2h6.92l4.78 6.32L18.24 2Zm-1.18 18h1.82L7.02 3.9H5.07L17.06 20Z" />
    </svg>
  );
}
