"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/form-controls";

/**
 * Small client island so the preview can toggle a real `Switch` without giving
 * a server component an event handler. The live wizard owns this state in
 * `src/components/student/onboarding-wizard.tsx`; nothing here adds a field.
 */
export function PreviewToggle({ label }: { label: string }) {
  const [postgraduate, setPostgraduate] = useState(false);
  return <Switch checked={postgraduate} onCheckedChange={setPostgraduate} label={label} />;
}
