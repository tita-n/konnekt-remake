/**
 * Pure presentation helpers for social cards, counts, and deterministic avatar
 * traits. Kept framework-free so both UI components and node:test unit suites
 * import them directly.
 */

export function formatCompactCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  if (count < 1000) return String(Math.floor(count));
  const value = count / 1000;
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace(/\.0$/, "")}k`;
}

export interface ClayAvatarTraits {
  skinTone: string;
  skinShade: string;
  cheek: string;
  hairColor: string;
  bgTint: string;
  shirtColor: string;
  shirtAccent: string;
  hairStyle: "shortCrop" | "afro" | "hijab" | "braids" | "lowFade" | "headwrap";
  accessory: "none" | "glasses" | "headphones" | "earrings";
  smile: "warm" | "grin";
}

const SKIN_PALETTES = [
  { skinTone: "#8D5524", skinShade: "#6E3F18", cheek: "#A8663B" },
  { skinTone: "#B67346", skinShade: "#925731", cheek: "#CA865A" },
  { skinTone: "#6F3E21", skinShade: "#522C16", cheek: "#8B5233" },
  { skinTone: "#C68652", skinShade: "#A2683B", cheek: "#DA9B69" },
  { skinTone: "#562F18", skinShade: "#3D200E", cheek: "#734227" },
] as const;

const BG_TINTS = ["#E8EAFF", "#FCE8EE", "#E6F4F1", "#FFF1DC", "#EDE9FE", "#E0F2FE"] as const;

const SHIRT_PALETTES = [
  { shirtColor: "#4F46E5", shirtAccent: "#3730A3" },
  { shirtColor: "#0F766E", shirtAccent: "#115E59" },
  { shirtColor: "#D97706", shirtAccent: "#B45309" },
  { shirtColor: "#7C3AED", shirtAccent: "#5B21B6" },
  { shirtColor: "#2563EB", shirtAccent: "#1D4ED8" },
  { shirtColor: "#BE123C", shirtAccent: "#9F1239" },
] as const;

const HAIR_STYLES: ClayAvatarTraits["hairStyle"][] = [
  "shortCrop",
  "hijab",
  "lowFade",
  "braids",
  "afro",
  "headwrap",
];

const ACCESSORIES: ClayAvatarTraits["accessory"][] = [
  "none",
  "glasses",
  "headphones",
  "earrings",
  "none",
];

/** Deterministic FNV-1a 32-bit hash so identical user seeds render identical faces. */
export function hashAvatarSeed(seed: string): number {
  let h = 2166136261;
  const input = seed.trim() || "konnekt-student";
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function deriveClayAvatarTraits(seed: string): ClayAvatarTraits {
  const h = hashAvatarSeed(seed);
  const skin = SKIN_PALETTES[h % SKIN_PALETTES.length]!;
  const bgTint = BG_TINTS[(h >>> 3) % BG_TINTS.length]!;
  const shirt = SHIRT_PALETTES[(h >>> 6) % SHIRT_PALETTES.length]!;
  const hairStyle = HAIR_STYLES[(h >>> 9) % HAIR_STYLES.length]!;
  const accessory = ACCESSORIES[(h >>> 13) % ACCESSORIES.length]!;
  const smile: ClayAvatarTraits["smile"] = ((h >>> 17) & 1) === 0 ? "warm" : "grin";
  const hairColor = hairStyle === "hijab" || hairStyle === "headwrap" ? shirt.shirtAccent : "#1D1B22";

  return {
    ...skin,
    hairColor,
    bgTint,
    ...shirt,
    hairStyle,
    accessory,
    smile,
  };
}

export function shouldCollapsePostBody(body: string, kind: "POST" | "QUESTION" | "POLL" | "EVENT"): boolean {
  if (!body) return false;
  if (kind !== "POST" && kind !== "QUESTION") return false;
  return body.length > 260 || body.split("\n").length > 5;
}
