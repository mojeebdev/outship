export function ProfilePageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="flex flex-col gap-1 border-b border-border pb-4">
      <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-base-blue">{eyebrow}</p>
      <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">{title}</h2>
      <p className="max-w-2xl text-sm leading-6 text-text-muted-1">{description}</p>
    </header>
  );
}
