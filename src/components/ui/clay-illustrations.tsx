import { useId } from "react";
import { cn } from "@/lib/utils";

export type ClayIllustrationKind =
  | "emptyMailbox"
  | "errorPlug"
  | "unavailableEnvelope"
  | "emptyBookmark"
  | "blankDrafts"
  | "happyPadlock"
  | "magnifier"
  | "hourglass"
  | "welcomeHero";

/**
 * Inline clay-style SVG illustrations (Spec Section 5 #52 & Section 5B).
 * Soft rounded clay shapes, gentle lavender/indigo/green gradients, subtle inner
 * highlights and zero raster background rectangles, safe in light & dark themes.
 */
export function ClayIllustration({
  kind,
  className,
  label,
}: {
  kind: ClayIllustrationKind;
  className?: string;
  label?: string;
}) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 220 176"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("h-40 w-48 shrink-0 select-none", className)}
      fill="none"
    >
      <defs>
        <linearGradient id={`${uid}-lav`} x1="25%" y1="10%" x2="80%" y2="95%">
          <stop offset="0%" stopColor="#B8AEFF" />
          <stop offset="55%" stopColor="#8E7CFF" />
          <stop offset="100%" stopColor="#6D5BE8" />
        </linearGradient>
        <linearGradient id={`${uid}-lav-soft`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#DDD7FF" />
          <stop offset="100%" stopColor="#B1A6FF" />
        </linearGradient>
        <linearGradient id={`${uid}-leaf`} x1="15%" y1="10%" x2="85%" y2="95%">
          <stop offset="0%" stopColor="#94E055" />
          <stop offset="100%" stopColor="#439E2F" />
        </linearGradient>
        <linearGradient id={`${uid}-spark`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id={`${uid}-coral`} x1="20%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#FF7A8A" />
          <stop offset="100%" stopColor="#E11D48" />
        </linearGradient>
        <linearGradient id={`${uid}-paper`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E9EAF5" />
        </linearGradient>
      </defs>

      {/* Soft clay ground disc */}
      <ellipse cx="110" cy="148" rx="68" ry="13" fill={`url(#${uid}-lav-soft)`} fillOpacity="0.65" />

      {kind === "happyPadlock" ? (
        <g>
          {/* Leaves */}
          <path d="M56 142c-16-8-26-26-22-40 6-14 23-6 28 14 4 14-1 23-6 26Z" fill={`url(#${uid}-leaf)`} />
          <path d="M62 140c-6-16 0-34 10-38 10-4 17 12 12 28-4 12-15 12-22 10Z" fill={`url(#${uid}-leaf)`} opacity="0.92" />
          <path d="M164 142c16-6 24-22 19-33-6-11-20-3-24 14-3 11 1 17 5 19Z" fill={`url(#${uid}-leaf)`} />
          <path d="M158 142c6-12 2-26-7-28-8-2-14 10-10 22 4 9 11 8 17 6Z" fill={`url(#${uid}-leaf)`} opacity="0.9" />
          {/* Shackle */}
          <path d="M84 82V66c0-15 11.5-26 26-26s26 11 26 26v16" stroke={`url(#${uid}-lav-soft)`} strokeWidth="14" strokeLinecap="round" />
          {/* Lock body */}
          <rect x="66" y="74" width="88" height="72" rx="22" fill={`url(#${uid}-lav)`} />
          <rect x="72" y="79" width="76" height="12" rx="6" fill="white" fillOpacity="0.22" />
          {/* Happy ^ ^ eyes & smile */}
          <path d="M87 104c2.5-5 8.5-5 11 0" stroke="#2D2842" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M122 104c2.5-5 8.5-5 11 0" stroke="#2D2842" strokeWidth="4.2" strokeLinecap="round" />
          <path d="M99 115c3.5 7 18.5 7 22 0" stroke="#2D2842" strokeWidth="4.5" strokeLinecap="round" />
          {/* Golden sparks */}
          <rect x="148" y="34" width="8" height="18" rx="4" transform="rotate(-12 148 34)" fill={`url(#${uid}-spark)`} />
          <rect x="163" y="45" width="7" height="15" rx="3.5" transform="rotate(32 163 45)" fill={`url(#${uid}-spark)`} />
          <rect x="165" y="64" width="16" height="7" rx="3.5" transform="rotate(6 165 64)" fill={`url(#${uid}-spark)`} />
        </g>
      ) : null}

      {kind === "unavailableEnvelope" ? (
        <g>
          {/* Botanical leaves */}
          <path d="M50 138c-15-8-22-24-18-35 5-12 20-5 25 13 4 13-2 20-7 22Z" fill={`url(#${uid}-leaf)`} />
          <path d="M170 138c15-8 22-24 18-35-5-12-20-5-25 13-4 13 2 20 7 22Z" fill={`url(#${uid}-leaf)`} />
          {/* Open flap back */}
          <path d="M58 70l52-34 52 34v58c0 10-8 18-18 18H76c-10 0-18-8-18-18V70Z" fill="#6856DF" />
          {/* Inner cream card */}
          <rect x="72" y="48" width="76" height="72" rx="14" fill={`url(#${uid}-paper)`} />
          {/* Coral ban symbol */}
          <circle cx="110" cy="80" r="19" fill={`url(#${uid}-coral)`} />
          <circle cx="110" cy="80" r="11" fill="white" />
          <path d="M102 88l16-16" stroke={`url(#${uid}-coral)`} strokeWidth="5.5" strokeLinecap="round" />
          {/* Envelope front pocket */}
          <path d="M58 76l52 36 52-36v52c0 10-8 18-18 18H76c-10 0-18-8-18-18V76Z" fill={`url(#${uid}-lav)`} />
          <path d="M62 80l48 33 48-33" stroke="white" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
          {/* Golden sparks */}
          <rect x="148" y="22" width="7.5" height="17" rx="3.75" transform="rotate(-10 148 22)" fill={`url(#${uid}-spark)`} />
          <rect x="163" y="34" width="7" height="15" rx="3.5" transform="rotate(30 163 34)" fill={`url(#${uid}-spark)`} />
          <rect x="167" y="54" width="15" height="7" rx="3.5" transform="rotate(6 167 54)" fill={`url(#${uid}-spark)`} />
        </g>
      ) : null}

      {kind === "emptyMailbox" ? (
        <g>
          <path d="M54 140c-14-8-20-23-16-33 5-10 18-4 22 12 3 11-1 19-6 21Z" fill={`url(#${uid}-leaf)`} />
          {/* Post stand */}
          <rect x="103" y="108" width="14" height="38" rx="7" fill={`url(#${uid}-lav-soft)`} />
          {/* Rounded mailbox body */}
          <path d="M58 84c0-20 15-34 34-34h36c19 0 34 14 34 34v30c0 5.5-4.5 10-10 10H68c-5.5 0-10-4.5-10-10V84Z" fill={`url(#${uid}-lav)`} />
          {/* Front door dark recess */}
          <rect x="64" y="64" width="38" height="54" rx="19" fill="#5242C9" />
          {/* Open tray door */}
          <rect x="44" y="102" width="38" height="12" rx="6" transform="rotate(-14 44 102)" fill={`url(#${uid}-lav-soft)`} />
          {/* Side highlight & red flag */}
          <path d="M98 58h32c11 0 20 8 23 18" stroke="white" strokeOpacity="0.28" strokeWidth="4" strokeLinecap="round" />
          <rect x="148" y="38" width="6" height="36" rx="3" fill={`url(#${uid}-spark)`} />
          <rect x="148" y="38" width="18" height="11" rx="4" fill={`url(#${uid}-coral)`} />
          {/* Soft sparkle */}
          <circle cx="168" cy="70" r="4" fill={`url(#${uid}-spark)`} />
        </g>
      ) : null}

      {kind === "errorPlug" ? (
        <g>
          {/* Left cord & socket */}
          <path d="M40 120c14 0 18-16 32-16" stroke={`url(#${uid}-lav-soft)`} strokeWidth="9" strokeLinecap="round" />
          <rect x="70" y="84" width="28" height="40" rx="12" fill={`url(#${uid}-lav)`} />
          <rect x="96" y="94" width="9" height="5" rx="2.5" fill={`url(#${uid}-lav-soft)`} />
          <rect x="96" y="109" width="9" height="5" rx="2.5" fill={`url(#${uid}-lav-soft)`} />
          {/* Right plug disconnected */}
          <path d="M182 88c-16 0-18 16-32 16" stroke={`url(#${uid}-lav-soft)`} strokeWidth="9" strokeLinecap="round" />
          <rect x="122" y="84" width="30" height="40" rx="12" fill={`url(#${uid}-coral)`} />
          <rect x="126" y="89" width="22" height="7" rx="3.5" fill="white" fillOpacity="0.25" />
          {/* Disconnected spark bolts */}
          <rect x="107" y="54" width="6" height="15" rx="3" fill={`url(#${uid}-spark)`} />
          <rect x="93" y="61" width="6" height="12" rx="3" transform="rotate(-28 93 61)" fill={`url(#${uid}-spark)`} />
          <rect x="121" y="61" width="6" height="12" rx="3" transform="rotate(28 121 61)" fill={`url(#${uid}-spark)`} />
        </g>
      ) : null}

      {kind === "emptyBookmark" ? (
        <g>
          <path d="M58 140c-14-7-20-21-16-31 5-10 18-3 22 12 3 10-1 17-6 19Z" fill={`url(#${uid}-leaf)`} />
          <path d="M162 140c14-7 20-21 16-31-5-10-18-3-22 12-3 10 1 17 6 19Z" fill={`url(#${uid}-leaf)`} />
          {/* Soft pedestal ribbon */}
          <path d="M74 44c0-9 7-16 16-16h40c9 0 16 7 16 16v90c0 6-6.5 9.5-11.5 6L110 123l-24.5 17c-5 3.5-11.5 0-11.5-6V44Z" fill={`url(#${uid}-lav)`} />
          <rect x="82" y="34" width="56" height="10" rx="5" fill="white" fillOpacity="0.25" />
          {/* Golden star dot */}
          <circle cx="155" cy="44" r="6" fill={`url(#${uid}-spark)`} />
          <circle cx="64" cy="64" r="4" fill={`url(#${uid}-lav-soft)`} />
        </g>
      ) : null}

      {kind === "blankDrafts" ? (
        <g>
          {/* Notepad sheet */}
          <rect x="66" y="34" width="84" height="108" rx="18" fill={`url(#${uid}-paper)`} stroke="#D5D7EE" strokeWidth="2" />
          {/* Top spiral rings */}
          {[80, 96, 112, 128].map((x) => (
            <rect key={x} x={x} y="26" width="8" height="16" rx="4" fill={`url(#${uid}-lav)`} />
          ))}
          <rect x="82" y="64" width="52" height="8" rx="4" fill="#D8DCF0" />
          <rect x="82" y="82" width="40" height="8" rx="4" fill="#E3E6F6" />
          <rect x="82" y="100" width="28" height="8" rx="4" fill="#ECEEF9" />
          {/* Tilted clay pencil */}
          <g transform="translate(132 72) rotate(28)">
            <rect x="0" y="0" width="16" height="62" rx="8" fill={`url(#${uid}-lav)`} />
            <rect x="2" y="4" width="12" height="10" rx="5" fill={`url(#${uid}-coral)`} />
            <path d="M2 58h12l-6 12-6-12Z" fill={`url(#${uid}-spark)`} />
          </g>
        </g>
      ) : null}

      {kind === "magnifier" ? (
        <g>
          <path d="M58 140c-12-7-17-20-13-29 4-9 16-2 19 11 3 9-1 16-6 18Z" fill={`url(#${uid}-leaf)`} />
          {/* Handle */}
          <rect x="130" y="102" width="16" height="44" rx="8" transform="rotate(-42 130 102)" fill={`url(#${uid}-lav)`} />
          {/* Rim */}
          <circle cx="98" cy="80" r="38" fill={`url(#${uid}-lav-soft)`} />
          <circle cx="98" cy="80" r="26" fill={`url(#${uid}-paper)`} />
          {/* Glass shine */}
          <path d="M84 68c5-6 14-8 21-4" stroke={`url(#${uid}-lav)`} strokeOpacity="0.45" strokeWidth="5" strokeLinecap="round" />
          <circle cx="154" cy="48" r="5" fill={`url(#${uid}-spark)`} />
        </g>
      ) : null}

      {kind === "hourglass" ? (
        <g>
          <path d="M56 140c-12-7-17-19-13-28 4-9 15-3 18 11 3 9-1 15-5 17Z" fill={`url(#${uid}-leaf)`} />
          <path d="M164 140c12-7 17-19 13-28-4-9-15-3-18 11-3 9 1 15 5 17Z" fill={`url(#${uid}-leaf)`} />
          {/* Frame caps */}
          <rect x="74" y="34" width="72" height="12" rx="6" fill={`url(#${uid}-lav)`} />
          <rect x="74" y="130" width="72" height="12" rx="6" fill={`url(#${uid}-lav)`} />
          {/* Bulbs */}
          <path d="M84 46h52c0 22-18 32-18 42s18 20 18 42H84c0-22 18-32 18-42S84 68 84 46Z" fill={`url(#${uid}-paper)`} stroke="#D4CEF8" strokeWidth="3" />
          {/* Warm amber sand */}
          <path d="M92 126c4-11 11-16 18-16s14 5 18 16H92Z" fill={`url(#${uid}-spark)`} />
          <path d="M94 64h32c-4 10-10 15-16 18-6-3-12-8-16-18Z" fill={`url(#${uid}-spark)`} opacity="0.85" />
          <circle cx="110" cy="96" r="2.2" fill={`url(#${uid}-spark)`} />
        </g>
      ) : null}

      {kind === "welcomeHero" ? (
        <g>
          {/* Floating campus card left */}
          <rect x="26" y="48" width="72" height="90" rx="18" transform="rotate(-7 26 48)" fill={`url(#${uid}-lav-soft)`} />
          <circle cx="62" cy="76" r="14" fill="#8D5524" />
          <path d="M46 112c2-9 9-14 17-14s15 5 17 14H46Z" fill={`url(#${uid}-lav)`} />
          {/* Floating campus card right */}
          <rect x="122" y="42" width="72" height="90" rx="18" transform="rotate(7 122 42)" fill={`url(#${uid}-paper)`} stroke="#D8DCF0" strokeWidth="2.5" />
          <path d="M142 66c0-10 7-17 17-17s17 7 17 17v18h-34V66Z" fill={`url(#${uid}-lav)`} />
          <circle cx="159" cy="68" r="12" fill="#B67346" />
          <rect x="138" y="96" width="42" height="7" rx="3.5" fill="#D5D7EE" />
          <rect x="144" y="109" width="30" height="6" rx="3" fill="#E4E6F4" />
          {/* Centre phone / connection pill */}
          <rect x="82" y="24" width="56" height="106" rx="18" fill={`url(#${uid}-lav)`} />
          <rect x="88" y="34" width="44" height="76" rx="12" fill={`url(#${uid}-paper)`} />
          <rect x="96" y="48" width="28" height="22" rx="8" fill={`url(#${uid}-lav-soft)`} />
          <circle cx="110" cy="59" r="5" fill={`url(#${uid}-spark)`} />
          <rect x="96" y="78" width="28" height="6" rx="3" fill="#CBD2EA" />
          <rect x="96" y="90" width="20" height="6" rx="3" fill="#DDE2F3" />
          {/* Sparks */}
          <circle cx="198" cy="40" r="5" fill={`url(#${uid}-spark)`} />
          <circle cx="24" cy="36" r="4" fill={`url(#${uid}-leaf)`} />
        </g>
      ) : null}
    </svg>
  );
}
