import { Suspense } from "react";
import { SiteShell } from "@/components/site-shell";
import { FeedSkeleton } from "@/components/skeletons";
import { Hero } from "@/components/hero";
import { LiveShipFeed } from "@/components/live-ship-feed";
import { ShipsGrid } from "@/components/ships-grid";
import { ManifestoTeaser } from "@/components/manifesto-teaser";
import { FaqTeaser } from "@/components/faq-teaser";

// The feed and the "shipped today" number are read live on every request.
// Only the feed waits on the database: the hero shows at once, and the feed
// streams in behind a skeleton.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <SiteShell navOverlay>
      <Hero />
      <Suspense fallback={<FeedSkeleton />}>
        <LiveShipFeed />
      </Suspense>
      <ShipsGrid />
      <FaqTeaser />
      <ManifestoTeaser />
    </SiteShell>
  );
}
