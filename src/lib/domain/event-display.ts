/**
 * Client-safe timezone formatting for events. No Node built-ins live here so
 * the same helpers can be imported by server components and client forms.
 */

const DEFAULT_LOCALE = "en-NG";

function partsFor(date: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return parts;
}

export function timezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = partsFor(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function zonedTimeToUtc(
  input: { year: number; month: number; day: number; hour?: number; minute?: number },
  timeZone: string,
): Date {
  const guess = Date.UTC(input.year, input.month - 1, input.day, input.hour ?? 0, input.minute ?? 0, 0);
  let offset = timezoneOffsetMs(new Date(guess), timeZone);
  let utc = guess - offset;
  offset = timezoneOffsetMs(new Date(utc), timeZone);
  utc = guess - offset;
  return new Date(utc);
}

export function eventDateKey(date: Date | string, timeZone: string): string {
  const parts = partsFor(new Date(date), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatEventDate(date: Date | string, timeZone: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatEventTime(date: Date | string, timeZone: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function formatEventDayShort(date: Date | string, timeZone: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function formatEventWhen(
  startsAt: Date | string,
  endsAt: Date | string,
  timeZone: string,
  locale = DEFAULT_LOCALE,
): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = eventDateKey(start, timeZone) === eventDateKey(end, timeZone);
  const date = formatEventDate(start, timeZone, locale);
  const startTime = formatEventTime(start, timeZone, locale);
  const endTime = formatEventTime(end, timeZone, locale);
  return sameDay
    ? `${date} · ${startTime} – ${endTime}`
    : `${date} ${startTime} – ${formatEventDate(end, timeZone, locale)} ${endTime}`;
}

export interface DateKeyParts {
  year: number;
  month: number;
  day: number;
}

export function eventDateParts(date: Date | string, timeZone: string): DateKeyParts {
  const parts = partsFor(new Date(date), timeZone);
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

export function calendarMonthBounds(year: number, month: number, timeZone: string): { start: Date; end: Date } {
  const start = zonedTimeToUtc({ year, month, day: 1, hour: 0 }, timeZone);
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = zonedTimeToUtc({ ...nextMonth, day: 1, hour: 0 }, timeZone);
  return { start, end };
}

/** Local wall-clock value for a datetime-local input in the event timezone. */
export function toDatetimeLocalValue(date: Date | string, timeZone: string): string {
  const parts = partsFor(new Date(date), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Parse a datetime-local value as a wall clock in the event timezone. */
export function fromDatetimeLocalValue(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return zonedTimeToUtc(
    {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
    },
    timeZone,
  );
}
