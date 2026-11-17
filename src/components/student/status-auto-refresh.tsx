"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Polls the status page every 60s so approvals appear without a manual reload. */
export function StatusAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
