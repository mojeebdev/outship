import Link from "next/link";

const checklist = [
  { label: "shipped today", checked: true },
  { label: "in progress", checked: false },
  { label: "blocked", checked: false },
  { label: "shelved", checked: false },
];

export function ManifestoTeaser() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-10 sm:flex-row sm:justify-center">
        <div className="w-56 -rotate-3 rounded-md border border-border bg-white p-5 shadow-md">
          <ul className="flex flex-col gap-3 text-sm">
            {checklist.map(({ label, checked }) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`h-3.5 w-3.5 shrink-0 border border-void ${
                    checked ? "bg-base-blue" : "bg-transparent"
                  }`}
                />
                <span className={checked ? "" : "text-text-muted-1"}>
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="max-w-sm text-center text-lg sm:text-left">
          this isn&apos;t a portfolio. it&apos;s proof you&apos;re still
          shipping.{" "}
          <Link href="/manifesto" className="text-base-blue hover:underline">
            read the manifesto →
          </Link>
        </p>
      </div>
    </section>
  );
}
