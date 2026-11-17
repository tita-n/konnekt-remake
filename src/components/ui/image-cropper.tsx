"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "./button";

/**
 * Square profile-photo cropper. The exported canvas is 1024px JPEG; callers
 * compress further before upload. Pointer drag + keyboard-accessible zoom.
 */
export function ImageCropper({
  file,
  onCancel,
  onSave,
  saving = false,
}: {
  file: File;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  saving?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const viewport = 288;
  const cover = natural ? Math.max(viewport / natural.width, viewport / natural.height) : 1;
  const scale = cover * zoom;
  const rendered = natural ? { width: natural.width * scale, height: natural.height * scale } : null;

  const clamp = useCallback(
    (x: number, y: number, zoomValue = zoom) => {
      if (!natural) return { x, y };
      const s = Math.max(viewport / natural.width, viewport / natural.height) * zoomValue;
      const maxX = Math.max(0, (natural.width * s - viewport) / 2);
      const maxY = Math.max(0, (natural.height * s - viewport) / 2);
      return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
    },
    [natural, zoom],
  );

  useEffect(() => {
    setOffset((current) => clamp(current.x, current.y));
  }, [clamp]);

  function exportCrop() {
    const image = imageRef.current;
    if (!image || !natural) return;
    const output = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = output;
    canvas.height = output;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = output / viewport;
    const drawWidth = natural.width * scale * ratio;
    const drawHeight = natural.height * scale * ratio;
    const drawX = (output - drawWidth) / 2 + offset.x * ratio;
    const drawY = (output - drawHeight) / 2 + offset.y * ratio;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, output, output);
    context.imageSmoothingQuality = "high";
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    canvas.toBlob(
      (blob) => {
        if (blob) onSave(blob);
      },
      "image/jpeg",
      0.88,
    );
  }

  return (
    <div className="space-y-4">
      <div
        ref={viewportRef}
        className="relative mx-auto size-72 touch-none overflow-hidden rounded-card border border-border bg-surface-2"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setOffset(
            clamp(
              drag.current.originX + (event.clientX - drag.current.startX),
              drag.current.originY + (event.clientY - drag.current.startY),
            ),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {src && natural ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imageRef}
            src={src}
            alt="Your selected profile photo. Drag to reposition."
            draggable={false}
            onLoad={(event) => {
              const image = event.currentTarget;
              setNatural({ width: image.naturalWidth, height: image.naturalHeight });
            }}
            className="absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              width: rendered?.width,
              height: rendered?.height,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src ?? ""}
            alt="Loading your photo"
            onLoad={(event) => {
              const image = event.currentTarget;
              setNatural({ width: image.naturalWidth, height: image.naturalHeight });
            }}
            className="size-full object-cover opacity-60"
          />
        )}
        <span className="pointer-events-none absolute inset-0 rounded-card ring-1 ring-inset ring-black/10" aria-hidden="true" />
      </div>

      <div className="flex items-center gap-3">
        <Minus aria-hidden="true" className="size-4 text-fg-subtle" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          aria-label="Zoom photo"
          onChange={(event) => {
            const next = Number(event.target.value);
            setZoom(next);
            setOffset((current) => clamp(current.x, current.y, next));
          }}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--accent)]"
        />
        <Plus aria-hidden="true" className="size-4 text-fg-subtle" />
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" fullWidth onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button fullWidth onClick={exportCrop} loading={saving} loadingLabel="Saving…" disabled={!natural}>
          Use photo
        </Button>
      </div>
    </div>
  );
}
