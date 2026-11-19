"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareProfileButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/profile/${username}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Student profile on Konnekt", url });
        return;
      } catch {
        // Fall back to copying when the share sheet is dismissed or unavailable.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this profile link", url);
    }
  }

  return (
    <Button
      variant="secondary"
      fullWidth
      className="rounded-full"
      leftIcon={copied ? <Check aria-hidden="true" className="size-4" /> : <Share2 aria-hidden="true" className="size-4" />}
      onClick={() => void share()}
    >
      {copied ? "Link copied" : "Share profile"}
    </Button>
  );
}
