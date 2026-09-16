import { SiteShell } from "@/components/site-shell";
import { Hero } from "@/components/hero";
import { FeaturedShips } from "@/components/featured-ships";
import { ShipsGrid } from "@/components/ships-grid";
import { ManifestoTeaser } from "@/components/manifesto-teaser";

export default function Home() {
  return (
    <SiteShell>
      <Hero />
      <FeaturedShips />
      <ShipsGrid />
      <ManifestoTeaser />
    </SiteShell>
  );
}
