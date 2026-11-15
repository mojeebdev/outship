import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

// navOverlay floats the nav over the page's first section (the home page's
// hero), instead of above it.
export function SiteShell({ children, navOverlay = false }: { children: ReactNode; navOverlay?: boolean }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Nav overlay={navOverlay} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
