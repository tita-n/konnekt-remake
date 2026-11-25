/**
 * Server-side .ics generation. Formatting helpers live in event-display.ts so
 * client components never pull Node's Buffer into the browser bundle.
 */
import {
  calendarMonthBounds,
  eventDateKey,
  formatEventDate,
  formatEventDayShort,
  formatEventTime,
  formatEventWhen,
  eventDateParts,
  timezoneOffsetMs,
  zonedTimeToUtc,
} from "./event-display";

export {
  calendarMonthBounds,
  eventDateKey,
  formatEventDate,
  formatEventDayShort,
  formatEventTime,
  formatEventWhen,
  eventDateParts,
  timezoneOffsetMs,
  zonedTimeToUtc,
};

/* ---------------------------------- .ics --------------------------------- */

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let index = 0;
  let first = true;
  while (index < bytes.length) {
    const limit = first ? 75 : 74;
    let end = Math.min(index + limit, bytes.length);
    while (end > index) {
      const byte = bytes[end];
      if (byte === undefined || byte < 0x80 || (byte & 0xc0) !== 0x80) break;
      end -= 1;
    }
    if (end === index) end = Math.min(index + limit, bytes.length);
    chunks.push((first ? "" : " ") + bytes.subarray(index, end).toString("utf8"));
    index = end;
    first = false;
  }
  return chunks.join("\r\n");
}

function icsDate(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export interface IcsEventInput {
  id: string;
  title: string;
  description: string;
  startsAt: Date | string;
  endsAt: Date | string;
  venueName: string;
  status?: "SCHEDULED" | "CANCELLED" | "REMOVED";
  url?: string;
  sequence?: number;
}

/** One visible event, or the viewer's My Events list. Never attendee data. */
export function buildIcs(input: {
  events: readonly IcsEventInput[];
  now?: Date;
  productId?: string;
  calendarName?: string;
  baseUrl?: string;
}): string {
  const now = input.now ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${input.productId ?? "-//Konnekt//Events//EN"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(input.calendarName ?? "Konnekt events")}`,
  ];
  for (const event of input.events) {
    if (event.status === "REMOVED") continue;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@konnekt.ng`);
    lines.push(`DTSTAMP:${icsDate(now)}`);
    lines.push(`DTSTART:${icsDate(new Date(event.startsAt))}`);
    lines.push(`DTEND:${icsDate(new Date(event.endsAt))}`);
    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    lines.push(`LOCATION:${escapeIcsText(event.venueName)}`);
    if (event.status === "CANCELLED") lines.push("STATUS:CANCELLED");
    if (event.sequence !== undefined) lines.push(`SEQUENCE:${event.sequence}`);
    if (event.url && input.baseUrl) lines.push(`URL:${input.baseUrl}${event.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

export function icsFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "konnekt-event"}.ics`;
}
