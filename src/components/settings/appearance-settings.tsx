"use client";

import { Moon, Smartphone, Sun } from "lucide-react";
import { useAppearance } from "@/components/providers/appearance-provider";
import { SegmentedControl } from "@/components/ui/navigation";
import { Switch } from "@/components/ui/form-controls";

export function AppearanceSettings() {
  const { theme, setTheme, dataSaver, setDataSaver, glassFallback } = useAppearance();

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-h3 text-fg">Theme</h2>
        <p className="mt-1 text-small text-fg-muted">System follows your phone&apos;s light or dark setting.</p>
        <div className="mt-3">
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
        <div className="mt-3 flex gap-4 text-small text-fg-subtle">
          <span className="inline-flex items-center gap-1.5"><Sun aria-hidden="true" className="size-4" /> Light</span>
          <span className="inline-flex items-center gap-1.5"><Moon aria-hidden="true" className="size-4" /> Dark</span>
          <span className="inline-flex items-center gap-1.5"><Smartphone aria-hidden="true" className="size-4" /> System</span>
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
