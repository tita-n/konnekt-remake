"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";

function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    const handleClose = () => {
      document.documentElement.style.overflow = "";
      if (open) onClose();
    };
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose, open]);

  return ref;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  destructive = false,
  centered = false,
  hideClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  destructive?: boolean;
  centered?: boolean;
  hideClose?: boolean;
}) {
  const ref = useDialog(open, onClose);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="animate-pop-in rounded-dialog border border-border bg-surface p-5 shadow-floating">
        {centered ? (
          <div className="text-center">
            <h2 id={titleId} className="font-display text-[1.25rem] leading-[1.4] font-bold text-fg">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1.5 text-[0.9375rem] leading-[1.45] text-fg-muted">
                {description}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className={cn("text-h2 font-bold", destructive ? "text-danger" : "text-fg")}>
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1.5 text-small text-fg-muted">
                  {description}
                </p>
              ) : null}
            </div>
            {!hideClose ? (
              <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-2">
                <X aria-hidden="true" className="size-4" />
              </IconButton>
            ) : null}
          </div>
        )}
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? (
          <div
            className={cn(
              "mt-5",
              centered ? "flex flex-col gap-2.5" : "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}

/**
 * Bottom sheet on mobile; centered glass modal dialog on md+ viewports.
 * One of the only three surfaces allowed to use glass (top bar, tab bar, sheet).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  leftAction,
  hideClose = false,
  centeredTitle = false,
  hideHeader = false,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  leftAction?: React.ReactNode;
  hideClose?: boolean;
  centeredTitle?: boolean;
  hideHeader?: boolean;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useDialog(open, onClose);
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="flex h-full items-end justify-center md:items-center md:p-4">
        <div className="glass w-full max-w-lg animate-sheet-in overflow-hidden rounded-t-sheet border border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] shadow-floating md:animate-pop-in md:rounded-sheet md:border">
          <div className="flex justify-center pt-2.5 md:hidden" aria-hidden="true">
            <span className="h-1 w-9 rounded-full bg-fg/20" />
          </div>
          {hideHeader ? (
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
          ) : centeredTitle || leftAction ? (
            <div className="grid grid-cols-[40px_1fr_40px] items-center px-3 pb-2 pt-2.5">
              <div className="flex items-center justify-start">{leftAction}</div>
              <div className="text-center">
                <h2 id={titleId} className="font-display text-[1.0625rem] font-bold text-fg">
                  {title}
                </h2>
                {description ? <p className="mt-0.5 text-small text-fg-muted">{description}</p> : null}
              </div>
              <div className="flex items-center justify-end">
                {!hideClose ? (
                  <IconButton label="Close" onClick={onClose}>
                    <X aria-hidden="true" className="size-4" />
                  </IconButton>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4 px-4 pb-2 pt-3">
              <div>
                <h2 id={titleId} className="font-display text-[1.125rem] font-bold text-fg">
                  {title}
                </h2>
                {description ? <p className="mt-1 text-small text-fg-muted">{description}</p> : null}
              </div>
              {!hideClose ? (
                <IconButton label="Close" onClick={onClose} className="-mr-1.5 -mt-1">
                  <X aria-hidden="true" className="size-4" />
                </IconButton>
              ) : null}
            </div>
          )}
          <div className="max-h-[65dvh] overflow-y-auto px-4 pb-4">{children}</div>
          {footer ? <div className="border-t border-border/70 px-4 pb-4 pt-3">{footer}</div> : null}
        </div>
      </div>
    </dialog>
  );
}
