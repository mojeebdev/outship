import { SiteShell } from "@/components/site-shell";
import { Hero } from "@/components/hero";
import { LiveShipFeed } from "@/components/live-ship-feed";
import { ShipsGrid } from "@/components/ships-grid";
import { ManifestoTeaser } from "@/components/manifesto-teaser";
import { FaqTeaser } from "@/components/faq-teaser";

// The feed and the "shipped today" number are read live on every request.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <SiteShell>
      <Hero />
      <LiveShipFeed />
      <ShipsGrid />
      <FaqTeaser />
      <ManifestoTeaser />
    </SiteShell>
  );
}
