import type { Metadata } from "next";
import { OfflineFeed } from "@/components/pulse/offline-feed";

export const metadata: Metadata = { title: "You're offline", robots: { index: false } };
export const dynamic = "force-static";

export default function OfflinePage() {
  return <OfflineFeed />;
}
