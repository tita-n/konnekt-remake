import { z } from "zod";

/** Hex colour helpers with WCAG contrast maths. */

export const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb | null {
  if (!HEX_COLOUR.test(hex)) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) throw new Error(`Not a hex colour: ${hex}`);
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

export function roundRatio(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

/** Text/icon colour to place on top of an accent-coloured surface. */
export function readableOn(background: string): "#0C1411" | "#FFFFFF" {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#0C1411") ? "#FFFFFF" : "#0C1411";
}

export const LIGHT_SURFACE = "#FFFFFF";
export const DARK_SURFACE = "#0F1512";
export const AA_TEXT = 4.5;

export interface ContrastReport {
  onWhite: number;
  onDark: number;
  accentText: number;
  primaryButton: number;
  passes: boolean;
  messages: string[];
}

/**
 * Accent colours must work as small text on both light and dark surfaces and
 * as a primary-button background with white text.
 */
export function checkAccentContrast(accent: string): ContrastReport {
  if (!HEX_COLOUR.test(accent)) {
    return {
      onWhite: 0,
      onDark: 0,
      accentText: 0,
      primaryButton: 0,
      passes: false,
      messages: ["Enter a 6-digit hex colour, e.g. #1B7F5A."],
    };
  }
  const onWhite = roundRatio(contrastRatio(accent, LIGHT_SURFACE));
  const onDark = roundRatio(contrastRatio(accent, DARK_SURFACE));
  const accentText = Math.min(onWhite, onDark);
  const primaryButton = roundRatio(contrastRatio(accent, "#FFFFFF"));
  const messages: string[] = [];
  if (onWhite < AA_TEXT) messages.push(`Needs ${AA_TEXT}:1 against white for accent text (currently ${onWhite}:1).`);
  if (onDark < AA_TEXT) messages.push(`Needs ${AA_TEXT}:1 against the dark surface (currently ${onDark}:1).`);
  if (primaryButton < AA_TEXT) messages.push(`White text on this accent is only ${primaryButton}:1.`);
  return { onWhite, onDark, accentText, primaryButton, passes: messages.length === 0, messages };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Blend `hex` toward `towards` by `amount` (0..1). */
export function mix(hex: string, towards: string, amount: number): string {
  const a = parseHex(hex) ?? { r: 27, g: 127, b: 90 };
  const b = parseHex(towards) ?? { r: 255, g: 255, b: 255 };
  return toHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

/**
 * Tinted accent surfaces (chips, callouts) with a guaranteed readable
 * foreground — the accent itself is often too light once lightly tinted.
 */
export function accentSurface(accent: string, dark: boolean): { background: string; foreground: string } {
  if (dark) {
    const background = mix(accent, "#0F1512", 0.78);
    return { background, foreground: contrastRatio(background, "#F5FAF7") >= AA_TEXT ? "#F5FAF7" : "#FFFFFF" };
  }
  const background = mix(accent, "#FFFFFF", 0.88);
  return { background, foreground: contrastRatio(background, "#0C1411") >= AA_TEXT ? "#0C1411" : "#000000" };
}

export const hexColourSchema = z
  .string()
  .regex(HEX_COLOUR, "Use a 6-digit hex colour, e.g. #1B7F5A");
