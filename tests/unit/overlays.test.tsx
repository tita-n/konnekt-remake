// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BottomSheet, Dialog } from "@/components/ui/overlays";

const pathname = vi.hoisted(() => ({ current: "/pulse" }));
vi.mock("next/navigation", () => ({
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
  pathname.current = "/pulse";
});

function dialog(): HTMLDialogElement {
  return document.querySelector("dialog") as HTMLDialogElement;
}

describe("overlay dismissal", () => {
  it("closes a dialog when the backdrop is clicked but not the panel", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Report">
        <p>Body</p>
      </Dialog>,
    );
    fireEvent.click(document.querySelector("dialog")!);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector("dialog p")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes a bottom sheet on the empty area above the panel", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Post options">
        <button type="button">Share</button>
      </BottomSheet>,
    );
    const wrapper = dialog().firstElementChild as HTMLElement;
    fireEvent.click(wrapper);
    expect(onClose).toHaveBeenCalledTimes(1);
    const share = [...document.querySelectorAll("dialog button")].find((button) => button.textContent === "Share")!;
    fireEvent.click(share);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape through the native cancel event", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Delete">
        <p>Body</p>
      </Dialog>,
    );
    fireEvent(dialog(), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on the Android back button (popstate)", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Create">
        <p>Body</p>
      </BottomSheet>,
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes a sheet on a downward swipe", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Create">
        <p>Body</p>
      </BottomSheet>,
    );
    const panel = dialog().querySelector(".glass")!;
    fireEvent.touchStart(panel, { touches: [{ clientX: 10, clientY: 10 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 12, clientY: 140 }] });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on a route change", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog open onClose={onClose} title="Share">
        <p>Body</p>
      </Dialog>,
    );
    pathname.current = "/bookmarks";
    rerender(
      <Dialog open onClose={onClose} title="Share">
        <p>Body</p>
      </Dialog>,
    );
    expect(onClose).toHaveBeenCalled();
  });
});
