// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { CreateSheet } from "@/components/app/create-sheet";

const push = vi.fn();
const pathname = { current: "/pulse" };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname.current,
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup();
  push.mockReset();
});

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("dialog button")].find((node) =>
    node.textContent?.includes(label),
  );
  if (!found) throw new Error(`No button ${label}`);
  return found as HTMLButtonElement;
}

describe("Create sheet", () => {
  it("opens the built composer, community, event and poll destinations", () => {
    const onClose = vi.fn();
    render(<CreateSheet open onClose={onClose} />);
    for (const [label, href] of [
      ["Post", "/compose?type=post"],
      ["Ask a question", "/compose?type=question"],
      ["Create a poll", "/compose?type=poll"],
      ["Start a community", "/communities/new"],
      ["Create an event", "/events/new"],
    ]) {
      push.mockReset();
      fireEvent.click(button(label));
      expect(push).toHaveBeenCalledWith(href);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps Campus Voice as the only coming-soon option and hides announcements by default", () => {
    render(<CreateSheet open onClose={() => undefined} />);
    expect(button("Campus Voice").disabled).toBe(true);
    expect(() => button("Post an announcement")).toThrow();
  });

  it("shows announcements only when the viewer may announce", () => {
    render(<CreateSheet open onClose={() => undefined} canAnnounce />);
    expect(button("Post an announcement")).toBeTruthy();
    expect(button("Campus Voice").disabled).toBe(true);
  });
});
