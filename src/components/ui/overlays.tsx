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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  destructive?: boolean;
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
      <div className="animate-pop-in rounded-[20px] border border-border bg-surface p-5 shadow-floating">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className={cn("text-h2", destructive ? "text-danger" : "text-fg")}>
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1.5 text-small text-fg-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-2">
            <X aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
        {footer ? <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
      </div>
    </dialog>
  );
}

/**
 * Bottom sheet. One of the only three surfaces allowed to use glass (top bar,
 * tab bar, sheet), and the glass preference is applied by the appearance
 * provider globally.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
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
      <div className="flex h-full items-end justify-center">
        <div className="glass w-full max-w-lg animate-sheet-in overflow-hidden rounded-t-sheet border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] shadow-floating sm:mb-6 sm:rounded-sheet sm:border">
          <div className="flex justify-center pt-2.5" aria-hidden="true">
            <span className="h-1 w-10 rounded-full bg-fg/20" />
          </div>
          <div className="flex items-start justify-between gap-4 px-4 pb-2 pt-3">
            <div>
              <h2 id={titleId} className="text-h2 text-fg">
                {title}
              </h2>
              {description ? <p className="mt-1 text-small text-fg-muted">{description}</p> : null}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mr-1.5 -mt-1">
              <X aria-hidden="true" className="size-4" />
            </IconButton>
          </div>
          <div className="max-h-[65dvh] overflow-y-auto px-4 pb-4">{children}</div>
          {footer ? <div className="border-t border-border/70 px-4 pb-4 pt-3">{footer}</div> : null}
        </div>
      </div>
    </dialog>
  );
}
