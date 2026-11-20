"use client";

import { forwardRef, useId, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { passwordStrength } from "@/lib/domain/password-strength";

interface FieldChrome {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  hideLabel?: boolean;
  id?: string;
  labelAction?: React.ReactNode;
}

function describedBy(id: string, hint?: string, error?: string | null): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

const inputBase =
  "w-full rounded-input border bg-surface px-3.5 text-body text-fg placeholder:text-fg-subtle transition-colors duration-150 focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-fg-muted";

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id">, FieldChrome {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, required, hideLabel, id: providedId, labelAction, leading, trailing, className, ...props },
  ref,
) {
  const generated = useId();
  const id = providedId ?? generated;
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className={cn("text-small font-semibold text-fg", hideLabel && "sr-only", required && "label-required")}
        >
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle" aria-hidden="true">
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(
            inputBase,
            "h-11",
            leading && "pl-10",
            trailing && "pr-11",
            error ? "border-danger" : "border-border",
            className,
          )}
          {...props}
        />
        {trailing ? <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span> : null}
      </div>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
});

function FieldMessages({ id, hint, error }: { id: string; hint?: string; error?: string | null }) {
  return (
    <>
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1.5 text-small text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-small font-medium text-danger">
          <AlertCircle aria-hidden="true" className="mt-[1px] size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </>
  );
}

export const PasswordField = forwardRef<HTMLInputElement, TextFieldProps>(function PasswordField(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      ref={ref}
      type={visible ? "text" : "password"}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="rounded-full p-2 text-fg-subtle transition hover:bg-surface-2 hover:text-fg"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      }
    />
  );
});

export interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id">, FieldChrome {}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, required, hideLabel, id: providedId, labelAction, className, rows = 4, ...props },
  ref,
) {
  const generated = useId();
  const id = providedId ?? generated;
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={cn("text-small font-semibold text-fg", hideLabel && "sr-only", required && "label-required")}>
          {label}
        </label>
        {labelAction}
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(inputBase, "min-h-[104px] resize-y py-2.5", error ? "border-danger" : "border-border", className)}
        {...props}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
});

export interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id">, FieldChrome {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, required, hideLabel, id: providedId, labelAction, options, placeholder, className, ...props },
  ref,
) {
  const generated = useId();
  const id = providedId ?? generated;
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={cn("text-small font-semibold text-fg", hideLabel && "sr-only", required && "label-required")}>
          {label}
        </label>
        {labelAction}
      </div>
      <select
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(
          inputBase,
          "h-11 appearance-none bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10",
          error ? "border-danger" : "border-border",
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2355645c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
});

const strengthColors = ["bg-danger", "bg-danger", "bg-warning", "bg-accent", "bg-success"];

export function PasswordStrengthMeter({ password, userInputs }: { password: string; userInputs?: string[] }) {
  if (!password) return null;
  const strength = passwordStrength(password, userInputs);
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              index < strength.score ? strengthColors[strength.score] : "bg-surface-3",
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-small text-fg-muted">
        Password strength: <span className="font-semibold text-fg">{strength.label}</span>
        {strength.suggestions[0] ? ` — ${strength.suggestions[0]}` : ""}
      </p>
    </div>
  );
}

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: string | null;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, error, className, id: providedId, ...props },
  ref,
) {
  const generated = useId();
  const id = providedId ?? generated;
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : description ? `${id}-description` : undefined}
            className={cn(
              "peer size-5 cursor-pointer appearance-none rounded-[6px] border border-border-strong bg-surface transition checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50",
              error && "border-danger",
              className,
            )}
            {...props}
          />
          <Check
            aria-hidden="true"
            className="pointer-events-none absolute size-3.5 text-accent-fg opacity-0 transition peer-checked:opacity-100"
            strokeWidth={3}
          />
        </span>
        <div className="min-w-0">
          <label htmlFor={id} className="cursor-pointer text-[0.9375rem] leading-snug text-fg">
            {label}
          </label>
          {description ? (
            <p id={`${id}-description`} className="mt-0.5 text-small text-fg-subtle">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-small font-medium text-danger">
          <AlertCircle aria-hidden="true" className="mt-[1px] size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
});

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onCheckedChange, label, description, disabled, id: providedId }: SwitchProps) {
  const generated = useId();
  const id = providedId ?? generated;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[0.9375rem] font-medium text-fg">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-small text-fg-subtle">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50",
          checked ? "border-accent bg-accent" : "border-border-strong bg-surface-3",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-spring",
            checked ? "translate-x-[22px] bg-accent-fg" : "translate-x-[3px]",
          )}
        />
      </button>
    </div>
  );
}

export type ChipProps = {
  selected?: boolean;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Chip({ selected = false, children, className, icon, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-chip border px-3 text-small font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
        selected
          ? "border-accent bg-accent text-accent-fg"
          : "border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2",
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

export function CheckPill({ checked, children }: { checked: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-small font-medium",
        checked ? "bg-success-soft text-success" : "bg-surface-2 text-fg-muted",
      )}
    >
      {checked ? (
        <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
      ) : (
        <Minus aria-hidden="true" className="size-3.5" />
      )}
      {children}
    </span>
  );
}
