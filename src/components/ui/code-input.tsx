"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Six-box one-time code input with paste support. Kept as a single controlled
 * string so the parent can submit or validate without racing individual boxes.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  label = "Verification code",
  error,
  disabled,
  autoFocus,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  label?: string;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  hint?: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const id = useId();
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  const setAt = (index: number, digit: string) => {
    const next = digits.map((d, i) => (i === index ? digit : d.trim())).map((d) => d.trim());
    const joined = next.join("");
    onChange(joined);
    return joined;
  };

  const focusBox = (index: number) => {
    const target = refs.current[Math.max(0, Math.min(5, index))];
    target?.focus();
    target?.select();
  };

  return (
    <div>
      <span id={`${id}-label`} className="mb-1.5 block text-small font-semibold text-fg">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        aria-describedby={cn(hint ? `${id}-hint` : "", error ? `${id}-error` : "") || undefined}
        className="flex gap-2"
        onPaste={(event) => {
          const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
          if (!pasted) return;
          event.preventDefault();
          onChange(pasted);
          if (pasted.length === 6) onComplete?.(pasted);
          else focusBox(pasted.length);
        }}
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            value={digit.trim()}
            autoFocus={autoFocus && index === 0}
            disabled={disabled}
            inputMode="numeric"
            type="text"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${index + 1} of 6`}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "");
              if (!raw) {
                setAt(index, "");
                return;
              }
              if (raw.length > 1) {
                const pasted = raw.slice(0, 6 - index);
                const next = (digits.map((d) => d.trim()).join("").slice(0, index) + pasted).slice(0, 6);
                onChange(next);
                if (next.length === 6) onComplete?.(next);
                else focusBox(next.length);
                return;
              }
              const joined = setAt(index, raw);
              if (index < 5) focusBox(index + 1);
              if (joined.length === 6) onComplete?.(joined);
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digit.trim() && index > 0) {
                const next = digits.map((d) => d.trim()).join("").slice(0, index - 1);
                onChange(next);
                focusBox(index - 1);
                event.preventDefault();
              }
              if (event.key === "ArrowLeft") {
                focusBox(index - 1);
                event.preventDefault();
              }
              if (event.key === "ArrowRight") {
                focusBox(index + 1);
                event.preventDefault();
              }
            }}
            className={cn(
              "h-14 w-full min-w-0 rounded-input border bg-surface text-center text-[1.375rem] font-bold tabular-nums text-fg transition-colors focus:border-accent disabled:opacity-60",
              error ? "border-danger" : "border-border",
            )}
          />
        ))}
      </div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1.5 text-small text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-small font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
