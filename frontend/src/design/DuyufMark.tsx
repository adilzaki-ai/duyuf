import "@fontsource/reem-kufi/500.css";
import "@fontsource/reem-kufi/600.css";
import { useId } from "react";

/**
 * Duyuf's mark. Duyuf means "guests" (Duyuf al-Rahman, the guests of God):
 * a wide pointed doorway of welcome, and inside it two golden arches, the
 * Two Holy Mosques, under a crescent. On the turquoise tile. Drawn on a
 * 64-unit grid; reads at 20 px and at 160 px.
 */
export function DuyufMark({ size = 32, title, glow }: { size?: number; title?: string; glow?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#35d0cc" />
          <stop offset="0.55" stopColor="#0d8f97" />
          <stop offset="1" stopColor="#065159" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3a3" />
          <stop offset="1" stopColor="#e3962a" />
        </linearGradient>
        <mask id={`${id}-moon`}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="34.6" cy="17.6" r="4.1" fill="#000" />
        </mask>
        {glow && (
          <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${id}-tile)`} />
      {/* a soft light across the top of the tile */}
      <path d="M8 11 Q 32 2 56 11" stroke="#ffffff" strokeOpacity=".18" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* the doorway of welcome */}
      <path d="M13 53 V31 Q13 16 32 8.5 Q51 16 51 31 V53" stroke="#ffffff" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 53 H55" stroke="#ffffff" strokeWidth="3.6" strokeLinecap="round" />
      <g filter={glow ? `url(#${id}-glow)` : undefined}>
        {/* the crescent */}
        <circle cx="32" cy="19" r="5" fill={`url(#${id}-gold)`} mask={`url(#${id}-moon)`} />
        {/* the Two Holy Mosques: two arches side by side */}
        <path d="M19.5 51 V39.5 Q19.5 32.5 25.5 29 Q31.5 32.5 31.5 39.5 V51 Z" fill={`url(#${id}-gold)`} />
        <path d="M32.5 51 V39.5 Q32.5 32.5 38.5 29 Q44.5 32.5 44.5 39.5 V51 Z" fill={`url(#${id}-gold)`} />
        {/* their doors */}
        <path d="M23.3 51 V43 Q23.3 40 25.5 38.6 Q27.7 40 27.7 43 V51 Z" fill="#065159" opacity=".55" />
        <path d="M36.3 51 V43 Q36.3 40 38.5 38.6 Q40.7 40 40.7 43 V51 Z" fill="#065159" opacity=".55" />
      </g>
    </svg>
  );
}

const ARABIC = /[\u0600-\u06ff]/;

/** The mark with the name in both scripts, for covers and sign-in. */
export function DuyufLogo({ size = 56, light, tagline }: { size?: number; light?: boolean; tagline?: string }) {
  const ink = light ? "#ffffff" : "#10292c";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.28 }}>
      <DuyufMark size={size} title="Duyuf" glow={light} />
      <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1 }} dir="ltr">
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: size * 0.18 }}>
          <span style={{ fontFamily: '"Reem Kufi", system-ui, sans-serif', fontWeight: 600, fontSize: size * 0.62, letterSpacing: "0.02em", color: ink }}>Duyuf</span>
          <span lang="ar" style={{ fontFamily: '"Reem Kufi", "IBM Plex Sans Arabic", system-ui, sans-serif', fontWeight: 500, fontSize: size * 0.56, color: "#e8a33a" }}>
            ضيوف
          </span>
        </span>
        {tagline && (
          <span
            dir="auto"
            style={{
              marginTop: size * 0.14,
              /* spaced capitals for Latin; Arabic letters must stay joined, so no spacing for it */
              fontFamily: ARABIC.test(tagline) ? '"IBM Plex Sans Arabic", system-ui, sans-serif' : '"JetBrains Mono", ui-monospace, monospace',
              fontSize: Math.max(10, size * (ARABIC.test(tagline) ? 0.24 : 0.19)),
              letterSpacing: ARABIC.test(tagline) ? 0 : "0.14em",
              textTransform: "uppercase",
              color: light ? "rgb(255 255 255 / 0.7)" : "#4c6467",
            }}
          >
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
