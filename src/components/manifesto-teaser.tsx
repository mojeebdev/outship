import Link from "next/link";
import { getDb } from "@/lib/db";
import { PUBLIC_BUILDER } from "@/lib/builders";

/** Builders with at least one ship since 00:00 UTC today. */
async function buildersShippedToday(): Promise<number> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const rows = await (await getDb()).ship.findMany({
    where: { shippedAt: { gte: today }, builder: PUBLIC_BUILDER },
    distinct: ["builderId"],
    select: { builderId: true },
  });
  return rows.length;
}

export async function ManifestoTeaser() {
  const shippedToday = await buildersShippedToday();

  return (
    <section className="px-6 py-20">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-10 sm:flex-row sm:justify-center">
        {/* A real number, not a prop: it's read from today's ships. */}
        <div className="flex w-56 -rotate-3 flex-col gap-1 rounded-md border border-border bg-white p-5 shadow-md">
          <span className="text-4xl font-medium text-base-blue">{shippedToday}</span>
          <span className="text-sm">
            builder{shippedToday === 1 ? "" : "s"} shipped today
          </span>
          <span className="text-xs text-text-muted-2">since 00:00 UTC</span>
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
