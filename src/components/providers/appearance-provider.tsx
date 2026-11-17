"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

interface AppearanceContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  dataSaver: boolean;
  setDataSaver: (value: boolean) => void;
  glassFallback: boolean;
  resolvedTheme: "light" | "dark";
}

const THEME_KEY = "konnekt:theme";
const DATA_SAVER_KEY = "konnekt:data-saver";

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function readTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function readDataSaver(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DATA_SAVER_KEY) === "1";
}

/** Any of these conditions forces solid surfaces instead of frosted glass. */
export function shouldUseSolidSurfaces(dataSaver: boolean): boolean {
  if (typeof window === "undefined") return true;
  if (dataSaver) return true;
  if (window.matchMedia("(prefers-reduced-transparency: reduce)").matches) return true;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) return true;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return true;
  if (nav.connection?.saveData) return true;
  if (typeof CSS !== "undefined" && !CSS.supports("backdrop-filter", "blur(8px)")) return true;
  return false;
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [dataSaver, setDataSaverState] = useState(false);
  const [glassFallback, setGlassFallback] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  const apply = useCallback((next: ThemePreference, saver: boolean) => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const resolved = next === "system" ? (media.matches ? "dark" : "light") : next;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document.documentElement.dataset.glass = shouldUseSolidSurfaces(saver) ? "solid" : "glass";
    setResolvedTheme(resolved);
    setGlassFallback(shouldUseSolidSurfaces(saver));
  }, []);

  useEffect(() => {
    const initialTheme = readTheme();
    const initialSaver = readDataSaver();
    setThemeState(initialTheme);
    setDataSaverState(initialSaver);
    apply(initialTheme, initialSaver);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(readTheme(), readDataSaver());
    media.addEventListener("change", onChange);

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === DATA_SAVER_KEY) {
        const nextTheme = readTheme();
        const nextSaver = readDataSaver();
        setThemeState(nextTheme);
        setDataSaverState(nextSaver);
        apply(nextTheme, nextSaver);
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      media.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [apply]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      window.localStorage.setItem(THEME_KEY, next);
      setThemeState(next);
      apply(next, readDataSaver());
    },
    [apply],
  );

  const setDataSaver = useCallback(
    (value: boolean) => {
      window.localStorage.setItem(DATA_SAVER_KEY, value ? "1" : "0");
      setDataSaverState(value);
      apply(readTheme(), value);
    },
    [apply],
  );

  const value = useMemo(
    () => ({ theme, setTheme, dataSaver, setDataSaver, glassFallback, resolvedTheme }),
    [theme, setTheme, dataSaver, setDataSaver, glassFallback, resolvedTheme],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used inside AppearanceProvider");
  return context;
}

/** Stored data-saver preference; consumers use it to avoid heavy media. */
export function useDataSaver() {
  const { dataSaver, setDataSaver } = useAppearance();
  return { dataSaver, setDataSaver };
}

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useAppearance();
  return { theme, setTheme, resolvedTheme };
}
