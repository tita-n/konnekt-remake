"use client";

import { Moon, Smartphone, Sun } from "lucide-react";
import { useAppearance } from "@/components/providers/appearance-provider";
import { SegmentedControl } from "@/components/ui/navigation";
import { Switch } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

const THEME_CARDS = [
  {
    value: "light" as const,
    label: "Light",
    icon: Sun,
    surfaceClass: "bg-[#FFFFFF] border-[#E4E6EB]",
    cardClass: "bg-[#F6F7F9]",
    lineClass: "bg-[#12141A]",
  },
  {
    value: "dark" as const,
    label: "Dark",
    icon: Moon,
    surfaceClass: "bg-[#0E1013] border-[#2A2F37]",
    cardClass: "bg-[#171A1F]",
    lineClass: "bg-[#F2F3F5]",
  },
  {
    value: "system" as const,
    label: "System",
    icon: Smartphone,
    surfaceClass: "bg-gradient-to-br from-[#FFFFFF] via-[#F6F7F9] to-[#171A1F] border-border",
    cardClass: "bg-accent/20",
    lineClass: "bg-accent",
  },
];

export function AppearanceSettings() {
  const { theme, setTheme, dataSaver, setDataSaver, glassFallback } = useAppearance();

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-h3 text-fg">Theme</h2>
        <p className="mt-1 text-small text-fg-muted">System follows your phone&apos;s light or dark setting.</p>

        <div className="mt-3.5 grid grid-cols-3 gap-2.5">
          {THEME_CARDS.map((option) => {
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-[14px] border p-2.5 text-center transition",
                  selected ? "border-accent bg-accent-soft/60 ring-1 ring-accent" : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                <span className={cn("flex h-12 w-full flex-col justify-between rounded-[10px] border p-2", option.surfaceClass)} aria-hidden="true">
                  <span className="flex items-center justify-between">
                    <span className={cn("h-1.5 w-6 rounded-full opacity-75", option.lineClass)} />
                    <span className="size-2 rounded-full bg-accent" />
                  </span>
                  <span className={cn("h-4 w-full rounded-[5px]", option.cardClass)} />
                </span>
                <span className={cn("inline-flex items-center gap-1 text-small font-semibold", selected ? "text-accent-ink" : "text-fg")}>
                  <option.icon aria-hidden="true" className="size-3.5" />
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3.5">
          <SegmentedControl
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "System" },
            ]}
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <Switch
          checked={dataSaver}
          onCheckedChange={setDataSaver}
          label="Data saver"
          description="Compresses images more aggressively and turns off frosted-glass effects. Stored on this device."
        />
        <p className="mt-3 rounded-card bg-surface-2 px-3 py-2 text-small text-fg-muted">
          Surfaces are currently{" "}
          <span className="font-semibold text-fg">{glassFallback ? "solid" : "glass"}</span>.
          {glassFallback
            ? " Glass is off because of Data saver, reduced transparency, a low-memory device or an unsupported browser."
            : " Glass is limited to the top bar, tab bar and bottom sheets (never more than three)."}
        </p>
      </section>
    </div>
  );
}
