const shipsItems = [
  { letter: "S", label: "Streaks", description: "stay active daily" },
  { letter: "H", label: "Highlights", description: "share your week" },
  { letter: "I", label: "Index", description: "browse builders" },
  { letter: "P", label: "Profile", description: "github, ranked" },
  { letter: "S", label: "Score", description: "quality + cadence" },
];

export function ShipsGrid() {
  return (
    <section className="border-y border-border px-6 py-16">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-5">
        {shipsItems.map(({ letter, label, description }, index) => (
          <div key={`${label}-${index}`} className="flex flex-col gap-2">
            <span className="text-5xl font-medium text-base-blue">
              {letter}
            </span>
            <span className="font-medium">{label}</span>
            <span className="text-sm text-text-muted-1">{description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
