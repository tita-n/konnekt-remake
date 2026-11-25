import { ImageResponse } from "next/og";
import { getPublicEventPreview } from "@/lib/services/events";
import { formatEventDate, formatEventTime } from "@/lib/domain/event-display";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Konnekt event share card";

export default async function EventOpengraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const preview = await getPublicEventPreview(id).catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#12141a",
          color: "#ffffff",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700 }}>
          <span style={{ display: "flex", width: 44, height: 44, borderRadius: 12, background: "#4f46e5" }} />
          Konnekt
        </div>
        {preview ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>
              {preview.title.length > 80 ? `${preview.title.slice(0, 77)}…` : preview.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 30, color: "#c9ccd6", gap: 8 }}>
              <span>
                {formatEventDate(preview.startsAt, preview.timezone)} · {formatEventTime(preview.startsAt, preview.timezone)}
              </span>
              <span>{preview.venueName}</span>
              <span>{preview.universityName}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 800 }}>Something&apos;s happening on campus.</div>
            <div style={{ display: "flex", fontSize: 30, color: "#c9ccd6" }}>Join your university community on Konnekt.</div>
          </div>
        )}
        <div style={{ display: "flex", fontSize: 22, color: "#8f96a6", justifyContent: "space-between" }}>
          <span>Only students of this university can RSVP.</span>
          <span>konnekt.app</span>
        </div>
      </div>
    ),
    size,
  );
}
