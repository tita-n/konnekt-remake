// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { CheckinScanner } from "@/components/events/checkin-scanner";

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const event = {
  id: "event-1",
  title: "Scanner test",
  timezone: "Africa/Lagos",
  checkInEnabled: true,
  startsAt: new Date("2026-11-27T10:00:00Z").toISOString(),
  endsAt: new Date("2026-11-27T12:00:00Z").toISOString(),
  venueName: "Hall",
  goingCount: 3,
} as never;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

afterEach(() => {
  cleanup();
});

describe("check-in scanner", () => {
  it("exposes the manual check-in branch", async () => {
    render(<CheckinScanner event={event} initialCheckedIn={0} />);

    const manual = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Find student"),
    );
    expect(manual).toBeTruthy();
    // The QR branch is the default; the manual label is not rendered yet.
    expect(document.body.textContent).not.toContain("Find a student who RSVP");

    fireEvent.click(manual!);
    await waitFor(() => {
      expect(document.body.textContent).toContain("Find a student who RSVP");
    });
  });
});
