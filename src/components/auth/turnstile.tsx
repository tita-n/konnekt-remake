"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile. Tokens are single-use; `resetKey` changing resets the
 * widget after a failed submission.
 */
export function Turnstile({
  siteKey,
  onToken,
  resetKey = 0,
  theme = "auto",
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  resetKey?: number;
  theme?: "light" | "dark" | "auto";
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  const render = useCallback(() => {
    if (!window.turnstile || !container.current || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      theme,
      size: "flexible",
      callback: (token) => onToken(token),
      "error-callback": () => onToken(null),
      "expired-callback": () => onToken(null),
    });
  }, [onToken, siteKey, theme]);

  useEffect(() => {
    if (ready) render();
  }, [ready, render]);

  useEffect(() => {
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      onToken(null);
    }
    // Only reset when the parent asks (after a failed submit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!siteKey) return null;

  return (
    <div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={container} aria-label="Human verification" />
    </div>
  );
}
