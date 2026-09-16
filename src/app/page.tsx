import { Nav } from "@/components/nav";
import { Hero } from "@/components/hero";
import { FeaturedShips } from "@/components/featured-ships";
import { ShipsGrid } from "@/components/ships-grid";
import { ManifestoTeaser } from "@/components/manifesto-teaser";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">
        <Hero />
        <FeaturedShips />
        <ShipsGrid />
        <ManifestoTeaser />
      </main>
      <Footer />
    </div>
  );
}
