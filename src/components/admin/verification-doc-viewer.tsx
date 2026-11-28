"use client";

import { useState } from "react";
import { ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerificationDocViewer({
  src,
  alt,
  href,
}: {
  src: string;
  alt: string;
  href: string;
}) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className="bg-surface-2 p-3">
      <div className="min-h-[240px] overflow-auto rounded-input border border-border bg-surface p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          decoding="async"
          onClick={() => setZoomed((prev) => !prev)}
          className={cn(
            "mx-auto cursor-zoom-in rounded-lg object-contain transition-transform duration-200",
            zoomed ? "max-h-none scale-150 cursor-zoom-out" : "max-h-[480px] w-auto",
          )}
        />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setZoomed((prev) => !prev)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-button border border-border bg-surface px-3 text-small font-semibold text-fg hover:bg-surface-3"
        >
          {zoomed ? <ZoomOut aria-hidden="true" className="size-4" /> : <ZoomIn aria-hidden="true" className="size-4" />}
          {zoomed ? "Fit to card" : "Zoom in"}
        </button>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 min-w-11 items-center gap-1.5 px-2 text-small font-semibold text-accent-ink hover:underline"
        >
          Open full size <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
