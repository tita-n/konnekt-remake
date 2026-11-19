"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "info";

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastRecord extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      counter.current += 1;
      const record = { ...input, id: counter.current };
      setToasts((current) => [...current.slice(-2), record]);
    },
    [],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end"
        aria-live="polite"
        role="status"
      >
        {toasts.map((item) => {
          const Icon = icons[item.variant ?? "default"];
          return (
            <ToastItem key={item.id} toast={item} Icon={Icon} onDismiss={() => dismiss(item.id)} />
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  Icon,
  onDismiss,
}: {
  toast: ToastRecord;
  Icon: typeof Info;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, toast.durationMs ?? 5000);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast.durationMs]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-button border bg-surface-2 px-3.5 py-3 shadow-floating animate-toast-in",
        toast.variant === "error" ? "border-danger/50" : "border-border",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-5 shrink-0",
          toast.variant === "error" ? "text-danger" : toast.variant === "success" ? "text-success" : "text-accent-ink",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-semibold leading-snug text-fg">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-small text-fg-muted">{toast.description}</p> : null}
      </div>
      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.();
            onDismiss();
          }}
          className="min-h-8 shrink-0 rounded-button px-2.5 text-small font-semibold text-accent-ink transition hover:bg-surface-3"
        >
          {toast.actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-fg-subtle transition hover:bg-surface-3 hover:text-fg"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
