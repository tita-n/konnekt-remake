import { useId } from "react";
import { deriveClayAvatarTraits } from "@/lib/domain/card-presentation";

/**
 * Deterministic clay-style illustrated avatar (Spec Section 3 & 5B).
 * Soft rounded geometry, warm skin gradients, subtle highlights, varied
 * hairstyles/headwear/accessories. Zero external calls, lightweight inline SVG.
 */
export function ClayAvatar({ seed, className }: { seed: string; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const t = deriveClayAvatarTraits(seed);

  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      className={className ?? "size-full"}
      fill="none"
    >
      <defs>
        <radialGradient id={`${uid}-skin`} cx="42%" cy="34%" r="65%">
          <stop offset="0%" stopColor={t.skinTone} />
          <stop offset="100%" stopColor={t.skinShade} />
        </radialGradient>
        <linearGradient id={`${uid}-shirt`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={t.shirtColor} />
          <stop offset="100%" stopColor={t.shirtAccent} />
        </linearGradient>
      </defs>

      {/* Soft pastel clay disc */}
      <rect width="96" height="96" rx="48" fill={t.bgTint} />

      {/* Back layer for hijab or puffy afro/braids */}
      {t.hairStyle === "hijab" ? (
        <path
          d="M21 56c0-18 11-31 27-31s27 13 27 31v32H21V56Z"
          fill={t.shirtColor}
        />
      ) : null}
      {t.hairStyle === "afro" ? (
        <circle cx="48" cy="36" r="24" fill={t.hairColor} />
      ) : null}
      {t.hairStyle === "headwrap" ? (
        <>
          <circle cx="48" cy="23" r="10.5" fill={t.hairColor} />
          <path d="M25 40c2-11 11-18 23-18s21 7 23 18H25Z" fill={t.shirtAccent} />
        </>
      ) : null}
      {t.hairStyle === "braids" ? (
        <path
          d="M25 44c0-14 10-24 23-24s23 10 23 24v19c0 4-3 6-6 6H31c-3 0-6-2-6-6V44Z"
          fill={t.hairColor}
        />
      ) : null}

      {/* Shoulders & clay hoodie/collar */}
      <path
        d="M14 96c2-15 15-24 34-24s32 9 34 24H14Z"
        fill={`url(#${uid}-shirt)`}
      />
      <path
        d="M36 74c3.5 4.2 8 6.2 12 6.2S56.5 78.2 60 74"
        stroke="white"
        strokeOpacity="0.24"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Neck */}
      <rect x="41" y="61" width="14" height="15" rx="7" fill={t.skinShade} />

      {/* Ears (hidden under hijab) */}
      {t.hairStyle !== "hijab" ? (
        <>
          <ellipse cx="28" cy="48" rx="4.5" ry="6" fill={t.skinShade} />
          <ellipse cx="68" cy="48" rx="4.5" ry="6" fill={t.skinShade} />
          {t.accessory === "earrings" ? (
            <>
              <circle cx="27.5" cy="54.5" r="2.6" stroke="#F5A524" strokeWidth="1.6" />
              <circle cx="68.5" cy="54.5" r="2.6" stroke="#F5A524" strokeWidth="1.6" />
            </>
          ) : null}
        </>
      ) : null}

      {/* Head shape */}
      <rect x="29" y="26" width="38" height="42" rx="19" fill={`url(#${uid}-skin)`} />

      {/* Soft clay cheek & forehead highlight */}
      <ellipse cx="42" cy="34" rx="8" ry="3.5" fill="white" fillOpacity="0.12" />
      <ellipse cx="36" cy="52" rx="4" ry="2.2" fill={t.cheek} fillOpacity="0.4" />
      <ellipse cx="60" cy="52" rx="4" ry="2.2" fill={t.cheek} fillOpacity="0.4" />

      {/* Top hair shapes */}
      {t.hairStyle === "shortCrop" ? (
        <path
          d="M28 41c0-11.5 8.5-19 20-19s20 7.5 20 19c-2-5-7.5-8.5-20-8.5S30 36 28 41Z"
          fill={t.hairColor}
        />
      ) : null}
      {t.hairStyle === "lowFade" ? (
        <path
          d="M29 40c1-10.5 8.5-16.5 19-16.5S66 29.5 67 40c-2.2-4.5-8.5-7-19-7s-16.8 2.5-19 7Z"
          fill={t.hairColor}
        />
      ) : null}
      {t.hairStyle === "braids" ? (
        <path
          d="M29 42c1-10.5 9-17 19-17s18 6.5 19 17c-4-5-10-7.5-19-7.5S33 37 29 42Z"
          fill={t.hairColor}
        />
      ) : null}
      {t.hairStyle === "hijab" ? (
        <path
          d="M28 48c0-13.5 8-22 20-22s20 8.5 20 22v19c0 6-6.5 11-20 11s-20-5-20-11V48Z"
          stroke={t.shirtAccent}
          strokeWidth="4.5"
        />
      ) : null}

      {/* Brows */}
      <path d="M36 42.5c2-1.2 4.5-1.2 6 0" stroke="#1F1A17" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M54 42.5c1.5-1.2 4-1.2 6 0" stroke="#1F1A17" strokeWidth="2.1" strokeLinecap="round" />

      {/* Eyes */}
      <circle cx="39" cy="47" r="2.6" fill="#1B1614" />
      <circle cx="57" cy="47" r="2.6" fill="#1B1614" />
      <circle cx="39.8" cy="46.2" r="0.85" fill="white" />
      <circle cx="57.8" cy="46.2" r="0.85" fill="white" />

      {/* Nose hint */}
      <path d="M47 48.5v4c0 1 .9 1.6 2 1.6" stroke={t.skinShade} strokeWidth="1.9" strokeLinecap="round" />

      {/* Friendly smile */}
      {t.smile === "grin" ? (
        <path d="M41.5 57.5c2 3.2 11 3.2 13 0H41.5Z" fill="#FFFFFF" stroke="#1B1614" strokeWidth="1.3" strokeLinejoin="round" />
      ) : (
        <path d="M42.5 58c2.2 2.4 8.8 2.4 11 0" stroke="#1B1614" strokeWidth="2" strokeLinecap="round" />
      )}

      {/* Glasses */}
      {t.accessory === "glasses" ? (
        <g stroke="#222632" strokeWidth="2">
          <rect x="33.5" y="43" width="11" height="8" rx="3" fill="white" fillOpacity="0.14" />
          <rect x="51.5" y="43" width="11" height="8" rx="3" fill="white" fillOpacity="0.14" />
          <path d="M44.5 46.8h7" />
        </g>
      ) : null}

      {/* Headphones around neck */}
      {t.accessory === "headphones" ? (
        <g>
          <path d="M32 71c0 8.5 7 13 16 13s16-4.5 16-13" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="28" y="67" width="6.5" height="10" rx="3" fill="#334155" />
          <rect x="61.5" y="67" width="6.5" height="10" rx="3" fill="#334155" />
        </g>
      ) : null}
    </svg>
  );
}
